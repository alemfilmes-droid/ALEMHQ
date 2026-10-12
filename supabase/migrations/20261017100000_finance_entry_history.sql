-- Editar lançamentos já baixados e "Estornar baixa", com histórico de alterações (Bloco 3B).
--
-- • Quem pode: diretoria e squad financeiro — can_see_money() (a marca manual has_finance_access só VÊ).
--   A regra está nas duas funções abaixo (security definer); a tela só esconde os botões.
-- • Histórico imutável: financial_entry_history (campo a campo, antes → depois, motivo).
-- • Concorrência: "version" sobe a cada alteração; a edição manda a versão que viu e recusa se mudou.
-- • Cancelado (manual ou pelo encerramento do cliente) não se edita por aqui.
-- • Estorno limpa a baixa (inclusive settle_key): a próxima baixa funciona e continua sem duplicar.
-- • Comissão de meta (goals.payable_id / goal_contract_payouts.payable_id): valor editado acompanha;
--   o beneficiário é avisado da mudança ou do estorno.
--
-- Só adiciona: tabela, colunas (com padrão) e funções. As views *_with_status são recriadas com o
-- mesmo corpo para expor as colunas novas (r.* / pa.* são expandidos na criação). Nenhum dado muda.

create type public.finance_history_action as enum ('EDIT', 'REVERSE_WRITE_OFF');

alter table public.payables
  add column if not exists version int not null default 1,
  add column if not exists updated_by uuid references public.profiles (id) on delete set null,
  add column if not exists edited_at timestamptz;
alter table public.receivables
  add column if not exists version int not null default 1,
  add column if not exists updated_by uuid references public.profiles (id) on delete set null,
  add column if not exists edited_at timestamptz;

-- Toda alteração sobe a versão e registra quem alterou (escrita do sistema mantém o último autor).
create function public.finance_bump_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_by := coalesce(auth.uid(), old.updated_by);
  return new;
end;
$$;

create trigger payables_bump_version before update on public.payables
  for each row execute function public.finance_bump_version();
create trigger receivables_bump_version before update on public.receivables
  for each row execute function public.finance_bump_version();

-- ---------------------------------------------------------------------------
-- Histórico de alterações (imutável)
-- ---------------------------------------------------------------------------

create table public.financial_entry_history (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('payable', 'receivable')),
  entry_id uuid not null,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now(),
  action public.finance_history_action not null,
  -- { "campo": { "before": …, "after": … } }
  changes jsonb not null check (jsonb_typeof(changes) = 'object'),
  reason text check (reason is null or length(reason) <= 500)
);

create index financial_entry_history_entry_idx on public.financial_entry_history (entry_type, entry_id, changed_at desc);

create function public.financial_entry_history_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'O histórico de alterações não pode ser alterado nem apagado.' using errcode = '42501';
end;
$$;

create trigger financial_entry_history_immutable before update or delete on public.financial_entry_history
  for each row execute function public.financial_entry_history_immutable();

alter table public.financial_entry_history enable row level security;

-- Leitura: quem vê o financeiro. Escrita: só pelas funções abaixo (sem policy de insert).
create policy "financial_entry_history_select" on public.financial_entry_history for select to authenticated
  using (public.has_finance_access());

revoke all on public.financial_entry_history from anon, authenticated;
grant select on public.financial_entry_history to authenticated;

-- ---------------------------------------------------------------------------
-- Regras comuns
-- ---------------------------------------------------------------------------

-- Campos editáveis num lançamento baixado (a recorrência e o agendamento são da série/da fila, não deste
-- lançamento já pago).
create function public.finance_settled_fields(p_entry_type text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_entry_type
    when 'payable' then array[
      'description', 'category', 'is_fixed', 'company_id', 'project_id', 'payee_profile_id', 'payee_name',
      'payee_pix_key_type', 'payee_pix_key', 'payee_holder_name', 'payee_document', 'payee_bank_name',
      'payee_bank_agency', 'payee_bank_account', 'payee_account_type', 'amount', 'due_date', 'notes',
      'paid_at', 'payment_method', 'payment_receipt_url', 'late_reason', 'penalty_amount', 'penalty_reason'
    ]
    when 'receivable' then array[
      'company_id', 'project_id', 'description', 'service_description', 'competence_month', 'amount',
      'due_date', 'payment_method', 'invoice_number', 'notes', 'received_at', 'received_amount'
    ]
  end
$$;

-- Mudou valor ou data de pagamento: motivo obrigatório.
create function public.finance_reason_fields(p_entry_type text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_entry_type
    when 'payable' then array['amount', 'paid_at']
    when 'receivable' then array['amount', 'received_amount', 'received_at']
  end
$$;

-- Lê o lançamento travado para alteração e confere quem pode, cancelado, baixado e versão.
create function public.finance_lock_settled(p_entry_type text, p_entry_id uuid, p_expected_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_name text;
begin
  if not public.can_see_money() then
    raise exception 'Só a diretoria e o squad financeiro alteram lançamentos baixados.' using errcode = '42501';
  end if;

  if p_entry_type = 'payable' then
    select to_jsonb(pa) into v_row from public.payables pa where pa.id = p_entry_id for update;
  elsif p_entry_type = 'receivable' then
    select to_jsonb(x) into v_row from public.receivables x where x.id = p_entry_id for update;
  else
    raise exception 'Tipo de lançamento inválido.' using errcode = '22023';
  end if;

  if v_row is null then
    raise exception 'Lançamento não encontrado.' using errcode = 'P0002';
  end if;
  if v_row ->> 'cancelled_at' is not null then
    raise exception 'Lançamento cancelado não pode ser alterado.' using errcode = '42501';
  end if;
  if v_row ->> (case p_entry_type when 'payable' then 'paid_at' else 'received_at' end) is null then
    raise exception 'Este lançamento não está baixado.' using errcode = '22023';
  end if;
  if (v_row ->> 'version')::int <> p_expected_version then
    select p.full_name into v_name from public.profiles p where p.id = (v_row ->> 'updated_by')::uuid;
    raise exception 'Este lançamento foi alterado por % agora há pouco. Recarregue para ver a versão atual.',
      coalesce(nullif(btrim(v_name), ''), 'outra pessoa') using errcode = 'HQ409';
  end if;
  return v_row;
end;
$$;

-- Diferença campo a campo entre duas versões, só nos campos pedidos.
create function public.finance_diff(p_before jsonb, p_after jsonb, p_fields text[])
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(f, jsonb_build_object('before', p_before -> f, 'after', p_after -> f)), '{}'::jsonb)
  from unnest(p_fields) as f
  where (p_before -> f) is distinct from (p_after -> f)
$$;

-- Comissão de meta paga por este lançamento: valor acompanha a edição e o beneficiário é avisado.
create function public.finance_sync_commission(p_payable_id uuid, p_changes jsonb, p_reversed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pa public.payables%rowtype;
  v_prev text := current_setting('alem.goal_approving', true);
begin
  if not exists (select 1 from public.goals g where g.payable_id = p_payable_id)
     and not exists (select 1 from public.goal_contract_payouts c where c.payable_id = p_payable_id) then
    return;
  end if;
  select * into v_pa from public.payables where id = p_payable_id;

  if p_changes ? 'amount' then
    -- Meta aprovada é travada (goals_guard): a liberação é a mesma da aprovação, só nesta transação.
    perform set_config('alem.goal_approving', 'on', true);
    update public.goals set final_commission = v_pa.amount where payable_id = p_payable_id;
    perform set_config('alem.goal_approving', coalesce(v_prev, ''), true);
    update public.goal_contract_payouts set amount = v_pa.amount where payable_id = p_payable_id;
  end if;

  if v_pa.payee_profile_id is null then
    return;
  end if;
  if p_reversed then
    perform public.notify(v_pa.payee_profile_id, 'finance_commission_updated', 'Pagamento da comissão estornado',
      'O pagamento de ' || public.fmt_brl(v_pa.amount) || ' voltou a ficar em aberto. O financeiro vai registrar de novo.',
      'payable', p_payable_id, '/metas');
  elsif p_changes ?| array['amount', 'paid_at'] then
    perform public.notify(v_pa.payee_profile_id, 'finance_commission_updated', 'Comissão atualizada',
      'Sua comissão de ' || public.fmt_brl(v_pa.amount) || ' foi paga em ' || to_char(v_pa.paid_at, 'DD/MM') || '.',
      'payable', p_payable_id, '/metas');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Editar lançamento baixado
-- ---------------------------------------------------------------------------

create function public.finance_edit_settled(
  p_entry_type text,
  p_entry_id uuid,
  p_expected_version int,
  p_patch jsonb,
  p_reason text default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := public.finance_lock_settled(p_entry_type, p_entry_id, p_expected_version);
  v_fields text[] := public.finance_settled_fields(p_entry_type);
  v_merged jsonb;
  v_changes jsonb;
  v_new jsonb;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_pa public.payables;
  v_x public.receivables;
  v_version int;
begin
  -- Só os campos editáveis entram; o resto do pedido é ignorado.
  select v_old || coalesce(jsonb_object_agg(k, p_patch -> k), '{}'::jsonb) into v_merged
  from jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) as k
  where k = any (v_fields);

  v_changes := public.finance_diff(v_old, v_merged, v_fields);
  if v_changes = '{}'::jsonb then
    return (v_old ->> 'version')::int;
  end if;
  if v_changes ?| public.finance_reason_fields(p_entry_type) and v_reason is null then
    raise exception 'Informe o motivo: o valor ou a data de pagamento mudou.' using errcode = '22023';
  end if;

  perform set_config('alem.finance_settled_edit', 'on', true);
  if p_entry_type = 'payable' then
    v_pa := jsonb_populate_record(null::public.payables, v_merged);
    if v_pa.paid_at > v_pa.due_date and nullif(btrim(coalesce(v_pa.late_reason, '')), '') is null then
      raise exception 'Pagamento depois do vencimento: informe o motivo do atraso.' using errcode = '22023';
    end if;
    update public.payables set
      description = v_pa.description, category = v_pa.category, is_fixed = v_pa.is_fixed,
      company_id = v_pa.company_id, project_id = v_pa.project_id,
      payee_profile_id = v_pa.payee_profile_id, payee_name = v_pa.payee_name,
      payee_pix_key_type = v_pa.payee_pix_key_type, payee_pix_key = v_pa.payee_pix_key,
      payee_holder_name = v_pa.payee_holder_name, payee_document = v_pa.payee_document,
      payee_bank_name = v_pa.payee_bank_name, payee_bank_agency = v_pa.payee_bank_agency,
      payee_bank_account = v_pa.payee_bank_account, payee_account_type = v_pa.payee_account_type,
      amount = v_pa.amount, due_date = v_pa.due_date, notes = v_pa.notes,
      paid_at = v_pa.paid_at, payment_method = v_pa.payment_method, payment_receipt_url = v_pa.payment_receipt_url,
      paid_late = v_pa.paid_at > v_pa.due_date,
      late_reason = case when v_pa.paid_at > v_pa.due_date then v_pa.late_reason end,
      penalty_amount = v_pa.penalty_amount, penalty_reason = v_pa.penalty_reason,
      edited_at = now()
    where id = p_entry_id
    returning to_jsonb(payables.*), version into v_new, v_version;
  else
    v_x := jsonb_populate_record(null::public.receivables, v_merged);
    update public.receivables set
      company_id = v_x.company_id, project_id = v_x.project_id, description = v_x.description,
      service_description = v_x.service_description, competence_month = v_x.competence_month,
      amount = v_x.amount, due_date = v_x.due_date, payment_method = v_x.payment_method,
      invoice_number = v_x.invoice_number, notes = v_x.notes,
      received_at = v_x.received_at, received_amount = v_x.received_amount,
      edited_at = now()
    where id = p_entry_id
    returning to_jsonb(receivables.*), version into v_new, v_version;
  end if;

  perform set_config('alem.finance_settled_edit', 'off', true);

  -- O histórico registra o que ficou gravado (ex.: motivo do atraso limpo ao deixar de ser atrasado).
  v_changes := public.finance_diff(v_old, v_new, v_fields);
  insert into public.financial_entry_history (entry_type, entry_id, changed_by, action, changes, reason)
  values (p_entry_type, p_entry_id, auth.uid(), 'EDIT', v_changes, v_reason);

  if p_entry_type = 'payable' then
    perform public.finance_sync_commission(p_entry_id, v_changes, false);
  end if;
  return v_version;
end;
$$;

-- Nota fiscal anexada/trocada num recebimento já recebido (ação "Anexar nota fiscal", fora da edição):
-- também entra no histórico, para nada mudar sem registro depois da baixa.
create function public.receivables_history_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.received_at is null or current_setting('alem.finance_settled_edit', true) = 'on' then
    return new;
  end if;
  new.edited_at := now();
  insert into public.financial_entry_history (entry_type, entry_id, changed_by, action, changes, reason)
  values ('receivable', new.id, auth.uid(), 'EDIT',
    public.finance_diff(to_jsonb(old), to_jsonb(new), array['invoice_number', 'invoice_file_path']), null);
  return new;
end;
$$;

create trigger receivables_history_invoice before update of invoice_number, invoice_file_path on public.receivables
  for each row
  when (old.invoice_number is distinct from new.invoice_number or old.invoice_file_path is distinct from new.invoice_file_path)
  execute function public.receivables_history_invoice();

-- ---------------------------------------------------------------------------
-- Estornar baixa: volta a ficar em aberto; a baixa antiga fica no histórico.
-- ---------------------------------------------------------------------------

create function public.finance_reverse_settlement(
  p_entry_type text,
  p_entry_id uuid,
  p_expected_version int,
  p_reason text
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := public.finance_lock_settled(p_entry_type, p_entry_id, p_expected_version);
  v_new jsonb;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_fields text[];
  v_version int;
begin
  if v_reason is null then
    raise exception 'Informe o motivo do estorno.' using errcode = '22023';
  end if;

  if p_entry_type = 'payable' then
    -- payables_settlement_guard desfaz atraso e multa e devolve o valor original.
    update public.payables
    set paid_at = null, payment_receipt_url = null, settle_key = null, edited_at = now()
    where id = p_entry_id
    returning to_jsonb(payables.*), version into v_new, v_version;
    v_fields := array['paid_at', 'payment_receipt_url', 'paid_late', 'late_reason', 'amount', 'original_amount', 'penalty_amount', 'penalty_reason'];
  else
    update public.receivables
    set received_at = null, received_amount = null, settle_key = null, edited_at = now()
    where id = p_entry_id
    returning to_jsonb(receivables.*), version into v_new, v_version;
    v_fields := array['received_at', 'received_amount'];
  end if;

  insert into public.financial_entry_history (entry_type, entry_id, changed_by, action, changes, reason)
  values (p_entry_type, p_entry_id, auth.uid(), 'REVERSE_WRITE_OFF', public.finance_diff(v_old, v_new, v_fields), v_reason);

  if p_entry_type = 'payable' then
    perform public.finance_sync_commission(p_entry_id, '{}'::jsonb, true);
  end if;
  return v_version;
end;
$$;

revoke all on function public.finance_lock_settled(text, uuid, int) from public, anon, authenticated;
revoke all on function public.finance_sync_commission(uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.finance_edit_settled(text, uuid, int, jsonb, text) from public, anon;
revoke all on function public.finance_reverse_settlement(text, uuid, int, text) from public, anon;
grant execute on function public.finance_edit_settled(text, uuid, int, jsonb, text) to authenticated;
grant execute on function public.finance_reverse_settlement(text, uuid, int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Views: mesmo corpo de antes, agora com version / updated_by / edited_at.
-- ---------------------------------------------------------------------------

drop view if exists public.receivables_with_status;
create view public.receivables_with_status
with (security_invoker = true) as
select
  r.*,
  c.name as company_name,
  p.name as project_name,
  case
    when r.cancelled_at is not null then 'cancelado'
    when r.received_at is not null then 'recebido'
    when r.due_date < (now() at time zone 'America/Fortaleza')::date then 'atrasado'
    else 'pendente'
  end as status
from public.receivables r
left join public.companies c on c.id = r.company_id
left join public.projects p on p.id = r.project_id;

revoke all on public.receivables_with_status from anon;
grant select on public.receivables_with_status to authenticated;

drop view if exists public.payables_with_status;
create view public.payables_with_status
with (security_invoker = true) as
select
  pa.*,
  p.name as project_name,
  coalesce(nullif(btrim(pa.payee_name), ''), pr.full_name) as payee_label,
  case
    when pa.cancelled_at is not null then 'cancelado'
    when pa.paid_at is not null then 'pago'
    when pa.due_date < (now() at time zone 'America/Fortaleza')::date then 'atrasado'
    else 'pendente'
  end as status
from public.payables pa
left join public.projects p on p.id = pa.project_id
left join public.profiles pr on pr.id = pa.payee_profile_id;

revoke all on public.payables_with_status from anon;
grant select on public.payables_with_status to authenticated;

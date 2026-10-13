-- "Equipe e colaboradores" (pedido do Anderson, 12/10/2026).
--
-- • A categoria `pessoal` passa a se chamar "Equipe e colaboradores" na tela (o valor no banco é o mesmo).
-- • Tipo do pagamento à equipe (team_payment_type): Pró-labore, Comissão ou Pagamento a colaborador.
-- • Marcas novas: is_pro_labore ("Pró-labore") e is_reimbursement ("Reembolso de despesa").
-- • Regra única (payable_team_rule; os mesmos casos de lib/finance/team-category-cases.json), aplicada por gatilho
--   ao criar e ao EDITAR a categoria/favorecido/marcas (dar baixa não mexe na categoria):
--   pró-labore → Equipe · Pró-labore; reembolso → Outro; favorecido do HQ → Equipe · Comissão ou Pagamento a
--   colaborador; o resto é livre. Cada troca automática vai para o histórico do lançamento com o motivo
--   "Categorização automática: equipe e colaboradores".
-- • Reembolso ligado a um cliente ou projeto não entra nos custos da empresa (cost_scope = projeto).
-- • A comissão passa a ser reconhecida pelo tipo (antes, pela categoria "Comissão"): avisos e comemoração iguais.
-- • Lançamentos que já existem NÃO mudam aqui: a recategorização é uma migração à parte, depois da confirmação.
--
-- Só adiciona tipo, colunas (com padrão/nulas) e funções; recria finance_edit_settled e finance_settled_fields
-- com o mesmo corpo + os campos novos, payables_commission_events com o tipo e a view payables_with_status.

create type public.team_payment_type as enum ('pro_labore', 'comissao', 'pagamento_colaborador');

alter table public.payables
  add column if not exists team_payment_type public.team_payment_type,
  add column if not exists is_pro_labore boolean not null default false,
  add column if not exists is_reimbursement boolean not null default false;

comment on column public.payables.team_payment_type is 'Equipe e colaboradores: Pró-labore, Comissão ou Pagamento a colaborador (nulo nas outras categorias).';

-- ---------------------------------------------------------------------------
-- Regra única
-- ---------------------------------------------------------------------------

create function public.payable_team_rule(
  p_category public.payable_category,
  p_payee_is_member boolean,
  p_is_pro_labore boolean,
  p_is_reimbursement boolean,
  p_type public.team_payment_type,
  p_has_commission_goal boolean
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_is_pro_labore or p_category = 'pro_labore' then
      jsonb_build_object('category', 'pessoal', 'type', 'pro_labore', 'lock', 'pro_labore')
    when p_is_reimbursement then
      jsonb_build_object('category', 'outro', 'type', null, 'lock', 'reembolso')
    when p_payee_is_member or p_category in ('pessoal', 'comissao') then
      jsonb_build_object(
        'category', 'pessoal',
        'type', case when p_type = 'comissao' or p_category = 'comissao' or p_has_commission_goal then 'comissao' else 'pagamento_colaborador' end,
        'lock', case when p_payee_is_member then 'equipe' end)
    else
      jsonb_build_object('category', p_category, 'type', null, 'lock', null)
  end
$$;

create function public.payables_team_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule jsonb;
  v_category public.payable_category;
  v_type public.team_payment_type;
  v_changes jsonb := '{}'::jsonb;
begin
  -- Edição que não mexe em categoria, favorecido nem marcas (ex.: dar baixa): nada muda.
  if tg_op = 'UPDATE'
     and new.category is not distinct from old.category
     and new.payee_profile_id is not distinct from old.payee_profile_id
     and new.is_pro_labore is not distinct from old.is_pro_labore
     and new.is_reimbursement is not distinct from old.is_reimbursement
     and new.team_payment_type is not distinct from old.team_payment_type
     and new.commission_goal_id is not distinct from old.commission_goal_id
     and new.company_id is not distinct from old.company_id
     and new.project_id is not distinct from old.project_id then
    return new;
  end if;

  v_rule := public.payable_team_rule(new.category, new.payee_profile_id is not null, new.is_pro_labore, new.is_reimbursement,
    new.team_payment_type, new.commission_goal_id is not null);
  v_category := (v_rule ->> 'category')::public.payable_category;
  v_type := (v_rule ->> 'type')::public.team_payment_type;

  if v_category is distinct from new.category then
    v_changes := v_changes || jsonb_build_object('category', jsonb_build_object('before', new.category, 'after', v_category));
  end if;
  if v_type is distinct from new.team_payment_type then
    v_changes := v_changes || jsonb_build_object('team_payment_type', jsonb_build_object('before', new.team_payment_type, 'after', v_type));
  end if;

  new.category := v_category;
  new.team_payment_type := v_type;
  new.is_pro_labore := coalesce(v_type = 'pro_labore', false);
  if new.is_pro_labore then
    new.is_reimbursement := false;
  end if;
  -- Reembolso ligado a cliente ou projeto não é custo da empresa.
  new.cost_scope := case when new.project_id is not null or (new.is_reimbursement and new.company_id is not null)
    then 'projeto'::public.cost_scope else 'empresa'::public.cost_scope end;

  if v_changes <> '{}'::jsonb then
    insert into public.financial_entry_history (entry_type, entry_id, changed_by, action, changes, reason)
    values ('payable', new.id, auth.uid(), 'EDIT', v_changes, 'Categorização automática: equipe e colaboradores');
  end if;
  return new;
end;
$$;

-- Depois de payables_sync_cost_scope (ordem alfabética dos gatilhos BEFORE): o escopo do reembolso vale.
create trigger payables_team_category before insert or update on public.payables
  for each row execute function public.payables_team_category();

-- ---------------------------------------------------------------------------
-- Comissão: reconhecida pelo tipo (os pagamentos novos de comissão ficam em Equipe · Comissão)
-- ---------------------------------------------------------------------------

create or replace function public.payables_commission_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_goal public.goals%rowtype;
  v_when date;
begin
  if new.team_payment_type is distinct from 'comissao' or new.payee_profile_id is null or new.cancelled_at is not null then
    return null;
  end if;
  if new.commission_goal_id is not null then
    select * into v_goal from public.goals where id = new.commission_goal_id;
  end if;

  if tg_op = 'INSERT' or new.scheduled_for is distinct from old.scheduled_for then
    v_when := coalesce(new.scheduled_for, new.due_date);
    perform public.notify(new.payee_profile_id, 'commission_scheduled', 'Comissão agendada',
      'Sua comissão de ' || public.fmt_brl(new.amount) || ' será paga em ' || to_char(v_when, 'DD/MM') || '.'
        || coalesce(' Meta: ' || v_goal.title || '.', ''),
      'payable', new.id, coalesce('/metas/' || new.commission_goal_id, '/metas'));
  end if;

  if tg_op = 'UPDATE' and new.paid_at is not null and old.paid_at is null then
    perform public.notify(new.payee_profile_id, 'commission_paid', 'Comissão paga',
      'Sua comissão de ' || public.fmt_brl(new.amount) || ' foi paga.', 'payable', new.id, coalesce('/metas/' || new.commission_goal_id, '/metas'));
  end if;

  -- Comemoração: comissão nova para a pessoa (a de meta batida já foi comemorada na finalização).
  if tg_op = 'INSERT' and new.amount > 0 and not exists (
    select 1 from public.commission_celebrations c where c.goal_id = new.commission_goal_id and new.commission_goal_id is not null
  ) then
    insert into public.commission_celebrations (profile_id, amount, goal_id, payable_id, goal_title)
    values (new.payee_profile_id, new.amount, new.commission_goal_id, new.id, v_goal.title)
    on conflict do nothing;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Editar lançamento já baixado: os campos novos também (mesmo corpo de antes)
-- ---------------------------------------------------------------------------

create or replace function public.finance_settled_fields(p_entry_type text)
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
      'paid_at', 'payment_method', 'payment_receipt_url', 'late_reason', 'penalty_amount', 'penalty_reason',
      'team_payment_type', 'is_pro_labore', 'is_reimbursement'
    ]
    when 'receivable' then array[
      'company_id', 'project_id', 'description', 'service_description', 'competence_month', 'amount',
      'due_date', 'payment_method', 'invoice_number', 'notes', 'received_at', 'received_amount'
    ]
  end
$$;

create or replace function public.finance_edit_settled(
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
      team_payment_type = v_pa.team_payment_type, is_pro_labore = v_pa.is_pro_labore, is_reimbursement = v_pa.is_reimbursement,
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

-- ---------------------------------------------------------------------------
-- payables_with_status: mesmo corpo (pa.* é expandido na criação; agora com os campos novos)
-- ---------------------------------------------------------------------------

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

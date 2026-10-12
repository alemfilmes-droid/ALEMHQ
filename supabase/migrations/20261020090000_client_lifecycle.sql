-- Bloco 6 — Ciclo de vida do cliente (pedido do Anderson).
--
-- Status do cliente inativo (coluna "Inativos" em Clientes): sai do último encerramento em aberto do
-- cliente (client_closures sem reopened_at): churn → Churn; pausa_temporaria → Pausado; fim de contrato,
-- projeto concluído e outro → Encerrado. Nenhum dado existente muda.
--
-- • Encerrar (Churn/Encerrado), fluxo guiado — client_close():
--   projetos ativos → encerrado; pautas abertas (dos projetos e as diretas do cliente) → finalizadas;
--   recebimentos/pagamentos EM ABERTO que não foram marcados como "continuam valendo" → cancelados
--   (status, nunca apagados) com motivo "Encerramento do cliente", quem e quando; os pagos nunca mudam;
--   lançamentos manuais informados no encerramento são criados no Financeiro.
-- • Pausar — client_pause(): projetos ativos → pausado (guardando a etapa); pautas abertas → pausadas
--   (arquivadas com a marca do encerramento); financeiro não muda.
-- • Reativar — client_reactivate(): volta a cliente; se estava pausado, pode reativar projetos e pautas.
-- • Regra fixa: cliente inativo não ganha projeto nem pauta nova (até reativar). Negócios do CRM
--   ("Reabrir prospecção") e tarefas automáticas do financeiro continuam permitidos.
-- • Cliente da casa: continua para Encerrado; não para Churn; entrada pendente é cancelada no churn.
--
-- Só adiciona colunas (nulas) e cria/substitui funções e gatilhos.

alter table public.receivables
  add column if not exists cancelled_by uuid references public.profiles (id) on delete set null,
  add column if not exists cancel_reason text check (cancel_reason is null or length(cancel_reason) <= 300);
alter table public.payables
  add column if not exists cancelled_by uuid references public.profiles (id) on delete set null,
  add column if not exists cancel_reason text check (cancel_reason is null or length(cancel_reason) <= 300);

alter table public.projects
  add column if not exists paused_from_stage public.project_stage,
  add column if not exists paused_closure_id uuid references public.client_closures (id) on delete set null;
alter table public.pautas add column if not exists paused_closure_id uuid references public.client_closures (id) on delete set null;
alter table public.prospect_house_entries add column if not exists cancelled_at timestamptz;

-- ---------------------------------------------------------------------------
-- Status do inativo
-- ---------------------------------------------------------------------------

create function public.client_inactive_status(p_reason public.closure_reason)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_reason when 'churn' then 'churn' when 'pausa_temporaria' then 'pausado' else 'encerrado' end
$$;

-- Encerramento em aberto do cliente inteiro (o mais recente sem reabertura).
create function public.client_open_closure(p_company_id uuid)
returns public.client_closures
language sql
stable
security definer
set search_path = ''
as $$
  select cc.* from public.client_closures cc
  where cc.company_id = p_company_id and cc.project_id is null and cc.reopened_at is null
  order by cc.created_at desc limit 1
$$;

revoke all on function public.client_open_closure(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Regra fixa: cliente inativo não ganha projeto nem pauta nova
-- ---------------------------------------------------------------------------

create function public.client_is_inactive(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.companies c where c.id = p_company_id and c.lifecycle = 'former_client')
$$;

create function public.projects_block_inactive_client()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Projeto que nasce de um negócio ganho no CRM (reabrir prospecção) reativa o cliente
  -- (projects_promote_prospect) em vez de ser barrado.
  if not new.is_internal and new.deal_id is null and new.company_id is not null and public.client_is_inactive(new.company_id) then
    raise exception 'Este cliente está inativo (churn, pausado ou encerrado). Reative o cliente antes de criar um projeto.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger projects_block_inactive_client
  before insert on public.projects
  for each row execute function public.projects_block_inactive_client();

create function public.pautas_block_inactive_client()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_company uuid;
begin
  -- Negócio do CRM (reabrir prospecção) e tarefas automáticas do financeiro continuam; tarefa pessoal também.
  if new.source <> 'manual' or new.is_standalone then
    return new;
  end if;
  v_company := coalesce((select pr.company_id from public.projects pr where pr.id = new.project_id), new.direct_company_id);
  if v_company is not null and public.client_is_inactive(v_company) then
    raise exception 'Este cliente está inativo (churn, pausado ou encerrado). Reative o cliente antes de criar uma pauta.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger pautas_block_inactive_client
  before insert on public.pautas
  for each row execute function public.pautas_block_inactive_client();

-- ---------------------------------------------------------------------------
-- Cliente da casa: nunca para Churn
-- ---------------------------------------------------------------------------

create or replace function public.prospect_house_entry_on_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.delivered_at is null or new.company_id is null or new.is_internal then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.delivered_at is not null then
    return new;
  end if;
  -- Churn não vira cliente da casa (Encerrado continua virando).
  if (public.client_open_closure(new.company_id)).reason = 'churn' then
    return new;
  end if;
  -- Nunca trava a entrega do projeto: qualquer falha aqui vira só um aviso no log do banco.
  begin
    insert into public.prospect_house_entries (project_id, company_id, project_name, delivered_at, origin_deal_id)
    values (
      new.id, new.company_id, new.name, new.delivered_at,
      coalesce(
        new.deal_id,
        (select d.id from public.deals d where d.company_id = new.company_id and d.stage = 'ganho' order by d.won_at desc nulls last limit 1)
      )
    )
    on conflict (project_id) do nothing;
  exception when others then
    raise warning 'cliente da casa: entrega do projeto % não registrada (%)', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- Churn: entradas pendentes canceladas e o retorno "cliente da casa" que ainda não começou é descartado.
create function public.client_cancel_house_reentry(p_company_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  update public.prospect_house_entries set cancelled_at = now()
  where company_id = p_company_id and deal_id is null and cancelled_at is null;
  get diagnostics v_count = row_count;

  update public.deals d
  set prospect_discarded_at = now(), prospect_discard_reason = 'Cliente encerrado por churn: retorno de cliente da casa cancelado.'
  where d.company_id = p_company_id
    and d.prospect_house_return_on is not null
    and d.prospect_discarded_at is null
    and d.archived_at is null
    and d.stage in ('prospeccao', 'primeiro_contato', 'tentativas_contato')
    and not exists (select 1 from public.prospect_touch_logs t where t.deal_id = d.id and t.deleted_at is null);
  return v_count;
end;
$$;

revoke all on function public.client_cancel_house_reentry(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Prévia: inclui as pautas diretas do cliente (sem projeto)
-- ---------------------------------------------------------------------------

create or replace function public.client_closure_preview(p_company_id uuid, p_project_id uuid default null, p_closed_at date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_finance boolean := public.has_finance_access();
  v_date date := coalesce(p_closed_at, (now() at time zone 'America/Fortaleza')::date);
  c public.companies;
  v_projects uuid[];
  v_result jsonb;
begin
  if not public.can_close_clients() then
    raise exception 'Só diretoria e master encerram clientes e projetos.' using errcode = '42501';
  end if;
  select * into c from public.companies where id = p_company_id;
  if not found then
    raise exception 'Cliente não encontrado.' using errcode = '22023';
  end if;
  v_projects := array(select public.closure_target_projects(p_company_id, p_project_id));

  select jsonb_build_object(
    'finance_visible', v_finance,
    'company', jsonb_build_object('id', c.id, 'name', c.name, 'lifecycle', c.lifecycle, 'health', c.health),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.name, 'stage', pr.stage, 'model', pr.model) order by pr.name)
      from public.projects pr where pr.id = any (v_projects)
    ), '[]'::jsonb),
    'pautas', coalesce((
      select jsonb_agg(jsonb_build_object('id', pt.id, 'title', pt.title, 'assignee', a.full_name, 'status', pt.status, 'squad', pt.squad) order by pt.due_date nulls last)
      from public.pautas pt
      left join public.profiles a on a.id = pt.current_assignee_id
      where pt.archived_at is null and pt.status <> 'aprovado' and pt.source = 'manual' and not pt.is_standalone
        and (pt.project_id = any (v_projects) or (p_project_id is null and pt.project_id is null and pt.direct_company_id = p_company_id))
    ), '[]'::jsonb),
    'receivables', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'description', r.description, 'due_date', r.due_date, 'project', pr.name,
        'amount', case when v_finance then r.amount end,
        'overdue', r.due_date < v_date
      ) order by r.due_date)
      from public.receivables r
      left join public.projects pr on pr.id = r.project_id
      where r.cancelled_at is null and r.received_at is null
        and (case when p_project_id is null then r.company_id = p_company_id else r.project_id = p_project_id end)
    ), '[]'::jsonb),
    'payables', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pa.id, 'description', pa.description, 'due_date', pa.due_date, 'project', pr.name,
        'payee', coalesce(nullif(btrim(pa.payee_name), ''), pp.full_name),
        'amount', case when v_finance then pa.amount end,
        'overdue', pa.due_date < v_date,
        'scheduled', pa.scheduled_at is not null
      ) order by pa.due_date)
      from public.payables pa
      left join public.projects pr on pr.id = pa.project_id
      left join public.profiles pp on pp.id = pa.payee_profile_id
      where pa.cancelled_at is null and pa.paid_at is null
        and (case when p_project_id is null
               then pa.company_id = p_company_id or pa.project_id in (select x.id from public.projects x where x.company_id = p_company_id)
               else pa.project_id = p_project_id end)
    ), '[]'::jsonb),
    'invoice_schedules', (
      select count(*)::int from public.project_invoice_schedules s where s.project_id = any (v_projects) and s.active
    ),
    'open_deals', (
      select count(*)::int from public.deals d where d.company_id = p_company_id and d.archived_at is null and d.stage not in ('ganho', 'perdido')
    ),
    'active_closure', (
      select jsonb_build_object('id', cc.id, 'reason', cc.reason, 'closed_at', cc.closed_at)
      from public.client_closures cc
      where cc.company_id = p_company_id and cc.project_id is null and cc.reopened_at is null
      order by cc.created_at desc limit 1
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Encerrar cliente (Churn ou Encerrado): fluxo guiado
-- ---------------------------------------------------------------------------

create function public.client_close(
  p_company_id uuid,
  p_reason public.closure_reason,
  p_description text,
  p_closed_at date,
  p_keep_receivable_ids uuid[],
  p_keep_payable_ids uuid[],
  p_manual_receivables jsonb,
  p_manual_payables jsonb,
  p_potential public.prospect_potential,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.companies;
  v_id uuid;
  v_projects uuid[];
  v_label text := public.closure_reason_label(p_reason);
  v_pauta_label text := 'Encerrado — ' || lower(public.closure_reason_label(p_reason));
  v_stamp text := to_char(p_closed_at, 'DD/MM/YYYY');
  v_cancel_reason text := 'Encerramento do cliente (' || v_label || ', ' || to_char(p_closed_at, 'DD/MM/YYYY') || ')';
  v_keep_r uuid[] := coalesce(p_keep_receivable_ids, '{}');
  v_keep_p uuid[] := coalesce(p_keep_payable_ids, '{}');
  v_manual_r jsonb := coalesce(p_manual_receivables, '[]'::jsonb);
  v_manual_p jsonb := coalesce(p_manual_payables, '[]'::jsonb);
  v_prev_system text := current_setting('app.pauta_system', true);
  v_health public.client_health;
  v_pautas int := 0;
  v_r_cancel int := 0;
  v_r_keep int := 0;
  v_p_cancel int := 0;
  v_p_keep int := 0;
  v_r_manual int := 0;
  v_p_manual int := 0;
  v_schedules int := 0;
  v_house int := 0;
  v_recipient uuid;
  r record;
begin
  if not public.can_close_clients() then
    raise exception 'Só diretoria e master encerram clientes.' using errcode = '42501';
  end if;
  if p_reason = 'pausa_temporaria' then
    raise exception 'Para pausar o cliente, use "Pausar cliente".' using errcode = '22023';
  end if;
  if btrim(coalesce(p_description, '')) = '' then
    raise exception 'Explique o que aconteceu.' using errcode = '23514';
  end if;
  if p_closed_at is null then
    raise exception 'Informe a data do encerramento.' using errcode = '23514';
  end if;
  if p_potential is null then
    raise exception 'Informe o potencial de prospecção futura.' using errcode = '23514';
  end if;
  if jsonb_typeof(v_manual_r) <> 'array' or jsonb_typeof(v_manual_p) <> 'array' then
    raise exception 'Lançamentos manuais inválidos.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(v_manual_r) as m(description text, amount numeric, due_date date)
    where nullif(btrim(coalesce(m.description, '')), '') is null or m.amount is null or m.amount <= 0 or m.due_date is null
  ) or exists (
    select 1 from jsonb_to_recordset(v_manual_p) as m(description text, amount numeric, due_date date, payee_name text)
    where nullif(btrim(coalesce(m.description, '')), '') is null or m.amount is null or m.amount <= 0 or m.due_date is null
      or nullif(btrim(coalesce(m.payee_name, '')), '') is null
  ) then
    raise exception 'Cada lançamento manual precisa de descrição, valor maior que zero e vencimento (custos: também o favorecido).' using errcode = '22023';
  end if;

  select * into c from public.companies where id = p_company_id for update;
  if not found then
    raise exception 'Cliente não encontrado.' using errcode = '22023';
  end if;
  if c.lifecycle <> 'client' then
    raise exception 'Só um cliente ativo pode ser encerrado.' using errcode = '23514';
  end if;

  v_projects := array(select public.closure_target_projects(p_company_id, null));

  insert into public.client_closures (
    company_id, project_id, reason, description, closed_at,
    has_pending_receivables, has_pending_payables, notes, future_prospect_potential, closed_by
  ) values (
    p_company_id, null, p_reason, btrim(p_description), p_closed_at,
    cardinality(v_keep_r) > 0 or jsonb_array_length(v_manual_r) > 0,
    cardinality(v_keep_p) > 0 or jsonb_array_length(v_manual_p) > 0,
    nullif(btrim(coalesce(p_notes, '')), ''), p_potential, auth.uid()
  )
  returning id into v_id;

  -- Projetos → encerrado.
  update public.projects set stage = 'encerrado', closed_at = now(), closure_id = v_id where id = any (v_projects);

  -- Pautas abertas (dos projetos e as diretas do cliente) → coluna final, marcadas; responsáveis avisados.
  perform set_config('app.pauta_system', 'true', true);
  for r in
    select pt.id, pt.title, pt.lead_id, pt.current_assignee_id
    from public.pautas pt
    where pt.archived_at is null and pt.status <> 'aprovado' and pt.source = 'manual' and not pt.is_standalone
      and (pt.project_id = any (v_projects) or (pt.project_id is null and pt.direct_company_id = p_company_id))
  loop
    update public.pautas set status = 'aprovado', closure_label = v_pauta_label where id = r.id;
    insert into public.pauta_logs (pauta_id, author_id, kind, body)
    values (r.id, auth.uid(), 'registro', v_pauta_label || ' em ' || v_stamp || '. ' || btrim(p_description));
    foreach v_recipient in array array[r.current_assignee_id, r.lead_id] loop
      if v_recipient is not null and v_recipient is distinct from auth.uid() then
        perform public.notify(v_recipient, 'pauta_closed', 'Pauta encerrada: não siga com ela',
          r.title || ' · ' || v_pauta_label, 'pauta', r.id, '/minhas-pautas?pauta=' || r.id);
      end if;
      exit when r.current_assignee_id is not distinct from r.lead_id;
    end loop;
    v_pautas := v_pautas + 1;
  end loop;
  perform set_config('app.pauta_system', coalesce(v_prev_system, ''), true);

  -- Recebimentos em aberto: os marcados continuam; os demais são cancelados (status). Recebidos não mudam.
  update public.receivables x
  set cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = v_cancel_reason
  where x.company_id = p_company_id and x.cancelled_at is null and x.received_at is null and not (x.id = any (v_keep_r));
  get diagnostics v_r_cancel = row_count;
  select count(*) into v_r_keep from public.receivables x
  where x.company_id = p_company_id and x.cancelled_at is null and x.received_at is null and x.id = any (v_keep_r);

  -- Pagamentos em aberto do cliente (diretos ou dos projetos): mesma regra. Pagos não mudam.
  update public.payables pa
  set cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = v_cancel_reason
  where pa.cancelled_at is null and pa.paid_at is null and not (pa.id = any (v_keep_p))
    and (pa.company_id = p_company_id or pa.project_id in (select x.id from public.projects x where x.company_id = p_company_id));
  get diagnostics v_p_cancel = row_count;
  select count(*) into v_p_keep from public.payables pa
  where pa.cancelled_at is null and pa.paid_at is null and pa.id = any (v_keep_p)
    and (pa.company_id = p_company_id or pa.project_id in (select x.id from public.projects x where x.company_id = p_company_id));

  -- Lançamentos manuais do encerramento → Financeiro.
  insert into public.receivables (company_id, description, amount, due_date, notes)
  select p_company_id, btrim(m.description), m.amount, m.due_date, 'Lançado no encerramento do cliente (' || v_stamp || ').'
  from jsonb_to_recordset(v_manual_r) as m(description text, amount numeric, due_date date);
  get diagnostics v_r_manual = row_count;

  insert into public.payables (company_id, description, amount, due_date, payee_name, category, notes)
  select p_company_id, btrim(m.description), m.amount, m.due_date, btrim(m.payee_name), 'outro', 'Lançado no encerramento do cliente (' || v_stamp || ').'
  from jsonb_to_recordset(v_manual_p) as m(description text, amount numeric, due_date date, payee_name text);
  get diagnostics v_p_manual = row_count;

  update public.project_invoice_schedules set active = false where project_id = any (v_projects) and active;
  get diagnostics v_schedules = row_count;

  if p_reason = 'churn' then
    v_house := public.client_cancel_house_reentry(p_company_id);
  end if;

  v_health := public.closure_health(p_reason, c.health);
  update public.companies
  set lifecycle = 'former_client',
      health = v_health,
      health_note = case when v_health is distinct from c.health then 'Encerrado: ' || v_label || '. ' || left(btrim(p_description), 200) else health_note end
  where id = p_company_id;

  update public.client_closures
  set summary = jsonb_build_object(
    'projects', coalesce(array_length(v_projects, 1), 0),
    'pautas', v_pautas,
    'receivables_cancelled', v_r_cancel,
    'receivables_kept', v_r_keep,
    'receivables_manual', v_r_manual,
    'payables_cancelled', v_p_cancel,
    'payables_kept', v_p_keep,
    'payables_manual', v_p_manual,
    'invoice_schedules', v_schedules,
    'house_entries_cancelled', v_house,
    'health_from', c.health,
    'health_to', v_health
  )
  where id = v_id;

  for r in select pr.id, pr.name, pr.owner_id from public.projects pr where pr.id = any (v_projects) loop
    if r.owner_id is distinct from auth.uid() then
      perform public.notify(r.owner_id, 'project_closed', 'Projeto encerrado',
        r.name || ' · ' || v_label || ' — ' || left(btrim(p_description), 140), 'project', r.id, '/projetos/' || r.id);
    end if;
    perform public.log_activity('closed', 'project', r.id, jsonb_build_object('closure_id', v_id, 'reason', p_reason));
  end loop;
  perform public.log_activity('closed', 'company', p_company_id, jsonb_build_object('closure_id', v_id, 'reason', p_reason, 'potential', p_potential));

  return v_id;
end;
$$;

revoke all on function public.client_close(uuid, public.closure_reason, text, date, uuid[], uuid[], jsonb, jsonb, public.prospect_potential, text) from public, anon;
grant execute on function public.client_close(uuid, public.closure_reason, text, date, uuid[], uuid[], jsonb, jsonb, public.prospect_potential, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Pausar cliente: projetos e pautas pausados, financeiro intacto
-- ---------------------------------------------------------------------------

create function public.client_pause(p_company_id uuid, p_description text, p_closed_at date, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.companies;
  v_id uuid;
  v_projects uuid[];
  v_prev_system text := current_setting('app.pauta_system', true);
  v_pautas int := 0;
  v_stamp text := to_char(p_closed_at, 'DD/MM/YYYY');
  r record;
begin
  if not public.can_close_clients() then
    raise exception 'Só diretoria e master pausam clientes.' using errcode = '42501';
  end if;
  if btrim(coalesce(p_description, '')) = '' then
    raise exception 'Explique o motivo da pausa.' using errcode = '23514';
  end if;
  if p_closed_at is null then
    raise exception 'Informe a data da pausa.' using errcode = '23514';
  end if;
  select * into c from public.companies where id = p_company_id for update;
  if not found or c.lifecycle <> 'client' then
    raise exception 'Só um cliente ativo pode ser pausado.' using errcode = '23514';
  end if;

  v_projects := array(select public.closure_target_projects(p_company_id, null));

  insert into public.client_closures (company_id, project_id, reason, description, closed_at, notes, future_prospect_potential, closed_by)
  values (p_company_id, null, 'pausa_temporaria', btrim(p_description), p_closed_at, nullif(btrim(coalesce(p_notes, '')), ''), 'alto', auth.uid())
  returning id into v_id;

  update public.projects
  set paused_from_stage = stage, stage = 'pausado', paused_closure_id = v_id
  where id = any (v_projects) and stage <> 'pausado';

  perform set_config('app.pauta_system', 'true', true);
  for r in
    select pt.id from public.pautas pt
    where pt.archived_at is null and pt.status <> 'aprovado' and pt.source = 'manual' and not pt.is_standalone
      and (pt.project_id = any (v_projects) or (pt.project_id is null and pt.direct_company_id = p_company_id))
  loop
    update public.pautas set archived_at = now(), paused_closure_id = v_id where id = r.id;
    insert into public.pauta_logs (pauta_id, author_id, kind, body)
    values (r.id, auth.uid(), 'registro', 'Pausada com o cliente em ' || v_stamp || '. ' || btrim(p_description));
    v_pautas := v_pautas + 1;
  end loop;
  perform set_config('app.pauta_system', coalesce(v_prev_system, ''), true);

  update public.companies
  set lifecycle = 'former_client', health = public.closure_health('pausa_temporaria', c.health)
  where id = p_company_id;

  update public.client_closures
  set summary = jsonb_build_object('projects', coalesce(array_length(v_projects, 1), 0), 'pautas', v_pautas, 'paused', true)
  where id = v_id;

  perform public.log_activity('paused', 'company', p_company_id, jsonb_build_object('closure_id', v_id));
  return v_id;
end;
$$;

revoke all on function public.client_pause(uuid, text, date, text) from public, anon;
grant execute on function public.client_pause(uuid, text, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Reativar cliente (de churn, pausa ou encerramento)
-- ---------------------------------------------------------------------------

create function public.client_reactivate(p_company_id uuid, p_restore_paused boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.companies;
  v_closure public.client_closures := public.client_open_closure(p_company_id);
  v_prev_system text := current_setting('app.pauta_system', true);
begin
  if not public.can_close_clients() then
    raise exception 'Só diretoria e master reativam clientes.' using errcode = '42501';
  end if;
  select * into c from public.companies where id = p_company_id for update;
  if not found or c.lifecycle <> 'former_client' then
    raise exception 'Este cliente não está inativo.' using errcode = '23514';
  end if;

  update public.client_closures set reopened_at = now(), reopened_by = auth.uid()
  where company_id = p_company_id and project_id is null and reopened_at is null;

  update public.companies
  set lifecycle = 'client',
      health = case when health in ('churn', 'atencao') then 'ativo'::public.client_health else health end
  where id = p_company_id;

  -- Estava pausado e a pessoa escolheu reativar tudo: projetos voltam à etapa de antes, pautas voltam ao quadro.
  if v_closure.reason = 'pausa_temporaria' and coalesce(p_restore_paused, false) then
    update public.projects
    set stage = coalesce(paused_from_stage, 'producao'), paused_from_stage = null, paused_closure_id = null
    where paused_closure_id = v_closure.id;
    perform set_config('app.pauta_system', 'true', true);
    update public.pautas set archived_at = null, paused_closure_id = null where paused_closure_id = v_closure.id;
    perform set_config('app.pauta_system', coalesce(v_prev_system, ''), true);
  end if;

  perform public.log_activity('reopened', 'company', p_company_id,
    jsonb_build_object('closure_id', v_closure.id, 'restored', coalesce(p_restore_paused, false)));
end;
$$;

revoke all on function public.client_reactivate(uuid, boolean) from public, anon;
grant execute on function public.client_reactivate(uuid, boolean) to authenticated;

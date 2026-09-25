-- Painel financeiro completo: custos fixos/variáveis, recorrência, vínculo com cliente,
-- competência de recebimentos, projeções (resumo mensal, por cliente, fluxo de caixa) e
-- notificação de itens em atraso. Tudo sob has_finance_access(); RLS já cobre as tabelas
-- via as policies "receivables_finance_only" / "payables_finance_only" existentes.

-- ---------------------------------------------------------------------------
-- payables: fixo x variável, vínculo com cliente, recorrência
-- ---------------------------------------------------------------------------

create type public.payable_recurrence as enum ('none', 'mensal', 'trimestral', 'anual');

alter table public.payables
  add column is_fixed boolean not null default false,
  add column company_id uuid references public.companies (id) on delete set null,
  add column recurrence public.payable_recurrence not null default 'none',
  add column recurrence_until date,
  -- Aponta para o lançamento original quando esta linha foi gerada por generate_recurring_payables.
  add column recurrence_parent_id uuid references public.payables (id) on delete cascade;

create index payables_company_idx on public.payables (company_id);
create index payables_is_fixed_idx on public.payables (is_fixed);
create index payables_recurrence_parent_idx on public.payables (recurrence_parent_id);

-- Evita duplicar uma mesma ocorrência ao rodar generate_recurring_payables mais de uma vez.
create unique index payables_recurrence_unique_idx on public.payables (recurrence_parent_id, due_date)
  where recurrence_parent_id is not null;

-- Quando projeto e cliente são informados juntos, o projeto precisa ser da mesma empresa
-- (mesmo espírito de receivables_validate_project).
create function public.payables_validate_company()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.project_id is not null and new.company_id is not null
     and not exists (
       select 1 from public.projects p
       where p.id = new.project_id and p.company_id = new.company_id
     ) then
    raise exception 'O projeto não pertence à empresa informada.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger payables_validate_company
  before insert or update of company_id, project_id on public.payables
  for each row execute function public.payables_validate_company();

-- ---------------------------------------------------------------------------
-- receivables: descrição do serviço e mês de competência (útil para clientes recorrentes)
-- ---------------------------------------------------------------------------

alter table public.receivables
  add column service_description text,
  add column competence_month date;

create index receivables_competence_month_idx on public.receivables (competence_month);

-- ---------------------------------------------------------------------------
-- payables_with_status / receivables_with_status usam "pa.*" / "r.*", que o Postgres expande
-- na criação da view — colunas novas na tabela não aparecem sozinhas. Recria as duas (sem
-- dependentes) para incluir os campos novos.
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

-- ---------------------------------------------------------------------------
-- generate_recurring_payables: materializa as ocorrências futuras de um custo recorrente
-- até recurrence_until (ou 12 meses à frente). SECURITY INVOKER — a RLS de payables vale.
-- Idempotente: reexecutar não duplica (índice único em recurrence_parent_id + due_date).
-- ---------------------------------------------------------------------------

create function public.generate_recurring_payables(p_payable_id uuid)
returns setof public.payables
language plpgsql
set search_path = ''
as $$
declare
  v_parent public.payables%rowtype;
  v_until date;
  v_step interval;
  v_next date;
  v_guard int := 0;
begin
  if not public.has_finance_access() then
    raise exception 'Sem acesso ao financeiro.' using errcode = '42501';
  end if;

  select * into v_parent from public.payables where id = p_payable_id;
  if not found then
    raise exception 'Pagamento não encontrado.' using errcode = '22023';
  end if;
  if v_parent.recurrence = 'none' then
    raise exception 'Este pagamento não é recorrente.' using errcode = '22023';
  end if;
  if v_parent.recurrence_parent_id is not null then
    raise exception 'Gere a recorrência a partir do lançamento original.' using errcode = '22023';
  end if;

  v_until := coalesce(v_parent.recurrence_until, (v_parent.due_date + interval '12 months')::date);
  v_step := case v_parent.recurrence
    when 'mensal' then interval '1 month'
    when 'trimestral' then interval '3 months'
    when 'anual' then interval '12 months'
  end;

  v_next := (v_parent.due_date + v_step)::date;
  while v_next <= v_until and v_guard < 60 loop
    return query
    with inserted as (
      insert into public.payables (
        project_id, company_id, payee_profile_id, payee_name, category, description,
        amount, due_date, payment_method, notes, is_fixed, recurrence, recurrence_parent_id
      )
      values (
        v_parent.project_id, v_parent.company_id, v_parent.payee_profile_id, v_parent.payee_name,
        v_parent.category, v_parent.description, v_parent.amount, v_next, v_parent.payment_method,
        v_parent.notes, v_parent.is_fixed, 'none', v_parent.id
      )
      on conflict (recurrence_parent_id, due_date) where recurrence_parent_id is not null do nothing
      returning *
    )
    select * from inserted;
    v_next := (v_next + v_step)::date;
    v_guard := v_guard + 1;
  end loop;
end;
$$;

revoke all on function public.generate_recurring_payables(uuid) from public, anon;
grant execute on function public.generate_recurring_payables(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- finance_monthly_summary: últimos 12 meses + próximos 6, para os gráficos do dashboard.
-- ---------------------------------------------------------------------------

create view public.finance_monthly_summary
with (security_invoker = true) as
with months as (
  select (date_trunc('month', (now() at time zone 'America/Fortaleza')::date) - (n || ' months')::interval)::date as month_start
  from generate_series(11, -6, -1) as n
),
bounds as (
  select month_start, (month_start + interval '1 month' - interval '1 day')::date as month_end
  from months
),
raw as (
  select
    b.month_start,
    b.month_end,
    coalesce((
      select sum(r.received_amount) from public.receivables r
      where r.cancelled_at is null and r.received_at between b.month_start and b.month_end
    ), 0)::numeric(12, 2) as total_received,
    coalesce((
      select sum(r.amount) from public.receivables r
      where r.cancelled_at is null and r.received_at is null and r.due_date between b.month_start and b.month_end
    ), 0)::numeric(12, 2) as total_to_receive,
    coalesce((
      select sum(pa.amount) from public.payables pa
      where pa.cancelled_at is null and pa.paid_at between b.month_start and b.month_end
    ), 0)::numeric(12, 2) as total_paid,
    coalesce((
      select sum(pa.amount) from public.payables pa
      where pa.cancelled_at is null and pa.paid_at is null and pa.due_date between b.month_start and b.month_end
    ), 0)::numeric(12, 2) as total_to_pay,
    coalesce((
      select sum(pa.amount) from public.payables pa
      where pa.cancelled_at is null and pa.is_fixed and pa.due_date between b.month_start and b.month_end
    ), 0)::numeric(12, 2) as fixed_costs,
    coalesce((
      select sum(pa.amount) from public.payables pa
      where pa.cancelled_at is null and not pa.is_fixed and pa.due_date between b.month_start and b.month_end
    ), 0)::numeric(12, 2) as variable_costs,
    coalesce((
      select count(*) from public.receivables r
      where r.cancelled_at is null and r.received_at is null and r.due_date between b.month_start and b.month_end
        and r.due_date < (now() at time zone 'America/Fortaleza')::date
    ), 0)::int as overdue_receivables_count,
    coalesce((
      select count(*) from public.payables pa
      where pa.cancelled_at is null and pa.paid_at is null and pa.due_date between b.month_start and b.month_end
        and pa.due_date < (now() at time zone 'America/Fortaleza')::date
    ), 0)::int as overdue_payables_count
  from bounds b
)
select
  raw.*,
  (raw.total_received - raw.total_paid)::numeric(12, 2) as net_result
from raw
where public.has_finance_access()
order by raw.month_start;

revoke all on public.finance_monthly_summary from anon;

-- ---------------------------------------------------------------------------
-- finance_by_client: faturamento, recebido, pendente, custos e margem por empresa.
-- ---------------------------------------------------------------------------

create view public.finance_by_client
with (security_invoker = true) as
with proj as (
  select id, company_id from public.projects where company_id is not null and not is_internal
),
costs as (
  select coalesce(pa.company_id, p.company_id) as company_id, sum(pa.amount) as total
  from public.payables pa
  left join proj p on p.id = pa.project_id
  where pa.cancelled_at is null and coalesce(pa.company_id, p.company_id) is not null
  group by coalesce(pa.company_id, p.company_id)
),
rec as (
  select
    r.company_id,
    sum(r.amount) filter (where r.cancelled_at is null) as billed,
    sum(r.received_amount) filter (where r.received_at is not null and r.cancelled_at is null) as received,
    sum(r.amount) filter (where r.received_at is null and r.cancelled_at is null) as pending
  from public.receivables r
  group by r.company_id
),
projcount as (
  select company_id, count(*) as project_count from proj group by company_id
)
select
  c.id as company_id,
  c.name as company_name,
  coalesce(rec.billed, 0)::numeric(12, 2) as total_billed,
  coalesce(rec.received, 0)::numeric(12, 2) as total_received,
  coalesce(rec.pending, 0)::numeric(12, 2) as total_pending,
  coalesce(costs.total, 0)::numeric(12, 2) as total_costs,
  case when coalesce(rec.billed, 0) > 0
    then round((rec.billed - coalesce(costs.total, 0)) / rec.billed * 100, 1)
  end as margin_pct,
  case
    when coalesce(rec.billed, 0) <= 0 then null
    when round((rec.billed - coalesce(costs.total, 0)) / rec.billed * 100, 1) >= 50 then 'saudavel'
    when round((rec.billed - coalesce(costs.total, 0)) / rec.billed * 100, 1) >= 47 then 'atencao'
    else 'critico'
  end as margin_status,
  coalesce(projcount.project_count, 0)::int as project_count
from public.companies c
left join rec on rec.company_id = c.id
left join costs on costs.company_id = c.id
left join projcount on projcount.company_id = c.id
where public.has_finance_access() and (rec.billed is not null or costs.total is not null)
order by c.name;

revoke all on public.finance_by_client from anon;

-- ---------------------------------------------------------------------------
-- cash_flow_projection: próximos 90 dias, dia a dia, com saldo acumulado.
-- ---------------------------------------------------------------------------

create view public.cash_flow_projection
with (security_invoker = true) as
with days as (
  select ((now() at time zone 'America/Fortaleza')::date + n) as day
  from generate_series(0, 89) as n
),
raw as (
  select
    d.day,
    coalesce((
      select sum(r.amount) from public.receivables r
      where r.cancelled_at is null and r.received_at is null and r.due_date = d.day
    ), 0)::numeric(12, 2) as expected_inflow,
    coalesce((
      select sum(pa.amount) from public.payables pa
      where pa.cancelled_at is null and pa.paid_at is null and pa.due_date = d.day
    ), 0)::numeric(12, 2) as expected_outflow
  from days d
)
select
  raw.day,
  raw.expected_inflow,
  raw.expected_outflow,
  (raw.expected_inflow - raw.expected_outflow)::numeric(12, 2) as net_change,
  (sum(raw.expected_inflow - raw.expected_outflow) over (order by raw.day rows unbounded preceding))::numeric(12, 2) as running_balance
from raw
where public.has_finance_access()
order by raw.day;

revoke all on public.cash_flow_projection from anon;

-- ---------------------------------------------------------------------------
-- notify_overdue_finance: gera notificações para quem tem acesso ao financeiro quando um
-- recebimento ou pagamento está em atraso. SECURITY DEFINER; sem cron — chamada a partir de
-- uma Server Action no carregamento do painel. O próprio filtro "criado nas últimas 24h para
-- este item" garante no máximo 1 notificação por item por dia, sem coluna extra de controle.
-- ---------------------------------------------------------------------------

create function public.notify_overdue_finance()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Fortaleza')::date;
begin
  insert into public.notifications (recipient_id, type, title, body, entity_type, entity_id, url)
  select
    p.id, 'finance_overdue_receivable', 'Recebimento em atraso',
    r.description || ' — ' || c.name, 'receivable', r.id, '/financeiro?aba=recebimentos&status=atrasado'
  from public.receivables r
  join public.companies c on c.id = r.company_id
  cross join public.profiles p
  where r.received_at is null and r.cancelled_at is null and r.due_date < v_today
    and p.is_active
    and (
      p.has_finance_access
      or exists (select 1 from public.profile_squads ps where ps.profile_id = p.id and ps.squad in ('diretoria', 'financeiro'))
    )
    and not exists (
      select 1 from public.notifications n
      where n.recipient_id = p.id and n.entity_type = 'receivable' and n.entity_id = r.id
        and n.created_at > now() - interval '1 day'
    );

  insert into public.notifications (recipient_id, type, title, body, entity_type, entity_id, url)
  select
    p.id, 'finance_overdue_payable', 'Pagamento em atraso',
    pa.description || ' — ' || coalesce(nullif(btrim(pa.payee_name), ''), pr.full_name, 'Favorecido não informado'),
    'payable', pa.id, '/financeiro?aba=pagamentos&status=atrasado'
  from public.payables pa
  left join public.profiles pr on pr.id = pa.payee_profile_id
  cross join public.profiles p
  where pa.paid_at is null and pa.cancelled_at is null and pa.due_date < v_today
    and p.is_active
    and (
      p.has_finance_access
      or exists (select 1 from public.profile_squads ps where ps.profile_id = p.id and ps.squad in ('diretoria', 'financeiro'))
    )
    and not exists (
      select 1 from public.notifications n
      where n.recipient_id = p.id and n.entity_type = 'payable' and n.entity_id = pa.id
        and n.created_at > now() - interval '1 day'
    );
end;
$$;

revoke all on function public.notify_overdue_finance() from public, anon;
grant execute on function public.notify_overdue_finance() to authenticated;

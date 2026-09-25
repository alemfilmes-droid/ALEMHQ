-- Módulo Financeiro: recebimentos (parcelas), pagamentos, views de status e rentabilidade.
-- Toda operação exige has_finance_access(); o papel admin não dá acesso.

create type public.payment_method as enum (
  'pix', 'boleto', 'transferencia', 'cartao', 'dinheiro', 'outro'
);

create type public.payable_category as enum (
  'freelancer', 'equipamento', 'locacao', 'deslocamento', 'hospedagem',
  'alimentacao', 'trilha_licenca', 'software', 'imposto', 'marketing', 'outro'
);

-- ---------------------------------------------------------------------------
-- receivables
-- ---------------------------------------------------------------------------

create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  project_id uuid references public.projects (id) on delete set null,
  -- Vínculos futuros (CRM e tarefas avulsas). Sem FK por enquanto.
  deal_id uuid,
  task_id uuid,
  description text not null check (length(btrim(description)) > 0),
  installment_number int,
  installment_total int,
  amount numeric(12, 2) not null check (amount > 0),
  due_date date not null,
  received_at date,
  received_amount numeric(12, 2) check (received_amount is null or received_amount > 0),
  payment_method public.payment_method,
  invoice_number text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint receivables_installment_check
    check (
      (installment_number is null and installment_total is null)
      or (installment_number between 1 and installment_total)
    ),
  constraint receivables_settlement_pair_check
    check ((received_at is null) = (received_amount is null)),
  constraint receivables_not_settled_and_cancelled_check
    check (received_at is null or cancelled_at is null)
);

create index receivables_due_date_idx on public.receivables (due_date);
create index receivables_project_idx on public.receivables (project_id);
create index receivables_company_idx on public.receivables (company_id);
create index receivables_received_at_idx on public.receivables (received_at);

-- ---------------------------------------------------------------------------
-- payables (project_id nulo = despesa geral da empresa)
-- ---------------------------------------------------------------------------

create table public.payables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete set null,
  payee_profile_id uuid references public.profiles (id) on delete set null,
  payee_name text,
  category public.payable_category not null,
  description text not null check (length(btrim(description)) > 0),
  amount numeric(12, 2) not null check (amount > 0),
  due_date date not null,
  paid_at date,
  payment_method public.payment_method,
  notes text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint payables_payee_check
    check (payee_profile_id is not null or length(btrim(coalesce(payee_name, ''))) > 0),
  constraint payables_not_paid_and_cancelled_check
    check (paid_at is null or cancelled_at is null)
);

create index payables_due_date_idx on public.payables (due_date);
create index payables_project_idx on public.payables (project_id);
create index payables_paid_at_idx on public.payables (paid_at);

create trigger receivables_set_updated_at
  before update on public.receivables
  for each row execute function public.set_updated_at();

create trigger payables_set_updated_at
  before update on public.payables
  for each row execute function public.set_updated_at();

-- O projeto do recebimento precisa ser da mesma empresa (definer: lê projects sem depender da RLS do chamador).
create function public.receivables_validate_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.project_id is not null
     and not exists (
       select 1 from public.projects p
       where p.id = new.project_id and p.company_id = new.company_id and not p.is_internal
     ) then
    raise exception 'O projeto não pertence à empresa informada.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger receivables_validate_project
  before insert or update of company_id, project_id on public.receivables
  for each row execute function public.receivables_validate_project();

-- ---------------------------------------------------------------------------
-- RLS: tudo somente com has_finance_access()
-- ---------------------------------------------------------------------------

alter table public.receivables enable row level security;
alter table public.payables enable row level security;

create policy "receivables_finance_only" on public.receivables for all to authenticated
  using (public.has_finance_access())
  with check (public.has_finance_access());

create policy "payables_finance_only" on public.payables for all to authenticated
  using (public.has_finance_access())
  with check (public.has_finance_access());

-- ---------------------------------------------------------------------------
-- Views de status (nunca gravado). security_invoker: a RLS das tabelas vale para quem consulta.
-- ---------------------------------------------------------------------------

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

create view public.project_profitability
with (security_invoker = true) as
select
  p.id as project_id,
  p.name as project_name,
  p.company_id,
  c.name as company_name,
  p.is_internal,
  p.stage,
  p.due_date,
  pf.contract_value,
  coalesce(r.received, 0)::numeric(12, 2) as total_received,
  coalesce(r.pending, 0)::numeric(12, 2) as receivable_pending,
  coalesce(pa.total, 0)::numeric(12, 2) as payables_total,
  coalesce(pa.paid, 0)::numeric(12, 2) as payables_paid,
  (pf.contract_value - coalesce(pa.total, 0))::numeric(12, 2) as planned_margin,
  case
    when coalesce(pf.contract_value, 0) > 0
      then round((pf.contract_value - coalesce(pa.total, 0)) / pf.contract_value * 100, 1)
  end as margin_pct
from public.projects p
left join public.companies c on c.id = p.company_id
left join public.project_financials pf on pf.project_id = p.id
left join lateral (
  select
    sum(x.received_amount) filter (where x.received_at is not null and x.cancelled_at is null) as received,
    sum(x.amount) filter (where x.received_at is null and x.cancelled_at is null) as pending
  from public.receivables x where x.project_id = p.id
) r on true
left join lateral (
  select
    sum(y.amount) filter (where y.cancelled_at is null) as total,
    sum(y.amount) filter (where y.paid_at is not null and y.cancelled_at is null) as paid
  from public.payables y where y.project_id = p.id
) pa on true
where public.has_finance_access();

revoke all on public.receivables_with_status, public.payables_with_status, public.project_profitability from anon;

-- ---------------------------------------------------------------------------
-- generate_installments: N parcelas cuja soma é exatamente o total (centavos distribuídos).
-- SECURITY INVOKER: além da checagem explícita, a RLS de receivables também barra.
-- ---------------------------------------------------------------------------

create function public.generate_installments(
  p_project_id uuid,
  p_total_amount numeric,
  p_installments int,
  p_first_due_date date,
  p_interval_days int default 30,
  p_payment_method public.payment_method default null,
  p_company_id uuid default null,
  p_description text default null
)
returns setof public.receivables
language plpgsql
set search_path = ''
as $$
declare
  v_company_id uuid := p_company_id;
  v_label text := p_description;
  v_project public.projects%rowtype;
  v_total_cents bigint;
  v_base bigint;
  v_extra bigint;
  v_cents bigint;
  v_i int;
begin
  if not public.has_finance_access() then
    raise exception 'Sem acesso ao financeiro.' using errcode = '42501';
  end if;

  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'O valor total deve ser maior que zero.' using errcode = '22023';
  end if;
  if p_installments is null or p_installments < 1 or p_installments > 120 then
    raise exception 'O número de parcelas deve ficar entre 1 e 120.' using errcode = '22023';
  end if;
  if p_interval_days is null or p_interval_days < 1 then
    raise exception 'O intervalo deve ser de pelo menos 1 dia.' using errcode = '22023';
  end if;
  if p_first_due_date is null then
    raise exception 'Informe o primeiro vencimento.' using errcode = '22023';
  end if;

  if p_project_id is not null then
    select * into v_project from public.projects where id = p_project_id;
    if not found then
      raise exception 'Projeto não encontrado.' using errcode = '22023';
    end if;
    if v_project.is_internal or v_project.company_id is null then
      raise exception 'Projetos internos não têm recebimentos.' using errcode = '22023';
    end if;
    v_company_id := v_project.company_id;
    v_label := coalesce(nullif(btrim(p_description), ''), v_project.name);
  elsif v_company_id is null then
    raise exception 'Informe o projeto ou a empresa.' using errcode = '22023';
  end if;

  v_label := coalesce(nullif(btrim(v_label), ''), 'Recebimento');
  v_total_cents := round(p_total_amount * 100);
  v_base := v_total_cents / p_installments;
  v_extra := v_total_cents % p_installments;

  for v_i in 1..p_installments loop
    v_cents := v_base + case when v_i <= v_extra then 1 else 0 end;
    return query
    with inserted as (
      insert into public.receivables (
        company_id, project_id, description, installment_number, installment_total,
        amount, due_date, payment_method
      )
      values (
        v_company_id, p_project_id,
        v_label || ' — parcela ' || v_i || '/' || p_installments,
        v_i, p_installments,
        v_cents::numeric / 100,
        p_first_due_date + (v_i - 1) * p_interval_days,
        p_payment_method
      )
      returning *
    )
    select * from inserted;
  end loop;
end;
$$;

revoke all on function public.generate_installments(uuid, numeric, int, date, int, public.payment_method, uuid, text) from public, anon;
grant execute on function public.generate_installments(uuid, numeric, int, date, int, public.payment_method, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- activity_log: criar / quitar / cancelar. Linhas financeiras só para quem tem acesso ao financeiro.
-- ---------------------------------------------------------------------------

drop policy "activity_log_select_admin" on public.activity_log;

create policy "activity_log_select" on public.activity_log for select to authenticated
  using (
    case
      when entity_type in ('receivable', 'payable') then public.has_finance_access()
      else public.is_admin()
    end
  );

create function public.finance_log_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := tg_argv[0];
  v_settled_old boolean;
  v_settled_new boolean;
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('created', v_type, new.id,
      jsonb_build_object('amount', new.amount, 'due_date', new.due_date));
    return new;
  end if;

  if v_type = 'receivable' then
    v_settled_old := old.received_at is not null;
    v_settled_new := new.received_at is not null;
  else
    v_settled_old := to_jsonb(old) ->> 'paid_at' is not null;
    v_settled_new := to_jsonb(new) ->> 'paid_at' is not null;
  end if;

  if not v_settled_old and v_settled_new then
    perform public.log_activity('settled', v_type, new.id, jsonb_build_object('amount', new.amount));
  end if;
  if old.cancelled_at is null and new.cancelled_at is not null then
    perform public.log_activity('cancelled', v_type, new.id, jsonb_build_object('amount', new.amount));
  end if;
  return new;
end;
$$;

create trigger receivables_log_changes
  after insert or update on public.receivables
  for each row execute function public.finance_log_changes('receivable');

create trigger payables_log_changes
  after insert or update on public.payables
  for each row execute function public.finance_log_changes('payable');

-- Carteira — Módulo 1 (pedido do Anderson, 13/10/2026).
--
-- A Carteira NÃO é uma fonte nova de dinheiro: é uma visão só de leitura dos pagamentos do Financeiro (payables)
-- em que a pessoa é a favorecida (payee_profile_id, que já existia). Fonte única.
--
-- • Remuneração por pessoa (só o master edita): tipo, fixo (centavos), dia de pagamento (1–28) e % padrão de
--   comissão — profile_remuneration.
-- • payables.payout_date: data em que o valor cai na Carteira = o primeiro dia do mês igual ao dia de pagamento da
--   pessoa ESTRITAMENTE depois do vencimento (payout_date_for; mesmos casos de lib/wallet/payout-date-cases.json).
--   Sem dia configurado, o vencimento. Recalculado ao mudar o vencimento/favorecido e ao mudar o dia de pagamento
--   da pessoa — só nos lançamentos em aberto (pagos e cancelados ficam como estão).
-- • payables.deal_id: ligação opcional com o negócio do CRM (para o Módulo 2; ainda sem uso).
-- • wallet_entries(): leitura da Carteira — a própria pessoa; master, admin e financeiro leem a de qualquer um.
--   Ninguém edita valores pela Carteira.
--
-- Só adiciona tipo, tabela, colunas (nulas) e funções; recria a view payables_with_status com o mesmo corpo.

create type public.remuneration_type as enum ('fixo', 'fixo_mais_variavel', 'so_comissao', 'por_job');

create table public.profile_remuneration (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  remuneration_type public.remuneration_type not null,
  fixed_amount_cents bigint check (fixed_amount_cents is null or fixed_amount_cents >= 0),
  payday smallint not null check (payday between 1 and 28),
  default_commission_percent numeric(5, 2) check (default_commission_percent is null or default_commission_percent between 0 and 100),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.payables
  add column if not exists payout_date date,
  add column if not exists deal_id uuid references public.deals (id) on delete set null;

create index if not exists payables_payee_payout_idx on public.payables (payee_profile_id, payout_date) where payee_profile_id is not null;

-- ---------------------------------------------------------------------------
-- Quem lê a Carteira de alguém
-- ---------------------------------------------------------------------------

create function public.can_read_wallet(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() = p_profile_id or public.is_master() or public.is_admin() or public.can_see_money()
$$;

grant execute on function public.can_read_wallet(uuid) to authenticated;

alter table public.profile_remuneration enable row level security;

create policy "profile_remuneration_select" on public.profile_remuneration for select to authenticated
  using (public.can_read_wallet(profile_id));
create policy "profile_remuneration_insert" on public.profile_remuneration for insert to authenticated
  with check (public.is_master());
create policy "profile_remuneration_update" on public.profile_remuneration for update to authenticated
  using (public.is_master()) with check (public.is_master());

-- ---------------------------------------------------------------------------
-- Data de pagamento
-- ---------------------------------------------------------------------------

create function public.payout_date_for(p_due date, p_payday int)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when p_due is null or p_payday is null or p_payday not between 1 and 28 then p_due
    when extract(day from p_due)::int < p_payday then make_date(extract(year from p_due)::int, extract(month from p_due)::int, p_payday)
    else (make_date(extract(year from p_due)::int, extract(month from p_due)::int, p_payday) + interval '1 month')::date
  end
$$;

create function public.payable_payout_date(p_payee uuid, p_due date)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select public.payout_date_for(p_due, (select r.payday from public.profile_remuneration r where r.profile_id = p_payee))
$$;

revoke all on function public.payable_payout_date(uuid, date) from public, anon, authenticated;

create function public.payables_payout_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Pago ou cancelado: a data fica como estava.
  if new.paid_at is not null or new.cancelled_at is not null then
    if tg_op = 'INSERT' then
      new.payout_date := case when new.payee_profile_id is null then null else public.payable_payout_date(new.payee_profile_id, new.due_date) end;
    end if;
    return new;
  end if;
  new.payout_date := case when new.payee_profile_id is null then null else public.payable_payout_date(new.payee_profile_id, new.due_date) end;
  return new;
end;
$$;

create trigger payables_payout_date before insert or update of due_date, payee_profile_id, paid_at, cancelled_at on public.payables
  for each row execute function public.payables_payout_date();

-- Mudou o dia de pagamento da pessoa: recalcula os lançamentos dela em aberto.
create function public.profile_remuneration_sync_payouts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.payday is not distinct from old.payday then
    return new;
  end if;
  update public.payables pa
  set payout_date = public.payout_date_for(pa.due_date, new.payday)
  where pa.payee_profile_id = new.profile_id and pa.paid_at is null and pa.cancelled_at is null
    and pa.payout_date is distinct from public.payout_date_for(pa.due_date, new.payday);
  return new;
end;
$$;

create trigger profile_remuneration_sync_payouts after insert or update of payday on public.profile_remuneration
  for each row execute function public.profile_remuneration_sync_payouts();

-- Lançamentos que já existem, em aberto e com favorecido do HQ: a data passa a existir (= vencimento, até a pessoa
-- ter um dia de pagamento). Só a coluna nova é preenchida.
update public.payables
set payout_date = due_date
where payee_profile_id is not null and paid_at is null and cancelled_at is null and payout_date is null;

-- ---------------------------------------------------------------------------
-- Leitura da Carteira
-- ---------------------------------------------------------------------------

create function public.wallet_entries(p_profile_id uuid)
returns table (
  id uuid,
  description text,
  amount numeric,
  due_date date,
  payout_date date,
  paid_at date,
  category public.payable_category,
  team_payment_type public.team_payment_type,
  is_fixed boolean,
  commission_goal_id uuid,
  goal_title text,
  project_id uuid,
  project_name text,
  company_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_read_wallet(p_profile_id) then
    raise exception 'Você só pode ver a sua Carteira.' using errcode = '42501';
  end if;
  return query
  select pa.id, pa.description, pa.amount, pa.due_date, coalesce(pa.payout_date, pa.due_date), pa.paid_at::date, pa.category,
    pa.team_payment_type, pa.is_fixed, pa.commission_goal_id, g.title, pa.project_id, pr.name, coalesce(c.name, pc.name)
  from public.payables pa
  left join public.goals g on g.id = pa.commission_goal_id
  left join public.projects pr on pr.id = pa.project_id
  left join public.companies c on c.id = pa.company_id
  left join public.companies pc on pc.id = pr.company_id
  where pa.payee_profile_id = p_profile_id and pa.cancelled_at is null
  order by coalesce(pa.payout_date, pa.due_date);
end;
$$;

revoke all on function public.wallet_entries(uuid) from public, anon;
grant execute on function public.wallet_entries(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- payables_with_status: mesmo corpo (pa.* é expandido na criação; agora com payout_date e deal_id)
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

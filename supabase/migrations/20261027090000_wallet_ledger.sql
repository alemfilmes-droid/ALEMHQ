-- Carteira — extrato (pedido do Anderson, 13/10/2026).
--
-- • wallet_ledger_events: extrato imutável da Carteira. Cada baixa de um pagamento com favorecido do HQ grava uma
--   SAÍDA (payout): lançamento, favorecido, valor em centavos, data E hora do pagamento (America/Fortaleza) e quem
--   confirmou. Desfazer a baixa grava um ESTORNO (reversal) apontando para a saída — nada é apagado nem alterado.
-- • A gravação é por gatilho em payables (AFTER), então vale para toda baixa/estorno/edição do Financeiro, venha de
--   onde vier. Regra (mesmos casos de lib/wallet/ledger-cases.json):
--     elegível = pago, com favorecido do HQ, não cancelado e não reembolso;
--     a saída em aberto (sem estorno) diverge do lançamento (favorecido, valor ou data) ou ele deixou de ser
--     elegível → estorno; elegível e sem saída em aberto → nova saída.
--   Hora da saída: baixa com a data de hoje → agora; data no passado/futuro → 12:00 e "horário não registrado"
--   (quem confirmou e quando continuam em actor_id/created_at). Ajuste que mantém a data reaproveita a hora.
-- • Backfill: os pagamentos já pagos ganham uma saída às 12:00 do dia do pagamento, "horário não registrado",
--   sem autor (não havia esse registro).
-- • wallet_ledger(): leitura do extrato com os dados do lançamento (mesma regra de acesso da Carteira).
-- • wallet_entries ganha created_at (linha do tempo "lançado → previsto → pago").
--
-- Só adiciona tabela e funções; recria wallet_entries (o retorno mudou) com o mesmo corpo + created_at.
-- Nenhum dado existente de payables muda.

create table public.wallet_ledger_events (
  id uuid primary key default gen_random_uuid(),
  -- Sem FK: o extrato sobrevive ao lançamento (como financial_entry_history.entry_id).
  payable_id uuid not null,
  profile_id uuid not null,
  kind text not null check (kind in ('payout', 'reversal')),
  amount_cents bigint not null check (amount_cents >= 0),
  -- Data do pagamento (payables.paid_at) a que o evento se refere.
  paid_on date not null,
  -- Saída: data e hora do pagamento. Estorno: quando foi estornado.
  occurred_at timestamptz not null,
  time_recorded boolean not null default true,
  -- Quem confirmou a baixa (saída) ou desfez (estorno). Nulo no backfill.
  actor_id uuid,
  reverses_event_id uuid unique references public.wallet_ledger_events (id),
  description text not null,
  source text not null default 'financeiro' check (source in ('financeiro', 'backfill')),
  -- clock_timestamp: estorno e nova saída do mesmo ajuste ficam em ordem.
  created_at timestamptz not null default clock_timestamp(),
  check ((kind = 'reversal') = (reverses_event_id is not null))
);

create index wallet_ledger_events_profile_idx on public.wallet_ledger_events (profile_id, occurred_at desc);
create index wallet_ledger_events_payable_idx on public.wallet_ledger_events (payable_id, created_at desc);

comment on table public.wallet_ledger_events is 'Extrato da Carteira: saídas e estornos, imutável. Só o gatilho de payables grava.';

create function public.wallet_ledger_events_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'O extrato da Carteira não pode ser alterado nem apagado.' using errcode = '42501';
end;
$$;

create trigger wallet_ledger_events_immutable before update or delete on public.wallet_ledger_events
  for each row execute function public.wallet_ledger_events_immutable();

alter table public.wallet_ledger_events enable row level security;

create policy "wallet_ledger_events_select" on public.wallet_ledger_events for select to authenticated
  using (public.can_read_wallet(profile_id));

revoke all on public.wallet_ledger_events from anon, authenticated;
grant select on public.wallet_ledger_events to authenticated;

-- ---------------------------------------------------------------------------
-- Gatilho: baixa → saída; estorno/ajuste → estorno (+ nova saída)
-- ---------------------------------------------------------------------------

create function public.payables_wallet_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_open public.wallet_ledger_events;
  v_eligible boolean := new.paid_at is not null and new.payee_profile_id is not null and new.cancelled_at is null and not new.is_reimbursement;
  v_cents bigint := round(coalesce(new.amount, 0) * 100)::bigint;
  v_today date := (now() at time zone 'America/Fortaleza')::date;
  v_at timestamptz;
  v_recorded boolean;
begin
  select e.* into v_open
  from public.wallet_ledger_events e
  where e.payable_id = new.id and e.kind = 'payout'
    and not exists (select 1 from public.wallet_ledger_events r where r.reverses_event_id = e.id)
  order by e.created_at desc
  limit 1;

  if v_open.id is not null then
    if v_eligible and v_open.profile_id = new.payee_profile_id and v_open.amount_cents = v_cents and v_open.paid_on = new.paid_at then
      return null;
    end if;
    insert into public.wallet_ledger_events (payable_id, profile_id, kind, amount_cents, paid_on, occurred_at, time_recorded, actor_id,
      reverses_event_id, description)
    values (new.id, v_open.profile_id, 'reversal', v_open.amount_cents, v_open.paid_on, now(), true, auth.uid(), v_open.id, new.description);
  end if;

  if v_eligible then
    if v_open.id is not null and v_open.paid_on = new.paid_at then
      v_at := v_open.occurred_at;
      v_recorded := v_open.time_recorded;
    elsif new.paid_at = v_today then
      v_at := now();
      v_recorded := true;
    else
      v_at := (new.paid_at + time '12:00') at time zone 'America/Fortaleza';
      v_recorded := false;
    end if;
    insert into public.wallet_ledger_events (payable_id, profile_id, kind, amount_cents, paid_on, occurred_at, time_recorded, actor_id, description)
    values (new.id, new.payee_profile_id, 'payout', v_cents, new.paid_at, v_at, v_recorded, auth.uid(), new.description);
  end if;
  return null;
end;
$$;

revoke all on function public.payables_wallet_ledger() from public, anon, authenticated;

create trigger payables_wallet_ledger
  after insert or update of paid_at, amount, payee_profile_id, cancelled_at, is_reimbursement on public.payables
  for each row execute function public.payables_wallet_ledger();

-- ---------------------------------------------------------------------------
-- Backfill: pagamentos já pagos (12:00 do dia, horário não registrado)
-- ---------------------------------------------------------------------------

insert into public.wallet_ledger_events (payable_id, profile_id, kind, amount_cents, paid_on, occurred_at, time_recorded, actor_id, description, source)
select pa.id, pa.payee_profile_id, 'payout', round(pa.amount * 100)::bigint, pa.paid_at,
  (pa.paid_at + time '12:00') at time zone 'America/Fortaleza', false, null, pa.description, 'backfill'
from public.payables pa
where pa.paid_at is not null and pa.payee_profile_id is not null and pa.cancelled_at is null and not pa.is_reimbursement
  and not exists (select 1 from public.wallet_ledger_events e where e.payable_id = pa.id);

-- ---------------------------------------------------------------------------
-- Leitura do extrato
-- ---------------------------------------------------------------------------

create function public.wallet_ledger(p_profile_id uuid)
returns table (
  id uuid,
  payable_id uuid,
  kind text,
  amount_cents bigint,
  paid_on date,
  occurred_at timestamptz,
  time_recorded boolean,
  actor_name text,
  reverses_event_id uuid,
  created_at timestamptz,
  description text,
  category public.payable_category,
  team_payment_type public.team_payment_type,
  is_fixed boolean,
  commission_goal_id uuid,
  goal_title text,
  project_id uuid,
  project_name text,
  company_name text,
  due_date date,
  payout_date date,
  entry_created_at timestamptz
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
  select e.id, e.payable_id, e.kind, e.amount_cents, e.paid_on, e.occurred_at, e.time_recorded, nullif(btrim(a.full_name), ''),
    e.reverses_event_id, e.created_at, coalesce(pa.description, e.description), pa.category, pa.team_payment_type,
    coalesce(pa.is_fixed, false), pa.commission_goal_id, g.title, pa.project_id, pr.name, coalesce(c.name, pc.name),
    pa.due_date, coalesce(pa.payout_date, pa.due_date), pa.created_at
  from public.wallet_ledger_events e
  left join public.payables pa on pa.id = e.payable_id
  left join public.profiles a on a.id = e.actor_id
  left join public.goals g on g.id = pa.commission_goal_id
  left join public.projects pr on pr.id = pa.project_id
  left join public.companies c on c.id = pa.company_id
  left join public.companies pc on pc.id = pr.company_id
  where e.profile_id = p_profile_id
  order by e.occurred_at desc, e.created_at desc;
end;
$$;

revoke all on function public.wallet_ledger(uuid) from public, anon;
grant execute on function public.wallet_ledger(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- wallet_entries: mesmo corpo + created_at
-- ---------------------------------------------------------------------------

drop function public.wallet_entries(uuid);

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
  company_name text,
  created_at timestamptz
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
    pa.team_payment_type, pa.is_fixed, pa.commission_goal_id, g.title, pa.project_id, pr.name, coalesce(c.name, pc.name), pa.created_at
  from public.payables pa
  left join public.goals g on g.id = pa.commission_goal_id
  left join public.projects pr on pr.id = pa.project_id
  left join public.companies c on c.id = pa.company_id
  left join public.companies pc on pc.id = pr.company_id
  where pa.payee_profile_id = p_profile_id and pa.cancelled_at is null and not pa.is_reimbursement
  order by coalesce(pa.payout_date, pa.due_date);
end;
$$;

revoke all on function public.wallet_entries(uuid) from public, anon;
grant execute on function public.wallet_entries(uuid) to authenticated;

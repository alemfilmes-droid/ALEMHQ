-- Correções do banco de horas:
--   1) a checagem de sequência (entrada/saída) comparava com a última linha da pessoa em
--      QUALQUER dia, em vez de só dentro do mesmo dia local — por isso lançar uma entrada
--      esquecida de um dia passado colidia com o que já existia hoje.
--   2) work_schedules.effective_from tinha um valor "-120 dias" cravado no backfill original,
--      cobrando falta em dias antes de a pessoa sequer existir no sistema. Agora é opcional:
--      nulo cai para a data de criação do perfil, e a diretoria pode fixar uma data manual
--      ("Início da contagem").

-- ---------------------------------------------------------------------------
-- 1) Sequência de entrada/saída: só entre linhas do MESMO dia local (America/Fortaleza).
-- ---------------------------------------------------------------------------

create or replace function public.time_entries_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work_date date;
  v_prev public.time_entries%rowtype;
  v_next public.time_entries%rowtype;
  v_content_changed boolean;
begin
  if tg_op = 'UPDATE' then
    v_content_changed := new.occurred_at is distinct from old.occurred_at
      or new.kind is distinct from old.kind
      or new.note is distinct from old.note;

    -- Exclusão/restauração pura (só deleted_at mudou): não revalida sequência nem marca edição.
    if new.deleted_at is distinct from old.deleted_at and not v_content_changed then
      return new;
    end if;

    if v_content_changed then
      new.is_edited := true;
      if old.original_occurred_at is null then
        new.original_occurred_at := old.occurred_at;
      end if;
    end if;
  end if;

  if new.deleted_at is not null then
    return new;
  end if;

  if new.occurred_at > now() then
    raise exception 'Não é possível registrar um horário no futuro.' using errcode = '22023';
  end if;

  -- A sequência é validada só dentro do dia local do próprio lançamento: um dia passado nunca
  -- colide com o que existe hoje (ou em qualquer outro dia), mesmo que cronologicamente venha antes.
  v_work_date := (new.occurred_at at time zone 'America/Fortaleza')::date;

  select * into v_prev from public.time_entries
  where profile_id = new.profile_id and deleted_at is null
    and (occurred_at at time zone 'America/Fortaleza')::date = v_work_date
    and occurred_at < new.occurred_at
    and id is distinct from new.id
  order by occurred_at desc limit 1;

  select * into v_next from public.time_entries
  where profile_id = new.profile_id and deleted_at is null
    and (occurred_at at time zone 'America/Fortaleza')::date = v_work_date
    and occurred_at > new.occurred_at
    and id is distinct from new.id
  order by occurred_at asc limit 1;

  if new.kind = 'entrada' then
    if v_prev.kind = 'entrada' then
      raise exception 'Já existe uma entrada em aberto às % deste dia. Registre a saída antes de começar outra.',
        to_char(v_prev.occurred_at at time zone 'America/Fortaleza', 'HH24:MI')
        using errcode = '23514';
    end if;
    if v_next.kind = 'entrada' then
      raise exception 'Já existe uma entrada às % depois deste horário, no mesmo dia.',
        to_char(v_next.occurred_at at time zone 'America/Fortaleza', 'HH24:MI')
        using errcode = '23514';
    end if;
  else
    if v_prev.id is null or v_prev.kind <> 'entrada' then
      raise exception 'Não é possível registrar uma saída sem uma entrada em aberto neste dia.' using errcode = '23514';
    end if;
    if v_next.kind = 'saida' then
      raise exception 'Já existe uma saída às % depois deste horário, no mesmo dia.',
        to_char(v_next.occurred_at at time zone 'America/Fortaleza', 'HH24:MI')
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) effective_from opcional ("Início da contagem"): nulo = usa profiles.created_at.
-- ---------------------------------------------------------------------------

alter table public.work_schedules
  alter column effective_from drop not null,
  alter column effective_from drop default;

-- Os valores existentes vieram de um default arbitrário (-120 dias do momento da migração
-- original), não de uma escolha real da diretoria — zera para todo mundo cair no fallback correto.
update public.work_schedules set effective_from = null;

create or replace function public.create_default_work_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.work_schedules (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- time_daily_summary: "dias" agora partem de coalesce(effective_from, profiles.created_at), nunca
-- de antes de a pessoa existir. Mesma forma de saída (nenhuma view dependente precisa mudar).
-- ---------------------------------------------------------------------------

create or replace view public.time_daily_summary
with (security_invoker = true) as
with entries as (
  select
    te.profile_id,
    te.kind,
    te.occurred_at,
    (te.occurred_at at time zone 'America/Fortaleza')::date as work_date,
    row_number() over (
      partition by te.profile_id, (te.occurred_at at time zone 'America/Fortaleza')::date
      order by te.occurred_at
    ) as rn
  from public.time_entries te
  where te.deleted_at is null
),
pairs as (
  select
    e1.profile_id,
    e1.work_date,
    e1.occurred_at as entry_at,
    e2.occurred_at as exit_at
  from entries e1
  left join entries e2
    on e2.profile_id = e1.profile_id
   and e2.work_date = e1.work_date
   and e2.rn = e1.rn + 1
   and e2.kind = 'saida'
  where e1.kind = 'entrada'
),
worked as (
  select
    profile_id,
    work_date,
    min(entry_at) as first_entry,
    max(exit_at) as last_exit,
    sum(case when exit_at is not null then extract(epoch from (exit_at - entry_at)) / 60 else 0 end)::int as worked_minutes,
    bool_or(exit_at is null) as open_session
  from pairs
  group by profile_id, work_date
),
starts as (
  select
    ws.profile_id,
    ws.daily_hours,
    ws.workdays,
    coalesce(ws.effective_from, (p.created_at at time zone 'America/Fortaleza')::date) as start_date
  from public.work_schedules ws
  join public.profiles p on p.id = ws.profile_id
),
-- generate_series(date, date, interval) dependeria de cast implícito para timestamp; para bater
-- com o idioma já usado em cash_flow_projection, gera índices inteiros e soma em dias.
days as (
  select s.profile_id, (s.start_date + gs.n) as work_date, s.daily_hours, s.workdays
  from starts s,
    generate_series(0, greatest((now() at time zone 'America/Fortaleza')::date - s.start_date, 0)) as gs(n)
)
select
  d.profile_id,
  d.work_date,
  w.first_entry,
  w.last_exit,
  coalesce(w.worked_minutes, 0) as worked_minutes,
  coalesce(w.open_session, false) as open_session,
  (case when extract(isodow from d.work_date)::int = any (d.workdays) then round(d.daily_hours * 60) else 0 end)::int
    as expected_minutes,
  (coalesce(w.worked_minutes, 0)
    - (case when extract(isodow from d.work_date)::int = any (d.workdays) then round(d.daily_hours * 60) else 0 end))::int
    as balance_minutes
from days d
left join worked w on w.profile_id = d.profile_id and w.work_date = d.work_date;

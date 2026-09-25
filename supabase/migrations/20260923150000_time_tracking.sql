-- Banco de horas: registros de ponto (entrada/saída), carga horária por pessoa e as views de
-- saldo usadas pelo timer da home e pela página /banco-de-horas. Sem notificações (módulo
-- silencioso, de propósito). Sem cron: sessões esquecidas abertas são fechadas às 23:59 do dia
-- por uma função chamada de forma "fire-and-forget" a partir de uma Server Action no carregamento
-- da página (mesmo padrão de notify_overdue_finance, só que sem gerar notificação).

create type public.time_entry_kind as enum ('entrada', 'saida');
create type public.time_entry_source as enum ('timer', 'manual');

-- ---------------------------------------------------------------------------
-- time_entries
-- ---------------------------------------------------------------------------

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind public.time_entry_kind not null,
  occurred_at timestamptz not null,
  source public.time_entry_source not null default 'manual',
  note text,
  is_edited boolean not null default false,
  original_occurred_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index time_entries_profile_occurred_idx on public.time_entries (profile_id, occurred_at);
create index time_entries_profile_open_idx on public.time_entries (profile_id, occurred_at) where deleted_at is null;

create trigger time_entries_set_updated_at
  before update on public.time_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Regras de negócio: sem horário futuro, sem duas entradas (ou duas saídas) seguidas para a
-- mesma pessoa, e toda edição de conteúdo marca is_edited (preservando o horário original só na
-- primeira edição). SECURITY DEFINER: precisa olhar as linhas vizinhas do mesmo profile
-- independente da RLS de quem está chamando (o próprio dono já pode ler as próprias linhas, mas
-- isso evita qualquer acoplamento com a policy de select).
-- ---------------------------------------------------------------------------

create function public.time_entries_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
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

  select * into v_prev from public.time_entries
  where profile_id = new.profile_id and deleted_at is null and occurred_at < new.occurred_at
    and id is distinct from new.id
  order by occurred_at desc limit 1;

  select * into v_next from public.time_entries
  where profile_id = new.profile_id and deleted_at is null and occurred_at > new.occurred_at
    and id is distinct from new.id
  order by occurred_at asc limit 1;

  if new.kind = 'entrada' then
    if v_prev.kind = 'entrada' then
      raise exception 'Já existe um período em aberto. Encerre antes de começar outro.' using errcode = '23514';
    end if;
    if v_next.kind = 'entrada' then
      raise exception 'Já existe uma entrada registrada depois deste horário.' using errcode = '23514';
    end if;
  else
    if v_prev.id is null or v_prev.kind <> 'entrada' then
      raise exception 'Não é possível registrar uma saída sem uma entrada em aberto.' using errcode = '23514';
    end if;
    if v_next.kind = 'saida' then
      raise exception 'Já existe uma saída registrada depois deste horário.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger time_entries_before_insert
  before insert on public.time_entries
  for each row execute function public.time_entries_before_write();

create trigger time_entries_before_update
  before update on public.time_entries
  for each row execute function public.time_entries_before_write();

-- ---------------------------------------------------------------------------
-- activity_log: edição e exclusão (a criação em si não é logada, só o histórico de mudanças).
-- ---------------------------------------------------------------------------

create function public.time_entries_log_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    perform public.log_activity('deleted', 'time_entry', new.id,
      jsonb_build_object('kind', new.kind, 'occurred_at', new.occurred_at));
    return new;
  end if;

  if new.is_edited
     and (new.occurred_at is distinct from old.occurred_at or new.kind is distinct from old.kind or new.note is distinct from old.note) then
    perform public.log_activity('edited', 'time_entry', new.id,
      jsonb_build_object('kind', new.kind, 'from', old.occurred_at, 'to', new.occurred_at));
  end if;

  return new;
end;
$$;

create trigger time_entries_log_changes
  after update on public.time_entries
  for each row execute function public.time_entries_log_changes();

-- ---------------------------------------------------------------------------
-- RLS: cada pessoa só grava e edita as próprias linhas. Diretoria e admin só leem — nunca
-- inserem ou editam em nome de outra pessoa.
-- ---------------------------------------------------------------------------

alter table public.time_entries enable row level security;

create policy "time_entries_select" on public.time_entries for select to authenticated
  using (profile_id = auth.uid() or public.is_director() or public.is_admin());

create policy "time_entries_insert_own" on public.time_entries for insert to authenticated
  with check (profile_id = auth.uid() and (created_by is null or created_by = auth.uid()));

create policy "time_entries_update_own" on public.time_entries for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- work_schedules: carga horária e dias de trabalho por pessoa. Só diretoria/admin definem;
-- cada pessoa lê a própria. Uma linha por pessoa (sem histórico de versões).
-- ---------------------------------------------------------------------------

create table public.work_schedules (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  daily_hours numeric(4, 2) not null default 8 check (daily_hours > 0 and daily_hours <= 24),
  workdays int[] not null default '{1,2,3,4,5}' check (workdays <@ array[1, 2, 3, 4, 5, 6, 7]),
  effective_from date not null default ((now() at time zone 'America/Fortaleza')::date - 120),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger work_schedules_set_updated_at
  before update on public.work_schedules
  for each row execute function public.set_updated_at();

create function public.work_schedules_stamp_updated_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger work_schedules_stamp_updated_by
  before insert or update on public.work_schedules
  for each row execute function public.work_schedules_stamp_updated_by();

alter table public.work_schedules enable row level security;

create policy "work_schedules_select" on public.work_schedules for select to authenticated
  using (profile_id = auth.uid() or public.is_director() or public.is_admin());

create policy "work_schedules_write_directors" on public.work_schedules for all to authenticated
  using (public.is_director() or public.is_admin())
  with check (public.is_director() or public.is_admin());

-- Toda pessoa nasce com uma carga horária padrão (8h, seg–sex), editável depois pela diretoria.
-- effective_from = hoje (não o default de -120 dias da coluna, que existe só para o backfill
-- abaixo): sem isso, uma contratação nova apareceria com saldo negativo em dias antes de existir.
create function public.create_default_work_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.work_schedules (profile_id, effective_from)
  values (new.id, (now() at time zone 'America/Fortaleza')::date)
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

create trigger profiles_create_default_work_schedule
  after insert on public.profiles
  for each row execute function public.create_default_work_schedule();

-- Backfill para quem já existia antes desta migração.
insert into public.work_schedules (profile_id)
select id from public.profiles
on conflict (profile_id) do nothing;

-- ---------------------------------------------------------------------------
-- time_daily_summary: saldo por pessoa por dia, do início da carga horária até hoje. Pareia
-- entrada→saída em ordem (por isso a sessão que cruza a meia-noite precisa ser fechada antes —
-- ver close_stale_time_sessions() abaixo); dias sem nenhum registro entram com 0 minuto
-- trabalhado e o saldo negativo correspondente à carga esperada, se for dia útil.
-- security_invoker: a visibilidade vem só das RLS de time_entries/work_schedules — sem filtro
-- redundante aqui.
-- ---------------------------------------------------------------------------

create view public.time_daily_summary
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
-- generate_series(date, date, interval) dependeria de cast implícito para timestamp; para bater
-- com o idioma já usado em cash_flow_projection, gera índices inteiros e soma em dias.
days as (
  select ws.profile_id, (ws.effective_from + gs.n) as work_date, ws.daily_hours, ws.workdays
  from public.work_schedules ws,
    generate_series(0, greatest((now() at time zone 'America/Fortaleza')::date - ws.effective_from, 0)) as gs(n)
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

revoke all on public.time_daily_summary from anon;

-- ---------------------------------------------------------------------------
-- time_balance_summary: saldo total, do mês e da semana correntes, e total de horas trabalhadas.
-- ---------------------------------------------------------------------------

create view public.time_balance_summary
with (security_invoker = true) as
with bounds as (
  select
    date_trunc('month', (now() at time zone 'America/Fortaleza')::date)::date as month_start,
    date_trunc('week', (now() at time zone 'America/Fortaleza')::date)::date as week_start
)
select
  s.profile_id,
  sum(s.balance_minutes)::int as total_balance_minutes,
  sum(s.balance_minutes) filter (where s.work_date >= b.month_start)::int as month_balance_minutes,
  sum(s.balance_minutes) filter (where s.work_date >= b.week_start)::int as week_balance_minutes,
  sum(s.worked_minutes)::int as total_worked_minutes
from public.time_daily_summary s
cross join bounds b
group by s.profile_id;

revoke all on public.time_balance_summary from anon;

-- ---------------------------------------------------------------------------
-- close_stale_time_sessions: fecha, com nota "Fechado automaticamente", qualquer entrada aberta
-- de um dia anterior a hoje (America/Fortaleza) às 23:59 daquele dia. SECURITY DEFINER: precisa
-- fechar sessões de qualquer pessoa, não só de quem chamou. Idempotente — rodar de novo não cria
-- nada, porque a entrada já deixa de estar "aberta" depois da primeira saída inserida.
-- ---------------------------------------------------------------------------

create function public.close_stale_time_sessions()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Fortaleza')::date;
  v_row record;
begin
  for v_row in
    select te.id, te.profile_id, te.occurred_at
    from public.time_entries te
    where te.kind = 'entrada'
      and te.deleted_at is null
      and (te.occurred_at at time zone 'America/Fortaleza')::date < v_today
      and not exists (
        select 1 from public.time_entries te2
        where te2.profile_id = te.profile_id
          and te2.deleted_at is null
          and te2.kind = 'saida'
          and te2.occurred_at > te.occurred_at
      )
  loop
    insert into public.time_entries (profile_id, kind, occurred_at, source, note, created_by)
    values (
      v_row.profile_id,
      'saida',
      (((v_row.occurred_at at time zone 'America/Fortaleza')::date + time '23:59:00') at time zone 'America/Fortaleza'),
      'timer',
      'Fechado automaticamente',
      v_row.profile_id
    );
  end loop;
end;
$$;

revoke all on function public.close_stale_time_sessions() from public, anon;
grant execute on function public.close_stale_time_sessions() to authenticated;

-- Agenda (/agenda) sobre a tabela commitments: participantes, recorrência (RFC 5545), lembretes,
-- visibilidade, colunas reservadas para o Google Agenda, RLS nova, feed do calendário (com pautas
-- agendadas derivadas — não duplicadas) e detecção de conflitos.
-- A sincronização com o Google Agenda NÃO está implementada: só as colunas ficam prontas.

-- ---------------------------------------------------------------------------
-- Enums e colunas
-- ---------------------------------------------------------------------------

create type public.commitment_visibility as enum ('privado', 'equipe');
create type public.google_sync_status as enum ('nao_sincronizado', 'pendente', 'sincronizado', 'erro');

alter table public.commitments
  add column all_day boolean not null default false,
  -- Subconjunto de RFC 5545 que o feed expande: FREQ=DAILY|WEEKLY|MONTHLY, INTERVAL, COUNT, UNTIL.
  add column recurrence_rule text,
  add column attendees uuid[] not null default '{}',
  add column external_attendees jsonb not null default '[]'::jsonb,
  add column reminder_minutes int[] not null default '{30}',
  add column visibility public.commitment_visibility not null default 'equipe',
  add column company_id uuid references public.companies (id) on delete set null,
  -- Reservadas para a sincronização com o Google Agenda (conectada depois da publicação).
  add column google_sync_status public.google_sync_status not null default 'nao_sincronizado',
  add column google_calendar_id text,
  add constraint commitments_recurrence_rule_format check (
    recurrence_rule is null
    or recurrence_rule ~ '^FREQ=(DAILY|WEEKLY|MONTHLY)(;(INTERVAL=[0-9]{1,3}|COUNT=[0-9]{1,4}|UNTIL=[0-9]{8}(T[0-9]{6}Z?)?))*$'
  ),
  add constraint commitments_external_attendees_array check (jsonb_typeof(external_attendees) = 'array'),
  add constraint commitments_reminders_valid check (0 <= all (reminder_minutes) and cardinality(reminder_minutes) <= 5);

create index commitments_starts_idx on public.commitments (starts_at);
create index commitments_attendees_idx on public.commitments using gin (attendees);
create index commitments_pauta_idx on public.commitments (pauta_id);
create index commitments_project_idx on public.commitments (project_id);
create index commitments_company_idx on public.commitments (company_id);

-- ---------------------------------------------------------------------------
-- Helpers de acesso (fonte única: RLS, feed e conflitos usam as mesmas funções)
-- ---------------------------------------------------------------------------

-- Diretoria (squad ou nível) e master leem a agenda de todo mundo.
create function public.is_leadership()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_master() or public.is_director() or coalesce(public.current_org_level() = 'diretoria', false)
$$;

create function public.shares_squad_with(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profile_squads mine
    join public.profile_squads theirs on theirs.squad = mine.squad
    where mine.profile_id = auth.uid() and theirs.profile_id = p_profile_id
  )
$$;

-- Detalhes completos do compromisso: dono, criador ou participante; compromissos "equipe" também
-- para diretoria/master, colegas de squad do dono e quem acessa o negócio vinculado.
create function public.can_view_commitment(
  p_owner_id uuid,
  p_created_by uuid,
  p_attendees uuid[],
  p_visibility public.commitment_visibility,
  p_deal_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and (
    p_owner_id = auth.uid()
    or p_created_by = auth.uid()
    or auth.uid() = any (p_attendees)
    or (
      p_visibility = 'equipe'
      and (
        public.is_leadership()
        or public.shares_squad_with(p_owner_id)
        or (p_deal_id is not null and public.can_access_deal(p_deal_id))
      )
    )
  )
$$;

-- Quem enxerga um compromisso privado de outra pessoa como bloco "Ocupado".
create function public.can_see_busy_of(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and (public.is_leadership() or public.shares_squad_with(p_owner_id))
$$;

revoke all on function public.is_leadership() from public, anon;
revoke all on function public.shares_squad_with(uuid) from public, anon;
revoke all on function public.can_view_commitment(uuid, uuid, uuid[], public.commitment_visibility, uuid) from public, anon;
revoke all on function public.can_see_busy_of(uuid) from public, anon;
grant execute on function public.is_leadership() to authenticated;
grant execute on function public.shares_squad_with(uuid) to authenticated;
grant execute on function public.can_view_commitment(uuid, uuid, uuid[], public.commitment_visibility, uuid) to authenticated;
grant execute on function public.can_see_busy_of(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Consistência na escrita: participantes válidos, dia inteiro normalizado, cliente derivado do
-- vínculo e marcação "pendente" para o Google quando o evento já sincronizado muda.
-- ---------------------------------------------------------------------------

create function public.commitments_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.attendees := coalesce(
    array(select distinct a from unnest(new.attendees) a where a is not null and a <> new.owner_id),
    '{}'::uuid[]
  );

  if exists (
    select 1 from unnest(new.attendees) a
    where not exists (select 1 from public.profiles p where p.id = a and p.is_active)
  ) then
    raise exception 'Um dos participantes não está ativo no sistema.' using errcode = '23514';
  end if;

  if exists (
    select 1 from jsonb_array_elements(new.external_attendees) e
    where jsonb_typeof(e) <> 'object'
       or (coalesce(btrim(e ->> 'name'), '') = '' and coalesce(btrim(e ->> 'email'), '') = '')
  ) then
    raise exception 'Informe nome ou e-mail de cada participante externo.' using errcode = '23514';
  end if;

  if new.all_day then
    new.starts_at := date_trunc('day', new.starts_at at time zone 'America/Fortaleza') at time zone 'America/Fortaleza';
    new.ends_at := (date_trunc('day', new.ends_at at time zone 'America/Fortaleza') + interval '1 day' - interval '1 second')
      at time zone 'America/Fortaleza';
  end if;

  if new.pauta_id is not null and new.project_id is null then
    select p.project_id into new.project_id from public.pautas p where p.id = new.pauta_id;
  end if;
  if new.company_id is null then
    new.company_id := coalesce(
      (select pr.company_id from public.projects pr where pr.id = new.project_id),
      (select d.company_id from public.deals d where d.id = new.deal_id)
    );
  end if;

  if tg_op = 'UPDATE' and new.google_event_id is not null then
    if new.title is distinct from old.title
       or new.starts_at is distinct from old.starts_at
       or new.ends_at is distinct from old.ends_at
       or new.all_day is distinct from old.all_day
       or new.location_or_link is distinct from old.location_or_link
       or new.attendees is distinct from old.attendees
       or new.external_attendees is distinct from old.external_attendees
       or new.recurrence_rule is distinct from old.recurrence_rule
       or new.status is distinct from old.status then
      new.google_sync_status := 'pendente';
    end if;
  end if;

  return new;
end;
$$;

create trigger commitments_before_write
  before insert or update on public.commitments
  for each row execute function public.commitments_before_write();

-- Avisa quem entrou como participante (não avisa quem fez a alteração).
create function public.commitments_notify_attendees()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person uuid;
  v_previous uuid[] := '{}';
  v_when text := to_char(new.starts_at at time zone 'America/Fortaleza', 'DD/MM "às" HH24:MI');
  v_day text := to_char(new.starts_at at time zone 'America/Fortaleza', 'YYYY-MM-DD');
begin
  if tg_op = 'UPDATE' then
    v_previous := old.attendees;
  end if;

  for v_person in
    select a from unnest(new.attendees) a
    where a is distinct from auth.uid() and not (a = any (v_previous))
  loop
    perform public.notify(
      v_person, 'commitment_invited', 'Você foi adicionado a um compromisso',
      new.title || ' — ' || case when new.all_day then 'dia inteiro' else v_when end,
      'commitment', new.id, '/agenda?visao=dia&data=' || v_day || '&compromisso=' || new.id
    );
  end loop;

  if tg_op = 'INSERT' and new.owner_id is distinct from auth.uid() and new.owner_id is distinct from new.created_by then
    perform public.notify(
      new.owner_id, 'commitment_invited', 'Um compromisso foi marcado para você',
      new.title || ' — ' || case when new.all_day then 'dia inteiro' else v_when end,
      'commitment', new.id, '/agenda?visao=dia&data=' || v_day || '&compromisso=' || new.id
    );
  end if;
  return new;
end;
$$;

create trigger commitments_notify_attendees
  after insert or update of attendees on public.commitments
  for each row execute function public.commitments_notify_attendees();

-- ---------------------------------------------------------------------------
-- RLS: lê o dono, o criador e os participantes; "equipe" também os squads do dono, a diretoria e
-- o master. Privado de outra pessoa não é legível pela tabela — o feed o devolve como "Ocupado".
-- Editar ou cancelar: dono, criador ou diretoria.
-- ---------------------------------------------------------------------------

drop policy "commitments_select" on public.commitments;
drop policy "commitments_insert" on public.commitments;
drop policy "commitments_update" on public.commitments;
drop policy "commitments_delete" on public.commitments;

create policy "commitments_select" on public.commitments for select to authenticated
  using (public.can_view_commitment(owner_id, created_by, attendees, visibility, deal_id));

create policy "commitments_insert" on public.commitments for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_active_user()
    and (owner_id = auth.uid() or public.is_leadership() or public.is_head())
  );

create policy "commitments_update" on public.commitments for update to authenticated
  using (owner_id = auth.uid() or created_by = auth.uid() or public.is_leadership())
  with check (owner_id = auth.uid() or created_by = auth.uid() or public.is_leadership());

create policy "commitments_delete" on public.commitments for delete to authenticated
  using (owner_id = auth.uid() or created_by = auth.uid() or public.is_leadership());

-- ---------------------------------------------------------------------------
-- Recorrência: ocorrências de um evento dentro de [p_from, p_to)
-- ---------------------------------------------------------------------------

create function public.expand_recurrence(p_start timestamptz, p_rule text, p_from timestamptz, p_to timestamptz)
returns setof timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_freq text := substring(p_rule from 'FREQ=([A-Z]+)');
  v_interval int := greatest(coalesce(substring(p_rule from 'INTERVAL=([0-9]+)')::int, 1), 1);
  v_count int := substring(p_rule from 'COUNT=([0-9]+)')::int;
  v_until_raw text := substring(p_rule from 'UNTIL=([0-9]{8})');
  v_until timestamptz;
  v_step interval;
  v_n int := 0;
  v_occ timestamptz;
begin
  if p_rule is null then
    if p_start >= p_from and p_start < p_to then
      return next p_start;
    end if;
    return;
  end if;

  v_step := case v_freq
    when 'DAILY' then make_interval(days => v_interval)
    when 'WEEKLY' then make_interval(weeks => v_interval)
    when 'MONTHLY' then make_interval(months => v_interval)
  end;
  if v_step is null then
    return;
  end if;
  -- UNTIL é inclusivo: vale até o fim daquele dia em Fortaleza.
  if v_until_raw is not null then
    v_until := (to_date(v_until_raw, 'YYYYMMDD') + 1)::timestamp at time zone 'America/Fortaleza';
  end if;

  -- Diário/semanal: pula direto para perto da janela em vez de andar desde o início.
  if v_freq in ('DAILY', 'WEEKLY') and p_from > p_start then
    v_n := greatest(floor(extract(epoch from (p_from - p_start)) / extract(epoch from v_step))::int - 1, 0);
  end if;

  loop
    -- Sempre a partir do início (não do anterior): mensal no dia 31 não "escorrega" para o 28.
    v_occ := p_start + v_step * v_n;
    exit when v_occ >= p_to;
    exit when v_count is not null and v_n >= v_count;
    exit when v_until is not null and v_occ >= v_until;
    exit when v_n > 5000;
    if v_occ >= p_from then
      return next v_occ;
    end if;
    v_n := v_n + 1;
  end loop;
end;
$$;

grant execute on function public.expand_recurrence(timestamptz, text, timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Feed do calendário: compromissos (com recorrência expandida e privados mascarados) + pautas
-- agendadas (scheduled_at) do líder e dos responsáveis, derivadas na leitura — sem duplicar dados.
-- Uma pauta que já tem um compromisso vinculado (pauta_id) aparece só pelo compromisso.
-- ---------------------------------------------------------------------------

create function public.agenda_feed(
  p_from timestamptz,
  p_to timestamptz,
  p_people uuid[] default null,
  p_only_mine boolean default false
)
returns table (
  event_key text,
  source text,
  commitment_id uuid,
  pauta_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean,
  title text,
  kind public.commitment_kind,
  status public.commitment_status,
  busy_only boolean,
  visibility public.commitment_visibility,
  owner_id uuid,
  owner_name text,
  attendees uuid[],
  external_attendees jsonb,
  location_or_link text,
  notes text,
  company_id uuid,
  company_name text,
  company_logo_url text,
  project_id uuid,
  project_name text,
  deal_id uuid,
  recurrence_rule text,
  reminder_minutes int[],
  can_edit boolean,
  google_sync_status public.google_sync_status
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select
      auth.uid() as uid,
      public.is_leadership() as leadership,
      public.can_read_companies() as internal
  ),
  candidates as (
    select
      c.*,
      (c.owner_id = me.uid or c.created_by = me.uid or me.uid = any (c.attendees)) as involved,
      public.can_view_commitment(c.owner_id, c.created_by, c.attendees, c.visibility, c.deal_id) as full_access
    from public.commitments c, me
    where public.is_active_user()
      and c.status <> 'cancelado'
      and c.starts_at < p_to
      and (c.recurrence_rule is not null or c.ends_at > p_from)
      and (not p_only_mine or c.owner_id = me.uid or me.uid = any (c.attendees))
      and (p_people is null or c.owner_id = any (p_people) or c.attendees && p_people)
  ),
  visible as (
    select v.* from candidates v
    where v.full_access or (v.visibility = 'privado' and public.can_see_busy_of(v.owner_id))
  ),
  occurrences as (
    select v.id, o.occ as occ_start, o.occ + (v.ends_at - v.starts_at) as occ_end
    from visible v
    cross join lateral public.expand_recurrence(v.starts_at, v.recurrence_rule, p_from - (v.ends_at - v.starts_at), p_to) o(occ)
    where v.recurrence_rule is not null
    union all
    select v.id, v.starts_at, v.ends_at
    from visible v
    where v.recurrence_rule is null
  ),
  pauta_rows as (
    select
      p.*,
      array(
        select distinct x
        from unnest(array_append(array(select pm.profile_id from public.pauta_members pm where pm.pauta_id = p.id), p.current_assignee_id)) x
        where x is not null and x <> p.lead_id
      ) as people
    from public.pautas p
    where public.is_active_user()
      and p.archived_at is null
      and p.scheduled_at is not null
      and p.scheduled_at < p_to
      and p.scheduled_at + make_interval(mins => coalesce(p.duration_minutes, 60)) > p_from
      and not exists (select 1 from public.commitments cm where cm.pauta_id = p.id and cm.status <> 'cancelado')
      and public.can_view_pauta(p.id)
  )
  select
    'c:' || v.id::text || ':' || extract(epoch from o.occ_start)::bigint::text,
    'commitment',
    v.id,
    case when v.full_access then v.pauta_id end,
    o.occ_start,
    o.occ_end,
    v.all_day,
    case when v.full_access then v.title else 'Ocupado' end,
    case when v.full_access then v.kind else 'interno'::public.commitment_kind end,
    v.status,
    not v.full_access,
    v.visibility,
    v.owner_id,
    owner.full_name,
    case when v.full_access then v.attendees else '{}'::uuid[] end,
    case when v.full_access then v.external_attendees else '[]'::jsonb end,
    case when v.full_access then v.location_or_link end,
    case when v.full_access then v.notes end,
    case when v.full_access and me.internal then v.company_id end,
    case when v.full_access and me.internal then co.name end,
    case when v.full_access and me.internal then co.logo_url end,
    case when v.full_access then v.project_id end,
    case when v.full_access then pr.name end,
    case when v.full_access then v.deal_id end,
    v.recurrence_rule,
    case when v.full_access then v.reminder_minutes else '{}'::int[] end,
    v.full_access and (v.owner_id = me.uid or v.created_by = me.uid or me.leadership),
    v.google_sync_status
  from occurrences o
  join visible v on v.id = o.id
  cross join me
  join public.profiles owner on owner.id = v.owner_id
  left join public.companies co on co.id = v.company_id
  left join public.projects pr on pr.id = v.project_id
  where o.occ_start < p_to and o.occ_end > p_from

  union all

  select
    'p:' || p.id::text,
    'pauta',
    null,
    p.id,
    p.scheduled_at,
    p.scheduled_at + make_interval(mins => coalesce(p.duration_minutes, 60)),
    false,
    p.title,
    'captacao'::public.commitment_kind,
    'agendado'::public.commitment_status,
    false,
    'equipe'::public.commitment_visibility,
    p.lead_id,
    lead.full_name,
    p.people,
    '[]'::jsonb,
    p.location_address,
    null,
    case when me.internal then pr.company_id end,
    case when me.internal then co.name end,
    case when me.internal then co.logo_url end,
    p.project_id,
    pr.name,
    p.deal_id,
    null,
    '{}'::int[],
    false,
    'nao_sincronizado'::public.google_sync_status
  from pauta_rows p
  cross join me
  join public.profiles lead on lead.id = p.lead_id
  left join public.projects pr on pr.id = p.project_id
  left join public.companies co on co.id = pr.company_id
  where (not p_only_mine or p.lead_id = me.uid or me.uid = any (p.people))
    and (p_people is null or p.lead_id = any (p_people) or p.people && p_people)

  order by 5, 6
$$;

revoke all on function public.agenda_feed(timestamptz, timestamptz, uuid[], boolean) from public, anon;
grant execute on function public.agenda_feed(timestamptz, timestamptz, uuid[], boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Conflitos: o que já ocupa cada pessoa no intervalo (compromissos com horário — dia inteiro não
-- bloqueia — e pautas agendadas). Detecta mesmo o que quem consulta não pode ler; nesse caso o
-- título sai como "Ocupado".
-- ---------------------------------------------------------------------------

create function public.agenda_conflicts(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_people uuid[],
  p_exclude_id uuid default null
)
returns table (
  profile_id uuid,
  profile_name text,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  source text
)
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select distinct unnest(p_people) as pid
  ),
  commitment_hits as (
    select
      ppl.pid,
      case
        when public.can_view_commitment(c.owner_id, c.created_by, c.attendees, c.visibility, c.deal_id) then c.title
        else 'Ocupado'
      end as title,
      o.occ as occ_start,
      o.occ + (c.ends_at - c.starts_at) as occ_end
    from public.commitments c
    cross join lateral public.expand_recurrence(c.starts_at, c.recurrence_rule, p_starts_at - (c.ends_at - c.starts_at), p_ends_at) o(occ)
    join people ppl on ppl.pid = c.owner_id or ppl.pid = any (c.attendees)
    where c.status not in ('cancelado', 'remarcado')
      and not c.all_day
      and (p_exclude_id is null or c.id <> p_exclude_id)
      and c.starts_at < p_ends_at
  ),
  pauta_hits as (
    select
      ppl.pid,
      case when public.can_view_pauta(p.id) then p.title else 'Ocupado' end as title,
      p.scheduled_at as occ_start,
      p.scheduled_at + make_interval(mins => coalesce(p.duration_minutes, 60)) as occ_end
    from public.pautas p
    join people ppl
      on ppl.pid = p.lead_id
      or ppl.pid = p.current_assignee_id
      or exists (select 1 from public.pauta_members pm where pm.pauta_id = p.id and pm.profile_id = ppl.pid)
    where p.archived_at is null
      and p.board_column <> 'entregue'
      and p.scheduled_at is not null
      and not exists (
        select 1 from public.commitments cm
        where cm.pauta_id = p.id and cm.status <> 'cancelado' and (p_exclude_id is null or cm.id <> p_exclude_id)
      )
  ),
  hits as (
    select h.pid, h.title, h.occ_start, h.occ_end, 'commitment'::text as source from commitment_hits h
    union all
    select h.pid, h.title, h.occ_start, h.occ_end, 'pauta' from pauta_hits h
  )
  select h.pid, pr.full_name, h.title, h.occ_start, h.occ_end, h.source
  from hits h
  join public.profiles pr on pr.id = h.pid
  where public.is_active_user()
    and h.occ_start < p_ends_at
    and h.occ_end > p_starts_at
  order by pr.full_name, h.occ_start
$$;

revoke all on function public.agenda_conflicts(timestamptz, timestamptz, uuid[], uuid) from public, anon;
grant execute on function public.agenda_conflicts(timestamptz, timestamptz, uuid[], uuid) to authenticated;

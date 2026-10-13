-- Prazos do CRM fora da agenda do Anderson (pedido do Anderson, 12/10/2026).
--
-- Antes: a pauta-espelho de cada negócio do CRM aparecia na agenda (e no Google) de quem está com a bola. Como a
-- bola vai para o CEO em "Qualificado", os prazos ("próxima ação") dos negócios qualificados enchiam a agenda dele.
-- Regra única (crm_pauta_on_agenda_rule; os mesmos casos de lib/agenda/crm-items-cases.json): item do CRM vindo da
-- pauta-espelho (prazo ou horário) só aparece para quem está com a bola, e NUNCA para o CEO. As reuniões "com
-- Anderson" continuam: elas são compromissos da agenda (commitments), não a pauta-espelho. A sincronização com o
-- Google (lib/google/calendar.server.ts) usa a mesma regra em TypeScript; o que deixa de valer é apagado do Google
-- na próxima sincronização (só os eventos que o HQ criou). Bola, notificações e o card do negócio não mudam.
--
-- Só cria funções e recria agenda_feed com o mesmo corpo, trocando a condição do CRM pela regra.

create function public.crm_pauta_on_agenda_rule(p_assignee uuid, p_people uuid[], p_ceo uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_assignee = any (p_people), false) and p_assignee is distinct from p_ceo
$$;

create function public.crm_pauta_on_agenda(p_assignee uuid, p_people uuid[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.crm_pauta_on_agenda_rule(p_assignee, p_people, public.ceo_id())
$$;

grant execute on function public.crm_pauta_on_agenda(uuid, uuid[]) to authenticated;

create or replace function public.agenda_feed(
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
      -- CRM: compromisso de negócio só para quem participa ou está com a bola (Bloco 5).
      and (
        c.deal_id is null
        or c.owner_id = any (coalesce(p_people, array[me.uid]))
        or c.attendees && coalesce(p_people, array[me.uid])
        or exists (select 1 from public.deals d where d.id = c.deal_id and d.responsible_id = any (coalesce(p_people, array[me.uid])))
      )
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
      and (p.source <> 'crm' or public.crm_pauta_on_agenda(p.current_assignee_id, coalesce(p_people, array[auth.uid()])))
  ),
  deadline_base as (
    select
      p.*,
      case
        when p.due_time is null then (p.due_date + time '00:00') at time zone 'America/Fortaleza'
        else ((p.due_date + p.due_time) at time zone 'America/Fortaleza') - interval '30 minutes'
      end as due_starts,
      case
        when p.due_time is null then (p.due_date + time '23:59') at time zone 'America/Fortaleza'
        else (p.due_date + p.due_time) at time zone 'America/Fortaleza'
      end as due_ends
    from public.pautas p
    where public.is_active_user()
      and p.archived_at is null
      and p.due_date is not null
      and p.due_date between (p_from at time zone 'America/Fortaleza')::date - 1 and (p_to at time zone 'America/Fortaleza')::date + 1
      and p.board_column <> 'entregue'
      and p.status <> 'aprovado'
      and public.can_view_pauta(p.id)
      -- Prazo de negócio: só na agenda de quem está com a bola, e nunca na do CEO (crm_pauta_on_agenda).
      and (p.source <> 'crm' or public.crm_pauta_on_agenda(p.current_assignee_id, coalesce(p_people, array[auth.uid()])))
  ),
  deadline_rows as (
    select
      b.*,
      array(
        select distinct x
        from unnest(array_append(array(select pm.profile_id from public.pauta_members pm where pm.pauta_id = b.id), b.current_assignee_id)) x
        where x is not null and x <> b.lead_id
      ) as people
    from deadline_base b
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
  left join public.companies co on co.id = coalesce(pr.company_id, p.direct_company_id)
  where (not p_only_mine or p.lead_id = me.uid or me.uid = any (p.people))
    and (p_people is null or p.lead_id = any (p_people) or p.people && p_people)

  union all

  select
    'd:' || d.id::text,
    'pauta',
    null,
    d.id,
    d.due_starts,
    d.due_ends,
    d.due_time is null,
    'Prazo: ' || d.title,
    'entrega'::public.commitment_kind,
    'agendado'::public.commitment_status,
    false,
    'equipe'::public.commitment_visibility,
    d.lead_id,
    lead.full_name,
    d.people,
    '[]'::jsonb,
    null,
    null,
    case when me.internal then co.id end,
    case when me.internal then co.name end,
    case when me.internal then co.logo_url end,
    d.project_id,
    pr.name,
    d.deal_id,
    null,
    '{}'::int[],
    false,
    'nao_sincronizado'::public.google_sync_status
  from deadline_rows d
  cross join me
  join public.profiles lead on lead.id = d.lead_id
  left join public.projects pr on pr.id = d.project_id
  left join public.companies co on co.id = coalesce(pr.company_id, d.direct_company_id)
  where d.due_starts < p_to
    and d.due_ends > p_from
    and (not p_only_mine or d.lead_id = me.uid or me.uid = any (d.people))
    and (p_people is null or d.lead_id = any (p_people) or d.people && p_people)

  order by 5, 6
$$;

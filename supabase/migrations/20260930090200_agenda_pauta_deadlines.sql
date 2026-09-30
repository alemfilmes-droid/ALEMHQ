-- Agenda: além das captações agendadas, os PRAZOS das pautas/tarefas aparecem na agenda de quem
-- está nelas (líder, responsável, responsáveis e, na tarefa avulsa, a própria pessoa).
--  • Prazo com hora ("até as 18h"): bloco de 30 min terminando na hora do prazo.
--  • Prazo sem hora: evento de dia inteiro no dia do prazo.
--  • Pauta entregue/aprovada sai da agenda.
-- O cliente da captação passa a vir de pautas.direct_company_id (pautas sem projeto).
-- Mesma assinatura e retorno de antes: create or replace.

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

revoke all on function public.agenda_feed(timestamptz, timestamptz, uuid[], boolean) from public, anon;
grant execute on function public.agenda_feed(timestamptz, timestamptz, uuid[], boolean) to authenticated;

-- Bloco 5 — "Com a bola agora", agenda e notificações (pedido do Anderson).
--
-- 1. Bola (deals.responsible_id é a única fonte): prospecção (inclui "Em análise") → SDR; "Qualificado" →
--    o CEO (conta master); "Reunião agendada" → quem atende a reunião (Anderson ou o SDR, no kick-off);
--    depois disso (reunião realizada, proposta, negociação) → volta para o SDR. Direcionamento → SDR (já era).
-- 2. Agenda e Google: item de negócio (prazo da pauta do CRM, compromisso do negócio) só aparece para quem
--    está com a bola ou participa do compromisso. Os itens do SDR saem da agenda do Anderson (nada é apagado:
--    as tarefas continuam no CRM; a sincronização remove do Google só as cópias que o HQ tinha criado).
-- 3. Notificações: UMA regra (notification_rule) aplicada a toda notificação inserida (gatilho em
--    notifications — cobre notify() e as inserções diretas). Prazo/tarefa de negócio só para quem está com a
--    bola; para o CEO: audiovisual igual, comercial só nos 3 casos, financeiro só recebimento vencido e
--    pagamento vencendo, metas/comissões como estão (o Bloco 7 define os lembretes).
--
-- Só substitui funções (mesmas assinaturas) e cria funções/gatilho. Nenhum dado muda.

-- ---------------------------------------------------------------------------
-- O CEO: a conta master ativa (Anderson).
-- ---------------------------------------------------------------------------

create function public.ceo_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p where p.org_level = 'master' and p.is_active order by p.created_at limit 1
$$;

grant execute on function public.ceo_id() to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Bola
-- ---------------------------------------------------------------------------

-- Regra pura de quem fica com a bola ao mudar de etapa (espelhada em lib/crm/ball.ts e testada nos dois lados).
create function public.crm_ball_for_stage(p_stage public.deal_stage, p_owner uuid, p_ceo uuid, p_attendee uuid, p_current uuid)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    -- Prospecção (inclui "Em análise"): SDR.
    when p_stage in ('prospeccao', 'primeiro_contato', 'tentativas_contato', 'em_analise') then p_owner
    -- Qualificado: vai para a revisão do CEO.
    when p_stage = 'qualificado' then coalesce(p_ceo, p_owner)
    -- Reunião agendada: quem atende (Anderson, ou o SDR no kick-off).
    when p_stage = 'reuniao_agendada' then coalesce(p_attendee, p_current)
    when p_stage = 'perdido' then null
    -- Depois da reunião, o negócio volta para o SDR conduzir.
    when p_stage in ('reuniao_realizada', 'proposta_enviada', 'negociacao') then p_owner
    -- Ganho: o fechamento (close_deal_won) define o atendimento.
    else p_current
  end
$$;

create or replace function public.deals_route_responsible()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.responsible_id := coalesce(new.responsible_id, case when new.stage = 'perdido' then null else new.owner_id end);
    return new;
  end if;

  if new.stage is not distinct from old.stage then
    -- Quem estava com o próprio SDR continua com ele se o dono mudar.
    if new.owner_id is distinct from old.owner_id and old.responsible_id is not distinct from old.owner_id then
      new.responsible_id := new.owner_id;
    end if;
    return new;
  end if;

  new.responsible_id := public.crm_ball_for_stage(
    new.stage,
    new.owner_id,
    coalesce(public.ceo_id(), public.crm_head_id()),
    (select m.attendee_id from public.deal_meetings m where m.deal_id = new.id and m.result is null order by m.created_at desc limit 1),
    new.responsible_id
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Agenda (mesma função, com o filtro do CRM)
-- ---------------------------------------------------------------------------

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
      and (p.source <> 'crm' or p.current_assignee_id = any (coalesce(p_people, array[auth.uid()])))
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
      -- Prazo de negócio (próxima ação do SDR, abordagem vencida) só na agenda de quem está com a bola.
      and (p.source <> 'crm' or p.current_assignee_id = any (coalesce(p_people, array[auth.uid()])))
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

-- ---------------------------------------------------------------------------
-- 3. Notificações: uma regra só
-- ---------------------------------------------------------------------------

-- Regra pura (sem leitura de tabela): espelhada em lib/notifications/routing.ts e testada nos dois lados.
--   p_pauta_squad / p_pauta_is_crm: preenchidos quando a notificação é de uma pauta.
--   p_holds_ball: a pessoa é quem está com a bola (pauta do CRM: responsável atual; negócio: responsible_id).
create function public.notification_rule(
  p_recipient_is_ceo boolean,
  p_type text,
  p_pauta_squad public.squad,
  p_pauta_is_crm boolean,
  p_holds_ball boolean
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    -- Prazo/tarefa de negócio: só para quem está com a bola (vale para todo mundo).
    when coalesce(p_pauta_is_crm, false) and p_type in ('pauta_due_today', 'pauta_overdue', 'pauta_client_followup')
      then coalesce(p_holds_ball, false)
    when p_type in ('crm_action_overdue', 'crm_stale_prospection', 'crm_needs_update')
      then coalesce(p_holds_ball, false)
    when not p_recipient_is_ceo then true
    -- CEO · comercial: só resposta a direcionamento dele, negócio enviado para a revisão dele e bola com ele.
    when p_type in ('deal_responsible', 'deal_qualification_review', 'deal_request', 'deal_request_reply', 'deal_request_resolved') then true
    when p_type like 'deal\_%' or p_type like 'crm\_%' or p_type like 'prospect\_%' then false
    -- CEO · metas e comissões: como estão (o Bloco 7 define os lembretes).
    when p_type like 'goal\_%' or p_type in ('finance_commission', 'finance_commission_updated') then true
    -- CEO · financeiro: só recebimento vencido e pagamento vencendo. Nada de "tarefa a fazer".
    when p_type in ('finance_overdue_receivable', 'finance_due_today_payable') then true
    when p_type like 'finance\_%' then false
    -- CEO · pautas: audiovisual (e diretoria) como estão; pauta do CRM, comercial e financeiro não chegam.
    when p_type like 'pauta\_%' then not coalesce(p_pauta_is_crm, false) and coalesce(p_pauta_squad::text, 'audiovisual') not in ('comercial', 'financeiro')
    else true
  end
$$;

-- Junta os fatos da notificação (quem recebe, de que pauta/negócio) e aplica a regra.
create function public.notification_allowed(p_recipient uuid, p_type text, p_entity_type text, p_entity_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_is_ceo boolean;
  v_squad public.squad;
  v_is_crm boolean;
  v_holds boolean;
begin
  select coalesce(p.org_level = 'master', false) into v_is_ceo from public.profiles p where p.id = p_recipient;
  if p_entity_type = 'pauta' and p_entity_id is not null then
    select pt.squad, pt.source = 'crm', pt.current_assignee_id is not distinct from p_recipient
    into v_squad, v_is_crm, v_holds
    from public.pautas pt where pt.id = p_entity_id;
  elsif p_entity_type = 'deal' and p_entity_id is not null then
    select coalesce(d.responsible_id, d.owner_id) is not distinct from p_recipient into v_holds
    from public.deals d where d.id = p_entity_id;
  end if;
  return public.notification_rule(coalesce(v_is_ceo, false), p_type, v_squad, v_is_crm, v_holds);
end;
$$;

revoke all on function public.notification_allowed(uuid, text, text, uuid) from public, anon, authenticated;

create function public.notifications_route()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.notification_allowed(new.recipient_id, new.type, new.entity_type, new.entity_id) then
    return null;
  end if;
  return new;
end;
$$;

create trigger notifications_route
  before insert on public.notifications
  for each row execute function public.notifications_route();

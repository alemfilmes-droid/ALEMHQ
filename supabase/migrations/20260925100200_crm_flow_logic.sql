-- Fluxo comercial (3/3): regras de consistência no banco — roteamento de responsável, interação
-- obrigatória, agenda, propostas, comissão, SLA e os projetos financeiros de "Em negociação".
-- A UI só reflete e explica o que está aqui.

-- ---------------------------------------------------------------------------
-- Auxiliares
-- ---------------------------------------------------------------------------

-- Ordem do funil (substitui a versão sem "tentativas_contato"): sem isto a nova etapa compararia como NULL.
create or replace function public.deal_stage_rank(p_stage public.deal_stage)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_stage
    when 'prospeccao' then 0
    when 'primeiro_contato' then 1
    when 'tentativas_contato' then 2
    when 'qualificado' then 3
    when 'reuniao_agendada' then 4
    when 'reuniao_realizada' then 5
    when 'proposta_enviada' then 6
    when 'negociacao' then 7
    when 'ganho' then 8
    when 'perdido' then 8
  end
$$;

-- Movimentos feitos pelo próprio sistema (funções abaixo, service role, migração) não passam pelas
-- travas de interação/etapa. As funções ligam a GUC só durante o seu UPDATE e desligam em seguida.
create function public.crm_system_move()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is null or coalesce(current_setting('app.crm_system', true), '') = 'true'
$$;

create function public.crm_stage_label(p_stage public.deal_stage)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_stage
    when 'prospeccao' then 'Prospecção'
    when 'primeiro_contato' then 'Primeiro contato'
    when 'tentativas_contato' then 'Tentativas de contato'
    when 'qualificado' then 'Qualificado'
    when 'reuniao_agendada' then 'Reunião agendada'
    when 'reuniao_realizada' then 'Reunião realizada'
    when 'proposta_enviada' then 'Proposta enviada'
    when 'negociacao' then 'Negociação'
    when 'ganho' then 'Ganho'
    when 'perdido' then 'Perdido'
  end
$$;

create function public.crm_direction_label(p_task public.direction_task)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_task
    when 'marcar_reuniao_ceo' then 'Marcar reunião com o CEO'
    when 'qualificar_melhor' then 'Qualificar melhor o lead'
    when 'call_kickoff' then 'Fazer a call de kickoff'
    when 'enviar_material' then 'Enviar material ao cliente'
    when 'aguardar_retorno' then 'Aguardar retorno do cliente'
    when 'descartar' then 'Descartar o lead'
  end
$$;

create function public.crm_deal_qualified(p_deal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.deal_qualification q
    where q.deal_id = p_deal_id
      and coalesce(btrim(q.budget_range), '') <> ''
      and coalesce(btrim(q.project_type), '') <> ''
      and coalesce(btrim(q.desired_timeline), '') <> ''
      and q.decision_maker_contacted is not null
  )
$$;

-- O cliente respondeu à última proposta? (interação "resposta_cliente" registrada depois dela)
create function public.crm_client_responded(p_deal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.deal_proposals p where p.deal_id = p_deal_id)
    and exists (
      select 1 from public.deal_interactions i
      where i.deal_id = p_deal_id
        and i.kind = 'resposta_cliente'
        and i.created_at > coalesce(
          (select max(p.sent_at) from public.deal_proposals p where p.deal_id = p_deal_id),
          '-infinity'::timestamptz
        )
    )
$$;

create function public.crm_commission_percent(p_reheated boolean)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select r.percent
  from public.commission_rules r
  where r.kind = case when p_reheated then 'reaquecido'::public.commission_kind else 'padrao'::public.commission_kind end
    and r.effective_from <= now()
  order by r.effective_from desc
  limit 1
$$;

revoke all on function public.crm_deal_qualified(uuid) from public, anon;
revoke all on function public.crm_client_responded(uuid) from public, anon;
revoke all on function public.crm_commission_percent(boolean) from public, anon;
grant execute on function public.crm_deal_qualified(uuid) to authenticated;
grant execute on function public.crm_client_responded(uuid) to authenticated;
grant execute on function public.crm_commission_percent(boolean) to authenticated;

-- Pautas ligadas a negócios não geram a notificação genérica de pauta: o negócio já notifica
-- (com link direto para o card).
create or replace function public.pautas_notify_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deal_id is not null then
    return new;
  end if;

  if new.lead_id is distinct from auth.uid() then
    perform public.notify(new.lead_id, 'pauta_lead_assigned', 'Você é líder de uma pauta',
      new.title, 'pauta', new.id, '/pautas?pauta=' || new.id);
  end if;

  if new.current_assignee_id is not null
     and new.current_assignee_id is distinct from new.lead_id
     and new.current_assignee_id is distinct from auth.uid() then
    perform public.notify(new.current_assignee_id, 'pauta_assignee_changed', 'Você é responsável por uma pauta',
      new.title, 'pauta', new.id, '/pautas?pauta=' || new.id);
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- deal_interactions
-- ---------------------------------------------------------------------------

create function public.deal_interactions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stage is null then
    select d.stage into new.stage from public.deals d where d.id = new.deal_id;
  end if;
  if new.kind in ('tentativa_contato', 'resposta_cliente') and new.channel is null then
    raise exception 'Informe o canal do contato.' using errcode = '23514';
  end if;
  if new.kind = 'resposta_cliente' then
    new.responded := coalesce(new.responded, true);
  end if;
  return new;
end;
$$;

create trigger deal_interactions_before_insert
  before insert on public.deal_interactions
  for each row execute function public.deal_interactions_before_insert();

-- ---------------------------------------------------------------------------
-- Propostas: o valor do negócio acompanha a proposta mais recente
-- ---------------------------------------------------------------------------

create function public.deal_proposals_sync_value()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.deals d
  set estimated_value = (
    select p.amount from public.deal_proposals p
    where p.deal_id = new.deal_id
    order by p.sent_at desc, p.created_at desc
    limit 1
  )
  where d.id = new.deal_id;
  return new;
end;
$$;

create trigger deal_proposals_sync_value
  after insert or update of amount, sent_at on public.deal_proposals
  for each row execute function public.deal_proposals_sync_value();

-- ---------------------------------------------------------------------------
-- deals: trava de fluxo (interação obrigatória + pré-requisitos de cada etapa)
-- ---------------------------------------------------------------------------

drop trigger if exists deals_guard_qualification on public.deals;
drop function if exists public.deals_guard_qualification();

create function public.deals_guard_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_interaction uuid;
begin
  if new.stage is not distinct from old.stage or public.crm_system_move() then
    return new;
  end if;

  if old.stage = 'perdido' then
    raise exception 'Use "Definir reaquecimento" para reabrir um negócio perdido.' using errcode = '42501';
  end if;

  if not new.fast_track then
    if new.stage in ('reuniao_agendada', 'reuniao_realizada', 'proposta_enviada', 'negociacao', 'ganho')
       and not public.crm_deal_qualified(new.id) then
      raise exception 'Qualifique o negócio antes de avançar para esta etapa.' using errcode = '23514';
    end if;

    if old.stage = 'reuniao_agendada'
       and new.stage in ('reuniao_realizada', 'proposta_enviada', 'negociacao', 'ganho')
       and exists (select 1 from public.deal_meetings m where m.deal_id = new.id and m.result is null) then
      raise exception 'Registre o resultado da reunião antes de avançar.' using errcode = '23514';
    end if;

    if new.stage = 'reuniao_agendada'
       and not exists (select 1 from public.deal_meetings m where m.deal_id = new.id and m.result is null) then
      raise exception 'Agende a reunião para mover o negócio para esta etapa.' using errcode = '23514';
    end if;

    if new.stage = 'reuniao_realizada'
       and not exists (select 1 from public.deal_meetings m where m.deal_id = new.id and m.result is not null) then
      raise exception 'Registre o resultado de uma reunião para mover o negócio para esta etapa.' using errcode = '23514';
    end if;
  end if;

  if new.stage = 'proposta_enviada'
     and not exists (select 1 from public.deal_proposals p where p.deal_id = new.id) then
    raise exception 'Registre a proposta para mover o negócio para esta etapa.' using errcode = '23514';
  end if;

  if new.stage = 'negociacao' and not public.crm_client_responded(new.id) then
    raise exception 'O negócio só entra em negociação depois que o cliente responder à proposta. Registre a resposta do cliente.'
      using errcode = '23514';
  end if;

  select i.id into v_interaction
  from public.deal_interactions i
  where i.deal_id = new.id
    and i.stage_to = new.stage
    and i.consumed_at is null
    and i.author_id is not distinct from auth.uid()
    and i.created_at >= now() - interval '15 minutes'
  order by i.created_at desc
  limit 1;

  if v_interaction is null then
    raise exception 'Registre o contato realizado antes de mudar a etapa.' using errcode = '23514';
  end if;

  update public.deal_interactions set consumed_at = now() where id = v_interaction;
  return new;
end;
$$;

create trigger deals_guard_workflow
  before update of stage on public.deals
  for each row execute function public.deals_guard_workflow();

-- ---------------------------------------------------------------------------
-- deals: roteamento automático do responsável
-- ---------------------------------------------------------------------------

create function public.deals_route_responsible()
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

  if new.stage in ('prospeccao', 'primeiro_contato', 'tentativas_contato') then
    new.responsible_id := new.owner_id;
  elsif new.stage = 'qualificado' then
    new.responsible_id := coalesce(public.crm_head_id(), new.owner_id);
  elsif new.stage = 'reuniao_agendada' then
    new.responsible_id := coalesce(
      (select m.attendee_id from public.deal_meetings m where m.deal_id = new.id and m.result is null order by m.created_at desc limit 1),
      new.responsible_id
    );
  elsif new.stage = 'perdido' then
    new.responsible_id := null;
  elsif new.stage in ('reuniao_realizada', 'proposta_enviada', 'negociacao') then
    -- Continua com quem está com a bola (o atendente da reunião); na venda direta é sempre o SDR.
    if new.fast_track then
      new.responsible_id := new.owner_id;
    end if;
  end if;
  -- 'ganho': close_deal_won define o atendimento.
  return new;
end;
$$;

create trigger deals_route_responsible
  before insert or update on public.deals
  for each row execute function public.deals_route_responsible();

-- Substitui a função de timestamps (ver 20260924110000): agora também arma o cronômetro de reaquecimento.
create or replace function public.deals_set_stage_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    new.stage_changed_at := now();
  end if;

  if new.stage = 'ganho' and (tg_op = 'INSERT' or old.stage is distinct from 'ganho') then
    new.won_at := coalesce(new.won_at, now());
  end if;

  if new.stage = 'perdido' and (tg_op = 'INSERT' or old.stage is distinct from 'perdido') then
    new.lost_at := coalesce(new.lost_at, now());
    new.reheat_due_at := new.lost_at + interval '45 days';
    new.reheat_status := coalesce(new.reheat_status, 'aguardando');
    new.responsible_id := null;
  end if;

  if tg_op = 'UPDATE' then
    if new.stage <> 'perdido' and old.stage = 'perdido' then
      new.lost_reason := null;
      new.lost_note := null;
      new.lost_at := null;
      new.reheat_due_at := null;
    end if;
    if new.stage <> 'ganho' and old.stage = 'ganho' then
      new.won_at := null;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- deals: efeitos da mudança de responsável (log, pauta e notificação)
-- ---------------------------------------------------------------------------

create function public.deals_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_name text;
  v_new_name text;
  v_company text;
  v_note text;
  v_title text;
  v_head uuid;
  v_master record;
begin
  if new.responsible_id is not distinct from old.responsible_id then
    return new;
  end if;

  v_note := nullif(current_setting('app.crm_note', true), '');
  select p.full_name into v_old_name from public.profiles p where p.id = old.responsible_id;
  select p.full_name into v_new_name from public.profiles p where p.id = new.responsible_id;
  select c.name into v_company from public.companies c where c.id = new.company_id;

  insert into public.deal_activities (deal_id, kind, body, author_id)
  values (
    new.id, 'outro',
    'Responsável: ' || coalesce(v_old_name, 'ninguém') || ' → ' || coalesce(v_new_name, 'ninguém')
      || ' (etapa ' || public.crm_stage_label(new.stage) || ')',
    auth.uid()
  );

  if old.responsible_id is not null then
    update public.pautas
    set board_column = 'entregue'
    where deal_id = new.id and is_standalone and created_for = old.responsible_id and board_column <> 'entregue';
  end if;

  if new.responsible_id is null then
    return new;
  end if;

  if new.stage not in ('ganho', 'perdido', 'reuniao_agendada') then
    v_title := case
      when new.stage = 'qualificado' and new.responsible_id is distinct from new.owner_id then 'Revisar qualificação'
      else 'Agir no negócio'
    end || ' — ' || v_company || ' · ' || new.title;

    insert into public.pautas (
      title, briefing, priority, lead_id, current_assignee_id, is_standalone, created_for, due_date, deal_id, status
    ) values (
      v_title,
      coalesce(v_note, new.next_action),
      'alta',
      new.responsible_id, new.responsible_id, true, new.responsible_id,
      coalesce((new.next_action_at at time zone 'America/Fortaleza')::date, (now() at time zone 'America/Fortaleza')::date),
      new.id,
      'planejamento'
    );
  end if;

  if new.responsible_id is distinct from auth.uid() then
    perform public.notify(
      new.responsible_id,
      case when new.stage = 'qualificado' and new.responsible_id is distinct from new.owner_id
        then 'deal_qualification_review' else 'deal_responsible' end,
      case when new.stage = 'qualificado' and new.responsible_id is distinct from new.owner_id
        then 'Qualificação para revisar' else 'Você está com a bola em um negócio' end,
      v_company || ' · ' || new.title || ' — ' || coalesce(v_note, new.next_action, public.crm_stage_label(new.stage)),
      'deal', new.id, '/crm?negocio=' || new.id
    );
  end if;

  -- Ao qualificar, o master/CEO também é avisado para acompanhar a revisão.
  if new.stage = 'qualificado' and old.stage is distinct from 'qualificado' then
    v_head := new.responsible_id;
    for v_master in
      select p.id from public.profiles p
      where p.org_level = 'master' and p.is_active and p.id is distinct from v_head and p.id is distinct from auth.uid()
    loop
      perform public.notify(
        v_master.id, 'deal_qualification_review', 'Qualificação para revisar',
        v_company || ' · ' || new.title || ' foi qualificado e está com ' || coalesce(v_new_name, 'o head comercial'),
        'deal', new.id, '/crm?negocio=' || new.id
      );
    end loop;
  end if;

  return new;
end;
$$;

create trigger deals_after_update
  after update on public.deals
  for each row execute function public.deals_after_update();

-- ---------------------------------------------------------------------------
-- Reuniões: agenda (commitments), resultado e roteamento pós-reunião
-- ---------------------------------------------------------------------------

create function public.deal_meetings_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage public.deal_stage;
  v_fast boolean;
begin
  select d.stage, d.fast_track into v_stage, v_fast from public.deals d where d.id = new.deal_id;
  if v_stage in ('ganho', 'perdido') then
    raise exception 'Este negócio já foi encerrado.' using errcode = '23514';
  end if;
  if not v_fast and not public.crm_deal_qualified(new.deal_id) then
    raise exception 'Qualifique o negócio antes de avançar para esta etapa.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger deal_meetings_before_insert
  before insert on public.deal_meetings
  for each row execute function public.deal_meetings_before_insert();

-- Substitui a função da migração 20260924110000.
create or replace function public.deal_meetings_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deal public.deals;
  v_company text;
  v_attendee text;
  v_summary text;
  v_commitment uuid;
  v_when text;
begin
  select * into v_deal from public.deals where id = new.deal_id;
  select c.name into v_company from public.companies c where c.id = v_deal.company_id;
  select p.full_name into v_attendee from public.profiles p where p.id = new.attendee_id;
  v_when := to_char(new.scheduled_at at time zone 'America/Fortaleza', 'DD/MM "às" HH24:MI');

  insert into public.commitments (title, kind, starts_at, ends_at, location_or_link, owner_id, created_by, deal_id)
  values (
    'Reunião — ' || v_company || ' · ' || v_deal.title,
    'reuniao_comercial',
    new.scheduled_at,
    new.scheduled_at + make_interval(mins => new.duration_minutes),
    new.location_or_link,
    new.attendee_id,
    coalesce(auth.uid(), new.created_by),
    new.deal_id
  )
  returning id into v_commitment;

  update public.deal_meetings set commitment_id = v_commitment where id = new.id;

  select concat_ws(' · ', nullif(btrim(q.budget_range), ''), nullif(btrim(q.project_type), ''), nullif(btrim(q.desired_timeline), ''))
  into v_summary
  from public.deal_qualification q
  where q.deal_id = new.deal_id;

  insert into public.deal_interactions (deal_id, kind, approach, body, stage, stage_to, consumed_at, author_id)
  values (
    new.deal_id, 'reuniao', 'Agendamento',
    'Reunião agendada para ' || v_when || ' com ' || coalesce(v_attendee, 'o atendente') || '.',
    v_deal.stage, 'reuniao_agendada', now(), coalesce(auth.uid(), new.created_by, v_deal.owner_id)
  );

  perform set_config('app.crm_system', 'true', true);
  perform set_config('app.crm_note', 'Reunião ' || v_when || ' — ' || coalesce(v_summary, 'sem qualificação registrada'), true);
  update public.deals
  set stage = case
        when public.deal_stage_rank(stage) < public.deal_stage_rank('reuniao_agendada') then 'reuniao_agendada'::public.deal_stage
        else stage
      end,
      responsible_id = new.attendee_id,
      next_action = 'Reunião comercial',
      next_action_at = new.scheduled_at
  where id = new.deal_id;
  perform set_config('app.crm_system', 'false', true);
  perform set_config('app.crm_note', '', true);

  return new;
end;
$$;

create function public.deal_register_meeting_outcome(
  p_meeting_id uuid,
  p_result public.meeting_outcome,
  p_note text,
  p_next_action text default null,
  p_next_action_at timestamptz default null,
  p_new_starts_at timestamptz default null,
  p_new_duration int default null,
  p_new_location text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.deal_meetings;
  d public.deals;
  v_stage public.deal_stage;
  v_resp uuid;
  v_next text;
  v_next_at timestamptz;
  v_status public.commitment_status;
  v_label text;
begin
  select * into m from public.deal_meetings where id = p_meeting_id for update;
  if not found then
    raise exception 'Reunião não encontrada.' using errcode = '22023';
  end if;
  select * into d from public.deals where id = m.deal_id for update;

  if auth.uid() is not null and not (m.attendee_id = auth.uid() or public.can_access_all_deals()) then
    raise exception 'Só quem atende a reunião registra o resultado.' using errcode = '42501';
  end if;
  if m.result is not null then
    raise exception 'O resultado desta reunião já foi registrado.' using errcode = '22023';
  end if;
  if btrim(coalesce(p_note, '')) = '' then
    raise exception 'Registre o que aconteceu na reunião.' using errcode = '23514';
  end if;
  if p_result = 'remarcar' and p_new_starts_at is null then
    raise exception 'Informe a nova data da reunião.' using errcode = '23514';
  end if;

  v_label := case p_result
    when 'enviar_proposta' then 'Enviar proposta'
    when 'follow_up_sdr' then 'Follow-up com o SDR'
    when 'sem_interesse' then 'Sem interesse'
    when 'remarcar' then 'Remarcar'
    when 'nao_compareceu' then 'Não compareceu'
    when 'fechado_na_call' then 'Fechado na call'
  end;

  update public.deal_meetings
  set result = p_result, result_note = p_note, result_registered_at = now(), result_registered_by = auth.uid()
  where id = m.id;

  v_status := case p_result
    when 'nao_compareceu' then 'nao_compareceu'::public.commitment_status
    when 'remarcar' then 'remarcado'::public.commitment_status
    else 'realizado'::public.commitment_status
  end;
  update public.commitments set status = v_status where id = m.commitment_id;

  v_stage := case
    when public.deal_stage_rank(d.stage) > public.deal_stage_rank('reuniao_realizada') then d.stage
    when p_result in ('nao_compareceu', 'remarcar') then d.stage
    else 'reuniao_realizada'::public.deal_stage
  end;

  case p_result
    when 'enviar_proposta' then
      v_resp := m.attendee_id;
      v_next := coalesce(nullif(btrim(p_next_action), ''), 'Enviar proposta');
      v_next_at := coalesce(p_next_action_at, now() + interval '1 day');
    when 'fechado_na_call' then
      v_resp := m.attendee_id;
      v_next := coalesce(nullif(btrim(p_next_action), ''), 'Fechar o negócio');
      v_next_at := coalesce(p_next_action_at, now());
    when 'follow_up_sdr' then
      v_resp := d.owner_id;
      v_next := coalesce(nullif(btrim(p_next_action), ''), 'Follow-up pós-reunião');
      v_next_at := coalesce(p_next_action_at, now() + interval '1 day');
    when 'sem_interesse' then
      v_resp := d.owner_id;
      v_next := coalesce(nullif(btrim(p_next_action), ''), 'Decidir o destino do lead (sem interesse na reunião)');
      v_next_at := coalesce(p_next_action_at, now() + interval '1 day');
    when 'nao_compareceu' then
      v_resp := d.owner_id;
      v_next := coalesce(nullif(btrim(p_next_action), ''), 'Remarcar a reunião (cliente não compareceu)');
      v_next_at := coalesce(p_next_action_at, now() + interval '1 day');
    else
      v_resp := m.attendee_id;
      v_next := d.next_action;
      v_next_at := d.next_action_at;
  end case;

  insert into public.deal_interactions (deal_id, kind, approach, body, stage, stage_to, consumed_at, author_id)
  values (
    d.id, 'reuniao', 'Resultado: ' || v_label, p_note, d.stage,
    case when v_stage is distinct from d.stage then v_stage end,
    case when v_stage is distinct from d.stage then now() end,
    coalesce(auth.uid(), m.attendee_id)
  );

  if p_result = 'remarcar' then
    insert into public.deal_meetings (deal_id, scheduled_at, duration_minutes, attendee_id, location_or_link, created_by)
    values (m.deal_id, p_new_starts_at, coalesce(p_new_duration, m.duration_minutes), m.attendee_id,
            coalesce(nullif(btrim(p_new_location), ''), m.location_or_link), coalesce(auth.uid(), m.attendee_id));
  else
    perform set_config('app.crm_system', 'true', true);
    perform set_config('app.crm_note', p_note, true);
    update public.deals
    set stage = v_stage, responsible_id = v_resp, next_action = v_next, next_action_at = v_next_at
    where id = d.id;
    perform set_config('app.crm_system', 'false', true);
    perform set_config('app.crm_note', '', true);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fluxo do SDR e do head: criação, registro de contato, mudança de etapa, perda, direcionamento
-- (SECURITY INVOKER: a RLS continua valendo; as travas de etapa ficam nos triggers acima.)
-- ---------------------------------------------------------------------------

create function public.crm_create_deal(
  p_company_id uuid,
  p_company_name text,
  p_document text,
  p_segment text,
  p_city text,
  p_instagram text,
  p_website text,
  p_source public.company_source,
  p_primary_contact_id uuid,
  p_contact_name text,
  p_contact_job_title text,
  p_contact_phone text,
  p_contact_email text,
  p_title text,
  p_owner_id uuid,
  p_goals public.prospection_goal[],
  p_estimated_value numeric,
  p_expected_close_date date,
  p_next_action text,
  p_next_action_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company uuid := p_company_id;
  v_contact uuid := p_primary_contact_id;
  v_deal uuid;
begin
  if v_company is null then
    if btrim(coalesce(p_company_name, '')) = '' then
      raise exception 'Informe o nome da empresa.' using errcode = '23514';
    end if;
    insert into public.companies (name, document, segment, city, instagram, website, lifecycle, source)
    values (btrim(p_company_name), nullif(btrim(p_document), ''), nullif(btrim(p_segment), ''), nullif(btrim(p_city), ''),
            nullif(btrim(p_instagram), ''), nullif(btrim(p_website), ''), 'prospect', p_source)
    returning id into v_company;

    if btrim(coalesce(p_contact_name, '')) <> '' then
      insert into public.contacts (company_id, full_name, job_title, phone, email, is_primary)
      values (v_company, btrim(p_contact_name), nullif(btrim(p_contact_job_title), ''), nullif(btrim(p_contact_phone), ''),
              nullif(btrim(p_contact_email), ''), true)
      returning id into v_contact;
    end if;
  end if;

  insert into public.deals (
    company_id, primary_contact_id, title, owner_id, prospection_goals, estimated_value, expected_close_date,
    source, next_action, next_action_at
  ) values (
    v_company, v_contact, btrim(p_title), p_owner_id, coalesce(p_goals, '{}'), p_estimated_value, p_expected_close_date,
    p_source, btrim(p_next_action), p_next_action_at
  )
  returning id into v_deal;

  return v_deal;
end;
$$;

create function public.deal_log_interaction(
  p_deal_id uuid,
  p_kind public.deal_interaction_kind,
  p_channel public.deal_interaction_channel,
  p_approach text,
  p_body text,
  p_responded_to uuid default null,
  p_next_action text default null,
  p_next_action_at timestamptz default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.deal_interactions (deal_id, kind, channel, approach, body, responded_to_interaction_id)
  values (p_deal_id, p_kind, p_channel, nullif(btrim(p_approach), ''), p_body, p_responded_to)
  returning id into v_id;

  if nullif(btrim(p_next_action), '') is not null and p_next_action_at is not null then
    update public.deals set next_action = btrim(p_next_action), next_action_at = p_next_action_at where id = p_deal_id;
  end if;
  return v_id;
end;
$$;

create function public.deal_change_stage(
  p_deal_id uuid,
  p_stage public.deal_stage,
  p_kind public.deal_interaction_kind,
  p_channel public.deal_interaction_channel,
  p_approach text,
  p_body text,
  p_next_action text,
  p_next_action_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_stage not in ('ganho', 'perdido')
     and (nullif(btrim(p_next_action), '') is null or p_next_action_at is null) then
    raise exception 'Informe a próxima ação e a data.' using errcode = '23514';
  end if;

  insert into public.deal_interactions (deal_id, kind, channel, approach, body, stage_to)
  values (p_deal_id, p_kind, p_channel, nullif(btrim(p_approach), ''), p_body, p_stage);

  update public.deals
  set stage = p_stage,
      next_action = coalesce(nullif(btrim(p_next_action), ''), next_action),
      next_action_at = coalesce(p_next_action_at, next_action_at)
  where id = p_deal_id;

  if not found then
    raise exception 'Negócio não encontrado ou sem permissão.' using errcode = '42501';
  end if;
end;
$$;

create function public.deal_mark_lost(p_deal_id uuid, p_reason public.deal_loss_reason, p_note text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.deal_interactions (deal_id, kind, body, stage_to)
  values (p_deal_id, 'nota', coalesce(nullif(btrim(p_note), ''), 'Negócio perdido — motivo: ' || p_reason::text), 'perdido');

  update public.deals
  set stage = 'perdido', lost_reason = p_reason, lost_note = nullif(btrim(p_note), '')
  where id = p_deal_id;

  if not found then
    raise exception 'Negócio não encontrado ou sem permissão.' using errcode = '42501';
  end if;
end;
$$;

-- Direcionamento do head: registra, devolve a bola ao SDR com a tarefa e avisa.
create function public.deal_set_direction(
  p_deal_id uuid,
  p_task public.direction_task,
  p_note text,
  p_due timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.deals;
  v_label text := public.crm_direction_label(p_task);
begin
  if auth.uid() is not null and not public.can_access_all_deals() then
    raise exception 'Só head, diretoria e master fazem o direcionamento.' using errcode = '42501';
  end if;
  select * into d from public.deals where id = p_deal_id for update;
  if not found then
    raise exception 'Negócio não encontrado.' using errcode = '22023';
  end if;
  if d.stage in ('ganho', 'perdido') then
    raise exception 'Este negócio já foi encerrado.' using errcode = '23514';
  end if;
  if not public.crm_deal_qualified(p_deal_id) then
    raise exception 'Qualifique o negócio antes de dar o direcionamento.' using errcode = '23514';
  end if;
  if p_due is null then
    raise exception 'Informe a data da próxima ação.' using errcode = '23514';
  end if;

  insert into public.deal_interactions (deal_id, kind, approach, body, stage, stage_to, consumed_at, author_id)
  values (
    p_deal_id, 'direcionamento', v_label,
    coalesce(nullif(btrim(p_note), ''), v_label),
    d.stage,
    case when p_task = 'descartar' then 'perdido'::public.deal_stage end,
    case when p_task = 'descartar' then now() end,
    auth.uid()
  );

  perform set_config('app.crm_system', 'true', true);
  perform set_config('app.crm_note', coalesce(nullif(btrim(p_note), ''), v_label), true);
  if p_task = 'descartar' then
    update public.deals
    set stage = 'perdido', lost_reason = 'sem_fit', lost_note = coalesce(nullif(btrim(p_note), ''), v_label),
        direction_task = p_task, direction_note = nullif(btrim(p_note), '')
    where id = p_deal_id;
  else
    update public.deals
    set responsible_id = owner_id, next_action = v_label, next_action_at = p_due,
        direction_task = p_task, direction_note = nullif(btrim(p_note), '')
    where id = p_deal_id;
  end if;
  perform set_config('app.crm_system', 'false', true);
  perform set_config('app.crm_note', '', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Proposta e negociação
-- ---------------------------------------------------------------------------

create function public.deal_register_proposal(
  p_deal_id uuid,
  p_amount numeric,
  p_channel public.proposal_channel,
  p_document_url text,
  p_scope_notes text,
  p_next_action text,
  p_next_action_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.deals;
  v_id uuid;
  v_stage public.deal_stage;
begin
  select * into d from public.deals where id = p_deal_id for update;
  if not found then
    raise exception 'Negócio não encontrado.' using errcode = '22023';
  end if;
  if auth.uid() is not null and not public.can_access_deal(p_deal_id) then
    raise exception 'Você não tem acesso a este negócio.' using errcode = '42501';
  end if;
  if d.stage in ('ganho', 'perdido') then
    raise exception 'Este negócio já foi encerrado.' using errcode = '23514';
  end if;
  if not d.fast_track and public.deal_stage_rank(d.stage) < public.deal_stage_rank('reuniao_realizada') then
    raise exception 'A proposta só pode ser registrada depois da reunião.' using errcode = '23514';
  end if;
  if nullif(btrim(p_next_action), '') is null or p_next_action_at is null then
    raise exception 'Informe a próxima ação e a data.' using errcode = '23514';
  end if;

  insert into public.deal_proposals (deal_id, amount, sent_channel, document_url, scope_notes, sent_by)
  values (p_deal_id, p_amount, p_channel, nullif(btrim(p_document_url), ''), nullif(btrim(p_scope_notes), ''), auth.uid())
  returning id into v_id;

  v_stage := case
    when public.deal_stage_rank(d.stage) < public.deal_stage_rank('proposta_enviada') then 'proposta_enviada'::public.deal_stage
    else d.stage
  end;

  insert into public.deal_interactions (deal_id, kind, channel, approach, body, stage, stage_to, consumed_at, author_id)
  values (
    p_deal_id, 'proposta',
    case p_channel
      when 'whatsapp_pdf' then 'whatsapp'::public.deal_interaction_channel
      when 'email' then 'email'::public.deal_interaction_channel
      when 'ligacao' then 'ligacao'::public.deal_interaction_channel
      when 'meet' then 'meet'::public.deal_interaction_channel
      when 'presencial' then 'presencial'::public.deal_interaction_channel
      else 'outro'::public.deal_interaction_channel
    end,
    'Proposta',
    'Proposta de R$ ' || to_char(p_amount, 'FM999999990.00') || ' enviada.' || coalesce(' ' || nullif(btrim(p_scope_notes), ''), ''),
    d.stage,
    case when v_stage is distinct from d.stage then v_stage end,
    case when v_stage is distinct from d.stage then now() end,
    auth.uid()
  );

  perform set_config('app.crm_system', 'true', true);
  update public.deals
  set stage = v_stage, next_action = btrim(p_next_action), next_action_at = p_next_action_at
  where id = p_deal_id;
  perform set_config('app.crm_system', 'false', true);

  return v_id;
end;
$$;

create function public.deal_register_negotiation(
  p_deal_id uuid,
  p_proposal_id uuid,
  p_client_counter numeric,
  p_our_counter numeric,
  p_agreed numeric,
  p_channel public.deal_interaction_channel,
  p_notes text,
  p_next_action text,
  p_next_action_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.deals;
  v_id uuid;
  v_stage public.deal_stage;
begin
  select * into d from public.deals where id = p_deal_id for update;
  if not found then
    raise exception 'Negócio não encontrado.' using errcode = '22023';
  end if;
  if auth.uid() is not null and not public.can_access_deal(p_deal_id) then
    raise exception 'Você não tem acesso a este negócio.' using errcode = '42501';
  end if;
  if d.stage in ('ganho', 'perdido') then
    raise exception 'Este negócio já foi encerrado.' using errcode = '23514';
  end if;
  if not exists (select 1 from public.deal_proposals p where p.id = p_proposal_id and p.deal_id = p_deal_id) then
    raise exception 'Proposta não encontrada neste negócio.' using errcode = '22023';
  end if;
  if not public.crm_client_responded(p_deal_id) then
    raise exception 'O negócio só entra em negociação depois que o cliente responder à proposta. Registre a resposta do cliente.'
      using errcode = '23514';
  end if;
  if btrim(coalesce(p_notes, '')) = '' then
    raise exception 'Registre o que foi conversado na negociação.' using errcode = '23514';
  end if;
  if nullif(btrim(p_next_action), '') is null or p_next_action_at is null then
    raise exception 'Informe a próxima ação e a data.' using errcode = '23514';
  end if;

  insert into public.deal_negotiations (
    deal_id, proposal_id, client_counter_amount, our_counter_amount, agreed_amount, channel, notes
  ) values (p_deal_id, p_proposal_id, p_client_counter, p_our_counter, p_agreed, p_channel, btrim(p_notes))
  returning id into v_id;

  update public.deal_proposals set status = 'em_negociacao' where id = p_proposal_id and status = 'enviada';

  v_stage := case
    when public.deal_stage_rank(d.stage) < public.deal_stage_rank('negociacao') then 'negociacao'::public.deal_stage
    else d.stage
  end;

  insert into public.deal_interactions (deal_id, kind, channel, approach, body, stage, stage_to, consumed_at, author_id)
  values (
    p_deal_id, 'negociacao', p_channel, 'Negociação', btrim(p_notes), d.stage,
    case when v_stage is distinct from d.stage then v_stage end,
    case when v_stage is distinct from d.stage then now() end,
    auth.uid()
  );

  perform set_config('app.crm_system', 'true', true);
  update public.deals
  set stage = v_stage,
      next_action = btrim(p_next_action),
      next_action_at = p_next_action_at,
      estimated_value = coalesce(p_agreed, estimated_value)
  where id = p_deal_id;
  perform set_config('app.crm_system', 'false', true);

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ganho: cliente + projeto + atendimento (substitui a versão sem atendimento)
-- ---------------------------------------------------------------------------

drop function public.close_deal_won(uuid, text, public.project_model, numeric, public.client_tier, date, date, uuid);

create function public.close_deal_won(
  p_deal_id uuid,
  p_project_name text,
  p_project_model public.project_model,
  p_contract_value numeric,
  p_tier public.client_tier,
  p_start_date date,
  p_end_date date,
  p_project_owner_id uuid,
  p_atendimento_id uuid
)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deal public.deals;
  v_project public.projects;
  v_company text;
  v_atendimento text;
begin
  -- Sem JWT (service role, seed, migração): deixa passar, mesmo padrão de profiles_guard_update.
  if auth.uid() is not null and not public.can_access_all_deals() then
    raise exception 'Você não tem permissão para fechar negócios como ganhos.' using errcode = '42501';
  end if;

  select * into v_deal from public.deals where id = p_deal_id for update;
  if not found then
    raise exception 'Negócio não encontrado.' using errcode = '22023';
  end if;
  if v_deal.stage = 'ganho' then
    raise exception 'Este negócio já foi marcado como ganho.' using errcode = '22023';
  end if;
  if v_deal.stage = 'perdido' then
    raise exception 'Reabra o negócio antes de marcá-lo como ganho.' using errcode = '22023';
  end if;
  if not v_deal.fast_track and not public.crm_deal_qualified(p_deal_id) then
    raise exception 'Qualifique o negócio antes de avançar para esta etapa.' using errcode = '23514';
  end if;
  if not v_deal.fast_track
     and exists (select 1 from public.deal_meetings m where m.deal_id = p_deal_id and m.result is null) then
    raise exception 'Registre o resultado da reunião antes de avançar.' using errcode = '23514';
  end if;
  if p_atendimento_id is null
     or not exists (
       select 1 from public.profile_squads ps join public.profiles p on p.id = ps.profile_id
       where ps.profile_id = p_atendimento_id and ps.squad = 'comercial' and p.is_active
     ) then
    raise exception 'Selecione o atendimento responsável (uma pessoa do squad comercial).' using errcode = '23514';
  end if;

  select c.name into v_company from public.companies c where c.id = v_deal.company_id;
  select p.full_name into v_atendimento from public.profiles p where p.id = p_atendimento_id;

  insert into public.deal_interactions (deal_id, kind, body, stage, stage_to, consumed_at, author_id)
  values (
    p_deal_id, 'nota', 'Negócio ganho. Atendimento responsável: ' || coalesce(v_atendimento, '—') || '.',
    v_deal.stage, 'ganho', now(), auth.uid()
  );

  perform set_config('app.allow_deal_won', 'true', true);
  perform set_config('app.crm_system', 'true', true);
  perform set_config('app.crm_note', 'Onboarding de ' || v_company || ': o cliente acabou de fechar.', true);
  update public.deals
  set stage = 'ganho',
      responsible_id = p_atendimento_id,
      next_action = 'Fazer o onboarding do cliente',
      next_action_at = now() + interval '1 day',
      estimated_value = coalesce(p_contract_value, estimated_value)
  where id = p_deal_id;
  perform set_config('app.allow_deal_won', 'false', true);
  perform set_config('app.crm_system', 'false', true);
  perform set_config('app.crm_note', '', true);

  update public.deal_proposals set status = 'aceita'
  where id = (select p.id from public.deal_proposals p where p.deal_id = p_deal_id order by p.sent_at desc, p.created_at desc limit 1);

  update public.companies
  set lifecycle = 'client', tier = p_tier
  where id = v_deal.company_id;

  insert into public.projects (
    name, company_id, contact_id, deal_id, model, stage, owner_id, due_date, start_date, end_date, created_by
  ) values (
    p_project_name, v_deal.company_id, v_deal.primary_contact_id, p_deal_id, p_project_model, 'planejamento', p_project_owner_id,
    case when p_project_model = 'transacional' then p_end_date else null end,
    case when p_project_model = 'recorrente' then p_start_date else null end,
    case when p_project_model = 'recorrente' then p_end_date else null end,
    auth.uid()
  )
  returning * into v_project;

  insert into public.project_members (project_id, profile_id) values (v_project.id, p_project_owner_id) on conflict do nothing;
  insert into public.project_members (project_id, profile_id) values (v_project.id, p_atendimento_id) on conflict do nothing;

  if p_contract_value is not null and public.has_finance_access() then
    insert into public.project_financials (project_id, contract_value) values (v_project.id, p_contract_value);
  end if;

  -- Pauta de onboarding para o atendimento, já dentro do projeto novo.
  insert into public.pautas (project_id, title, briefing, priority, lead_id, current_assignee_id, due_date, deal_id, status)
  values (
    v_project.id, 'Onboarding — ' || v_company,
    'Receber o cliente, alinhar expectativas e coletar o que a produção precisa. Negócio ' || coalesce(v_deal.code, '') || '.',
    'alta', p_atendimento_id, p_atendimento_id,
    (now() at time zone 'America/Fortaleza')::date + 3, p_deal_id, 'planejamento'
  );

  if v_deal.owner_id is distinct from p_atendimento_id and v_deal.owner_id is distinct from auth.uid() then
    perform public.notify(
      v_deal.owner_id, 'deal_handoff', 'Seu negócio foi ganho e passou para o atendimento',
      v_company || ' · ' || v_deal.title || ' — atendimento: ' || coalesce(v_atendimento, '—') || '. A comissão continua com você.',
      'deal', p_deal_id, '/crm?negocio=' || p_deal_id
    );
  end if;

  perform public.log_activity('won', 'deal', p_deal_id, jsonb_build_object('project_id', v_project.id));

  return v_project;
end;
$$;

revoke all on function public.close_deal_won(uuid, text, public.project_model, numeric, public.client_tier, date, date, uuid, uuid) from public, anon;
grant execute on function public.close_deal_won(uuid, text, public.project_model, numeric, public.client_tier, date, date, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reaquecimento de leads frios
-- ---------------------------------------------------------------------------

create function public.deal_define_reheat(
  p_deal_id uuid,
  p_path text,
  p_body text,
  p_next_action text,
  p_next_action_at timestamptz,
  p_proposal_amount numeric default null,
  p_proposal_channel public.proposal_channel default null,
  p_document_url text default null,
  p_scope_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.deals;
  v_stage public.deal_stage;
begin
  select * into d from public.deals where id = p_deal_id for update;
  if not found then
    raise exception 'Negócio não encontrado.' using errcode = '22023';
  end if;
  if auth.uid() is not null and not (d.owner_id = auth.uid() or public.can_access_all_deals()) then
    raise exception 'Só o SDR dono do lead (ou a gestão) define o reaquecimento.' using errcode = '42501';
  end if;
  if d.stage <> 'perdido' or d.reheat_due_at is null or d.reheat_due_at > now()
     or d.reheat_status not in ('aguardando', 'notificado') then
    raise exception 'O reaquecimento só fica disponível 45 dias depois da perda.' using errcode = '23514';
  end if;
  if p_path not in ('nova_prospeccao', 'venda_direta') then
    raise exception 'Caminho de reaquecimento inválido.' using errcode = '22023';
  end if;
  if btrim(coalesce(p_body, '')) = '' then
    raise exception 'Registre como o lead foi reabordado.' using errcode = '23514';
  end if;
  if nullif(btrim(p_next_action), '') is null or p_next_action_at is null then
    raise exception 'Informe a próxima ação e a data.' using errcode = '23514';
  end if;

  v_stage := case p_path when 'venda_direta' then 'proposta_enviada'::public.deal_stage else 'prospeccao'::public.deal_stage end;

  if p_path = 'venda_direta' then
    if p_proposal_amount is null or p_proposal_amount <= 0 or p_proposal_channel is null then
      raise exception 'Registre a proposta (valor e canal) para a venda direta.' using errcode = '23514';
    end if;
    insert into public.deal_proposals (deal_id, amount, sent_channel, document_url, scope_notes, sent_by)
    values (p_deal_id, p_proposal_amount, p_proposal_channel, nullif(btrim(p_document_url), ''),
            nullif(btrim(p_scope_notes), ''), coalesce(auth.uid(), d.owner_id));
  end if;

  insert into public.deal_interactions (deal_id, kind, approach, body, stage, stage_to, consumed_at, author_id)
  values (
    p_deal_id,
    case when p_path = 'venda_direta' then 'proposta'::public.deal_interaction_kind else 'nota'::public.deal_interaction_kind end,
    case when p_path = 'venda_direta' then 'Reaquecimento — venda direta' else 'Reaquecimento — nova prospecção' end,
    btrim(p_body), d.stage, v_stage, now(), coalesce(auth.uid(), d.owner_id)
  );

  perform set_config('app.crm_system', 'true', true);
  perform set_config('app.crm_note', btrim(p_body), true);
  update public.deals
  set stage = v_stage,
      responsible_id = owner_id,
      is_reheated = true,
      fast_track = (p_path = 'venda_direta'),
      reheat_status = 'em_reaquecimento',
      next_action = btrim(p_next_action),
      next_action_at = p_next_action_at
  where id = p_deal_id;
  perform set_config('app.crm_system', 'false', true);
  perform set_config('app.crm_note', '', true);
end;
$$;

create function public.deal_discard_reheat(p_deal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not (
    exists (select 1 from public.deals d where d.id = p_deal_id and d.owner_id = auth.uid()) or public.can_access_all_deals()
  ) then
    raise exception 'Só o SDR dono do lead (ou a gestão) decide sobre o reaquecimento.' using errcode = '42501';
  end if;
  update public.deals set reheat_status = 'descartado'
  where id = p_deal_id and stage = 'perdido' and reheat_status in ('aguardando', 'notificado');
  if not found then
    raise exception 'Este lead não está aguardando decisão de reaquecimento.' using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Views: SLA e detalhes
-- ---------------------------------------------------------------------------

create view public.deals_sla
with (security_invoker = true) as
select
  d.id as deal_id,
  d.owner_id,
  d.responsible_id,
  d.stage,
  li.last_interaction_at,
  case when li.last_interaction_at is not null
    then round((extract(epoch from now() - li.last_interaction_at) / 3600)::numeric, 1) end as hours_since_last_interaction,
  round((extract(epoch from now() - d.stage_changed_at) / 3600)::numeric, 1) as hours_in_current_stage,
  (d.stage not in ('ganho', 'perdido') and d.next_action_at is not null and d.next_action_at < now()) as next_action_overdue,
  (
    d.stage not in ('ganho', 'perdido') and d.next_action_at is not null and d.next_action_at >= now()
    and (d.next_action_at at time zone 'America/Fortaleza')::date = (now() at time zone 'America/Fortaleza')::date
  ) as next_action_today,
  (d.stage = 'prospeccao' and d.created_at < now() - interval '48 hours' and li.last_interaction_at is null) as stale_prospection,
  (
    d.stage not in ('ganho', 'perdido')
    and greatest(coalesce(li.last_interaction_at, d.created_at), d.stage_changed_at) < now() - interval '24 hours'
  ) as needs_update,
  (d.stage = 'perdido' and d.reheat_status = 'aguardando' and d.reheat_due_at <= now()) as reheat_ready,
  (d.stage = 'perdido' and d.reheat_status in ('aguardando', 'notificado') and d.reheat_due_at <= now()) as can_reheat,
  case
    when d.stage in ('ganho', 'perdido') then 'neutral'
    when d.next_action_at < now()
      or (d.stage = 'prospeccao' and d.created_at < now() - interval '48 hours' and li.last_interaction_at is null)
      or greatest(coalesce(li.last_interaction_at, d.created_at), d.stage_changed_at) < now() - interval '48 hours' then 'danger'
    when (d.next_action_at at time zone 'America/Fortaleza')::date = (now() at time zone 'America/Fortaleza')::date
      or greatest(coalesce(li.last_interaction_at, d.created_at), d.stage_changed_at) < now() - interval '24 hours' then 'warning'
    else 'neutral'
  end as temperature,
  case
    when d.stage in ('ganho', 'perdido') then null
    when d.next_action_at < now() then 'Próxima ação vencida'
    when d.stage = 'prospeccao' and d.created_at < now() - interval '48 hours' and li.last_interaction_at is null
      then 'Sem nenhum contato há mais de 48h'
    when greatest(coalesce(li.last_interaction_at, d.created_at), d.stage_changed_at) < now() - interval '48 hours'
      then 'Parado há mais de 48h'
    when (d.next_action_at at time zone 'America/Fortaleza')::date = (now() at time zone 'America/Fortaleza')::date
      then 'Próxima ação vence hoje'
    when greatest(coalesce(li.last_interaction_at, d.created_at), d.stage_changed_at) < now() - interval '24 hours'
      then 'Sem atualização há mais de 24h'
    else 'Em dia'
  end as temperature_reason
from public.deals d
left join lateral (
  select max(i.occurred_at) as last_interaction_at
  from public.deal_interactions i
  where i.deal_id = d.id and i.kind <> 'direcionamento'
) li on true
where d.archived_at is null;

revoke all on public.deals_sla from anon;

create view public.deals_with_details
with (security_invoker = true) as
select
  d.*,
  c.name as company_name,
  c.lifecycle as company_lifecycle,
  ct.full_name as primary_contact_name,
  owner.full_name as owner_name,
  owner.avatar_url as owner_avatar_url,
  resp.full_name as responsible_name,
  resp.avatar_url as responsible_avatar_url,
  (select count(*)::int from public.deal_interactions i where i.deal_id = d.id) as interactions_count,
  s.last_interaction_at,
  public.crm_deal_qualified(d.id) as is_qualified,
  greatest(0, extract(day from now() - d.stage_changed_at))::int as days_in_stage,
  exists (select 1 from public.deal_meetings m where m.deal_id = d.id and m.result is null) as has_pending_meeting,
  (
    select m.id from public.deal_meetings m where m.deal_id = d.id and m.result is null order by m.scheduled_at limit 1
  ) as pending_meeting_id,
  lp.amount as latest_proposal_amount,
  lp.status as latest_proposal_status,
  lp.sent_at as latest_proposal_sent_at,
  case when d.owner_id = auth.uid() or public.can_access_all_deals()
    then public.crm_commission_percent(d.is_reheated) end as commission_percent,
  case when (d.owner_id = auth.uid() or public.can_access_all_deals()) and d.estimated_value is not null
    then round(d.estimated_value * public.crm_commission_percent(d.is_reheated) / 100, 2) end as commission_amount,
  (
    d.responsible_id = d.owner_id
    and d.stage in ('reuniao_agendada', 'reuniao_realizada')
    and exists (
      select 1 from public.deal_meetings m
      where m.deal_id = d.id
        and m.result in ('follow_up_sdr', 'sem_interesse', 'nao_compareceu')
        and m.result_registered_at > now() - interval '7 days'
    )
  ) as returned_from_meeting,
  s.hours_since_last_interaction,
  s.hours_in_current_stage,
  s.next_action_overdue,
  s.next_action_today,
  s.stale_prospection,
  s.needs_update,
  s.reheat_ready,
  s.can_reheat,
  s.temperature,
  s.temperature_reason
from public.deals d
join public.companies c on c.id = d.company_id
left join public.contacts ct on ct.id = d.primary_contact_id
join public.profiles owner on owner.id = d.owner_id
left join public.profiles resp on resp.id = d.responsible_id
left join public.deals_sla s on s.deal_id = d.id
left join lateral (
  select p.amount, p.status, p.sent_at
  from public.deal_proposals p
  where p.deal_id = d.id
  order by p.sent_at desc, p.created_at desc
  limit 1
) lp on true
where d.archived_at is null;

revoke all on public.deals_with_details from anon;

create view public.deals_needing_attention
with (security_invoker = true) as
select d.*
from public.deals_with_details d
where (d.stage not in ('ganho', 'perdido') and d.temperature <> 'neutral') or d.can_reheat;

revoke all on public.deals_needing_attention from anon;

-- ---------------------------------------------------------------------------
-- Alertas de SLA (sem cron): chamado na primeira carga do CRM/início do dia por pessoa.
-- No máximo uma notificação por negócio, tipo de alerta e dia.
-- ---------------------------------------------------------------------------

create function public.sync_crm_alerts()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_day timestamptz := (date_trunc('day', now() at time zone 'America/Fortaleza')) at time zone 'America/Fortaleza';
  r record;
  v_type text;
  v_title text;
  v_count int := 0;
begin
  if v_uid is null then
    return 0;
  end if;

  for r in
    select s.deal_id, s.next_action_overdue, s.stale_prospection, s.needs_update, s.reheat_ready,
           s.owner_id, s.responsible_id, d.title, c.name as company_name
    from public.deals_sla s
    join public.deals d on d.id = s.deal_id
    join public.companies c on c.id = d.company_id
    where (coalesce(s.responsible_id, s.owner_id) = v_uid and (s.next_action_overdue or s.stale_prospection or s.needs_update))
       or (s.owner_id = v_uid and s.reheat_ready)
  loop
    if coalesce(r.responsible_id, r.owner_id) = v_uid and (r.next_action_overdue or r.stale_prospection or r.needs_update) then
      if r.next_action_overdue then
        v_type := 'crm_action_overdue'; v_title := 'Próxima ação vencida';
      elsif r.stale_prospection then
        v_type := 'crm_stale_prospection'; v_title := 'Lead sem contato há mais de 48h';
      else
        v_type := 'crm_needs_update'; v_title := 'Negócio sem atualização há mais de 24h';
      end if;

      if not exists (
        select 1 from public.notifications n
        where n.recipient_id = v_uid and n.type = v_type and n.entity_id = r.deal_id and n.created_at >= v_day
      ) then
        perform public.notify(v_uid, v_type, v_title, r.company_name || ' · ' || r.title, 'deal', r.deal_id, '/crm?negocio=' || r.deal_id);
        v_count := v_count + 1;
      end if;
    end if;

    if r.owner_id = v_uid and r.reheat_ready then
      if not exists (
        select 1 from public.notifications n
        where n.recipient_id = v_uid and n.type = 'crm_reheat_ready' and n.entity_id = r.deal_id and n.created_at >= v_day
      ) then
        perform public.notify(
          v_uid, 'crm_reheat_ready', 'Lead frio há 45 dias — decida o reaquecimento',
          r.company_name || ' · ' || r.title, 'deal', r.deal_id, '/crm?negocio=' || r.deal_id
        );
        v_count := v_count + 1;
      end if;
      update public.deals set reheat_status = 'notificado' where id = r.deal_id and reheat_status = 'aguardando';
    end if;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Financeiro: projeção "Em negociação" (nunca misturada com recebíveis reais).
-- Leitura restrita a quem tem acesso ao financeiro; o squad financeiro não enxerga o CRM inteiro,
-- só esta projeção.
-- ---------------------------------------------------------------------------

create function public.finance_deals_in_negotiation()
returns table (
  deal_id uuid,
  code text,
  title text,
  company_id uuid,
  company_name text,
  stage public.deal_stage,
  owner_name text,
  proposal_amount numeric,
  proposal_sent_at timestamptz,
  proposal_status public.proposal_status,
  expected_close_date date,
  probability numeric,
  weighted_amount numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_finance_access() then
    raise exception 'Sem acesso ao financeiro.' using errcode = '42501';
  end if;

  return query
  select
    d.id, d.code, d.title, d.company_id, c.name, d.stage, o.full_name,
    lp.amount, lp.sent_at, lp.status, d.expected_close_date,
    coalesce(pr.probability, 0),
    round(lp.amount * coalesce(pr.probability, 0), 2)
  from public.deals d
  join public.companies c on c.id = d.company_id
  join public.profiles o on o.id = d.owner_id
  join lateral (
    select p.amount, p.sent_at, p.status
    from public.deal_proposals p
    where p.deal_id = d.id
    order by p.sent_at desc, p.created_at desc
    limit 1
  ) lp on true
  left join public.deal_stage_probabilities pr on pr.stage = d.stage
  where d.archived_at is null and d.stage not in ('ganho', 'perdido')
  order by lp.amount desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões de execução
-- ---------------------------------------------------------------------------

revoke all on function public.deal_register_meeting_outcome(uuid, public.meeting_outcome, text, text, timestamptz, timestamptz, int, text) from public, anon;
revoke all on function public.crm_create_deal(uuid, text, text, text, text, text, text, public.company_source, uuid, text, text, text, text, text, uuid, public.prospection_goal[], numeric, date, text, timestamptz) from public, anon;
revoke all on function public.deal_log_interaction(uuid, public.deal_interaction_kind, public.deal_interaction_channel, text, text, uuid, text, timestamptz) from public, anon;
revoke all on function public.deal_change_stage(uuid, public.deal_stage, public.deal_interaction_kind, public.deal_interaction_channel, text, text, text, timestamptz) from public, anon;
revoke all on function public.deal_mark_lost(uuid, public.deal_loss_reason, text) from public, anon;
revoke all on function public.deal_set_direction(uuid, public.direction_task, text, timestamptz) from public, anon;
revoke all on function public.deal_register_proposal(uuid, numeric, public.proposal_channel, text, text, text, timestamptz) from public, anon;
revoke all on function public.deal_register_negotiation(uuid, uuid, numeric, numeric, numeric, public.deal_interaction_channel, text, text, timestamptz) from public, anon;
revoke all on function public.deal_define_reheat(uuid, text, text, text, timestamptz, numeric, public.proposal_channel, text, text) from public, anon;
revoke all on function public.deal_discard_reheat(uuid) from public, anon;
revoke all on function public.sync_crm_alerts() from public, anon;
revoke all on function public.finance_deals_in_negotiation() from public, anon;

grant execute on function public.deal_register_meeting_outcome(uuid, public.meeting_outcome, text, text, timestamptz, timestamptz, int, text) to authenticated;
grant execute on function public.crm_create_deal(uuid, text, text, text, text, text, text, public.company_source, uuid, text, text, text, text, text, uuid, public.prospection_goal[], numeric, date, text, timestamptz) to authenticated;
grant execute on function public.deal_log_interaction(uuid, public.deal_interaction_kind, public.deal_interaction_channel, text, text, uuid, text, timestamptz) to authenticated;
grant execute on function public.deal_change_stage(uuid, public.deal_stage, public.deal_interaction_kind, public.deal_interaction_channel, text, text, text, timestamptz) to authenticated;
grant execute on function public.deal_mark_lost(uuid, public.deal_loss_reason, text) to authenticated;
grant execute on function public.deal_set_direction(uuid, public.direction_task, text, timestamptz) to authenticated;
grant execute on function public.deal_register_proposal(uuid, numeric, public.proposal_channel, text, text, text, timestamptz) to authenticated;
grant execute on function public.deal_register_negotiation(uuid, uuid, numeric, numeric, numeric, public.deal_interaction_channel, text, text, timestamptz) to authenticated;
grant execute on function public.deal_define_reheat(uuid, text, text, text, timestamptz, numeric, public.proposal_channel, text, text) to authenticated;
grant execute on function public.deal_discard_reheat(uuid) to authenticated;
grant execute on function public.sync_crm_alerts() to authenticated;
grant execute on function public.finance_deals_in_negotiation() to authenticated;

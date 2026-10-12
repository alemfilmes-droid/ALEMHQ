-- Prospecção (Módulo 4A, 2/2): Marcar reunião na agenda do Anderson, "Reunião aconteceu?" e o
-- vínculo CRM ↔ Orçamentos (docs/prospeccao/spec.md, 7.1 e 7.2). Só acréscimos.
--
-- A reunião reaproveita o fluxo do CRM: gravar em deal_meetings já cria o compromisso do
-- atendente (que o espelho leva ao Google), move o funil para "Reunião agendada" e registra o
-- histórico. Estas funções só acrescentam o que a prospecção precisa: título/descrição do evento,
-- Google Meet, e liberar o squad comercial (o registro de resultado existente é do atendente/gestão).
--
-- O HQ é a fonte da verdade da reunião: remarcar e cancelar é pelo card; o espelho acompanha.
--
-- Rollback (só se ainda não houver uso): drop function public.prospect_schedule_meeting,
-- public.prospect_reschedule_meeting, public.prospect_cancel_meeting, public.prospect_meeting_outcome,
-- public.prospect_quote_rejected, public.prospect_quote_approved, public.prospect_can_act;
-- alter table public.commitments drop column conference_requested, drop column meet_link;
-- delete from public.prospect_scripts where kind = 'oferta_reuniao'; recriar prospect_scripts_shape
-- sem o caso oferta_reuniao.

-- ---------------------------------------------------------------------------
-- Frase da oferta de horários (script compartilhado, editável em Configurações > Scripts)
-- ---------------------------------------------------------------------------

alter table public.prospect_scripts drop constraint prospect_scripts_shape;
alter table public.prospect_scripts add constraint prospect_scripts_shape check (
  case kind
    when 'toque_zero' then playbook_id is null and touch_zero_variant is not null and audience is null and touch_number is null
    when 'sem_gancho' then playbook_id is null and audience is not null and touch_zero_variant is null and touch_number is null
    when 'cliente_da_casa' then playbook_id is null and audience is not null and touch_zero_variant is null and touch_number is null
    when 'oferta_reuniao' then playbook_id is null and audience is null and touch_zero_variant is null and touch_number is null
    when 'toque' then playbook_id is not null and touch_number is not null and touch_zero_variant is null and audience is null
    when 'reativacao' then playbook_id is not null and touch_number is null and touch_zero_variant is null and audience is null
    else false
  end
);

insert into public.prospect_scripts (kind, body, updated_by)
values ('oferta_reuniao', $t${nome}, tenho dois horários com o Anderson, nosso diretor: {horario_1} ou {horario_2}. Qual fica melhor para você?$t$, null)
on conflict on constraint prospect_scripts_unique do nothing;

-- ---------------------------------------------------------------------------
-- Google Meet no compromisso (o espelho pede a sala ao criar o evento e guarda o link)
-- ---------------------------------------------------------------------------

alter table public.commitments
  add column conference_requested boolean not null default false,
  add column meet_link text check (meet_link is null or length(meet_link) <= 300);

-- ---------------------------------------------------------------------------
-- Quem age na prospecção: squad comercial ou master, com acesso ao negócio
-- (espelha a capability "prospectActions" de lib/auth/permissions.ts).
-- ---------------------------------------------------------------------------

create function public.prospect_can_act(p_deal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_access_deal(p_deal_id) and (public.in_squad('comercial') or public.is_master())
$$;

revoke all on function public.prospect_can_act(uuid) from public, anon;
grant execute on function public.prospect_can_act(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Marcar reunião
-- ---------------------------------------------------------------------------

create function public.prospect_schedule_meeting(
  p_deal_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes int,
  p_attendee_id uuid,
  p_title text,
  p_notes text,
  p_meet boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meeting uuid;
begin
  if not public.prospect_can_act(p_deal_id) then
    raise exception 'Só o squad comercial marca reuniões da prospecção.' using errcode = '42501';
  end if;
  if exists (select 1 from public.deal_meetings m where m.deal_id = p_deal_id and m.result is null) then
    raise exception 'Este lead já tem reunião marcada. Use Reagendar.' using errcode = '23514';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_attendee_id and p.is_active) then
    raise exception 'Quem atende a reunião não foi encontrado.' using errcode = '22023';
  end if;
  if p_duration_minutes not between 5 and 480 then
    raise exception 'Duração da reunião inválida.' using errcode = '22023';
  end if;

  insert into public.deal_meetings (deal_id, scheduled_at, duration_minutes, attendee_id, created_by)
  values (p_deal_id, p_starts_at, p_duration_minutes, p_attendee_id, auth.uid())
  returning id into v_meeting;

  update public.commitments c
  set title = left(btrim(p_title), 200), notes = nullif(btrim(p_notes), ''), conference_requested = coalesce(p_meet, false)
  from public.deal_meetings m
  where m.id = v_meeting and c.id = m.commitment_id;

  return v_meeting;
end;
$$;

revoke all on function public.prospect_schedule_meeting(uuid, timestamptz, int, uuid, text, text, boolean) from public, anon;
grant execute on function public.prospect_schedule_meeting(uuid, timestamptz, int, uuid, text, text, boolean) to authenticated;

-- Reagendar: o mesmo compromisso (e o mesmo evento no Google) vai para o novo horário.
create function public.prospect_reschedule_meeting(p_meeting_id uuid, p_starts_at timestamptz, p_meet boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.deal_meetings;
  v_when text := to_char(p_starts_at at time zone 'America/Fortaleza', 'DD/MM "às" HH24:MI');
begin
  select * into m from public.deal_meetings where id = p_meeting_id for update;
  if m.id is null or not public.prospect_can_act(m.deal_id) then
    raise exception 'Reunião não encontrada ou sem permissão.' using errcode = '42501';
  end if;
  if m.result is not null then
    raise exception 'O resultado desta reunião já foi registrado.' using errcode = '23514';
  end if;

  update public.deal_meetings set scheduled_at = p_starts_at where id = m.id;
  update public.commitments
  set starts_at = p_starts_at,
      ends_at = p_starts_at + make_interval(mins => m.duration_minutes),
      status = 'agendado',
      conference_requested = coalesce(p_meet, conference_requested)
  where id = m.commitment_id;

  insert into public.deal_interactions (deal_id, kind, approach, body, stage, author_id)
  select m.deal_id, 'reuniao', 'Reagendamento', 'Reunião remarcada para ' || v_when || '.', d.stage, auth.uid()
  from public.deals d where d.id = m.deal_id;

  perform set_config('app.crm_system', 'true', true);
  update public.deals set next_action = 'Reunião comercial', next_action_at = p_starts_at where id = m.deal_id;
  perform set_config('app.crm_system', 'false', true);
end;
$$;

revoke all on function public.prospect_reschedule_meeting(uuid, timestamptz, boolean) from public, anon;
grant execute on function public.prospect_reschedule_meeting(uuid, timestamptz, boolean) to authenticated;

-- Cancelar: o evento sai do Google (compromisso cancelado) e o lead volta para "Em conversa".
create function public.prospect_cancel_meeting(p_meeting_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.deal_meetings;
begin
  select * into m from public.deal_meetings where id = p_meeting_id for update;
  if m.id is null or not public.prospect_can_act(m.deal_id) then
    raise exception 'Reunião não encontrada ou sem permissão.' using errcode = '42501';
  end if;
  if m.result is not null then
    raise exception 'O resultado desta reunião já foi registrado.' using errcode = '23514';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'Escreva o motivo do cancelamento.' using errcode = '23514';
  end if;

  update public.commitments set status = 'cancelado' where id = m.commitment_id;
  insert into public.deal_interactions (deal_id, kind, approach, body, stage, author_id)
  select m.deal_id, 'reuniao', 'Cancelamento', 'Reunião cancelada: ' || btrim(p_reason), d.stage, auth.uid()
  from public.deals d where d.id = m.deal_id;
  delete from public.deal_meetings where id = m.id;

  perform set_config('app.crm_system', 'true', true);
  update public.deals
  set stage = case when stage = 'reuniao_agendada' then 'tentativas_contato'::public.deal_stage else stage end,
      responsible_id = owner_id,
      prospect_replied_at = now(),
      next_action = 'Remarcar a reunião',
      next_action_at = now() + interval '1 day'
  where id = m.deal_id;
  perform set_config('app.crm_system', 'false', true);
end;
$$;

revoke all on function public.prospect_cancel_meeting(uuid, text) from public, anon;
grant execute on function public.prospect_cancel_meeting(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- "Reunião aconteceu?" — Sim: realizada + rascunho em Orçamentos (retorna o id do orçamento).
-- Não compareceu: volta para "Em conversa" para remarcar.
-- ---------------------------------------------------------------------------

create function public.prospect_meeting_outcome(p_meeting_id uuid, p_held boolean, p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.deal_meetings;
  d public.deals;
  v_note text := coalesce(nullif(btrim(p_note), ''), case when p_held then 'Reunião realizada.' else 'Cliente não compareceu.' end);
  v_company text;
  v_playbook text;
  v_budget uuid;
  v_last record;
begin
  select * into m from public.deal_meetings where id = p_meeting_id for update;
  if m.id is null or not public.prospect_can_act(m.deal_id) then
    raise exception 'Reunião não encontrada ou sem permissão.' using errcode = '42501';
  end if;
  if m.result is not null then
    raise exception 'O resultado desta reunião já foi registrado.' using errcode = '23514';
  end if;
  select * into d from public.deals where id = m.deal_id for update;

  update public.deal_meetings
  set result = case when p_held then 'enviar_proposta' else 'nao_compareceu' end::public.meeting_outcome,
      result_note = v_note, result_registered_at = now(), result_registered_by = auth.uid()
  where id = m.id;
  update public.commitments
  set status = case when p_held then 'realizado' else 'nao_compareceu' end::public.commitment_status
  where id = m.commitment_id;

  insert into public.deal_interactions (deal_id, kind, approach, body, stage, author_id)
  values (d.id, 'reuniao', case when p_held then 'Resultado: Enviar proposta' else 'Resultado: Não compareceu' end, v_note, d.stage, auth.uid());

  perform set_config('app.crm_system', 'true', true);
  if p_held then
    update public.deals
    set stage = case when public.deal_stage_rank(stage) < public.deal_stage_rank('reuniao_realizada') then 'reuniao_realizada'::public.deal_stage else stage end,
        responsible_id = m.attendee_id,
        next_action = 'Enviar proposta',
        next_action_at = now() + interval '1 day'
    where id = d.id;
  else
    update public.deals
    set stage = case when stage = 'reuniao_agendada' then 'tentativas_contato'::public.deal_stage else stage end,
        responsible_id = owner_id,
        prospect_replied_at = now(),
        next_action = 'Remarcar a reunião (cliente não compareceu)',
        next_action_at = now() + interval '1 day'
    where id = d.id;
  end if;
  perform set_config('app.crm_system', 'false', true);

  if not p_held then
    return null;
  end if;

  -- Rascunho em Orçamentos (um por negócio): cliente, negócio e produto (playbook) já preenchidos.
  select b.id into v_budget from public.budgets b where b.deal_id = d.id order by b.created_at desc limit 1;
  if v_budget is not null then
    return v_budget;
  end if;
  select c.name into v_company from public.companies c where c.id = d.company_id;
  select p.name into v_playbook from public.prospect_playbooks p where p.id = d.prospect_playbook_id;
  select b.fee_pct, b.tax_pct, b.payment_terms into v_last from public.budgets b order by b.created_at desc limit 1;

  insert into public.budgets (client_name, company_id, deal_id, title, fee_pct, tax_pct, payment_terms, notes, created_by)
  values (
    coalesce(v_company, d.title),
    d.company_id,
    d.id,
    left(coalesce(v_playbook, d.title) || ' · ' || coalesce(v_company, ''), 160),
    coalesce(v_last.fee_pct, 30),
    coalesce(v_last.tax_pct, 6),
    coalesce(v_last.payment_terms, '50% na aprovação e 50% na entrega.'),
    left(concat_ws(E'\n',
      'Criado pela prospecção depois da reunião.',
      'Decisor: ' || nullif(concat_ws(' · ', d.prospect_decision_maker_name, d.prospect_decision_maker_role), ''),
      'Playbook: ' || v_playbook
    ), 2000),
    auth.uid()
  )
  returning id into v_budget;
  return v_budget;
end;
$$;

revoke all on function public.prospect_meeting_outcome(uuid, boolean, text) from public, anon;
grant execute on function public.prospect_meeting_outcome(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Orçamentos → CRM
-- ---------------------------------------------------------------------------

-- Recusado: o negócio vai para Perdido com o motivo e volta como "Reativar" na data (prospecção).
create function public.prospect_quote_rejected(p_budget_id uuid, p_reason public.deal_loss_reason, p_note text, p_reactivate_on date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deal uuid;
begin
  if not public.can_manage_budgets() then
    raise exception 'Só o master e o financeiro decidem orçamentos.' using errcode = '42501';
  end if;
  if btrim(coalesce(p_note, '')) = '' then
    raise exception 'Escreva o motivo da recusa.' using errcode = '23514';
  end if;
  if p_reactivate_on is null or p_reactivate_on <= (now() at time zone 'America/Fortaleza')::date then
    raise exception 'Escolha uma data de reativação a partir de amanhã.' using errcode = '23514';
  end if;
  select b.deal_id into v_deal from public.budgets b where b.id = p_budget_id;
  if v_deal is null then
    raise exception 'Este orçamento não está ligado a um negócio do CRM.' using errcode = '22023';
  end if;

  insert into public.deal_interactions (deal_id, kind, body, stage, author_id)
  select v_deal, 'nota', 'Orçamento recusado: ' || btrim(p_note) || '. Reativar em ' || to_char(p_reactivate_on, 'DD/MM/YYYY') || '.', d.stage, auth.uid()
  from public.deals d where d.id = v_deal;

  perform set_config('app.crm_system', 'true', true);
  update public.deals
  set stage = 'perdido',
      lost_reason = p_reason,
      lost_note = btrim(p_note),
      prospect_manual_reactivation_on = case when prospect_playbook_id is not null then p_reactivate_on else prospect_manual_reactivation_on end,
      next_action = 'Reativar depois da recusa do orçamento',
      next_action_at = (p_reactivate_on::text || 'T09:00:00-03:00')::timestamptz
  where id = v_deal and stage <> 'ganho';
  perform set_config('app.crm_system', 'false', true);
end;
$$;

revoke all on function public.prospect_quote_rejected(uuid, public.deal_loss_reason, text, date) from public, anon;
grant execute on function public.prospect_quote_rejected(uuid, public.deal_loss_reason, text, date) to authenticated;

-- Aprovado: a empresa do lead vira cliente. Retorna negócio e valor para o evento quoteApproved.
create function public.prospect_quote_approved(p_budget_id uuid)
returns table (deal_id uuid, amount numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_budget public.budgets;
begin
  if not public.can_manage_budgets() then
    raise exception 'Só o master e o financeiro decidem orçamentos.' using errcode = '42501';
  end if;
  select * into v_budget from public.budgets b where b.id = p_budget_id;
  if v_budget.id is null then
    raise exception 'Orçamento não encontrado.' using errcode = '22023';
  end if;
  if v_budget.company_id is not null then
    update public.companies set lifecycle = 'client' where id = v_budget.company_id and lifecycle = 'prospect';
  end if;
  return query select v_budget.deal_id, public.budget_final_total(v_budget.id);
end;
$$;

revoke all on function public.prospect_quote_approved(uuid) from public, anon;
grant execute on function public.prospect_quote_approved(uuid) to authenticated;

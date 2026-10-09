-- CRM nas pautas, direcionamentos no negócio, squad da pauta, encerramento de cliente/projeto e
-- histórico de contatos.
--
-- Item 1. Negócio = pauta (fonte única). Todo negócio tem UMA pauta espelho (source 'crm', deal_id), criada
--    e mantida só pelo banco: título "<Empresa> — <objetivo>", coluna pela etapa, rótulo da etapa
--    (deal_stage), líder = SDR dono, responsável = quem está com a bola. Ninguém move, edita os dados
--    espelhados nem apaga essa pauta pelo quadro: "A etapa desta pauta é definida no CRM".
--    As tarefas avulsas "Agir no negócio" (uma por troca de responsável) deixam de existir — a pauta
--    espelho é o negócio no quadro. As abertas são concluídas pelo backfill.
-- Item 2. deal_notes: conversa interna do negócio (separada de deal_interactions, que é o histórico do
--    lead). Pedido (is_request + assigned_to) notifica, aparece em Minhas Pautas e fica aberto até ser
--    resolvido. Diretoria, master e head do comercial pedem; SDR/BDR respondem, resolvem e anotam.
-- Item 4. Squad da pauta pela origem: CRM → comercial, financeiro automático → financeiro, pauta de projeto
--    → audiovisual (ou o squad escolhido), tarefa interna sem projeto → squad principal de quem cria
--    (diretoria > comercial > audiovisual > financeiro). pautas.squad continua a fonte da verdade.
-- Item 5. Encerramento (client_closures): cliente inteiro ou um projeto. Projetos → 'encerrado', pautas
--    abertas → coluna final com "Encerrado — <motivo>" (responsáveis avisados), recebimentos e
--    pagamentos FUTUROS em aberto cancelados (o que já foi recebido/pago nunca muda; o que a pessoa
--    declarou como pendente fica aberto, com nota), agendas de nota fiscal desligadas, cliente →
--    'former_client'. Reativar devolve 'client' e registra no activity_log, sem ressuscitar nada.
-- Item 6. Histórico de contatos: resumo, próximo passo combinado e "a tentativa anterior teve resposta?"
--    (obrigatório quando há tentativa sem resposta registrada).

-- ===========================================================================
-- 0. Escrita do sistema: as funções do banco que sincronizam pautas ligam esta chave para passar
--    pelas travas de quadro (aprovar, mover, campos fechados). Vale só dentro da transação.
-- ===========================================================================

create or replace function public.pauta_system_write()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('app.pauta_system', true), '') = 'true'
$$;

-- ===========================================================================
-- Item 1. Pauta espelho do negócio
-- ===========================================================================

alter table public.pautas
  add column deal_stage public.deal_stage,
  add column closure_label text;

-- Histórico de contatos (item 6): resumo e próximo passo combinado — usados também no resumo da pauta.
alter table public.deal_interactions
  add column summary text,
  add column next_step text;

alter table public.pautas drop constraint pautas_source_check;
alter table public.pautas add constraint pautas_source_check check (source in ('manual', 'auto_financeiro', 'crm'));

create unique index pautas_crm_deal_unique on public.pautas (deal_id) where source = 'crm';

-- Etapa do negócio → coluna do quadro.
create or replace function public.crm_pauta_column(p_stage public.deal_stage)
returns public.pauta_column
language sql
immutable
set search_path = ''
as $$
  select case p_stage
    when 'prospeccao' then 'sprint_backlog'
    when 'qualificado' then 'revisao'
    when 'ganho' then 'entregue'
    when 'perdido' then 'entregue'
    else 'em_andamento'
  end::public.pauta_column
$$;

-- Status interno da pauta (o quadro mostra a etapa do negócio, não este status).
create or replace function public.crm_pauta_status(p_stage public.deal_stage)
returns public.pauta_status
language sql
immutable
set search_path = ''
as $$
  select case public.crm_pauta_column(p_stage)
    when 'sprint_backlog' then 'planejamento'
    when 'revisao' then 'revisao_interna'
    when 'entregue' then 'aprovado'
    else case when p_stage = 'tentativas_contato' then 'aguardando_retorno' else 'em_execucao' end
  end::public.pauta_status
$$;

create or replace function public.crm_goal_label(p_goal public.prospection_goal)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_goal
    when 'recorrencia' then 'Recorrência'
    when 'campanha_institucional' then 'Campanha institucional'
    when 'cobertura_evento' then 'Cobertura de evento'
    when 'ativacao_marca' then 'Ativação de marca'
    when 'producao_conteudo' then 'Produção de conteúdo'
    when 'video_institucional' then 'Vídeo institucional'
    else 'Outro'
  end
$$;

-- "<Empresa> — <objetivo da prospecção>" (sem objetivo definido: o título do negócio).
create or replace function public.crm_pauta_title(p_company text, p_goals public.prospection_goal[], p_title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(
    coalesce(nullif(btrim(p_company), ''), 'Empresa') || ' — ' || coalesce(
      nullif(array_to_string(array(
        select public.crm_goal_label(g) from unnest(coalesce(p_goals, '{}')) g where g <> 'outro'
      ), ' + '), ''),
      nullif(btrim(p_title), ''),
      'Prospecção'
    ),
    200
  )
$$;

-- Cria ou atualiza a pauta espelho a partir do negócio. Único caminho de escrita dessa pauta.
create or replace function public.crm_sync_deal_pauta(p_deal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.deals;
  v_company text;
  v_id uuid;
  v_status public.pauta_status;
  v_prev_system text := current_setting('app.pauta_system', true);
  v_prev_note text := current_setting('app.handover_note', true);
  v_stage_old public.deal_stage;
begin
  select * into d from public.deals where id = p_deal_id;
  if not found then
    return null;
  end if;
  select c.name into v_company from public.companies c where c.id = d.company_id;
  v_status := public.crm_pauta_status(d.stage);

  perform set_config('app.pauta_system', 'true', true);

  select pt.id, pt.deal_stage into v_id, v_stage_old from public.pautas pt where pt.deal_id = d.id and pt.source = 'crm';

  if v_id is null then
    perform set_config('app.handover_note', 'Negócio no CRM: ' || public.crm_stage_label(d.stage), true);
    insert into public.pautas (
      title, briefing, squad, board_column, status, lead_id, current_assignee_id, created_by,
      direct_company_id, contact_id, is_standalone, due_date, priority, source, deal_id, deal_stage, archived_at
    ) values (
      public.crm_pauta_title(v_company, d.prospection_goals, d.title),
      'Esta pauta é o negócio ' || coalesce(d.code || ' ', '') || 'visto do quadro. A etapa, o responsável e o prazo vêm do CRM: '
        || 'registre contatos e mude a etapa por lá.' || chr(10) || chr(10) || '[Abrir no CRM](/crm?negocio=' || d.id || ')',
      'comercial', public.crm_pauta_column(d.stage), v_status, d.owner_id, coalesce(d.responsible_id, d.owner_id),
      coalesce(d.created_by, d.owner_id), d.company_id, d.primary_contact_id, false,
      (d.next_action_at at time zone 'America/Fortaleza')::date, 'media', 'crm', d.id, d.stage, d.archived_at
    )
    returning id into v_id;
  else
    if v_stage_old is distinct from d.stage then
      perform set_config('app.handover_note', 'Etapa no CRM: ' || public.crm_stage_label(d.stage), true);
    end if;
    update public.pautas
    set title = public.crm_pauta_title(v_company, d.prospection_goals, d.title),
        status = v_status,
        board_column = public.crm_pauta_column(d.stage),
        lead_id = d.owner_id,
        current_assignee_id = coalesce(d.responsible_id, d.owner_id),
        direct_company_id = d.company_id,
        contact_id = d.primary_contact_id,
        due_date = (d.next_action_at at time zone 'America/Fortaleza')::date,
        deal_stage = d.stage,
        archived_at = d.archived_at
    where id = v_id
      and (title, status, lead_id, current_assignee_id, direct_company_id, contact_id, due_date, deal_stage, archived_at)
        is distinct from (
          public.crm_pauta_title(v_company, d.prospection_goals, d.title), v_status, d.owner_id, coalesce(d.responsible_id, d.owner_id),
          d.company_id, d.primary_contact_id, (d.next_action_at at time zone 'America/Fortaleza')::date, d.stage, d.archived_at
        );
  end if;

  perform set_config('app.handover_note', coalesce(v_prev_note, ''), true);
  perform set_config('app.pauta_system', coalesce(v_prev_system, ''), true);
  return v_id;
end;
$$;

revoke all on function public.crm_sync_deal_pauta(uuid) from public, anon, authenticated;

create or replace function public.deals_sync_pauta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.crm_sync_deal_pauta(new.id);
  return null;
end;
$$;

drop trigger if exists deals_sync_pauta on public.deals;
create trigger deals_sync_pauta
  after insert or update of stage, owner_id, responsible_id, title, prospection_goals, next_action_at, company_id, primary_contact_id, archived_at
  on public.deals
  for each row execute function public.deals_sync_pauta();

-- Negócio apagado: a pauta espelho vai junto (a trava da pauta só cede para o sistema).
create or replace function public.deals_delete_pauta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev text := current_setting('app.pauta_system', true);
begin
  perform set_config('app.pauta_system', 'true', true);
  delete from public.pautas where deal_id = old.id and source = 'crm';
  perform set_config('app.pauta_system', coalesce(v_prev, ''), true);
  return old;
end;
$$;

drop trigger if exists deals_delete_pauta on public.deals;
create trigger deals_delete_pauta
  before delete on public.deals
  for each row execute function public.deals_delete_pauta();

-- Empresa renomeada: o título das pautas espelho acompanha.
create or replace function public.companies_sync_deal_pautas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deal uuid;
begin
  for v_deal in select d.id from public.deals d where d.company_id = new.id loop
    perform public.crm_sync_deal_pauta(v_deal);
  end loop;
  return null;
end;
$$;

drop trigger if exists companies_sync_deal_pautas on public.companies;
create trigger companies_sync_deal_pautas
  after update of name on public.companies
  for each row when (new.name is distinct from old.name)
  execute function public.companies_sync_deal_pautas();

-- Trava da pauta espelho (e de quem tentar criar/alterar a marcação de origem pelo quadro).
create or replace function public.pautas_guard_crm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.pauta_system_write() or auth.uid() is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.source = 'crm' and old.deal_id is not null then
      raise exception 'Esta pauta é o negócio no CRM: ela só some quando o negócio for apagado.' using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.source = 'crm' or new.deal_stage is not null or new.closure_label is not null then
      raise exception 'A pauta de um negócio é criada pelo CRM.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.source is distinct from old.source
     or new.deal_stage is distinct from old.deal_stage
     or new.closure_label is distinct from old.closure_label then
    raise exception 'A origem desta pauta é definida pelo sistema.' using errcode = '42501';
  end if;

  if old.source = 'crm' and (
       new.board_column is distinct from old.board_column
       or new.status is distinct from old.status
       or new.title is distinct from old.title
       or new.lead_id is distinct from old.lead_id
       -- Ir para NULL vem das FKs (pessoa ou empresa apagada); trocar por outra pessoa, só pelo CRM.
       or (new.current_assignee_id is distinct from old.current_assignee_id and new.current_assignee_id is not null)
       or new.squad is distinct from old.squad
       or (new.deal_id is distinct from old.deal_id and new.deal_id is not null)
       or new.due_date is distinct from old.due_date
       or (new.direct_company_id is distinct from old.direct_company_id and new.direct_company_id is not null)
       or new.project_id is distinct from old.project_id
       or new.is_standalone is distinct from old.is_standalone
       or new.archived_at is distinct from old.archived_at
     ) then
    raise exception 'A etapa desta pauta é definida no CRM. Abra o negócio para movê-la.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists pautas_guard_crm on public.pautas;
create trigger pautas_guard_crm
  before insert or update or delete on public.pautas
  for each row execute function public.pautas_guard_crm();

-- As travas do quadro cedem à escrita do sistema (sincronização do CRM e encerramento).
create or replace function public.pautas_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or public.pauta_system_write()
     or public.can_fully_manage_pauta()
     or (not old.is_standalone and public.manages_pauta_squad(old.squad)) then
    return new;
  end if;

  if new.is_standalone and new.created_for = auth.uid() then
    return new;
  end if;

  if old.created_by = auth.uid() and public.can_manage_pautas() then
    return new;
  end if;

  if new.title is distinct from old.title
     or new.briefing is distinct from old.briefing
     or new.lead_id is distinct from old.lead_id
     or new.priority is distinct from old.priority
     or new.is_critical is distinct from old.is_critical
     or new.project_id is distinct from old.project_id
     or new.direct_company_id is distinct from old.direct_company_id
     or new.contact_id is distinct from old.contact_id
     or new.location_address is distinct from old.location_address
     or new.scheduled_at is distinct from old.scheduled_at
     or new.duration_minutes is distinct from old.duration_minutes
     or new.start_date is distinct from old.start_date
     or new.capture_type is distinct from old.capture_type
     or new.format is distinct from old.format then
    raise exception 'Só quem criou a pauta edita esses dados. Você pode atualizar o status, os links e o andamento.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.pautas_validate_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_active boolean;
begin
  if auth.uid() is null or new.is_standalone or public.pauta_system_write() then
    return new;
  end if;

  if new.status = 'aprovado' and old.status is distinct from 'aprovado' then
    if old.created_by = auth.uid() then
      return new;
    end if;
    if old.self_complete and auth.uid() in (old.current_assignee_id, old.lead_id) then
      return new;
    end if;
    select coalesce(p.is_active, false) into v_creator_active from public.profiles p where p.id = old.created_by;
    if not coalesce(v_creator_active, false) and public.can_manage_pautas() then
      return new;
    end if;
    raise exception 'Só quem criou a pauta pode aprovar. Envie para revisão.' using errcode = '42501';
  end if;

  if old.status = 'aprovado' and new.status is distinct from 'aprovado' then
    if old.created_by = auth.uid() or public.can_fully_manage_pauta() or public.manages_pauta_squad(old.squad)
       or (old.self_complete and auth.uid() in (old.current_assignee_id, old.lead_id)) then
      return new;
    end if;
    raise exception 'Só quem criou a pauta pode reabrir uma pauta aprovada.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.pautas_guard_squad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.squad is distinct from old.squad
     and auth.uid() is not null
     and not public.pauta_system_write()
     and not (
       public.can_fully_manage_pauta()
       or public.is_director()
       or (old.is_standalone and old.created_for = auth.uid())
       or (old.created_by = auth.uid() and public.can_manage_pautas())
     ) then
    raise exception 'Uma pauta não muda de squad pelo quadro.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Encerramento em massa não dispara a conferência de pagamento nem o "pronto para finalizar".
create or replace function public.pautas_check_project_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.pauta_system_write() then
    return new;
  end if;
  if new.project_id is not null and new.status = 'aprovado' and old.status is distinct from 'aprovado' then
    perform public.check_project_payment(new.project_id);
    perform public.notify_project_ready(new.project_id);
  end if;
  return new;
end;
$$;

-- Notificações de quadro: a escrita do sistema avisa por conta própria (encerramento) ou não avisa
-- (a troca de responsável do negócio já notifica pelo CRM).
create or replace function public.pautas_notify_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_url text := '/minhas-pautas?pauta=' || new.id;
  v_noun text := public.pauta_noun(new.squad);
  v_note text := nullif(current_setting('app.handover_note', true), '');
  v_priority text := public.pauta_priority_label(new.priority);
  v_body text;
  v_done uuid[] := '{}';
  v_reviewer uuid;
begin
  if new.is_standalone or new.deal_id is not null or public.pauta_system_write() then
    return new;
  end if;

  v_body := new.title || ' · ' || v_priority || coalesce(' · "' || left(v_note, 140) || '"', '');

  if new.status is distinct from old.status then
    if new.status = 'reajuste' and new.current_assignee_id is not null and new.current_assignee_id is distinct from v_actor then
      perform public.notify(new.current_assignee_id, 'pauta_adjustment', 'Sua ' || v_noun || ' voltou para ajuste', v_body, 'pauta', new.id, v_url);
      v_done := v_done || new.current_assignee_id;
    elsif new.status = 'aprovado' then
      if new.current_assignee_id is not null and new.current_assignee_id is distinct from v_actor then
        perform public.notify(new.current_assignee_id, 'pauta_approved', initcap(v_noun) || ' aprovada', v_body, 'pauta', new.id, v_url);
        v_done := v_done || new.current_assignee_id;
      end if;
      if new.lead_id is distinct from v_actor and not (new.lead_id = any (v_done)) then
        perform public.notify(new.lead_id, 'pauta_approved', initcap(v_noun) || ' aprovada', v_body, 'pauta', new.id, v_url);
        v_done := v_done || new.lead_id;
      end if;
    elsif new.status in ('revisao_interna', 'revisao_cliente') and old.status not in ('revisao_interna', 'revisao_cliente') then
      foreach v_reviewer in array array[new.lead_id, new.created_by] loop
        if v_reviewer is not null and v_reviewer is distinct from v_actor and not (v_reviewer = any (v_done)) then
          perform public.notify(v_reviewer, 'pauta_in_review',
            case when new.status = 'revisao_cliente' then initcap(v_noun) || ' com o cliente para aprovação'
                 else initcap(v_noun) || ' pronta para revisão' end,
            v_body, 'pauta', new.id, v_url);
          v_done := v_done || v_reviewer;
        end if;
      end loop;
    end if;
  end if;

  if new.current_assignee_id is distinct from old.current_assignee_id
     and new.current_assignee_id is not null
     and new.current_assignee_id is distinct from v_actor
     and not (new.current_assignee_id = any (v_done)) then
    perform public.notify(new.current_assignee_id, 'pauta_assignee_changed',
      'Nova ' || v_noun || ' para você',
      new.title || ' · ' || public.pauta_status_label(new.status, new.squad) || ' · ' || v_priority || coalesce(' · "' || left(v_note, 140) || '"', ''),
      'pauta', new.id, v_url);
    v_done := v_done || new.current_assignee_id;
  end if;

  if new.lead_id is distinct from old.lead_id and new.lead_id is distinct from v_actor and not (new.lead_id = any (v_done)) then
    perform public.notify(new.lead_id, 'pauta_lead_assigned', 'Você é líder de uma ' || v_noun, new.title || ' · ' || v_priority, 'pauta', new.id, v_url);
  end if;

  return new;
end;
$$;

-- Troca de responsável no negócio: registra e avisa; a pauta espelho acompanha sozinha (não nasce mais
-- uma tarefa avulsa "Agir no negócio" a cada troca).
create or replace function public.deals_after_update()
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

  if new.responsible_id is null then
    return new;
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

-- ===========================================================================
-- Item 4. Squad da pauta pela origem
-- ===========================================================================

create or replace function public.pautas_set_squad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := coalesce(new.created_for, new.lead_id);
  v_default public.squad;
begin
  -- Origem com squad fixo.
  if new.source = 'crm' or (new.is_standalone and new.deal_id is not null) then
    new.squad := 'comercial';
    return new;
  end if;
  if new.source = 'auto_financeiro' then
    new.squad := 'financeiro';
    return new;
  end if;

  if new.squad is null then
    if not new.is_standalone and new.project_id is null then
      -- Tarefa interna sem projeto: squad principal de quem cria (diretoria > comercial > audiovisual > financeiro).
      select ps.squad into new.squad
      from public.profile_squads ps
      where ps.profile_id = coalesce(new.created_by, auth.uid(), new.lead_id)
      order by array_position(array['diretoria', 'comercial', 'audiovisual', 'financeiro']::public.squad[], ps.squad)
      limit 1;
    end if;
    new.squad := coalesce(new.squad, public.pauta_default_squad(new.is_standalone, new.deal_id, v_owner));
    return new;
  end if;

  if not new.is_standalone then
    return new;
  end if;

  v_default := public.pauta_default_squad(new.is_standalone, new.deal_id, v_owner);
  if new.squad <> v_default and not exists (
    select 1 from public.profile_squads ps
    where ps.profile_id = v_owner and ps.squad = new.squad
  ) then
    raise exception 'Escolha um dos seus squads para esta tarefa.' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- Item 2. Direcionamentos do negócio (conversa interna)
-- ===========================================================================

create table public.deal_notes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  author_id uuid default auth.uid(),
  body text not null,
  is_request boolean not null default false,
  assigned_to uuid,
  due_at timestamptz,
  reply_to_id uuid references public.deal_notes (id) on delete cascade,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz not null default now(),
  constraint deal_notes_author_id_fkey foreign key (author_id) references public.profiles (id) on delete set null,
  constraint deal_notes_assigned_to_fkey foreign key (assigned_to) references public.profiles (id) on delete set null,
  constraint deal_notes_resolved_by_fkey foreign key (resolved_by) references public.profiles (id) on delete set null,
  constraint deal_notes_body_check check (length(btrim(body)) between 1 and 4000),
  constraint deal_notes_request_check check (is_request or (assigned_to is null and due_at is null and resolved_at is null)),
  constraint deal_notes_reply_check check (reply_to_id is null or not is_request)
);

create index deal_notes_deal_idx on public.deal_notes (deal_id, created_at);
create index deal_notes_open_requests_idx on public.deal_notes (assigned_to) where is_request and resolved_at is null;

alter table public.deal_notes enable row level security;

-- Quem vê a conversa: quem acessa o negócio e quem recebeu algum pedido nele.
create or replace function public.can_view_deal_notes(p_deal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and (
    public.can_access_deal(p_deal_id)
    or exists (select 1 from public.deal_notes n where n.deal_id = p_deal_id and n.assigned_to = auth.uid())
  )
$$;

-- Pedido aberto para mim neste negócio (dá acesso de leitura à pauta espelho).
create or replace function public.has_open_deal_request(p_deal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.deal_notes n
    where n.deal_id = p_deal_id and n.is_request and n.resolved_at is null and n.assigned_to = auth.uid()
  )
$$;

revoke all on function public.can_view_deal_notes(uuid) from public, anon;
revoke all on function public.has_open_deal_request(uuid) from public, anon;
grant execute on function public.can_view_deal_notes(uuid) to authenticated;
grant execute on function public.has_open_deal_request(uuid) to authenticated;

create policy "deal_notes_select" on public.deal_notes for select to authenticated
  using (public.can_view_deal_notes(deal_id));
-- Escrita só pelas funções abaixo; apagar, só a própria nota.
create policy "deal_notes_delete_author" on public.deal_notes for delete to authenticated
  using (author_id = auth.uid() and public.is_active_user());

grant select, delete on public.deal_notes to authenticated;

create or replace function public.deal_pauta_url(p_deal_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select '/minhas-pautas?pauta=' || pt.id from public.pautas pt where pt.deal_id = p_deal_id and pt.source = 'crm' and pt.archived_at is null),
    '/crm?negocio=' || p_deal_id
  )
$$;

create or replace function public.deal_note_create(
  p_deal_id uuid,
  p_body text,
  p_is_request boolean default false,
  p_assigned_to uuid default null,
  p_due_at timestamptz default null,
  p_reply_to uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.deals;
  v_company text;
  v_author text;
  v_id uuid;
  v_parent public.deal_notes;
  v_recipient uuid;
begin
  if not public.can_view_deal_notes(p_deal_id) then
    raise exception 'Você não tem acesso a este negócio.' using errcode = '42501';
  end if;
  if btrim(coalesce(p_body, '')) = '' then
    raise exception 'Escreva a mensagem.' using errcode = '23514';
  end if;
  select * into d from public.deals where id = p_deal_id;
  select c.name into v_company from public.companies c where c.id = d.company_id;
  select p.full_name into v_author from public.profiles p where p.id = auth.uid();

  if p_reply_to is not null then
    select * into v_parent from public.deal_notes where id = p_reply_to and deal_id = p_deal_id;
    if not found then
      raise exception 'Mensagem original não encontrada.' using errcode = '22023';
    end if;
  end if;

  if coalesce(p_is_request, false) then
    if not public.can_access_all_deals() then
      raise exception 'Só diretoria, master e o head comercial fazem pedidos. Deixe uma nota.' using errcode = '42501';
    end if;
    if p_reply_to is not null then
      raise exception 'Uma resposta não pode ser um pedido.' using errcode = '23514';
    end if;
    if p_assigned_to is null or not exists (
      select 1 from public.profile_squads ps join public.profiles pr on pr.id = ps.profile_id
      where ps.profile_id = p_assigned_to and ps.squad = 'comercial' and pr.is_active
    ) then
      raise exception 'Escolha para quem é o pedido (alguém do squad comercial).' using errcode = '23514';
    end if;
  end if;

  insert into public.deal_notes (deal_id, author_id, body, is_request, assigned_to, due_at, reply_to_id)
  values (
    p_deal_id, auth.uid(), btrim(p_body), coalesce(p_is_request, false),
    case when p_is_request then p_assigned_to end,
    case when p_is_request then p_due_at end,
    p_reply_to
  )
  returning id into v_id;

  if coalesce(p_is_request, false) and p_assigned_to is distinct from auth.uid() then
    perform public.notify(
      p_assigned_to, 'deal_request', 'Novo direcionamento para você',
      coalesce(v_company, '') || ' · ' || left(btrim(p_body), 160) || coalesce(' — por ' || v_author, ''),
      'deal', p_deal_id, public.deal_pauta_url(p_deal_id)
    );
  elsif p_reply_to is not null then
    foreach v_recipient in array array[v_parent.author_id, v_parent.assigned_to] loop
      if v_recipient is not null and v_recipient is distinct from auth.uid() then
        perform public.notify(
          v_recipient, 'deal_request_reply', 'Resposta no direcionamento',
          coalesce(v_company, '') || ' · ' || coalesce(v_author, 'Alguém') || ': ' || left(btrim(p_body), 160),
          'deal', p_deal_id, '/crm?negocio=' || p_deal_id
        );
      end if;
    end loop;
  end if;

  return v_id;
end;
$$;

create or replace function public.deal_note_set_resolved(p_note_id uuid, p_resolved boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.deal_notes;
  v_company text;
  v_actor text;
begin
  select * into n from public.deal_notes where id = p_note_id for update;
  if not found or not n.is_request then
    raise exception 'Pedido não encontrado.' using errcode = '22023';
  end if;
  if not (n.assigned_to = auth.uid() or n.author_id = auth.uid() or public.can_access_all_deals()) then
    raise exception 'Só quem recebeu o pedido, quem pediu ou a gestão do comercial resolvem.' using errcode = '42501';
  end if;

  if p_resolved then
    if n.resolved_at is not null then
      return;
    end if;
    update public.deal_notes set resolved_at = now(), resolved_by = auth.uid() where id = p_note_id;
    if n.author_id is not null and n.author_id is distinct from auth.uid() then
      select c.name into v_company from public.deals d join public.companies c on c.id = d.company_id where d.id = n.deal_id;
      select p.full_name into v_actor from public.profiles p where p.id = auth.uid();
      perform public.notify(
        n.author_id, 'deal_request_resolved', 'Direcionamento resolvido',
        coalesce(v_company, '') || ' · ' || left(n.body, 120) || coalesce(' — por ' || v_actor, ''),
        'deal', n.deal_id, '/crm?negocio=' || n.deal_id
      );
    end if;
  else
    update public.deal_notes set resolved_at = null, resolved_by = null where id = p_note_id;
  end if;
end;
$$;

revoke all on function public.deal_note_create(uuid, text, boolean, uuid, timestamptz, uuid) from public, anon;
revoke all on function public.deal_note_set_resolved(uuid, boolean) from public, anon;
revoke all on function public.deal_pauta_url(uuid) from public, anon;
grant execute on function public.deal_note_create(uuid, text, boolean, uuid, timestamptz, uuid) to authenticated;
grant execute on function public.deal_note_set_resolved(uuid, boolean) to authenticated;
grant execute on function public.deal_pauta_url(uuid) to authenticated;

-- Quem recebeu um pedido aberto enxerga a pauta espelho (lista e detalhe).
drop policy if exists "pautas_select" on public.pautas;
create policy "pautas_select" on public.pautas for select to authenticated
  using (
    public.is_active_user()
    and (
      (not is_standalone and public.manages_pauta_squad(squad))
      or lead_id = auth.uid()
      or current_assignee_id = auth.uid()
      or previous_assignee_id = auth.uid()
      or created_by = auth.uid()
      or created_for = auth.uid()
      or exists (select 1 from public.pauta_members pm where pm.pauta_id = pautas.id and pm.profile_id = auth.uid())
      or exists (select 1 from public.project_members prm where prm.project_id = pautas.project_id and prm.profile_id = auth.uid())
      or (source = 'crm' and deal_id is not null and public.has_open_deal_request(deal_id))
    )
  );

create or replace function public.can_view_pauta(p_pauta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_pauta_squad_manager(p_pauta_id)
    or exists (
      select 1 from public.pautas p
      where p.id = p_pauta_id
        and (
          p.lead_id = auth.uid()
          or p.current_assignee_id = auth.uid()
          or p.previous_assignee_id = auth.uid()
          or p.created_by = auth.uid()
          or p.created_for = auth.uid()
          or (p.source = 'crm' and p.deal_id is not null and public.has_open_deal_request(p.deal_id))
        )
    )
    or exists (select 1 from public.pauta_members pm where pm.pauta_id = p_pauta_id and pm.profile_id = auth.uid())
    or exists (
      select 1
      from public.pautas p
      join public.project_members prm on prm.project_id = p.project_id
      where p.id = p_pauta_id and prm.profile_id = auth.uid()
    )
$$;

-- Resumo do negócio dentro da pauta: etapa, próxima ação, última interação e (só com acesso ao
-- financeiro) o valor em negociação.
create or replace function public.pauta_deal_summary(p_pauta_id uuid)
returns table (
  deal_id uuid,
  code text,
  title text,
  stage public.deal_stage,
  owner_name text,
  responsible_name text,
  next_action text,
  next_action_at timestamptz,
  last_interaction_at timestamptz,
  last_interaction_kind public.deal_interaction_kind,
  last_interaction_channel public.deal_interaction_channel,
  last_interaction_text text,
  interactions_count int,
  open_requests int,
  negotiation_value numeric,
  can_open_deal boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.id, d.code, d.title, d.stage, o.full_name, r.full_name, d.next_action, d.next_action_at,
    li.occurred_at, li.kind, li.channel, coalesce(li.summary, li.body),
    (select count(*)::int from public.deal_interactions i where i.deal_id = d.id),
    (select count(*)::int from public.deal_notes n where n.deal_id = d.id and n.is_request and n.resolved_at is null),
    case when public.has_finance_access() then coalesce(
      (select p.amount from public.deal_proposals p where p.deal_id = d.id order by p.sent_at desc, p.created_at desc limit 1),
      d.estimated_value
    ) end,
    public.can_access_deal(d.id)
  from public.pautas pt
  join public.deals d on d.id = pt.deal_id
  join public.profiles o on o.id = d.owner_id
  left join public.profiles r on r.id = d.responsible_id
  left join lateral (
    select i.occurred_at, i.kind, i.channel, i.summary, i.body
    from public.deal_interactions i
    where i.deal_id = d.id
    order by i.occurred_at desc, i.created_at desc
    limit 1
  ) li on true
  where pt.id = p_pauta_id and pt.source = 'crm' and public.can_view_pauta(p_pauta_id)
$$;

revoke all on function public.pauta_deal_summary(uuid) from public, anon;
grant execute on function public.pauta_deal_summary(uuid) to authenticated;

-- ===========================================================================
-- Item 6. Histórico de contatos
-- ===========================================================================

drop function if exists public.deal_log_interaction(uuid, public.deal_interaction_kind, public.deal_interaction_channel, text, text, uuid, text, timestamptz);

create function public.deal_log_interaction(
  p_deal_id uuid,
  p_kind public.deal_interaction_kind,
  p_channel public.deal_interaction_channel,
  p_approach text,
  p_body text,
  p_responded_to uuid default null,
  p_next_action text default null,
  p_next_action_at timestamptz default null,
  p_previous_responded boolean default null,
  p_summary text default null,
  p_next_step text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_prev uuid;
  v_link uuid := p_responded_to;
  v_summary text := nullif(btrim(coalesce(p_summary, '')), '');
begin
  if not public.can_access_deal(p_deal_id) then
    raise exception 'Você não tem acesso a este negócio.' using errcode = '42501';
  end if;

  if p_kind = 'tentativa_contato' then
    if v_summary is null then
      raise exception 'Escreva o resumo do que aconteceu.' using errcode = '23514';
    end if;
    -- A tentativa anterior ainda sem resposta registrada: quem registra a nova diz se ela teve resposta.
    select i.id into v_prev
    from public.deal_interactions i
    where i.deal_id = p_deal_id and i.kind = 'tentativa_contato' and i.responded is null
    order by i.occurred_at desc, i.created_at desc
    limit 1;
    if v_prev is not null then
      if p_previous_responded is null then
        raise exception 'Informe se a tentativa anterior teve resposta.' using errcode = '23514';
      end if;
      update public.deal_interactions set responded = p_previous_responded where id = v_prev;
      v_link := coalesce(v_link, v_prev);
    end if;
  end if;

  if p_kind = 'resposta_cliente' and p_responded_to is not null then
    update public.deal_interactions set responded = true
    where id = p_responded_to and deal_id = p_deal_id and kind = 'tentativa_contato';
  end if;

  insert into public.deal_interactions (deal_id, kind, channel, approach, body, summary, next_step, responded_to_interaction_id, author_id)
  values (
    p_deal_id, p_kind, p_channel, nullif(btrim(p_approach), ''),
    coalesce(nullif(btrim(coalesce(p_body, '')), ''), v_summary, ''),
    v_summary, nullif(btrim(coalesce(p_next_step, '')), ''), v_link, auth.uid()
  )
  returning id into v_id;

  if nullif(btrim(p_next_action), '') is not null and p_next_action_at is not null then
    update public.deals set next_action = btrim(p_next_action), next_action_at = p_next_action_at where id = p_deal_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.deal_log_interaction(uuid, public.deal_interaction_kind, public.deal_interaction_channel, text, text, uuid, text, timestamptz, boolean, text, text) from public, anon;
grant execute on function public.deal_log_interaction(uuid, public.deal_interaction_kind, public.deal_interaction_channel, text, text, uuid, text, timestamptz, boolean, text, text) to authenticated;

-- ===========================================================================
-- View do quadro: etapa do negócio, rótulo de encerramento e pedidos abertos (colunas no fim).
-- ===========================================================================

create or replace view public.pautas_with_details
with (security_invoker = true) as
select
  pt.id,
  pt.code,
  pt.project_id,
  pt.title,
  pt.briefing,
  pt.board_column,
  pt.status,
  pt.priority,
  pt.is_critical,
  pt.lead_id,
  pt.current_assignee_id,
  pt.start_date,
  pt.due_date,
  pt.scheduled_at,
  pt.duration_minutes,
  pt.location_address,
  pt.contact_id,
  pt.contact_phone_override,
  pt.capture_type,
  pt.format,
  pt.equipment_notes,
  pt.script_url,
  pt.drive_folder_url,
  pt.delivery_url,
  pt.created_by,
  pt.created_at,
  pt.updated_at,
  pt.archived_at,
  pt.is_standalone,
  pt.created_for,
  pt.previous_assignee_id,
  pt.returned_at,
  pt.deal_id,
  pt.squad,
  pt.freelancer_id,
  pt.direct_company_id,
  pt.due_time,
  pt.waiting_on_contact_id,
  pt.client_waiting_since,
  pt.source,
  pt.source_ref_type,
  pt.source_ref_id,
  pt.source_period,
  pt.self_complete,
  pr.name as project_name,
  pr.is_internal as project_is_internal,
  coalesce(pr.company_id, pt.direct_company_id) as company_id,
  c.name as company_name,
  lead.full_name as lead_name,
  lead.avatar_url as lead_avatar_url,
  assignee.full_name as assignee_name,
  assignee.avatar_url as assignee_avatar_url,
  ct.full_name as contact_name,
  coalesce(nullif(btrim(pt.contact_phone_override), ''), ct.phone) as contact_phone,
  (select count(*)::int from public.pauta_comments cm where cm.pauta_id = pt.id) as comments_count,
  creator.full_name as created_for_name,
  c.logo_url as company_logo_url,
  fl.full_name as freelancer_name,
  fl.phone as freelancer_phone,
  waiting.full_name as waiting_on_contact_name,
  waiting.job_title as waiting_on_contact_role,
  author.full_name as created_by_name,
  (select count(*)::int from public.pauta_logs lg where lg.pauta_id = pt.id) as logs_count,
  pt.deal_stage,
  pt.closure_label,
  case when pt.source = 'crm' and pt.deal_id is not null then (
    select count(*)::int from public.deal_notes n where n.deal_id = pt.deal_id and n.is_request and n.resolved_at is null
  ) else 0 end as open_requests_count
from public.pautas pt
left join public.projects pr on pr.id = pt.project_id
left join public.companies c on c.id = coalesce(pr.company_id, pt.direct_company_id)
join public.profiles lead on lead.id = pt.lead_id
left join public.profiles assignee on assignee.id = pt.current_assignee_id
left join public.profiles creator on creator.id = pt.created_for
left join public.profiles author on author.id = pt.created_by
left join public.contacts ct on ct.id = pt.contact_id
left join public.contacts waiting on waiting.id = pt.waiting_on_contact_id
left join public.freelancers fl on fl.id = pt.freelancer_id
where pt.archived_at is null;

revoke all on public.pautas_with_details from anon;
grant select on public.pautas_with_details to authenticated;

-- ===========================================================================
-- Item 5. Encerramento de cliente / projeto
-- ===========================================================================

create type public.closure_reason as enum ('churn', 'fim_de_contrato', 'projeto_concluido', 'pausa_temporaria', 'outro');
create type public.prospect_potential as enum ('alto', 'medio', 'baixo', 'nenhum');

create table public.client_closures (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  -- null = o cliente inteiro; preenchido = só este projeto.
  project_id uuid references public.projects (id) on delete cascade,
  reason public.closure_reason not null,
  description text not null,
  closed_at date not null,
  has_pending_receivables boolean not null default false,
  pending_receivables_note text,
  has_pending_payables boolean not null default false,
  pending_payables_note text,
  notes text,
  future_prospect_potential public.prospect_potential not null,
  -- O que aconteceu (contagens, sem valores): projetos, pautas, recebimentos/pagamentos cancelados e mantidos.
  summary jsonb not null default '{}'::jsonb,
  closed_by uuid default auth.uid(),
  reopened_at timestamptz,
  reopened_by uuid,
  created_at timestamptz not null default now(),
  constraint client_closures_closed_by_fkey foreign key (closed_by) references public.profiles (id) on delete set null,
  constraint client_closures_reopened_by_fkey foreign key (reopened_by) references public.profiles (id) on delete set null,
  constraint client_closures_description_check check (length(btrim(description)) > 0)
);

create index client_closures_company_idx on public.client_closures (company_id, created_at desc);

alter table public.client_closures enable row level security;

-- Leitura para toda a equipe interna (o SDR precisa saber por que o cliente saiu). Sem valores aqui.
create policy "client_closures_select" on public.client_closures for select to authenticated
  using (public.current_access_role() in ('admin', 'coordinator', 'member', 'sdr', 'bdr'));

grant select on public.client_closures to authenticated;

alter table public.projects
  add column closed_at timestamptz,
  add column closure_id uuid references public.client_closures (id) on delete set null;

create or replace function public.can_close_clients()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_master() or coalesce(public.current_org_level() = 'diretoria', false) or public.is_director()
$$;

revoke all on function public.can_close_clients() from public, anon;
grant execute on function public.can_close_clients() to authenticated;

create or replace function public.closure_reason_label(p_reason public.closure_reason)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_reason
    when 'churn' then 'Churn'
    when 'fim_de_contrato' then 'Fim de contrato'
    when 'projeto_concluido' then 'Projeto concluído'
    when 'pausa_temporaria' then 'Pausa temporária'
    else 'Outro motivo'
  end
$$;

-- Saúde do cliente depois do encerramento: churn → churn; pausa → atenção; fim planejado → mantém.
create or replace function public.closure_health(p_reason public.closure_reason, p_current public.client_health)
returns public.client_health
language sql
immutable
set search_path = ''
as $$
  select case p_reason
    when 'churn' then 'churn'::public.client_health
    when 'pausa_temporaria' then 'atencao'::public.client_health
    else p_current
  end
$$;

-- Alvos do encerramento (mesma regra na prévia e na execução).
create or replace function public.closure_target_projects(p_company_id uuid, p_project_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pr.id from public.projects pr
  where pr.company_id = p_company_id
    and not pr.is_internal
    and (
      (p_project_id is null and pr.stage not in ('entregue', 'cancelado', 'encerrado') and pr.finalized_at is null)
      or pr.id = p_project_id
    )
$$;

revoke all on function public.closure_target_projects(uuid, uuid) from public, anon, authenticated;

-- Prévia: o que vai acontecer, ANTES de confirmar. Valores só para quem tem acesso ao financeiro.
create or replace function public.client_closure_preview(p_company_id uuid, p_project_id uuid default null, p_closed_at date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_finance boolean := public.has_finance_access();
  v_date date := coalesce(p_closed_at, (now() at time zone 'America/Fortaleza')::date);
  c public.companies;
  v_projects uuid[];
  v_result jsonb;
begin
  if not public.can_close_clients() then
    raise exception 'Só diretoria e master encerram clientes e projetos.' using errcode = '42501';
  end if;
  select * into c from public.companies where id = p_company_id;
  if not found then
    raise exception 'Cliente não encontrado.' using errcode = '22023';
  end if;
  v_projects := array(select public.closure_target_projects(p_company_id, p_project_id));

  select jsonb_build_object(
    'finance_visible', v_finance,
    'company', jsonb_build_object('id', c.id, 'name', c.name, 'lifecycle', c.lifecycle, 'health', c.health),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.name, 'stage', pr.stage, 'model', pr.model) order by pr.name)
      from public.projects pr where pr.id = any (v_projects)
    ), '[]'::jsonb),
    'pautas', coalesce((
      select jsonb_agg(jsonb_build_object('id', pt.id, 'title', pt.title, 'assignee', a.full_name, 'status', pt.status, 'squad', pt.squad) order by pt.due_date nulls last)
      from public.pautas pt
      left join public.profiles a on a.id = pt.current_assignee_id
      where pt.project_id = any (v_projects) and pt.archived_at is null and pt.status <> 'aprovado'
    ), '[]'::jsonb),
    'receivables', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'description', r.description, 'due_date', r.due_date, 'project', pr.name,
        'amount', case when v_finance then r.amount end,
        'overdue', r.due_date < v_date
      ) order by r.due_date)
      from public.receivables r
      left join public.projects pr on pr.id = r.project_id
      where r.cancelled_at is null and r.received_at is null
        and (case when p_project_id is null then r.company_id = p_company_id else r.project_id = p_project_id end)
    ), '[]'::jsonb),
    'payables', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pa.id, 'description', pa.description, 'due_date', pa.due_date, 'project', pr.name,
        'payee', coalesce(nullif(btrim(pa.payee_name), ''), pp.full_name),
        'amount', case when v_finance then pa.amount end,
        'overdue', pa.due_date < v_date,
        'scheduled', pa.scheduled_at is not null
      ) order by pa.due_date)
      from public.payables pa
      left join public.projects pr on pr.id = pa.project_id
      left join public.profiles pp on pp.id = pa.payee_profile_id
      where pa.cancelled_at is null and pa.paid_at is null
        and (case when p_project_id is null
               then pa.company_id = p_company_id or pa.project_id in (select x.id from public.projects x where x.company_id = p_company_id)
               else pa.project_id = p_project_id end)
    ), '[]'::jsonb),
    'invoice_schedules', (
      select count(*)::int from public.project_invoice_schedules s where s.project_id = any (v_projects) and s.active
    ),
    'open_deals', (
      select count(*)::int from public.deals d where d.company_id = p_company_id and d.archived_at is null and d.stage not in ('ganho', 'perdido')
    ),
    'active_closure', (
      select jsonb_build_object('id', cc.id, 'reason', cc.reason, 'closed_at', cc.closed_at)
      from public.client_closures cc
      where cc.company_id = p_company_id and cc.project_id is null and cc.reopened_at is null
      order by cc.created_at desc limit 1
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.client_closure_preview(uuid, uuid, date) from public, anon;
grant execute on function public.client_closure_preview(uuid, uuid, date) to authenticated;

create or replace function public.close_client(
  p_company_id uuid,
  p_project_id uuid,
  p_reason public.closure_reason,
  p_description text,
  p_closed_at date,
  p_has_pending_receivables boolean,
  p_pending_receivables_note text,
  p_keep_receivable_ids uuid[],
  p_has_pending_payables boolean,
  p_pending_payables_note text,
  p_keep_payable_ids uuid[],
  p_notes text,
  p_potential public.prospect_potential
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.companies;
  v_id uuid;
  v_projects uuid[];
  v_label text := public.closure_reason_label(p_reason);
  v_pauta_label text := 'Encerrado — ' || lower(public.closure_reason_label(p_reason));
  v_stamp text := to_char(p_closed_at, 'DD/MM/YYYY');
  v_keep_r uuid[] := case when p_has_pending_receivables then coalesce(p_keep_receivable_ids, '{}') else '{}' end;
  v_keep_p uuid[] := case when p_has_pending_payables then coalesce(p_keep_payable_ids, '{}') else '{}' end;
  v_prev_system text := current_setting('app.pauta_system', true);
  v_health public.client_health;
  v_pautas int := 0;
  v_r_cancel int := 0;
  v_r_keep int := 0;
  v_p_cancel int := 0;
  v_p_keep int := 0;
  v_schedules int := 0;
  v_recipient uuid;
  r record;
begin
  if not public.can_close_clients() then
    raise exception 'Só diretoria e master encerram clientes e projetos.' using errcode = '42501';
  end if;
  if btrim(coalesce(p_description, '')) = '' then
    raise exception 'Explique o que aconteceu.' using errcode = '23514';
  end if;
  if p_closed_at is null then
    raise exception 'Informe a data do encerramento.' using errcode = '23514';
  end if;
  if p_potential is null then
    raise exception 'Informe o potencial de prospecção futura.' using errcode = '23514';
  end if;

  select * into c from public.companies where id = p_company_id for update;
  if not found then
    raise exception 'Cliente não encontrado.' using errcode = '22023';
  end if;

  if p_project_id is null then
    if c.lifecycle <> 'client' then
      raise exception 'Só um cliente ativo pode ser encerrado.' using errcode = '23514';
    end if;
  elsif not exists (
    select 1 from public.projects pr
    where pr.id = p_project_id and pr.company_id = p_company_id and not pr.is_internal and pr.stage not in ('encerrado', 'cancelado')
  ) then
    raise exception 'Este projeto já foi encerrado ou não é deste cliente.' using errcode = '23514';
  end if;

  v_projects := array(select public.closure_target_projects(p_company_id, p_project_id));

  insert into public.client_closures (
    company_id, project_id, reason, description, closed_at,
    has_pending_receivables, pending_receivables_note, has_pending_payables, pending_payables_note,
    notes, future_prospect_potential, closed_by
  ) values (
    p_company_id, p_project_id, p_reason, btrim(p_description), p_closed_at,
    coalesce(p_has_pending_receivables, false), nullif(btrim(coalesce(p_pending_receivables_note, '')), ''),
    coalesce(p_has_pending_payables, false), nullif(btrim(coalesce(p_pending_payables_note, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''), p_potential, auth.uid()
  )
  returning id into v_id;

  -- Projetos → encerrado, com o motivo.
  update public.projects
  set stage = 'encerrado', closed_at = now(), closure_id = v_id
  where id = any (v_projects);

  -- Pautas abertas desses projetos → coluna final, marcadas, com registro; responsáveis avisados.
  perform set_config('app.pauta_system', 'true', true);
  for r in
    select pt.id, pt.title, pt.lead_id, pt.current_assignee_id
    from public.pautas pt
    where pt.project_id = any (v_projects) and pt.archived_at is null and pt.status <> 'aprovado'
  loop
    update public.pautas set status = 'aprovado', closure_label = v_pauta_label where id = r.id;
    insert into public.pauta_logs (pauta_id, author_id, kind, body)
    values (r.id, auth.uid(), 'registro', v_pauta_label || ' em ' || v_stamp || '. ' || btrim(p_description));
    foreach v_recipient in array array[r.current_assignee_id, r.lead_id] loop
      if v_recipient is not null and v_recipient is distinct from auth.uid() then
        perform public.notify(
          v_recipient, 'pauta_closed', 'Pauta encerrada: não siga com ela',
          r.title || ' · ' || v_pauta_label, 'pauta', r.id, '/minhas-pautas?pauta=' || r.id
        );
      end if;
      exit when r.current_assignee_id is not distinct from r.lead_id;
    end loop;
    v_pautas := v_pautas + 1;
  end loop;
  perform set_config('app.pauta_system', coalesce(v_prev_system, ''), true);

  -- Recebimentos FUTUROS em aberto: cancelados (os declarados como pendentes ficam, com nota).
  -- Já recebidos nunca mudam; vencidos antes do encerramento continuam em aberto (o cliente deve).
  update public.receivables x
  set cancelled_at = now(),
      notes = concat_ws(chr(10), nullif(x.notes, ''), 'Cancelado no encerramento (' || v_label || ', ' || v_stamp || ').')
  where x.cancelled_at is null and x.received_at is null and x.due_date >= p_closed_at
    and not (x.id = any (v_keep_r))
    and (case when p_project_id is null then x.company_id = p_company_id else x.project_id = p_project_id end);
  get diagnostics v_r_cancel = row_count;

  update public.receivables x
  set notes = concat_ws(chr(10), nullif(x.notes, ''), 'Mantido em aberto no encerramento (' || v_stamp || ')'
        || coalesce(': ' || nullif(btrim(coalesce(p_pending_receivables_note, '')), ''), '.'))
  where x.cancelled_at is null and x.received_at is null and x.id = any (v_keep_r)
    and (case when p_project_id is null then x.company_id = p_company_id else x.project_id = p_project_id end);
  get diagnostics v_r_keep = row_count;

  -- Pagamentos FUTUROS em aberto do cliente: cancelados, exceto os declarados e os já agendados no banco.
  update public.payables pa
  set cancelled_at = now(),
      notes = concat_ws(chr(10), nullif(pa.notes, ''), 'Cancelado no encerramento do cliente (' || v_label || ', ' || v_stamp || ').')
  where pa.cancelled_at is null and pa.paid_at is null and pa.due_date >= p_closed_at and pa.scheduled_at is null
    and not (pa.id = any (v_keep_p))
    and (case when p_project_id is null
           then pa.company_id = p_company_id or pa.project_id in (select x.id from public.projects x where x.company_id = p_company_id)
           else pa.project_id = p_project_id end);
  get diagnostics v_p_cancel = row_count;

  update public.payables pa
  set notes = concat_ws(chr(10), nullif(pa.notes, ''), 'Mantido em aberto no encerramento (' || v_stamp || ')'
        || coalesce(': ' || nullif(btrim(coalesce(p_pending_payables_note, '')), ''), '.'))
  where pa.cancelled_at is null and pa.paid_at is null
    and (pa.id = any (v_keep_p) or (pa.scheduled_at is not null and pa.due_date >= p_closed_at))
    and (case when p_project_id is null
           then pa.company_id = p_company_id or pa.project_id in (select x.id from public.projects x where x.company_id = p_company_id)
           else pa.project_id = p_project_id end);
  get diagnostics v_p_keep = row_count;

  -- Recorrência: agendas de nota fiscal param de gerar expectativa.
  update public.project_invoice_schedules set active = false where project_id = any (v_projects) and active;
  get diagnostics v_schedules = row_count;

  -- Cliente inteiro → ex-cliente.
  if p_project_id is null then
    v_health := public.closure_health(p_reason, c.health);
    update public.companies
    set lifecycle = 'former_client',
        health = v_health,
        health_note = case when v_health is distinct from c.health then 'Encerrado: ' || v_label || '. ' || left(btrim(p_description), 200) else health_note end
    where id = p_company_id;
  end if;

  update public.client_closures
  set summary = jsonb_build_object(
    'projects', coalesce(array_length(v_projects, 1), 0),
    'pautas', v_pautas,
    'receivables_cancelled', v_r_cancel,
    'receivables_kept', v_r_keep,
    'payables_cancelled', v_p_cancel,
    'payables_kept', v_p_keep,
    'invoice_schedules', v_schedules,
    'health_from', c.health,
    'health_to', coalesce(v_health, c.health)
  )
  where id = v_id;

  -- Dono de cada projeto encerrado é avisado.
  for r in select pr.id, pr.name, pr.owner_id from public.projects pr where pr.id = any (v_projects) loop
    if r.owner_id is distinct from auth.uid() then
      perform public.notify(r.owner_id, 'project_closed', 'Projeto encerrado',
        r.name || ' · ' || v_label || ' — ' || left(btrim(p_description), 140), 'project', r.id, '/projetos/' || r.id);
    end if;
    perform public.log_activity('closed', 'project', r.id, jsonb_build_object('closure_id', v_id, 'reason', p_reason));
  end loop;

  perform public.log_activity(
    'closed', case when p_project_id is null then 'company' else 'project' end,
    coalesce(p_project_id, p_company_id),
    jsonb_build_object('closure_id', v_id, 'reason', p_reason, 'company_id', p_company_id, 'potential', p_potential)
  );

  return v_id;
end;
$$;

revoke all on function public.close_client(uuid, uuid, public.closure_reason, text, date, boolean, text, uuid[], boolean, text, uuid[], text, public.prospect_potential) from public, anon;
grant execute on function public.close_client(uuid, uuid, public.closure_reason, text, date, boolean, text, uuid[], boolean, text, uuid[], text, public.prospect_potential) to authenticated;

-- Reativar: volta a 'client' e registra. Projetos encerrados e lançamentos cancelados ficam como estão.
create or replace function public.reopen_client(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.companies;
  v_closure uuid;
begin
  if not public.can_close_clients() then
    raise exception 'Só diretoria e master reativam clientes.' using errcode = '42501';
  end if;
  select * into c from public.companies where id = p_company_id for update;
  if not found or c.lifecycle <> 'former_client' then
    raise exception 'Este cliente não está encerrado.' using errcode = '23514';
  end if;

  update public.client_closures
  set reopened_at = now(), reopened_by = auth.uid()
  where company_id = p_company_id and project_id is null and reopened_at is null
  returning id into v_closure;

  update public.companies
  set lifecycle = 'client',
      health = case when health = 'churn' then 'ativo'::public.client_health else health end
  where id = p_company_id;

  perform public.log_activity('reopened', 'company', p_company_id, jsonb_build_object('closure_id', v_closure));
end;
$$;

revoke all on function public.reopen_client(uuid) from public, anon;
grant execute on function public.reopen_client(uuid) to authenticated;

-- Projeto novo para um ex-cliente: ele volta a ser cliente (e o encerramento fica como reaberto).
create or replace function public.projects_promote_prospect()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.is_internal and new.company_id is not null then
    if exists (select 1 from public.companies where id = new.company_id and lifecycle = 'former_client') then
      update public.client_closures
      set reopened_at = now(), reopened_by = auth.uid()
      where company_id = new.company_id and project_id is null and reopened_at is null;
      perform public.log_activity('reopened', 'company', new.company_id, jsonb_build_object('project_id', new.id));
    end if;
    update public.companies
    set lifecycle = 'client'
    where id = new.company_id and lifecycle in ('prospect', 'former_client');
  end if;
  return new;
end;
$$;

-- "Em negociação": negócios e orçamentos de antes do encerramento do cliente não contam mais.
create or replace function public.company_closed_since(p_company_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(cc.created_at) from public.client_closures cc
  where cc.company_id = p_company_id and cc.project_id is null and cc.reopened_at is null
$$;

revoke all on function public.company_closed_since(uuid) from public, anon;
grant execute on function public.company_closed_since(uuid) to authenticated;

create or replace function public.finance_deals_in_negotiation()
returns table (
  deal_id uuid, code text, title text, company_id uuid, company_name text, stage public.deal_stage, owner_name text,
  proposal_amount numeric, proposal_sent_at timestamptz, proposal_status public.proposal_status,
  expected_close_date date, probability numeric, weighted_amount numeric
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
    and (public.company_closed_since(d.company_id) is null or d.created_at > public.company_closed_since(d.company_id))
  order by lp.amount desc;
end;
$$;

create or replace function public.finance_budgets_in_negotiation()
returns table (
  budget_id uuid, number integer, version integer, client_name text, title text, status public.budget_status,
  total numeric, sent_at timestamptz, valid_until date, company_id uuid
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
  select b.id, b.number, b.version, b.client_name, b.title, b.status, public.budget_final_total(b.id), b.sent_at, b.valid_until, b.company_id
  from public.budgets b
  where b.status in ('enviado', 'em_ajuste') and b.deal_id is null
    and (b.company_id is null or public.company_closed_since(b.company_id) is null
         or coalesce(b.sent_at, b.created_at) > public.company_closed_since(b.company_id))
  order by b.sent_at desc nulls last;
end;
$$;

-- Reativação 30 dias depois: não para projetos encerrados nem para clientes encerrados sem potencial.
create or replace function public.create_reactivation_pautas()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Fortaleza')::date;
  v_sdr uuid;
  v_reviewer uuid;
  v_reviewer_name text;
  r record;
  v_pauta uuid;
  v_contact uuid;
begin
  select cs.prospect_sdr_id, cs.prospect_reviewer_id into v_sdr, v_reviewer from public.company_settings cs where cs.id;

  -- Sem SDR definido: a primeira pessoa ativa do comercial que não é head/diretoria.
  if v_sdr is null or not exists (select 1 from public.profiles where id = v_sdr and is_active) then
    select ps.profile_id into v_sdr
    from public.profile_squads ps
    join public.profiles p on p.id = ps.profile_id and p.is_active
    where ps.squad = 'comercial' and p.org_level not in ('master', 'diretoria', 'head')
    order by p.created_at
    limit 1;
  end if;
  -- Sem validador: head do comercial, senão o master.
  if v_reviewer is null or not exists (select 1 from public.profiles where id = v_reviewer and is_active) then
    select ps.profile_id into v_reviewer
    from public.profile_squads ps
    join public.profiles p on p.id = ps.profile_id and p.is_active
    where ps.squad = 'comercial' and p.org_level = 'head'
    order by p.created_at
    limit 1;
    if v_reviewer is null then
      select id into v_reviewer from public.profiles where org_level = 'master' and is_active limit 1;
    end if;
  end if;
  if v_sdr is null or v_reviewer is null then
    return;
  end if;
  select full_name into v_reviewer_name from public.profiles where id = v_reviewer;

  for r in
    select pr.id, pr.name, pr.company_id, pr.finalized_at, c.name as company_name
    from public.projects pr
    join public.companies c on c.id = pr.company_id
    where pr.finalized_at is not null
      and pr.reactivation_pauta_id is null
      and not pr.is_internal
      and pr.stage <> 'encerrado'
      and (pr.finalized_at at time zone 'America/Fortaleza')::date + 30 <= v_today
      and (pr.finalized_at at time zone 'America/Fortaleza')::date + 60 >= v_today
      -- Cliente já com outro projeto em andamento não precisa ser reativado.
      and not exists (
        select 1 from public.projects other
        where other.company_id = pr.company_id and other.id <> pr.id
          and other.finalized_at is null and other.stage not in ('entregue', 'cancelado', 'encerrado')
      )
      -- Encerrado sem potencial de voltar: não prospectar.
      and not exists (
        select 1 from public.client_closures cc
        where cc.company_id = pr.company_id and cc.project_id is null and cc.reopened_at is null
          and cc.future_prospect_potential = 'nenhum'
      )
  loop
    select ct.id into v_contact from public.contacts ct
    where ct.company_id = r.company_id
    order by ct.is_decision_maker desc, ct.created_at
    limit 1;

    v_pauta := gen_random_uuid();
    insert into public.pautas (
      id, title, briefing, squad, priority, lead_id, current_assignee_id, created_by,
      direct_company_id, contact_id, start_date, due_date, board_column
    ) values (
      v_pauta,
      'Prospecção: reativar ' || r.company_name,
      'Missão: reativar o cliente ' || r.company_name || '.' || E'\n\n'
        || 'O projeto "' || r.name || '" foi finalizado em ' || to_char(r.finalized_at at time zone 'America/Fortaleza', 'DD/MM/YYYY') || ' (há 30 dias).' || E'\n\n'
        || '1. Analise o perfil do cliente e os últimos projetos com a Além (página do cliente → projetos e equipe do cliente: quem é quem e quem decide).' || E'\n'
        || '2. Monte uma proposta para esse cliente: produção de conteúdo recorrente, projeto transacional ou o que fizer mais sentido, com a estratégia de abordagem.' || E'\n'
        || '3. Antes de abordar, valide com ' || coalesce(v_reviewer_name, 'a gestão') || ': registre a estratégia e o produto na aba Registros e envie para revisão.' || E'\n'
        || '4. Validado, faça a abordagem dentro do prazo de 5 dias úteis e registre o retorno.',
      'comercial', 'alta', v_sdr, v_sdr, v_reviewer,
      r.company_id, v_contact, v_today, public.add_business_days(v_today, 5), 'sprint_backlog'
    );
    insert into public.pauta_members (pauta_id, profile_id, production_function, added_by)
    values (v_pauta, v_sdr, 'prospeccao', v_reviewer)
    on conflict do nothing;

    update public.projects set reactivation_pauta_id = v_pauta where id = r.id;
  end loop;
end;
$$;

-- ===========================================================================
-- Backfills
-- ===========================================================================

select set_config('app.pauta_system', 'true', true);

-- Squad pela origem nas pautas existentes (as demais mantêm o squad escolhido na criação).
update public.pautas set squad = 'financeiro' where source = 'auto_financeiro' and squad <> 'financeiro';
update public.pautas set squad = 'comercial' where is_standalone and deal_id is not null and squad <> 'comercial';

-- Tarefas avulsas "Agir no negócio" abertas: substituídas pela pauta espelho.
update public.pautas
set board_column = 'entregue'
where is_standalone and deal_id is not null and board_column <> 'entregue' and archived_at is null;

-- Uma pauta espelho para cada negócio existente.
do $$
declare
  v_deal uuid;
begin
  for v_deal in
    select d.id from public.deals d
    where not exists (select 1 from public.pautas pt where pt.deal_id = d.id and pt.source = 'crm')
    order by d.created_at
  loop
    perform public.crm_sync_deal_pauta(v_deal);
  end loop;
end;
$$;

select set_config('app.pauta_system', '', true);

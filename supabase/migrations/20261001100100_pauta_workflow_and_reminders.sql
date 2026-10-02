-- Fluxo das pautas por squad, aprovação só por quem criou, registros de execução, notificações de
-- tudo que envolve a pessoa e lembretes diários (atraso, cobrança do cliente, pagamento do projeto).
--
-- 1. Status por squad: cada squad tem a sua sequência (pauta_statuses_for). As 4 colunas do quadro
--    continuam as mesmas; cada status cai numa coluna (pauta_column_for_status).
-- 2. Aprovar é de quem criou a pauta (ou da gestão, se quem criou saiu da empresa). Reabrir uma
--    pauta aprovada: quem criou ou a gestão do squad. Tarefas avulsas ficam de fora (são da pessoa).
-- 3. "Passar adiante" exige pessoa + função, menos para aprovar (a pauta termina, não vai a ninguém).
--    A nota vira um registro da pauta.
-- 4. pauta_logs: o que foi feito, pedidos de ajuste e aprovações — o histórico de execução.
-- 5. Notificações: nova pauta/tarefa, voltou para ajuste, pronta para revisão, aprovada, comentário,
--    registro novo. Uma notificação por pessoa por mudança (sem duplicar).
-- 6. Lembretes diários (pg_cron, 8h de Fortaleza): pauta atrasada e entrega do dia (responsável e
--    líder), cliente segurando a aprovação há 2+ dias (líder e quem criou) e projeto concluído para
--    conferir o pagamento (dono do projeto e financeiro).

-- ---------------------------------------------------------------------------
-- 1. Status por squad
-- ---------------------------------------------------------------------------

create or replace function public.pauta_statuses_for(p_squad public.squad)
returns public.pauta_status[]
language sql
immutable
set search_path = ''
as $$
  select case coalesce(p_squad, 'audiovisual'::public.squad)
    when 'audiovisual' then array['planejamento', 'captacao', 'edicao', 'revisao_interna', 'revisao_cliente', 'reajuste', 'aprovado']::public.pauta_status[]
    when 'comercial' then array['planejamento', 'em_execucao', 'aguardando_retorno', 'revisao_interna', 'revisao_cliente', 'reajuste', 'aprovado']::public.pauta_status[]
    when 'financeiro' then array['planejamento', 'em_execucao', 'aguardando_documento', 'revisao_interna', 'revisao_cliente', 'reajuste', 'aprovado']::public.pauta_status[]
    else array['planejamento', 'em_execucao', 'em_analise', 'revisao_interna', 'revisao_cliente', 'reajuste', 'aprovado']::public.pauta_status[]
  end
$$;

create or replace function public.pauta_column_for_status(p_status public.pauta_status)
returns public.pauta_column
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'planejamento' then 'sprint_backlog'
    when 'revisao_interna' then 'revisao'
    when 'revisao_cliente' then 'revisao'
    when 'aprovado' then 'entregue'
    else 'em_andamento'
  end::public.pauta_column
$$;

-- Status padrão ao arrastar só a coluna (o "passar adiante" que abre em seguida escolhe o certo).
create or replace function public.pauta_default_status(p_squad public.squad, p_column public.pauta_column, p_old public.pauta_status)
returns public.pauta_status
language sql
immutable
set search_path = ''
as $$
  select case p_column
    when 'sprint_backlog' then 'planejamento'
    when 'revisao' then 'revisao_interna'
    when 'entregue' then 'aprovado'
    else
      case
        when p_old in ('revisao_interna', 'revisao_cliente', 'aprovado') then 'reajuste'
        when coalesce(p_squad, 'audiovisual') = 'audiovisual' then
          case when p_old in ('edicao', 'reajuste') then 'edicao' else 'captacao' end
        when p_old = any (public.pauta_statuses_for(p_squad)) and public.pauta_column_for_status(p_old) = 'em_andamento' then p_old::text
        else 'em_execucao'
      end
  end::public.pauta_status
$$;

grant execute on function public.pauta_statuses_for(public.squad) to authenticated;
grant execute on function public.pauta_column_for_status(public.pauta_status) to authenticated;
grant execute on function public.pauta_default_status(public.squad, public.pauta_column, public.pauta_status) to authenticated;

create or replace function public.pautas_sync_column_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status is null and new.board_column is null then
      new.board_column := 'sprint_backlog';
    end if;
    if new.status is null or not (new.status = any (public.pauta_statuses_for(new.squad))) then
      new.status := public.pauta_default_status(new.squad, coalesce(new.board_column, 'sprint_backlog'), null);
    end if;
    new.board_column := public.pauta_column_for_status(new.status);
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (new.status = any (public.pauta_statuses_for(new.squad))) then
      raise exception 'Esse status não existe para o squad desta pauta.' using errcode = '22023';
    end if;
    new.board_column := public.pauta_column_for_status(new.status);
  elsif new.board_column is distinct from old.board_column then
    new.status := public.pauta_default_status(new.squad, new.board_column, old.status);
  elsif new.squad is distinct from old.squad and not (new.status = any (public.pauta_statuses_for(new.squad))) then
    new.status := public.pauta_default_status(new.squad, new.board_column, old.status);
    new.board_column := public.pauta_column_for_status(new.status);
  end if;

  return new;
end;
$$;

-- Pautas que já existem fora do audiovisual: captação/edição viram "em execução".
alter table public.pautas disable trigger user;
update public.pautas
set status = 'em_execucao'
where squad <> 'audiovisual' and status in ('captacao', 'edicao');
alter table public.pautas enable trigger user;

-- ---------------------------------------------------------------------------
-- 2. Aprovação só por quem criou. Nome "validate_*" de propósito: os BEFORE triggers rodam em ordem
--    alfabética e este precisa ver o status já derivado pelo pautas_sync_column_status.
-- ---------------------------------------------------------------------------

create or replace function public.pautas_validate_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_active boolean;
begin
  if auth.uid() is null or new.is_standalone then
    return new;
  end if;

  if new.status = 'aprovado' and old.status is distinct from 'aprovado' then
    if old.created_by = auth.uid() then
      return new;
    end if;
    select coalesce(p.is_active, false) into v_creator_active from public.profiles p where p.id = old.created_by;
    if not coalesce(v_creator_active, false) and public.can_manage_pautas() then
      return new;
    end if;
    raise exception 'Só quem criou a pauta pode aprovar. Envie para revisão.' using errcode = '42501';
  end if;

  if old.status = 'aprovado' and new.status is distinct from 'aprovado' then
    if old.created_by = auth.uid() or public.can_fully_manage_pauta() or public.manages_pauta_squad(old.squad) then
      return new;
    end if;
    raise exception 'Só quem criou a pauta pode reabrir uma pauta aprovada.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists pautas_validate_approval on public.pautas;
create trigger pautas_validate_approval
  before update on public.pautas
  for each row execute function public.pautas_validate_approval();

-- Prazo com hora fica aberto a quem passa a pauta adiante (como o prazo).
create or replace function public.pautas_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
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

-- ---------------------------------------------------------------------------
-- Cliente segurando a pauta: desde quando (para o lembrete de cobrança).
-- ---------------------------------------------------------------------------

alter table public.pautas add column client_waiting_since timestamptz;

create or replace function public.pautas_track_client_wait()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_waiting boolean := new.status = 'revisao_cliente' or new.waiting_on_contact_id is not null;
begin
  if not v_waiting then
    new.client_waiting_since := null;
  elsif tg_op = 'INSERT' then
    new.client_waiting_since := now();
  elsif old.status is distinct from 'revisao_cliente' and old.waiting_on_contact_id is null then
    new.client_waiting_since := now();
  else
    new.client_waiting_since := coalesce(old.client_waiting_since, now());
  end if;
  return new;
end;
$$;

-- "validate_" para rodar depois do sync (que define o status final).
drop trigger if exists pautas_validate_client_wait on public.pautas;
create trigger pautas_validate_client_wait
  before insert or update on public.pautas
  for each row execute function public.pautas_track_client_wait();

alter table public.pautas disable trigger user;
update public.pautas set client_waiting_since = updated_at
where status = 'revisao_cliente' or waiting_on_contact_id is not null;
alter table public.pautas enable trigger user;

-- ---------------------------------------------------------------------------
-- 4. Registros de execução
-- ---------------------------------------------------------------------------

create type public.pauta_log_kind as enum ('registro', 'entrega', 'ajuste', 'aprovacao');

create table public.pauta_logs (
  id uuid primary key default gen_random_uuid(),
  pauta_id uuid not null references public.pautas (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  kind public.pauta_log_kind not null default 'registro',
  body text not null check (length(btrim(body)) between 1 and 4000),
  link_url text check (link_url is null or link_url ~* '^https?://'),
  status public.pauta_status,
  created_at timestamptz not null default now()
);

create index pauta_logs_pauta_idx on public.pauta_logs (pauta_id, created_at);

alter table public.pauta_logs enable row level security;

create policy "pauta_logs_select" on public.pauta_logs for select to authenticated
  using (public.is_active_user() and public.can_view_pauta(pauta_id));

-- Registra quem está na pauta (ou a gestão), sempre em nome próprio. Registro não se edita: é histórico.
create policy "pauta_logs_insert" on public.pauta_logs for insert to authenticated
  with check (public.is_active_user() and author_id = auth.uid() and public.can_edit_pauta(pauta_id));

-- ---------------------------------------------------------------------------
-- 3. Passar adiante (v2)
-- ---------------------------------------------------------------------------

drop function if exists public.pauta_handover(uuid, public.pauta_status, uuid, public.production_function, date, text);

create function public.pauta_handover(
  p_pauta_id uuid,
  p_status public.pauta_status,
  p_assignee_id uuid default null,
  p_function public.production_function default null,
  p_due_date date default null,
  p_note text default null,
  p_due_time time default null
)
returns public.pautas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.pautas;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.can_edit_pauta(p_pauta_id) then
    raise exception 'Você não tem permissão para mover esta pauta.' using errcode = '42501';
  end if;

  if p_status <> 'aprovado' and (p_assignee_id is null or p_function is null) then
    raise exception 'Escolha para quem vai e o que a pessoa vai fazer.' using errcode = '22023';
  end if;

  perform set_config('app.handover_note', coalesce(v_note, ''), true);

  update public.pautas
  set status = p_status,
      current_assignee_id = case when p_status = 'aprovado' then current_assignee_id else p_assignee_id end,
      due_date = coalesce(p_due_date, due_date),
      due_time = case when p_due_date is not null then p_due_time else coalesce(p_due_time, due_time) end
  where id = p_pauta_id
  returning * into v_row;

  if not found then
    raise exception 'Pauta não encontrada.' using errcode = '22023';
  end if;

  if p_status <> 'aprovado' then
    insert into public.pauta_members (pauta_id, profile_id, production_function)
    values (p_pauta_id, p_assignee_id, p_function)
    on conflict do nothing;
  end if;

  if v_note is not null then
    insert into public.pauta_logs (pauta_id, author_id, kind, body, status)
    values (
      p_pauta_id,
      auth.uid(),
      case
        when p_status = 'aprovado' then 'aprovacao'
        when p_status = 'reajuste' then 'ajuste'
        when p_status in ('revisao_interna', 'revisao_cliente') then 'entrega'
        else 'registro'
      end::public.pauta_log_kind,
      v_note,
      p_status
    );
  end if;

  return v_row;
end;
$$;

revoke all on function public.pauta_handover(uuid, public.pauta_status, uuid, public.production_function, date, text, time) from public, anon;
grant execute on function public.pauta_handover(uuid, public.pauta_status, uuid, public.production_function, date, text, time) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Notificações
-- ---------------------------------------------------------------------------

create or replace function public.pauta_status_label(p_status public.pauta_status, p_squad public.squad)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'planejamento' then case when coalesce(p_squad, 'audiovisual') = 'audiovisual' then 'Planejamento' else 'A fazer' end
    when 'captacao' then 'Captação'
    when 'edicao' then 'Edição'
    when 'em_execucao' then 'Em execução'
    when 'aguardando_retorno' then 'Aguardando retorno'
    when 'aguardando_documento' then 'Aguardando documento'
    when 'em_analise' then 'Em análise'
    when 'revisao_interna' then case when p_squad = 'financeiro' then 'Conferência' else 'Revisão interna' end
    when 'revisao_cliente' then 'Com o cliente'
    when 'reajuste' then 'Ajuste'
    when 'aprovado' then case when coalesce(p_squad, 'audiovisual') = 'audiovisual' then 'Aprovado' else 'Concluída' end
  end
$$;

-- "pauta" no audiovisual, "tarefa" nos outros squads.
create or replace function public.pauta_noun(p_squad public.squad)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when coalesce(p_squad, 'audiovisual') = 'audiovisual' then 'pauta' else 'tarefa' end
$$;

create or replace function public.pautas_notify_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := '/minhas-pautas?pauta=' || new.id;
  v_noun text := public.pauta_noun(new.squad);
  v_by text;
begin
  if new.deal_id is not null or new.is_standalone then
    return new;
  end if;

  select full_name into v_by from public.profiles where id = auth.uid();

  if new.current_assignee_id is not null and new.current_assignee_id is distinct from auth.uid() then
    perform public.notify(new.current_assignee_id, 'pauta_assignee_changed',
      'Nova ' || v_noun || ' para você',
      new.title || coalesce(' · por ' || v_by, ''), 'pauta', new.id, v_url);
  end if;

  if new.lead_id is distinct from auth.uid() and new.lead_id is distinct from new.current_assignee_id then
    perform public.notify(new.lead_id, 'pauta_lead_assigned',
      'Você é líder de uma nova ' || v_noun,
      new.title || coalesce(' · por ' || v_by, ''), 'pauta', new.id, v_url);
  end if;

  return new;
end;
$$;

-- Um único gatilho para líder, responsável e status: cada pessoa recebe no máximo uma notificação
-- por mudança, com a mensagem mais específica.
drop trigger if exists pautas_notify_lead_update on public.pautas;
drop trigger if exists pautas_notify_assignee_update on public.pautas;
drop trigger if exists pautas_notify_review_change on public.pautas;

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
  v_body text;
  v_done uuid[] := '{}';
  v_reviewer uuid;
begin
  if new.is_standalone or new.deal_id is not null then
    return new;
  end if;

  v_body := new.title || coalesce(' · "' || left(v_note, 140) || '"', '');

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
      new.title || ' · ' || public.pauta_status_label(new.status, new.squad) || coalesce(' · "' || left(v_note, 140) || '"', ''),
      'pauta', new.id, v_url);
    v_done := v_done || new.current_assignee_id;
  end if;

  if new.lead_id is distinct from old.lead_id and new.lead_id is distinct from v_actor and not (new.lead_id = any (v_done)) then
    perform public.notify(new.lead_id, 'pauta_lead_assigned', 'Você é líder de uma ' || v_noun, new.title, 'pauta', new.id, v_url);
  end if;

  return new;
end;
$$;

drop trigger if exists pautas_notify_changes on public.pautas;
create trigger pautas_notify_changes
  after update on public.pautas
  for each row execute function public.pautas_notify_changes();

-- Responsável adicionado: quem já é líder ou responsável atual já foi avisado pelos gatilhos acima.
create or replace function public.pauta_members_notify_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pauta public.pautas;
begin
  if new.profile_id is not distinct from auth.uid() then
    return new;
  end if;
  select * into v_pauta from public.pautas where id = new.pauta_id;
  if v_pauta.id is null or new.profile_id in (v_pauta.lead_id, v_pauta.current_assignee_id) then
    return new;
  end if;
  perform public.notify(new.profile_id, 'pauta_member_added',
    'Você foi incluído numa ' || public.pauta_noun(v_pauta.squad), v_pauta.title, 'pauta', new.pauta_id,
    '/minhas-pautas?pauta=' || new.pauta_id);
  return new;
end;
$$;

-- Comentário: avisa líder, responsável atual, quem criou e os responsáveis (menos quem comentou).
create or replace function public.pauta_comments_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pauta public.pautas;
  v_author text;
  v_recipient uuid;
begin
  select * into v_pauta from public.pautas where id = new.pauta_id;
  if v_pauta.id is null then
    return new;
  end if;
  select full_name into v_author from public.profiles where id = new.author_id;

  for v_recipient in
    select distinct x from (
      select v_pauta.lead_id as x
      union select v_pauta.current_assignee_id
      union select v_pauta.created_by
      union select v_pauta.created_for
      union select pm.profile_id from public.pauta_members pm where pm.pauta_id = v_pauta.id
    ) people
    where x is not null and x is distinct from new.author_id
  loop
    perform public.notify(v_recipient, 'pauta_comment',
      coalesce(split_part(v_author, ' ', 1), 'Alguém') || ' comentou: ' || v_pauta.title,
      left(new.body, 160), 'pauta', v_pauta.id, '/minhas-pautas?pauta=' || v_pauta.id);
  end loop;
  return new;
end;
$$;

drop trigger if exists pauta_comments_notify on public.pauta_comments;
create trigger pauta_comments_notify
  after insert on public.pauta_comments
  for each row execute function public.pauta_comments_notify();

-- Registro avulso ("o que eu fiz"): avisa líder e quem criou. Os registros do "passar adiante" já
-- vão junto da notificação de status.
create or replace function public.pauta_logs_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pauta public.pautas;
  v_author text;
  v_recipient uuid;
begin
  if new.kind <> 'registro' or new.status is not null then
    return new;
  end if;
  select * into v_pauta from public.pautas where id = new.pauta_id;
  select full_name into v_author from public.profiles where id = new.author_id;
  for v_recipient in
    select distinct x from (select v_pauta.lead_id as x union select v_pauta.created_by) people
    where x is not null and x is distinct from new.author_id
  loop
    perform public.notify(v_recipient, 'pauta_log',
      coalesce(split_part(v_author, ' ', 1), 'Alguém') || ' registrou o que fez: ' || v_pauta.title,
      left(new.body, 160), 'pauta', v_pauta.id, '/minhas-pautas?pauta=' || v_pauta.id);
  end loop;
  return new;
end;
$$;

create trigger pauta_logs_notify
  after insert on public.pauta_logs
  for each row execute function public.pauta_logs_notify();

-- ---------------------------------------------------------------------------
-- 6. Lembretes diários + pagamento do projeto
-- ---------------------------------------------------------------------------

alter table public.projects add column payment_check_notified_at timestamptz;

-- Já mandou essa notificação hoje (Fortaleza) para essa pessoa sobre essa entidade?
create or replace function public.notified_today(p_recipient uuid, p_type text, p_entity uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.notifications n
    where n.recipient_id = p_recipient and n.type = p_type and n.entity_id = p_entity
      and (n.created_at at time zone 'America/Fortaleza')::date = (now() at time zone 'America/Fortaleza')::date
  )
$$;

-- Projeto com todas as pautas concluídas e data final já alcançada: avisa o dono do projeto e o
-- financeiro para conferir se o cliente pagou (uma vez por projeto).
create or replace function public.check_project_payment(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_company text;
  v_open int;
  v_recipient uuid;
  v_today date := (now() at time zone 'America/Fortaleza')::date;
begin
  select * into v_project from public.projects where id = p_project_id;
  if v_project.id is null or v_project.payment_check_notified_at is not null then
    return;
  end if;
  if coalesce(v_project.end_date, v_project.due_date) is not null and coalesce(v_project.end_date, v_project.due_date) > v_today then
    return;
  end if;
  if not exists (select 1 from public.pautas p where p.project_id = p_project_id and p.archived_at is null) then
    return;
  end if;
  if exists (
    select 1 from public.pautas p
    where p.project_id = p_project_id and p.archived_at is null and p.status <> 'aprovado'
  ) then
    return;
  end if;

  select c.name into v_company from public.companies c where c.id = v_project.company_id;
  select count(*)::int into v_open from public.receivables r
  where r.project_id = p_project_id and r.received_at is null and r.cancelled_at is null;

  for v_recipient in
    select distinct x from (
      select v_project.owner_id as x
      union
      select ps.profile_id from public.profile_squads ps
      join public.profiles pr on pr.id = ps.profile_id and pr.is_active
      where ps.squad = 'financeiro'
    ) people
    where x is not null
  loop
    perform public.notify(v_recipient, 'project_payment_check',
      'Projeto concluído: conferir pagamento',
      v_project.name || coalesce(' (' || v_company || ')', '') || ' tem todas as pautas aprovadas. '
        || case when v_open > 0 then v_open || ' recebível(is) em aberto — confira se o cliente pagou e dê baixa.'
                else 'Confira se o pagamento do cliente entrou.' end,
      'project', v_project.id, '/projetos/' || v_project.id);
  end loop;

  update public.projects set payment_check_notified_at = now() where id = p_project_id;
end;
$$;

revoke all on function public.check_project_payment(uuid) from public, anon, authenticated;

create or replace function public.pautas_check_project_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.project_id is not null and new.status = 'aprovado' and old.status is distinct from 'aprovado' then
    perform public.check_project_payment(new.project_id);
  end if;
  return new;
end;
$$;

drop trigger if exists pautas_check_project_payment on public.pautas;
create trigger pautas_check_project_payment
  after update on public.pautas
  for each row execute function public.pautas_check_project_payment();

create or replace function public.run_daily_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Fortaleza')::date;
  r record;
  v_recipient uuid;
  v_noun text;
  v_days int;
begin
  -- Atrasadas: responsável e líder.
  for r in
    select p.* from public.pautas p
    where p.archived_at is null and p.board_column <> 'entregue' and p.status <> 'aprovado'
      and p.due_date is not null and p.due_date < v_today
  loop
    v_noun := public.pauta_noun(r.squad);
    foreach v_recipient in array array[coalesce(r.current_assignee_id, r.created_for), r.lead_id] loop
      if v_recipient is not null and not public.notified_today(v_recipient, 'pauta_overdue', r.id) then
        perform public.notify(v_recipient, 'pauta_overdue', initcap(v_noun) || ' atrasada',
          r.title || ' · prazo era ' || to_char(r.due_date, 'DD/MM'), 'pauta', r.id, '/minhas-pautas?pauta=' || r.id);
      end if;
    end loop;
  end loop;

  -- Entrega hoje: responsável.
  for r in
    select p.* from public.pautas p
    where p.archived_at is null and p.board_column <> 'entregue' and p.status <> 'aprovado'
      and p.due_date = v_today
  loop
    v_recipient := coalesce(r.current_assignee_id, r.created_for, r.lead_id);
    if v_recipient is not null and not public.notified_today(v_recipient, 'pauta_due_today', r.id) then
      perform public.notify(v_recipient, 'pauta_due_today', 'Entrega hoje',
        r.title || coalesce(' · até ' || to_char(r.due_time, 'HH24:MI'), ''), 'pauta', r.id, '/minhas-pautas?pauta=' || r.id);
    end if;
  end loop;

  -- Cliente segurando a aprovação há 2+ dias (ou com o prazo vencido): líder e quem criou cobram.
  for r in
    select p.*, ct.full_name as contact_name, c.name as company_name
    from public.pautas p
    left join public.contacts ct on ct.id = p.waiting_on_contact_id
    left join public.projects pr on pr.id = p.project_id
    left join public.companies c on c.id = coalesce(pr.company_id, p.direct_company_id)
    where p.archived_at is null and p.status <> 'aprovado' and p.client_waiting_since is not null
      and (p.client_waiting_since <= now() - interval '2 days' or (p.due_date is not null and p.due_date < v_today))
  loop
    v_days := greatest(1, (v_today - (r.client_waiting_since at time zone 'America/Fortaleza')::date));
    for v_recipient in select distinct x from (select r.lead_id as x union select r.created_by) people where x is not null loop
      if not public.notified_today(v_recipient, 'pauta_client_followup', r.id) then
        perform public.notify(v_recipient, 'pauta_client_followup', 'Cobrar aprovação do cliente',
          r.title || ' está com ' || coalesce(r.contact_name, 'o cliente') || coalesce(' (' || r.company_name || ')', '')
            || ' há ' || v_days || case when v_days = 1 then ' dia.' else ' dias.' end,
          'pauta', r.id, '/minhas-pautas?pauta=' || r.id);
      end if;
    end loop;
  end loop;

  -- Projetos concluídos: conferir pagamento.
  for r in
    select pr.id from public.projects pr
    where pr.payment_check_notified_at is null
      and (coalesce(pr.end_date, pr.due_date) is null or coalesce(pr.end_date, pr.due_date) <= v_today)
  loop
    perform public.check_project_payment(r.id);
  end loop;
end;
$$;

revoke all on function public.run_daily_reminders() from public, anon, authenticated;

create extension if not exists pg_cron;

-- 11h UTC = 8h em Fortaleza.
select cron.schedule('alem-daily-reminders', '0 11 * * *', 'select public.run_daily_reminders()');

-- ---------------------------------------------------------------------------
-- View do quadro: nova coluna client_waiting_since (pt.* é expandido na criação) + nº de registros.
-- ---------------------------------------------------------------------------

drop view public.pautas_with_details;

create view public.pautas_with_details
with (security_invoker = true) as
select
  pt.*,
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
  (
    select count(*)::int from public.pauta_comments cm where cm.pauta_id = pt.id
  ) as comments_count,
  creator.full_name as created_for_name,
  c.logo_url as company_logo_url,
  fl.full_name as freelancer_name,
  fl.phone as freelancer_phone,
  waiting.full_name as waiting_on_contact_name,
  waiting.job_title as waiting_on_contact_role,
  author.full_name as created_by_name,
  (
    select count(*)::int from public.pauta_logs lg where lg.pauta_id = pt.id
  ) as logs_count
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

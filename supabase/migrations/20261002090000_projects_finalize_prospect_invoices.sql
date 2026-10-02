-- Projeto finalizado, prospecção automática do cliente 30 dias depois, nota fiscal agendada,
-- lembretes financeiros diários e prioridade nas notificações de pauta.
--
-- 1. Finalização: projeto transacional fica "pronto para finalizar" quando todas as pautas estão
--    aprovadas e todos os recebimentos foram baixados. Nesse momento o dono do projeto é avisado e
--    o app abre o pop-up de confirmação para quem deu a baixa/aprovou. Finalizar grava finalized_at.
-- 2. Prospecção: no dia seguinte aos 30 dias da finalização, nasce uma tarefa do comercial para o
--    SDR (líder e responsável), com o cliente já selecionado, prazo de 5 dias úteis e briefing. Quem
--    valida a estratégia (created_by) é quem aprova. SDR e validador ficam em company_settings.
-- 3. Nota fiscal: cada projeto pode ter agendamentos de emissão (mensal no dia X ou data única),
--    com responsável e contato de envio. O responsável é lembrado no dia e nos 7 dias seguintes até
--    marcar como emitida.
-- 4. Lembretes financeiros diários: vence hoje (receber e pagar) + atrasados, para o financeiro.
-- 5. Notificações de pauta trazem a prioridade.

-- ---------------------------------------------------------------------------
-- 1. Finalização
-- ---------------------------------------------------------------------------

alter table public.projects
  add column finalized_at timestamptz,
  add column finalized_by uuid references public.profiles (id) on delete set null,
  add column ready_notified_at timestamptz,
  add column reactivation_pauta_id uuid references public.pautas (id) on delete set null;

create or replace function public.project_finalization_status(p_project_id uuid)
returns table (ready boolean, finalized boolean, model public.project_model, pending_pautas int, open_receivables int, project_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pr.model = 'transacional' and pr.finalized_at is null
      and pend.cnt = 0 and rec.cnt = 0
      and (pa.total > 0 or rec.total > 0),
    pr.finalized_at is not null,
    pr.model,
    pend.cnt,
    rec.cnt,
    pr.name
  from public.projects pr
  cross join lateral (
    select count(*) filter (where p.status <> 'aprovado')::int as cnt, count(*)::int as total
    from public.pautas p where p.project_id = pr.id and p.archived_at is null
  ) pend
  cross join lateral (select count(*)::int as total from public.pautas p where p.project_id = pr.id and p.archived_at is null) pa
  cross join lateral (
    select count(*) filter (where r.received_at is null)::int as cnt, count(*)::int as total
    from public.receivables r where r.project_id = pr.id and r.cancelled_at is null
  ) rec
  where pr.id = p_project_id and public.is_active_user()
$$;

revoke all on function public.project_finalization_status(uuid) from public, anon;
grant execute on function public.project_finalization_status(uuid) to authenticated;

create or replace function public.can_finalize_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = p_project_id
      and (pr.owner_id = auth.uid() or public.is_director() or public.can_manage_pautas() or public.has_finance_access())
  )
$$;

revoke all on function public.can_finalize_project(uuid) from public, anon;
grant execute on function public.can_finalize_project(uuid) to authenticated;

create or replace function public.finalize_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_finalize_project(p_project_id) then
    raise exception 'Só o responsável pelo projeto, a gestão ou o financeiro finalizam projetos.' using errcode = '42501';
  end if;
  update public.projects
  set finalized_at = coalesce(finalized_at, now()),
      finalized_by = coalesce(finalized_by, auth.uid()),
      stage = 'entregue'
  where id = p_project_id;
end;
$$;

revoke all on function public.finalize_project(uuid) from public, anon;
grant execute on function public.finalize_project(uuid) to authenticated;

-- Avisa o dono quando o projeto fica pronto para finalizar (uma vez).
create or replace function public.notify_project_ready(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status record;
  v_project public.projects;
begin
  select * into v_status from public.project_finalization_status(p_project_id);
  if v_status is null or not coalesce(v_status.ready, false) then
    return;
  end if;
  select * into v_project from public.projects where id = p_project_id;
  if v_project.ready_notified_at is not null then
    return;
  end if;
  perform public.notify(v_project.owner_id, 'project_ready_to_finalize', 'Projeto pronto para finalizar',
    v_project.name || ': todas as pautas aprovadas e o pagamento recebido. Confirme a finalização.',
    'project', v_project.id, '/projetos/' || v_project.id || '?finalizar=1');
  update public.projects set ready_notified_at = now() where id = p_project_id;
end;
$$;

revoke all on function public.notify_project_ready(uuid) from public, anon, authenticated;

create or replace function public.receivables_check_project_ready()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.project_id is not null and new.received_at is not null and old.received_at is null then
    perform public.notify_project_ready(new.project_id);
  end if;
  return new;
end;
$$;

drop trigger if exists receivables_check_project_ready on public.receivables;
create trigger receivables_check_project_ready
  after update on public.receivables
  for each row execute function public.receivables_check_project_ready();

-- A checagem de pagamento ao aprovar a última pauta também avisa "pronto para finalizar".
create or replace function public.pautas_check_project_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.project_id is not null and new.status = 'aprovado' and old.status is distinct from 'aprovado' then
    perform public.check_project_payment(new.project_id);
    perform public.notify_project_ready(new.project_id);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Prospecção automática (reativação do cliente)
-- ---------------------------------------------------------------------------

alter table public.company_settings
  add column prospect_sdr_id uuid references public.profiles (id) on delete set null,
  add column prospect_reviewer_id uuid references public.profiles (id) on delete set null;

-- Data + N dias úteis (segunda a sexta).
create or replace function public.add_business_days(p_start date, p_days int)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_date date := p_start;
  v_left int := p_days;
begin
  while v_left > 0 loop
    v_date := v_date + 1;
    if extract(isodow from v_date) < 6 then
      v_left := v_left - 1;
    end if;
  end loop;
  return v_date;
end;
$$;

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
      and (pr.finalized_at at time zone 'America/Fortaleza')::date + 30 <= v_today
      and (pr.finalized_at at time zone 'America/Fortaleza')::date + 60 >= v_today
      -- Cliente já com outro projeto em andamento não precisa ser reativado.
      and not exists (
        select 1 from public.projects other
        where other.company_id = pr.company_id and other.id <> pr.id
          and other.finalized_at is null and other.stage not in ('entregue', 'cancelado')
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

revoke all on function public.create_reactivation_pautas() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Nota fiscal agendada por projeto
-- ---------------------------------------------------------------------------

create type public.invoice_frequency as enum ('mensal', 'unica');

create table public.project_invoice_schedules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  frequency public.invoice_frequency not null,
  day_of_month smallint check (day_of_month between 1 and 31),
  issue_date date,
  responsible_id uuid not null references public.profiles (id) on delete restrict,
  contact_id uuid references public.contacts (id) on delete set null,
  send_to_email text check (send_to_email is null or send_to_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notes text check (notes is null or length(notes) <= 1000),
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint project_invoice_schedules_when check (
    (frequency = 'mensal' and day_of_month is not null) or (frequency = 'unica' and issue_date is not null)
  )
);

create index project_invoice_schedules_project_idx on public.project_invoice_schedules (project_id);

create table public.invoice_issuances (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.project_invoice_schedules (id) on delete cascade,
  period date not null,
  invoice_number text check (invoice_number is null or length(invoice_number) <= 60),
  issued_at timestamptz not null default now(),
  issued_by uuid references public.profiles (id) on delete set null default auth.uid(),
  unique (schedule_id, period)
);

alter table public.project_invoice_schedules enable row level security;
alter table public.invoice_issuances enable row level security;

-- Vê quem pode ver o projeto; gerencia o financeiro, a diretoria e quem gerencia o projeto.
create or replace function public.can_manage_invoices(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and (
    public.has_finance_access() or public.is_director()
    or exists (select 1 from public.projects pr where pr.id = p_project_id and pr.owner_id = auth.uid())
  )
$$;

revoke all on function public.can_manage_invoices(uuid) from public, anon;
grant execute on function public.can_manage_invoices(uuid) to authenticated;

create policy "invoice_schedules_select" on public.project_invoice_schedules for select to authenticated
  using (public.can_manage_invoices(project_id) or responsible_id = auth.uid());
create policy "invoice_schedules_insert" on public.project_invoice_schedules for insert to authenticated
  with check (public.can_manage_invoices(project_id));
create policy "invoice_schedules_update" on public.project_invoice_schedules for update to authenticated
  using (public.can_manage_invoices(project_id)) with check (public.can_manage_invoices(project_id));
create policy "invoice_schedules_delete" on public.project_invoice_schedules for delete to authenticated
  using (public.can_manage_invoices(project_id));

create policy "invoice_issuances_select" on public.invoice_issuances for select to authenticated
  using (exists (
    select 1 from public.project_invoice_schedules s
    where s.id = schedule_id and (public.can_manage_invoices(s.project_id) or s.responsible_id = auth.uid())
  ));
create policy "invoice_issuances_insert" on public.invoice_issuances for insert to authenticated
  with check (issued_by = auth.uid() and exists (
    select 1 from public.project_invoice_schedules s
    where s.id = schedule_id and (public.can_manage_invoices(s.project_id) or s.responsible_id = auth.uid())
  ));
create policy "invoice_issuances_delete" on public.invoice_issuances for delete to authenticated
  using (issued_by = auth.uid() or exists (
    select 1 from public.project_invoice_schedules s where s.id = schedule_id and public.can_manage_invoices(s.project_id)
  ));

-- Data de emissão vigente de um agendamento (mensal: o dia X deste mês, limitado ao último dia).
create or replace function public.invoice_due_date(p_frequency public.invoice_frequency, p_day smallint, p_issue_date date, p_today date)
returns date
language sql
immutable
set search_path = ''
as $$
  select case p_frequency
    when 'unica' then p_issue_date
    else make_date(
      extract(year from p_today)::int,
      extract(month from p_today)::int,
      least(p_day::int, extract(day from (date_trunc('month', p_today) + interval '1 month - 1 day'))::int)
    )
  end
$$;

create or replace function public.notify_invoices_due()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Fortaleza')::date;
  r record;
  v_due date;
  v_period date;
  v_late int;
  v_target text;
begin
  for r in
    select s.*, pr.name as project_name, c.name as company_name, ct.full_name as contact_name, ct.email as contact_email
    from public.project_invoice_schedules s
    join public.projects pr on pr.id = s.project_id
    left join public.companies c on c.id = pr.company_id
    left join public.contacts ct on ct.id = s.contact_id
    where s.active
  loop
    v_due := public.invoice_due_date(r.frequency, r.day_of_month, r.issue_date, v_today);
    v_period := case when r.frequency = 'mensal' then date_trunc('month', v_today)::date else r.issue_date end;
    if v_due is null or v_today < v_due or v_today > v_due + 7 then
      continue;
    end if;
    if exists (select 1 from public.invoice_issuances i where i.schedule_id = r.id and i.period = v_period) then
      continue;
    end if;
    if public.notified_today(r.responsible_id, 'finance_invoice_due', r.id) then
      continue;
    end if;
    v_late := v_today - v_due;
    v_target := coalesce(r.contact_name, '') || coalesce(' (' || coalesce(r.send_to_email, r.contact_email) || ')', '');
    perform public.notify(r.responsible_id, 'finance_invoice_due',
      case when v_late = 0 then 'Emitir nota fiscal hoje' else 'Nota fiscal pendente há ' || v_late || case when v_late = 1 then ' dia' else ' dias' end end,
      r.project_name || coalesce(' · ' || r.company_name, '') || case when v_target <> '' then ' · enviar para ' || v_target else '' end,
      'invoice_schedule', r.id, '/projetos/' || r.project_id || '#nota-fiscal');
  end loop;
end;
$$;

revoke all on function public.notify_invoices_due() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Lembretes financeiros: vence hoje (os atrasados já existem em notify_overdue_finance)
-- ---------------------------------------------------------------------------

create or replace function public.notify_finance_due_today()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Fortaleza')::date;
begin
  insert into public.notifications (recipient_id, type, title, body, entity_type, entity_id, url)
  select p.id, 'finance_due_today_receivable', 'Recebimento vence hoje',
    r.description || ' — ' || c.name, 'receivable', r.id, '/financeiro?aba=recebimentos'
  from public.receivables r
  join public.companies c on c.id = r.company_id
  cross join public.profiles p
  where r.received_at is null and r.cancelled_at is null and r.due_date = v_today
    and p.is_active
    and (p.has_finance_access or exists (select 1 from public.profile_squads ps where ps.profile_id = p.id and ps.squad in ('diretoria', 'financeiro')))
    and not public.notified_today(p.id, 'finance_due_today_receivable', r.id);

  insert into public.notifications (recipient_id, type, title, body, entity_type, entity_id, url)
  select p.id, 'finance_due_today_payable', 'Pagamento vence hoje',
    pa.description || ' — ' || coalesce(nullif(btrim(pa.payee_name), ''), pr.full_name, 'Favorecido não informado'),
    'payable', pa.id, '/financeiro?aba=pagamentos'
  from public.payables pa
  left join public.profiles pr on pr.id = pa.payee_profile_id
  cross join public.profiles p
  where pa.paid_at is null and pa.cancelled_at is null and pa.due_date = v_today
    and p.is_active
    and (p.has_finance_access or exists (select 1 from public.profile_squads ps where ps.profile_id = p.id and ps.squad in ('diretoria', 'financeiro')))
    and not public.notified_today(p.id, 'finance_due_today_payable', pa.id);
end;
$$;

revoke all on function public.notify_finance_due_today() from public, anon, authenticated;

-- O job diário das 8h passa a rodar tudo: pautas, financeiro, nota fiscal e prospecção.
create or replace function public.run_daily_all()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.run_daily_reminders();
  perform public.notify_overdue_finance();
  perform public.notify_finance_due_today();
  perform public.notify_invoices_due();
  perform public.create_reactivation_pautas();
end;
$$;

revoke all on function public.run_daily_all() from public, anon, authenticated;

select cron.schedule('alem-daily-reminders', '0 11 * * *', 'select public.run_daily_all()');

-- ---------------------------------------------------------------------------
-- 5. Prioridade nas notificações de pauta
-- ---------------------------------------------------------------------------

create or replace function public.pauta_priority_label(p_priority public.project_priority)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'Prioridade ' || case p_priority when 'baixa' then 'baixa' when 'media' then 'média' when 'alta' then 'alta' when 'urgente' then 'URGENTE' end
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
  v_body text;
begin
  if new.deal_id is not null or new.is_standalone then
    return new;
  end if;

  select full_name into v_by from public.profiles where id = coalesce(auth.uid(), new.created_by);
  v_body := new.title || ' · ' || public.pauta_priority_label(new.priority) || coalesce(' · por ' || v_by, '');

  if new.current_assignee_id is not null and new.current_assignee_id is distinct from auth.uid() then
    perform public.notify(new.current_assignee_id, 'pauta_assignee_changed', 'Nova ' || v_noun || ' para você', v_body, 'pauta', new.id, v_url);
  end if;

  if new.lead_id is distinct from auth.uid() and new.lead_id is distinct from new.current_assignee_id then
    perform public.notify(new.lead_id, 'pauta_lead_assigned', 'Você é líder de uma nova ' || v_noun, v_body, 'pauta', new.id, v_url);
  end if;

  return new;
end;
$$;

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
  if new.is_standalone or new.deal_id is not null then
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

-- Responsável adicionado também vê a prioridade.
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
    'Você foi incluído numa ' || public.pauta_noun(v_pauta.squad),
    v_pauta.title || ' · ' || public.pauta_priority_label(v_pauta.priority), 'pauta', new.pauta_id,
    '/minhas-pautas?pauta=' || new.pauta_id);
  return new;
end;
$$;

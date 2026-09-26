-- Passada de produto: configurações da empresa, preferências de notificação por pessoa,
-- escopo de custo em payables, ranking de clientes por valor de contrato e o painel de Avisos.

-- ---------------------------------------------------------------------------
-- Quem administra a empresa: master ou diretoria (squad ou nível hierárquico).
-- ---------------------------------------------------------------------------

create function public.can_manage_company()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_master() or public.is_director() or coalesce(public.current_org_level() = 'diretoria', false)
$$;

revoke all on function public.can_manage_company() from public, anon;
grant execute on function public.can_manage_company() to authenticated;

-- ---------------------------------------------------------------------------
-- company_settings: linha única com os parâmetros da empresa que antes estavam fixos no código
-- (jornada padrão 8h seg–sex, margem saudável 50% / atenção 47%). Comissões continuam em
-- commission_rules (uma linha nova por mudança, com vigência).
-- ---------------------------------------------------------------------------

create table public.company_settings (
  id boolean primary key default true check (id),
  default_daily_hours numeric(4, 2) not null default 8 check (default_daily_hours > 0 and default_daily_hours <= 24),
  default_workdays int[] not null default '{1,2,3,4,5}'
    check (default_workdays <@ array[1, 2, 3, 4, 5, 6, 7] and cardinality(default_workdays) > 0),
  healthy_margin_pct numeric(5, 2) not null default 50 check (healthy_margin_pct >= 0 and healthy_margin_pct <= 100),
  attention_margin_pct numeric(5, 2) not null default 47 check (attention_margin_pct >= 0 and attention_margin_pct <= 100),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint company_settings_margin_order check (attention_margin_pct <= healthy_margin_pct)
);

insert into public.company_settings default values;

create trigger company_settings_set_updated_at
  before update on public.company_settings
  for each row execute function public.set_updated_at();

create function public.company_settings_stamp_updated_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger company_settings_stamp_updated_by
  before update on public.company_settings
  for each row execute function public.company_settings_stamp_updated_by();

alter table public.company_settings enable row level security;

-- Todo mundo ativo lê (a margem saudável aparece em vários painéis); só master/diretoria editam.
-- Sem insert/delete: a linha única nasce aqui.
create policy "company_settings_select" on public.company_settings for select to authenticated
  using (public.is_active_user());
create policy "company_settings_update" on public.company_settings for update to authenticated
  using (public.can_manage_company())
  with check (public.can_manage_company());

-- Status da margem a partir das configurações (antes: 50 / 47 fixos nas views).
create function public.margin_status_for(p_pct numeric)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_pct is null then null
    when p_pct >= s.healthy_margin_pct then 'saudavel'
    when p_pct >= s.attention_margin_pct then 'atencao'
    else 'critico'
  end
  from public.company_settings s
  where s.id
$$;

revoke all on function public.margin_status_for(numeric) from public, anon;
grant execute on function public.margin_status_for(numeric) to authenticated;

-- Mesmas colunas, na mesma ordem — só a regra da margem passa a vir das configurações.
create or replace view public.project_profitability
with (security_invoker = true) as
select
  p.id as project_id,
  p.name as project_name,
  p.company_id,
  c.name as company_name,
  p.is_internal,
  p.stage,
  p.due_date,
  pf.contract_value,
  coalesce(r.received, 0)::numeric(12, 2) as total_received,
  coalesce(r.pending, 0)::numeric(12, 2) as receivable_pending,
  coalesce(pa.total, 0)::numeric(12, 2) as payables_total,
  coalesce(pa.paid, 0)::numeric(12, 2) as payables_paid,
  (pf.contract_value - coalesce(pa.total, 0))::numeric(12, 2) as planned_margin,
  case
    when coalesce(pf.contract_value, 0) > 0
      then round((pf.contract_value - coalesce(pa.total, 0)) / pf.contract_value * 100, 1)
  end as margin_pct,
  case
    when coalesce(pf.contract_value, 0) <= 0 then null
    else public.margin_status_for(round((pf.contract_value - coalesce(pa.total, 0)) / pf.contract_value * 100, 1))
  end as margin_status
from public.projects p
left join public.companies c on c.id = p.company_id
left join public.project_financials pf on pf.project_id = p.id
left join lateral (
  select
    sum(x.received_amount) filter (where x.received_at is not null and x.cancelled_at is null) as received,
    sum(x.amount) filter (where x.received_at is null and x.cancelled_at is null) as pending
  from public.receivables x where x.project_id = p.id
) r on true
left join lateral (
  select
    sum(y.amount) filter (where y.cancelled_at is null) as total,
    sum(y.amount) filter (where y.paid_at is not null and y.cancelled_at is null) as paid
  from public.payables y where y.project_id = p.id
) pa on true
where public.has_finance_access();

create or replace view public.finance_by_client
with (security_invoker = true) as
with proj as (
  select id, company_id from public.projects where company_id is not null and not is_internal
),
costs as (
  select coalesce(pa.company_id, p.company_id) as company_id, sum(pa.amount) as total
  from public.payables pa
  left join proj p on p.id = pa.project_id
  where pa.cancelled_at is null and coalesce(pa.company_id, p.company_id) is not null
  group by coalesce(pa.company_id, p.company_id)
),
rec as (
  select
    r.company_id,
    sum(r.amount) filter (where r.cancelled_at is null) as billed,
    sum(r.received_amount) filter (where r.received_at is not null and r.cancelled_at is null) as received,
    sum(r.amount) filter (where r.received_at is null and r.cancelled_at is null) as pending
  from public.receivables r
  group by r.company_id
),
projcount as (
  select company_id, count(*) as project_count from proj group by company_id
)
select
  c.id as company_id,
  c.name as company_name,
  coalesce(rec.billed, 0)::numeric(12, 2) as total_billed,
  coalesce(rec.received, 0)::numeric(12, 2) as total_received,
  coalesce(rec.pending, 0)::numeric(12, 2) as total_pending,
  coalesce(costs.total, 0)::numeric(12, 2) as total_costs,
  case when coalesce(rec.billed, 0) > 0
    then round((rec.billed - coalesce(costs.total, 0)) / rec.billed * 100, 1)
  end as margin_pct,
  case
    when coalesce(rec.billed, 0) <= 0 then null
    else public.margin_status_for(round((rec.billed - coalesce(costs.total, 0)) / rec.billed * 100, 1))
  end as margin_status,
  coalesce(projcount.project_count, 0)::int as project_count
from public.companies c
left join rec on rec.company_id = c.id
left join costs on costs.company_id = c.id
left join projcount on projcount.company_id = c.id
where public.has_finance_access() and (rec.billed is not null or costs.total is not null)
order by c.name;

-- A carga horária padrão de quem entra vem das configurações (antes: 8h seg–sex fixo).
create or replace function public.create_default_work_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.work_schedules (profile_id, daily_hours, workdays, effective_from)
  values (
    new.id,
    coalesce((select s.default_daily_hours from public.company_settings s where s.id), 8),
    coalesce((select s.default_workdays from public.company_settings s where s.id), '{1,2,3,4,5}'),
    (now() at time zone 'America/Fortaleza')::date
  )
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- payables.cost_scope: custo da empresa (operação) ou de projeto. Mantido pelo banco a partir de
-- project_id — um pagamento com projeto é sempre 'projeto'. O vínculo com uma pessoa (custo
-- mensal por colaborador) já existe em payee_profile_id.
-- ---------------------------------------------------------------------------

create type public.cost_scope as enum ('empresa', 'projeto');

alter table public.payables add column cost_scope public.cost_scope;

update public.payables
set cost_scope = case when project_id is null then 'empresa'::public.cost_scope else 'projeto'::public.cost_scope end;

alter table public.payables
  alter column cost_scope set default 'empresa',
  alter column cost_scope set not null;

create function public.payables_sync_cost_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.cost_scope := case when new.project_id is null then 'empresa'::public.cost_scope else 'projeto'::public.cost_scope end;
  return new;
end;
$$;

create trigger payables_sync_cost_scope
  before insert or update of project_id, cost_scope on public.payables
  for each row execute function public.payables_sync_cost_scope();

create index if not exists payables_cost_scope_idx on public.payables (cost_scope, due_date);
create index if not exists payables_payee_profile_idx on public.payables (payee_profile_id) where payee_profile_id is not null;

-- "pa.*" é expandido na criação da view: recriada para incluir cost_scope.
drop view if exists public.payables_with_status;

create view public.payables_with_status
with (security_invoker = true) as
select
  pa.*,
  p.name as project_name,
  coalesce(nullif(btrim(pa.payee_name), ''), pr.full_name) as payee_label,
  case
    when pa.cancelled_at is not null then 'cancelado'
    when pa.paid_at is not null then 'pago'
    when pa.due_date < (now() at time zone 'America/Fortaleza')::date then 'atrasado'
    else 'pendente'
  end as status
from public.payables pa
left join public.projects p on p.id = pa.project_id
left join public.profiles pr on pr.id = pa.payee_profile_id;

revoke all on public.payables_with_status from anon;
grant select on public.payables_with_status to authenticated;

-- ---------------------------------------------------------------------------
-- user_settings: preferências de notificação por tipo. Respeitadas por um único gatilho em
-- notifications — todas as funções que notificam passam a obedecer sem serem reescritas.
-- ---------------------------------------------------------------------------

create table public.user_settings (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  notify_pautas boolean not null default true,
  notify_projetos boolean not null default true,
  notify_agenda boolean not null default true,
  notify_comercial boolean not null default true,
  notify_financeiro boolean not null default true,
  notify_avisos boolean not null default true,
  notify_banco_horas boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "user_settings_select_own" on public.user_settings for select to authenticated
  using (profile_id = auth.uid());
create policy "user_settings_insert_own" on public.user_settings for insert to authenticated
  with check (profile_id = auth.uid() and public.is_active_user());
create policy "user_settings_update_own" on public.user_settings for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Categoria de cada tipo de notificação (os tipos existentes seguem prefixos estáveis).
create function public.notification_category(p_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_type like 'pauta%' then 'pautas'
    when p_type like 'project%' then 'projetos'
    when p_type like 'commitment%' then 'agenda'
    when p_type like 'deal%' or p_type like 'crm%' or p_type = 'qualificado' then 'comercial'
    when p_type like 'finance%' or p_type in ('payable', 'receivable') then 'financeiro'
    when p_type like 'announcement%' then 'avisos'
    when p_type like 'time%' then 'banco_horas'
    else null
  end
$$;

create function public.notifications_respect_user_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean;
begin
  select case public.notification_category(new.type)
    when 'pautas' then s.notify_pautas
    when 'projetos' then s.notify_projetos
    when 'agenda' then s.notify_agenda
    when 'comercial' then s.notify_comercial
    when 'financeiro' then s.notify_financeiro
    when 'avisos' then s.notify_avisos
    when 'banco_horas' then s.notify_banco_horas
  end
  into v_enabled
  from public.user_settings s
  where s.profile_id = new.recipient_id;

  -- Sem linha de preferências (ou tipo sem categoria): notifica, como antes.
  if v_enabled is false then
    return null;
  end if;
  return new;
end;
$$;

create trigger notifications_respect_user_settings
  before insert on public.notifications
  for each row execute function public.notifications_respect_user_settings();

-- ---------------------------------------------------------------------------
-- Ranking de clientes por valor de contrato (soma dos projetos). Todos recebem a ORDEM; o valor só
-- volta para quem tem acesso ao financeiro — igual à RLS de project_financials.
-- ---------------------------------------------------------------------------

create function public.company_contract_ranking()
returns table (company_id uuid, rank int, total_value numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ranked.company_id,
    ranked.rank,
    case when public.has_finance_access() then ranked.total end
  from (
    select
      p.company_id,
      row_number() over (order by sum(coalesce(pf.contract_value, 0)) desc, p.company_id)::int as rank,
      sum(coalesce(pf.contract_value, 0))::numeric(14, 2) as total
    from public.projects p
    left join public.project_financials pf on pf.project_id = p.id
    where p.company_id is not null
    group by p.company_id
  ) ranked
  where public.is_active_user()
$$;

revoke all on function public.company_contract_ranking() from public, anon;
grant execute on function public.company_contract_ranking() to authenticated;

-- ---------------------------------------------------------------------------
-- Avisos (announcements). Só master/diretoria criam, editam, agendam e arquivam. Os demais leem só
-- o que é para o próprio squad/nível, dentro da janela published_at <= agora < expires_at.
-- Público vazio = todos (audience_squads vazio: qualquer squad; audience_levels vazio: qualquer nível).
-- O corpo é texto com marcação simples (negrito, itálico, listas, links) renderizada pela UI.
-- ---------------------------------------------------------------------------

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text not null default '' check (char_length(body) <= 20000),
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  audience_squads public.squad[] not null default '{}',
  audience_levels public.org_level[] not null default '{}',
  is_pinned boolean not null default false,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint announcements_window check (expires_at is null or expires_at > published_at)
);

create index announcements_active_idx on public.announcements (published_at desc) where archived_at is null;

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

create function public.is_announcement_audience(p_squads public.squad[], p_levels public.org_level[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (cardinality(p_squads) = 0 or exists (
      select 1 from public.profile_squads ps where ps.profile_id = auth.uid() and ps.squad = any (p_squads)
    ))
    and (cardinality(p_levels) = 0 or coalesce(public.current_org_level() = any (p_levels), false))
$$;

revoke all on function public.is_announcement_audience(public.squad[], public.org_level[]) from public, anon;
grant execute on function public.is_announcement_audience(public.squad[], public.org_level[]) to authenticated;

alter table public.announcements enable row level security;

create policy "announcements_select" on public.announcements for select to authenticated
  using (
    public.is_active_user()
    and (
      public.can_manage_company()
      or (
        archived_at is null
        and published_at <= now()
        and (expires_at is null or now() < expires_at)
        and public.is_announcement_audience(audience_squads, audience_levels)
      )
    )
  );
create policy "announcements_insert" on public.announcements for insert to authenticated
  with check (public.can_manage_company() and author_id = auth.uid());
create policy "announcements_update" on public.announcements for update to authenticated
  using (public.can_manage_company())
  with check (public.can_manage_company());

-- Autor não muda depois de criado; notified_at só é gravado pela função de publicação.
create function public.announcements_protect_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.author_id := old.author_id;
  new.created_at := old.created_at;
  -- notified_at só muda pela publish_due_announcements() (que liga a flag abaixo). Reagendar para o
  -- futuro volta a notificar quando o novo horário chegar.
  if coalesce(current_setting('app.publishing_announcements', true), '') = 'on' then
    return new;
  end if;
  if new.published_at is distinct from old.published_at and new.published_at > now() then
    new.notified_at := null;
  else
    new.notified_at := old.notified_at;
  end if;
  return new;
end;
$$;

create trigger announcements_protect_columns
  before update on public.announcements
  for each row execute function public.announcements_protect_columns();

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, profile_id)
);

alter table public.announcement_reads enable row level security;

create policy "announcement_reads_select_own" on public.announcement_reads for select to authenticated
  using (profile_id = auth.uid());
create policy "announcement_reads_insert_own" on public.announcement_reads for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (select 1 from public.announcements a where a.id = announcement_id)
  );

-- Gera as notificações dos avisos cujo horário de publicação chegou (uma vez por aviso). Chamada
-- pelo app a cada carregamento e logo após criar/agendar — sem depender de agendador no banco.
create function public.publish_due_announcements()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_announcement record;
  v_count int := 0;
begin
  if not public.is_active_user() then
    return 0;
  end if;

  perform set_config('app.publishing_announcements', 'on', true);

  for v_announcement in
    select a.*
    from public.announcements a
    where a.notified_at is null
      and a.archived_at is null
      and a.published_at <= now()
      and (a.expires_at is null or now() < a.expires_at)
    for update skip locked
  loop
    insert into public.notifications (recipient_id, type, title, body, entity_type, entity_id, url)
    select
      p.id,
      'announcement_published',
      'Novo aviso: ' || v_announcement.title,
      left(regexp_replace(v_announcement.body, '[*_#>\[\]()`-]', '', 'g'), 180),
      'announcement',
      v_announcement.id,
      '/avisos?aviso=' || v_announcement.id
    from public.profiles p
    where p.is_active
      and p.id is distinct from v_announcement.author_id
      and (cardinality(v_announcement.audience_squads) = 0 or exists (
        select 1 from public.profile_squads ps where ps.profile_id = p.id and ps.squad = any (v_announcement.audience_squads)
      ))
      and (cardinality(v_announcement.audience_levels) = 0 or p.org_level = any (v_announcement.audience_levels));

    update public.announcements set notified_at = now() where id = v_announcement.id;
    v_count := v_count + 1;
  end loop;

  perform set_config('app.publishing_announcements', 'off', true);

  return v_count;
end;
$$;

revoke all on function public.publish_due_announcements() from public, anon;
grant execute on function public.publish_due_announcements() to authenticated;

-- Avisos ativos para a pessoa (público + janela) que ela ainda não abriu — badge da sidebar.
create function public.announcements_unread_count()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.announcements a
  where public.is_active_user()
    and a.archived_at is null
    and a.published_at <= now()
    and (a.expires_at is null or now() < a.expires_at)
    and public.is_announcement_audience(a.audience_squads, a.audience_levels)
    and not exists (
      select 1 from public.announcement_reads r where r.announcement_id = a.id and r.profile_id = auth.uid()
    )
$$;

revoke all on function public.announcements_unread_count() from public, anon;
grant execute on function public.announcements_unread_count() to authenticated;

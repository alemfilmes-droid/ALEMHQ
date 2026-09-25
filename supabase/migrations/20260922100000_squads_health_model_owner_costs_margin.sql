-- Etapa A: squads e permissões, saúde do cliente e ticket, modelo comercial do projeto,
-- responsável e notificações, custos na criação e margem, cores de status.

-- ---------------------------------------------------------------------------
-- Squads
-- ---------------------------------------------------------------------------

create type public.squad as enum ('diretoria', 'audiovisual', 'comercial', 'financeiro');

create table public.profile_squads (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  squad public.squad not null,
  is_lead boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (profile_id, squad)
);

create index profile_squads_squad_idx on public.profile_squads (squad);

alter table public.profile_squads enable row level security;

create policy "profile_squads_select_active"
  on public.profile_squads for select
  to authenticated
  using (public.is_active_user());

create policy "profile_squads_admin_write"
  on public.profile_squads for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create function public.in_squad(p_squad public.squad)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profile_squads ps
    join public.profiles p on p.id = ps.profile_id
    where ps.profile_id = auth.uid() and ps.squad = p_squad and p.is_active
  )
$$;

create function public.is_director()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.in_squad('diretoria')
$$;

create function public.can_see_money()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.in_squad('diretoria') or public.in_squad('financeiro')
$$;

revoke all on function public.in_squad(public.squad) from public, anon;
revoke all on function public.is_director() from public, anon;
revoke all on function public.can_see_money() from public, anon;
grant execute on function public.in_squad(public.squad) to authenticated;
grant execute on function public.is_director() to authenticated;
grant execute on function public.can_see_money() to authenticated;

-- Bootstrap: a conta admin existente (dono do sistema) entra na diretoria.
insert into public.profile_squads (profile_id, squad)
select id, 'diretoria' from public.profiles where access_role = 'admin'
on conflict do nothing;

-- has_finance_access() agora é derivado: acesso efetivo = squad (diretoria/financeiro) OU a
-- concessão manual na coluna (exceção pontual). A coluna deixa de ser a única fonte de verdade,
-- mas TODAS as policies e o generate_installments que já chamavam esta função passam a valer
-- para squads automaticamente, sem precisar redefinir cada policy.
create or replace function public.has_finance_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.can_see_money()
    or coalesce((select p.has_finance_access from public.profiles p where p.id = auth.uid() and p.is_active), false)
$$;

-- ---------------------------------------------------------------------------
-- Saúde do cliente e nível de ticket
-- ---------------------------------------------------------------------------

create type public.client_health as enum ('ativo', 'atencao', 'tensao', 'churn');
create type public.client_tier as enum ('low_ticket', 'mid_ticket', 'high_ticket');

alter table public.companies
  add column health public.client_health not null default 'ativo',
  add column health_note text,
  add column health_updated_at timestamptz,
  add column health_updated_by uuid references public.profiles (id) on delete set null,
  add column tier public.client_tier;

create index companies_health_idx on public.companies (health);
create index companies_tier_idx on public.companies (tier);

-- Nível de ticket só existe para clientes (nunca para prospects). SDR/BDR não preenchem tier
-- porque, na prática, só lidam com prospects — a UI já esconde o campo até virar cliente.
-- Em vez de bloquear com erro, zera o tier sempre que a empresa não é 'client': assim uma
-- eventual reclassificação de cliente para prospect nunca fica presa por causa do tier antigo.
create function public.companies_guard_tier()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.lifecycle <> 'client' then
    new.tier = null;
  end if;
  return new;
end;
$$;

create trigger companies_guard_tier
  before insert or update on public.companies
  for each row execute function public.companies_guard_tier();

create function public.companies_stamp_health_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.health is distinct from old.health then
    new.health_updated_at = now();
    new.health_updated_by = auth.uid();
  end if;
  return new;
end;
$$;

create trigger companies_stamp_health_update
  before update on public.companies
  for each row execute function public.companies_stamp_health_update();

create function public.companies_log_health_and_tier()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.health is distinct from old.health then
    perform public.log_activity('health_changed', 'company', new.id,
      jsonb_build_object('from', old.health, 'to', new.health, 'note', new.health_note));
  end if;
  if new.tier is distinct from old.tier then
    perform public.log_activity('tier_changed', 'company', new.id,
      jsonb_build_object('from', old.tier, 'to', new.tier));
  end if;
  return new;
end;
$$;

create trigger companies_log_health_and_tier
  after update on public.companies
  for each row execute function public.companies_log_health_and_tier();

-- Empresas/contatos: diretoria e squad comercial criam e editam; os demais só leem.
drop policy "companies_insert_managers" on public.companies;
drop policy "companies_update_managers" on public.companies;
drop policy "contacts_insert_managers" on public.contacts;
drop policy "contacts_update_managers" on public.contacts;
drop policy "contacts_delete_managers" on public.contacts;

create policy "companies_insert_directors_or_comercial" on public.companies for insert to authenticated
  with check (public.is_director() or public.in_squad('comercial'));
create policy "companies_update_directors_or_comercial" on public.companies for update to authenticated
  using (public.is_director() or public.in_squad('comercial'))
  with check (public.is_director() or public.in_squad('comercial'));

create policy "contacts_insert_directors_or_comercial" on public.contacts for insert to authenticated
  with check (public.is_director() or public.in_squad('comercial'));
create policy "contacts_update_directors_or_comercial" on public.contacts for update to authenticated
  using (public.is_director() or public.in_squad('comercial'))
  with check (public.is_director() or public.in_squad('comercial'));
create policy "contacts_delete_directors_or_comercial" on public.contacts for delete to authenticated
  using (public.is_director() or public.in_squad('comercial'));

-- ---------------------------------------------------------------------------
-- Modelo comercial do projeto, responsável, entrega, prioridade, serviços
-- ---------------------------------------------------------------------------

create type public.project_model as enum ('transacional', 'recorrente');
create type public.project_priority as enum ('baixa', 'media', 'alta', 'urgente');
create type public.service_type as enum ('captacao', 'edicao', 'direcao', 'producao_completa');

-- Novas etapas do quadro (além das 7 existentes), para cobrir os status coloridos pedidos.
alter type public.project_stage add value if not exists 'planejamento';
alter type public.project_stage add value if not exists 'producao';
alter type public.project_stage add value if not exists 'pausado';
alter type public.project_stage add value if not exists 'cancelado';

alter table public.projects
  add column model public.project_model not null default 'transacional',
  add column start_date date,
  add column end_date date,
  add column priority public.project_priority not null default 'media',
  add column service_types public.service_type[] not null default '{}',
  add column briefing text,
  add column included_revision_rounds int,
  add column owner_id uuid references public.profiles (id) on delete restrict;

-- Transacional usa due_date ("Data de entrega"); recorrente usa start_date ("Início do projeto").
-- NOT VALID: não reavalia linhas já existentes, só passa a valer a partir de agora.
alter table public.projects
  add constraint projects_model_dates_check
  check (
    (model = 'transacional' and due_date is not null)
    or (model = 'recorrente' and start_date is not null)
  ) not valid;

-- Responsável pelo projeto: backfill (quem criou; sem isso, a diretoria) e só então NOT NULL.
update public.projects set owner_id = created_by where owner_id is null and created_by is not null;
update public.projects set owner_id = (
  select profile_id from public.profile_squads where squad = 'diretoria' order by profile_id limit 1
) where owner_id is null;
alter table public.projects alter column owner_id set not null;

create index projects_owner_idx on public.projects (owner_id);
create index projects_model_idx on public.projects (model);

-- ---------------------------------------------------------------------------
-- Equipe do projeto (freelancers só veem os projetos em que estão)
-- ---------------------------------------------------------------------------

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null default auth.uid(),
  added_at timestamptz not null default now(),
  primary key (project_id, profile_id)
);

create index project_members_profile_idx on public.project_members (profile_id);

alter table public.project_members enable row level security;

create policy "project_members_select_own"
  on public.project_members for select
  to authenticated
  using (profile_id = auth.uid());

create policy "project_members_manage_directors"
  on public.project_members for all
  to authenticated
  using (public.is_director())
  with check (public.is_director());

-- Freelancer só vê (e só nesse caso) os projetos em que consta como membro.
-- Policy adicional: some (OR) com a leitura interna já existente.
create policy "projects_select_member" on public.projects for select to authenticated
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = projects.id and pm.profile_id = auth.uid()
    )
  );

-- Criar/editar/arquivar (excluir) projetos: só diretoria. Os demais têm acesso só de leitura.
drop policy "projects_insert_managers" on public.projects;
drop policy "projects_update_managers" on public.projects;
drop policy "projects_delete_admin" on public.projects;

create policy "projects_insert_directors" on public.projects for insert to authenticated
  with check (public.is_director());
create policy "projects_update_directors" on public.projects for update to authenticated
  using (public.is_director())
  with check (public.is_director());
create policy "projects_delete_directors" on public.projects for delete to authenticated
  using (public.is_director());

-- ---------------------------------------------------------------------------
-- Notificações
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, read_at, created_at desc);

alter table public.notifications enable row level security;

-- Sem policy de insert/delete: só chegam linhas via função/trigger SECURITY DEFINER.
create policy "notifications_select_own" on public.notifications for select to authenticated
  using (recipient_id = auth.uid());
create policy "notifications_update_own" on public.notifications for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create function public.notify(
  p_recipient uuid, p_type text, p_title text, p_body text,
  p_entity_type text, p_entity_id uuid, p_url text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (recipient_id, type, title, body, entity_type, entity_id, url)
  values (p_recipient, p_type, p_title, p_body, p_entity_type, p_entity_id, p_url)
$$;

revoke all on function public.notify(uuid, text, text, text, text, uuid, text) from public, anon, authenticated;

create function public.notify_project_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.owner_id is not distinct from new.owner_id then
    return new;
  end if;
  -- Não notifica quem atribuiu o projeto a si mesmo.
  if new.owner_id is not distinct from auth.uid() then
    return new;
  end if;
  perform public.notify(
    new.owner_id, 'project_assigned', 'Você é responsável por um projeto',
    new.name, 'project', new.id, '/projetos/' || new.id
  );
  return new;
end;
$$;

create trigger projects_notify_owner
  after insert or update of owner_id on public.projects
  for each row execute function public.notify_project_owner();

create function public.notify_project_member_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_name text;
begin
  if new.profile_id is not distinct from auth.uid() then
    return new;
  end if;
  -- Quem é dono já recebeu a notificação de responsável; evita duplicar.
  if exists (select 1 from public.projects where id = new.project_id and owner_id = new.profile_id) then
    return new;
  end if;
  select name into v_project_name from public.projects where id = new.project_id;
  perform public.notify(
    new.profile_id, 'project_member_added', 'Você foi adicionado a um projeto',
    v_project_name, 'project', new.project_id, '/projetos/' || new.project_id
  );
  return new;
end;
$$;

create trigger project_members_notify_added
  after insert on public.project_members
  for each row execute function public.notify_project_member_added();

-- ---------------------------------------------------------------------------
-- Convites carregam squads também
-- ---------------------------------------------------------------------------

alter table public.invitations add column squads public.squad[] not null default '{}';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invitations%rowtype;
begin
  select * into inv
  from public.invitations i
  where i.email = lower(new.email)
    and i.status = 'pending'
    and i.expires_at > now()
  order by i.created_at desc
  limit 1;

  insert into public.profiles (id, email, full_name, access_role, functions)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(inv.access_role, 'freelancer'),
    coalesce(inv.functions, '{}')
  )
  on conflict (id) do nothing;

  if inv.id is not null and coalesce(array_length(inv.squads, 1), 0) > 0 then
    insert into public.profile_squads (profile_id, squad)
    select new.id, s from unnest(inv.squads) as s
    on conflict do nothing;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Margem prevista: regra de 50% líquido, saudável/atenção/crítico.
-- ---------------------------------------------------------------------------

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
    when round((pf.contract_value - coalesce(pa.total, 0)) / pf.contract_value * 100, 1) >= 50 then 'saudavel'
    when round((pf.contract_value - coalesce(pa.total, 0)) / pf.contract_value * 100, 1) >= 47 then 'atencao'
    else 'critico'
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

revoke all on public.project_profitability from anon;

-- Módulo 2A · Empresas, contatos, projetos e financeiro do projeto.

create type public.company_lifecycle as enum ('prospect', 'client');

create type public.company_source as enum (
  'crm', 'indicacao', 'cliente_antigo', 'instagram', 'site', 'evento', 'prospeccao_ativa', 'outro'
);

create type public.project_stage as enum (
  'pre_producao', 'captacao', 'edicao', 'revisao_interna',
  'aprovacao_cliente', 'alteracao', 'entregue'
);

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  document text,
  city text,
  instagram text,
  website text,
  lifecycle public.company_lifecycle not null default 'prospect',
  source public.company_source,
  source_detail text,
  became_client_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index companies_lifecycle_idx on public.companies (lifecycle);
create index companies_name_idx on public.companies (lower(name));

-- Cobre INSERT (cliente cadastrado direto) e UPDATE (prospect virando cliente).
create function public.companies_set_became_client_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.lifecycle = 'client'
     and new.became_client_at is null
     and (tg_op = 'INSERT' or old.lifecycle is distinct from 'client') then
    new.became_client_at = now();
  end if;
  return new;
end;
$$;

create trigger companies_set_became_client_at
  before insert or update on public.companies
  for each row execute function public.companies_set_became_client_at();

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) > 0),
  job_title text,
  email text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_company_idx on public.contacts (company_id);

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- projects (company_id nulo = projeto interno da Além Filmes)
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  company_id uuid references public.companies (id) on delete restrict,
  contact_id uuid references public.contacts (id) on delete set null,
  is_internal boolean not null default false,
  stage public.project_stage not null default 'pre_producao',
  description text,
  due_date date,
  drive_folder_url text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_client_or_internal_check
    check (company_id is not null or is_internal = true),
  -- Interno não tem cliente nem contato.
  constraint projects_internal_has_no_client_check
    check (not is_internal or (company_id is null and contact_id is null))
);

create index projects_company_idx on public.projects (company_id);
create index projects_stage_idx on public.projects (stage);
create index projects_internal_idx on public.projects (is_internal);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- O contato precisa pertencer à empresa do projeto.
create function public.projects_validate_contact()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.contact_id is not null
     and not exists (
       select 1 from public.contacts c
       where c.id = new.contact_id and c.company_id = new.company_id
     ) then
    raise exception 'O contato não pertence à empresa do projeto.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger projects_validate_contact
  before insert or update of company_id, contact_id on public.projects
  for each row execute function public.projects_validate_contact();

-- Projeto de cliente promove prospect a cliente. Projetos internos são ignorados.
create function public.projects_promote_prospect()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.is_internal and new.company_id is not null then
    update public.companies
    set lifecycle = 'client'
    where id = new.company_id and lifecycle = 'prospect';
  end if;
  return new;
end;
$$;

create trigger projects_promote_prospect
  after insert or update of company_id, is_internal on public.projects
  for each row execute function public.projects_promote_prospect();

-- ---------------------------------------------------------------------------
-- project_financials: somente quem tem has_finance_access()
-- ---------------------------------------------------------------------------

create table public.project_financials (
  project_id uuid primary key references public.projects (id) on delete cascade,
  contract_value numeric(14, 2) check (contract_value is null or contract_value >= 0),
  payment_terms text,
  updated_at timestamptz not null default now()
);

create trigger project_financials_set_updated_at
  before update on public.project_financials
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Activity log de criação
-- ---------------------------------------------------------------------------

create function public.log_entity_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.log_activity(
    'created',
    tg_argv[0],
    new.id,
    jsonb_build_object('name', to_jsonb(new) ->> 'name')
  );
  return new;
end;
$$;

create trigger companies_log_created
  after insert on public.companies
  for each row execute function public.log_entity_created('company');

create trigger projects_log_created
  after insert on public.projects
  for each row execute function public.log_entity_created('project');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.projects enable row level security;
alter table public.project_financials enable row level security;

-- Empresas e contatos: leitura para equipe interna (freelancer fora); escrita comercial/coordenação.
create policy "companies_select_internal" on public.companies for select to authenticated
  using (public.current_access_role() in ('admin', 'coordinator', 'member', 'sdr', 'bdr'));
create policy "companies_insert_managers" on public.companies for insert to authenticated
  with check (public.current_access_role() in ('admin', 'coordinator', 'sdr', 'bdr'));
create policy "companies_update_managers" on public.companies for update to authenticated
  using (public.current_access_role() in ('admin', 'coordinator', 'sdr', 'bdr'))
  with check (public.current_access_role() in ('admin', 'coordinator', 'sdr', 'bdr'));
create policy "companies_delete_admin" on public.companies for delete to authenticated
  using (public.is_admin());

create policy "contacts_select_internal" on public.contacts for select to authenticated
  using (public.current_access_role() in ('admin', 'coordinator', 'member', 'sdr', 'bdr'));
create policy "contacts_insert_managers" on public.contacts for insert to authenticated
  with check (public.current_access_role() in ('admin', 'coordinator', 'sdr', 'bdr'));
create policy "contacts_update_managers" on public.contacts for update to authenticated
  using (public.current_access_role() in ('admin', 'coordinator', 'sdr', 'bdr'))
  with check (public.current_access_role() in ('admin', 'coordinator', 'sdr', 'bdr'));
create policy "contacts_delete_managers" on public.contacts for delete to authenticated
  using (public.current_access_role() in ('admin', 'coordinator', 'sdr', 'bdr'));

-- Projetos: leitura interna; escrita admin/coordenação.
-- Freelancers não leem projetos até haver atribuição por tarefa (Módulo 2B).
create policy "projects_select_internal" on public.projects for select to authenticated
  using (public.current_access_role() in ('admin', 'coordinator', 'member', 'sdr', 'bdr'));
create policy "projects_insert_managers" on public.projects for insert to authenticated
  with check (public.current_access_role() in ('admin', 'coordinator'));
create policy "projects_update_managers" on public.projects for update to authenticated
  using (public.current_access_role() in ('admin', 'coordinator'))
  with check (public.current_access_role() in ('admin', 'coordinator'));
create policy "projects_delete_admin" on public.projects for delete to authenticated
  using (public.is_admin());

-- Financeiro: tudo depende exclusivamente do flag, independente do papel.
create policy "project_financials_finance_only" on public.project_financials for all to authenticated
  using (public.has_finance_access())
  with check (public.has_finance_access());

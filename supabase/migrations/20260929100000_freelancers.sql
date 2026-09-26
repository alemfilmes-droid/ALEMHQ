-- Freelancers: cadastro manual (sem conta de acesso ao sistema) e marcação na pauta.
--
-- O freelancer NÃO é responsável pela pauta: a pauta sempre tem líder e responsável da equipe
-- (lead_id / current_assignee_id, obrigatórios) — é essa pessoa que cobra a entrega. O campo
-- pautas.freelancer_id só sinaliza com quem está a execução.

create or replace function public.can_manage_freelancers()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and (public.is_admin() or public.is_director() or public.can_manage_pautas())
$$;

revoke all on function public.can_manage_freelancers() from public, anon;
grant execute on function public.can_manage_freelancers() to authenticated;

create table public.freelancers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  phone text check (phone is null or char_length(phone) <= 30),
  email text check (email is null or char_length(email) <= 200),
  functions public.production_function[] not null default '{}',
  city text check (city is null or char_length(city) <= 120),
  notes text check (notes is null or char_length(notes) <= 2000),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index freelancers_active_idx on public.freelancers (is_active, full_name);

create trigger freelancers_set_updated_at
  before update on public.freelancers
  for each row execute function public.set_updated_at();

alter table public.freelancers enable row level security;

-- Leitura: equipe interna ativa. Cadastro e edição: admin, diretoria, master e heads.
-- Sem DELETE: desativa-se (o histórico das pautas continua apontando para o nome).
create policy "freelancers_select_internal" on public.freelancers for select to authenticated
  using (public.can_read_companies());
create policy "freelancers_insert_managers" on public.freelancers for insert to authenticated
  with check (public.can_manage_freelancers());
create policy "freelancers_update_managers" on public.freelancers for update to authenticated
  using (public.can_manage_freelancers())
  with check (public.can_manage_freelancers());

alter table public.pautas add column freelancer_id uuid references public.freelancers (id) on delete set null;
create index pautas_freelancer_idx on public.pautas (freelancer_id) where freelancer_id is not null;

-- Recriada (não CREATE OR REPLACE): "pt.*" ganha freelancer_id no meio da lista; nome e telefone
-- do freelancer entram no fim.
drop view public.pautas_with_details;

create view public.pautas_with_details
with (security_invoker = true) as
select
  pt.*,
  pr.name as project_name,
  pr.is_internal as project_is_internal,
  pr.company_id,
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
  fl.phone as freelancer_phone
from public.pautas pt
left join public.projects pr on pr.id = pt.project_id
left join public.companies c on c.id = pr.company_id
join public.profiles lead on lead.id = pt.lead_id
left join public.profiles assignee on assignee.id = pt.current_assignee_id
left join public.profiles creator on creator.id = pt.created_for
left join public.contacts ct on ct.id = pt.contact_id
left join public.freelancers fl on fl.id = pt.freelancer_id
where pt.archived_at is null;

revoke all on public.pautas_with_details from anon;
grant select on public.pautas_with_details to authenticated;

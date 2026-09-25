-- Módulo 1 · Fundação: enums, profiles, funções auxiliares e RLS.

create type public.access_role as enum (
  'admin', 'coordinator', 'member', 'freelancer', 'sdr', 'bdr'
);

create type public.production_function as enum (
  'captacao', 'edicao', 'direcao', 'roteiro', 'motion', 'producao', 'fotografia'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  avatar_url text,
  access_role public.access_role not null default 'freelancer',
  functions public.production_function[] not null default '{}',
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_key on public.profiles (lower(email));
create index profiles_access_role_idx on public.profiles (access_role);

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER para evitar recursão de RLS em profiles)
-- ---------------------------------------------------------------------------

create function public.current_access_role()
returns public.access_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.access_role
  from public.profiles p
  where p.id = auth.uid() and p.is_active
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_access_role() = 'admin', false)
$$;

create function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active
  )
$$;

revoke all on function public.current_access_role() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_active_user() from public, anon;
grant execute on function public.current_access_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_user() to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Bloqueia alterações sensíveis feitas por não-admins e protege o próprio admin.
-- Chamadas sem JWT (service role, SQL editor, migrações) passam direto.
create function public.profiles_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'Alteração não permitida.' using errcode = '42501';
  end if;

  if public.is_admin() then
    if old.id = auth.uid()
       and (new.access_role is distinct from old.access_role
            or new.is_active is distinct from old.is_active) then
      raise exception 'Administradores não podem alterar o próprio papel ou status.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.access_role is distinct from old.access_role
     or new.functions is distinct from old.functions
     or new.is_active is distinct from old.is_active
     or new.email is distinct from old.email then
    raise exception 'Alteração não permitida.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.profiles_guard_update();

-- ---------------------------------------------------------------------------
-- RLS: profiles (sem DELETE — desative o usuário)
-- ---------------------------------------------------------------------------

create policy "profiles_select_active_users"
  on public.profiles for select
  to authenticated
  using (public.is_active_user());

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() and public.is_active_user())
  with check (id = auth.uid());

create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

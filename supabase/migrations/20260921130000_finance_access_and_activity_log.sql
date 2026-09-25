-- Módulo 2A · Acesso ao financeiro (por flag, não por papel), cargo e activity_log.

alter table public.profiles
  add column job_title text,
  add column has_finance_access boolean not null default false;

create function public.has_finance_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.has_finance_access from public.profiles p where p.id = auth.uid() and p.is_active),
    false
  )
$$;

revoke all on function public.has_finance_access() from public, anon;
grant execute on function public.has_finance_access() to authenticated;

-- ---------------------------------------------------------------------------
-- activity_log: escrito apenas por triggers (SECURITY DEFINER); leitura para admin.
-- ---------------------------------------------------------------------------

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_entity_idx on public.activity_log (entity_type, entity_id);
create index activity_log_created_at_idx on public.activity_log (created_at desc);

alter table public.activity_log enable row level security;

create policy "activity_log_select_admin"
  on public.activity_log for select
  to authenticated
  using (public.is_admin());

create function public.log_activity(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_log (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb))
$$;

revoke all on function public.log_activity(text, text, uuid, jsonb) from public, anon, authenticated;

create function public.profiles_log_finance_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.has_finance_access is distinct from old.has_finance_access then
    perform public.log_activity(
      case when new.has_finance_access then 'finance_access_granted' else 'finance_access_revoked' end,
      'profile',
      new.id,
      jsonb_build_object('email', new.email)
    );
  end if;
  return new;
end;
$$;

create trigger profiles_log_finance_access
  after update of has_finance_access on public.profiles
  for each row execute function public.profiles_log_finance_access();

-- Contas admin existentes (bootstrap do dono) recebem acesso ao financeiro.
-- Sem JWT (migração): o guard deixa passar; o log registra actor nulo.
update public.profiles set has_finance_access = true where access_role = 'admin';

-- ---------------------------------------------------------------------------
-- Guard de profiles (substitui a versão do Módulo 1)
-- ---------------------------------------------------------------------------

create or replace function public.profiles_guard_update()
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

  -- Financeiro: ninguém altera o próprio; só quem já tem acesso concede/revoga.
  -- Ser admin NÃO basta.
  if new.has_finance_access is distinct from old.has_finance_access then
    if old.id = auth.uid() then
      raise exception 'Você não pode alterar o seu próprio acesso ao financeiro.' using errcode = '42501';
    end if;
    if not public.has_finance_access() then
      raise exception 'Somente quem tem acesso ao financeiro pode concedê-lo ou revogá-lo.' using errcode = '42501';
    end if;
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
     or new.email is distinct from old.email
     or new.job_title is distinct from old.job_title
     or new.has_finance_access is distinct from old.has_finance_access then
    raise exception 'Alteração não permitida.' using errcode = '42501';
  end if;

  return new;
end;
$$;

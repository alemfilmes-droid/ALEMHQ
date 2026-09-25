-- Convites (fluxo invite-only) e criação automática de profiles.

create type public.invitation_status as enum (
  'pending', 'accepted', 'revoked', 'expired'
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  access_role public.access_role not null,
  functions public.production_function[] not null default '{}',
  invited_by uuid references public.profiles (id) on delete set null,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

-- Um único convite pendente por e-mail.
create unique index invitations_pending_email_key
  on public.invitations (email) where status = 'pending';
create index invitations_status_idx on public.invitations (status);

alter table public.invitations enable row level security;

create policy "invitations_admin_all"
  on public.invitations for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Marca convites vencidos (chamada por admins; RLS filtra os demais).
create function public.expire_stale_invitations()
returns void
language sql
set search_path = ''
as $$
  update public.invitations
  set status = 'expired'
  where status = 'pending' and expires_at <= now()
$$;

grant execute on function public.expire_stale_invitations() to authenticated;
revoke execute on function public.expire_stale_invitations() from anon, public;

-- O próprio convidado marca o convite como aceito ao definir a senha.
create function public.accept_invitation()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.invitations i
  set status = 'accepted'
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active
    and i.email = lower(p.email)
    and i.status = 'pending'
$$;

revoke all on function public.accept_invitation() from public, anon;
grant execute on function public.accept_invitation() to authenticated;

-- Cria o profile ao inserir em auth.users.
-- O papel e as funções vêm do convite pendente (mesmos valores enviados como
-- metadata no convite). Sem convite, o acesso é o mínimo: freelancer sem funções.
-- Não confiamos em raw_user_meta_data para papéis: é gravável pelo próprio usuário.
create function public.handle_new_user()
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

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

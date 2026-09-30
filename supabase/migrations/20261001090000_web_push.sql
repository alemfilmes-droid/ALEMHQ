-- Notificações no celular (web push). Cada aparelho que ativa as notificações vira uma inscrição
-- (push_subscriptions). Toda notificação nova do sistema (public.notifications) dispara, via pg_net,
-- uma chamada ao app (/api/push/dispatch), que entrega o push aos aparelhos de quem recebeu.
--
-- Segurança do disparo: a chamada leva só o id da notificação. O app "reivindica" a notificação de
-- forma atômica (pushed_at nulo e criada há menos de 10 min) e só então envia — repetir a chamada ou
-- adivinhar ids não gera push duplicado nem push de algo que não existe.

create extension if not exists pg_net;

alter table public.notifications add column pushed_at timestamptz;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

-- Cada pessoa só vê os próprios aparelhos. Gravação só pelas funções abaixo (o mesmo aparelho pode
-- trocar de dono quando outra pessoa entra nele).
create policy "push_subscriptions_select_own" on public.push_subscriptions for select to authenticated
  using (profile_id = auth.uid());

create or replace function public.register_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_endpoint !~ '^https://' then
    raise exception 'Inscrição inválida.' using errcode = '22023';
  end if;

  insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set profile_id = excluded.profile_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        last_seen_at = now();
end;
$$;

create or replace function public.unregister_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and profile_id = auth.uid()
$$;

revoke all on function public.register_push_subscription(text, text, text, text) from public, anon;
revoke all on function public.unregister_push_subscription(text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.unregister_push_subscription(text) to authenticated;

-- Disparo: só quando quem recebe tem algum aparelho inscrito. pg_net envia depois do commit.
create or replace function public.notifications_dispatch_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.push_subscriptions s where s.profile_id = new.recipient_id) then
    perform net.http_post(
      url := 'https://hq.alemfilmes.com.br/api/push/dispatch',
      body := jsonb_build_object('id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 5000
    );
  end if;
  return new;
exception when others then
  -- Push é complemento: falha no disparo nunca impede a notificação do sistema.
  return new;
end;
$$;

create trigger notifications_dispatch_push
  after insert on public.notifications
  for each row execute function public.notifications_dispatch_push();

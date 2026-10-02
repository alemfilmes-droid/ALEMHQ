-- Google Agenda por pessoa.
--
-- • google_accounts: a conta Google conectada por cada pessoa (tokens OAuth). Sem policy nenhuma:
--   só o servidor (chave de serviço) lê e grava. A pessoa vê o próprio status por my_google_account().
-- • google_event_links: o que o HQ já espelhou no Google de cada pessoa (chave do item → id do
--   evento no Google + hash do conteúdo, para só atualizar o que mudou e apagar o que saiu).
-- • google_calendar_events: eventos do Google da pessoa (fora os que o HQ criou), para aparecerem na
--   agenda do HQ — só para ela.
-- • google_sync_jobs: a cada 15 min o pg_cron cria um job e o pg_net chama o app com o id
--   (reivindicação atômica, sem segredo compartilhado — mesmo padrão do push).

create table public.google_accounts (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  google_email text,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  scope text,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text
);

alter table public.google_accounts enable row level security;
revoke all on public.google_accounts from anon, authenticated;

create table public.google_event_links (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  source_key text not null,
  google_event_id text not null,
  content_hash text not null,
  updated_at timestamptz not null default now(),
  primary key (profile_id, source_key)
);

alter table public.google_event_links enable row level security;
revoke all on public.google_event_links from anon, authenticated;

create table public.google_calendar_events (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  google_event_id text not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  location text,
  html_link text,
  synced_at timestamptz not null default now(),
  primary key (profile_id, google_event_id)
);

create index google_calendar_events_range_idx on public.google_calendar_events (profile_id, starts_at);

alter table public.google_calendar_events enable row level security;

create policy "google_calendar_events_select_own" on public.google_calendar_events for select to authenticated
  using (profile_id = auth.uid());

create type public.sync_job_status as enum ('pendente', 'rodando', 'concluido', 'erro');

create table public.google_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  status public.sync_job_status not null default 'pendente',
  detail text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.google_sync_jobs enable row level security;
revoke all on public.google_sync_jobs from anon, authenticated;

-- Status da conexão da própria pessoa (sem tokens).
create or replace function public.my_google_account()
returns table (google_email text, connected_at timestamptz, last_sync_at timestamptz, last_error text)
language sql
stable
security definer
set search_path = ''
as $$
  select ga.google_email, ga.connected_at, ga.last_sync_at, ga.last_error
  from public.google_accounts ga
  where ga.profile_id = auth.uid()
$$;

revoke all on function public.my_google_account() from public, anon;
grant execute on function public.my_google_account() to authenticated;

create or replace function public.google_sync_dispatch()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job uuid;
begin
  if not exists (select 1 from public.google_accounts) then
    return;
  end if;
  -- Limpa o histórico de jobs com mais de 2 dias.
  delete from public.google_sync_jobs where created_at < now() - interval '2 days';
  insert into public.google_sync_jobs default values returning id into v_job;
  perform net.http_post(
    url := 'https://hq.alemfilmes.com.br/api/google/sync',
    body := jsonb_build_object('id', v_job),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function public.google_sync_dispatch() from public, anon, authenticated;

select cron.schedule('alem-google-sync', '*/15 * * * *', $$select public.google_sync_dispatch()$$);

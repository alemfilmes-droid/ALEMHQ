-- Fluxogramas (1/2): o manual de operação da Além, por squad. Processos são checklists executáveis:
-- cada passo diz quem faz, onde no sistema, e como saber que terminou. Execução (process_runs) é
-- opcional — ler o processo nunca exige iniciar nada.
--
-- Acesso: cada pessoa lê os processos dos squads dela; diretoria (squad ou nível) e master leem
-- todos. Criar/editar: diretoria, master e o head do squad do processo (managed_squads()).
-- Execuções: de quem iniciou, visíveis para a liderança do squad.
--
-- Segurança: nenhum texto de processo ou passo pode conter credencial (senha:, password, login:,
-- token… seguido de valor). O app valida antes de salvar e o banco repete a regra num gatilho.

create type public.process_frequency as enum ('sob_demanda', 'diaria', 'semanal', 'mensal', 'trimestral');
create type public.process_system_area as enum (
  'clientes', 'projetos', 'pautas', 'crm', 'financeiro', 'agenda', 'equipe', 'banco_de_horas', 'avisos', 'externo', 'nenhum'
);

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------

create function public.can_read_process_squad(p_squad public.squad)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and (
    public.is_master() or public.is_director() or coalesce(public.current_org_level() = 'diretoria', false) or public.in_squad(p_squad)
  )
$$;

create function public.can_edit_process_squad(p_squad public.squad)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and (
    public.is_master() or public.is_director() or p_squad = any (public.managed_squads())
  )
$$;

revoke all on function public.can_read_process_squad(public.squad) from public, anon;
revoke all on function public.can_edit_process_squad(public.squad) from public, anon;
grant execute on function public.can_read_process_squad(public.squad) to authenticated;
grant execute on function public.can_edit_process_squad(public.squad) to authenticated;

-- Texto com cara de credencial: "senha: abc", "password=…", "login: fulano", "token …".
create function public.text_has_credential(p_text text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_text, '') ~* '(senha|password|passwd|pwd|login|usu[aá]rio|user(name)?|token|api[ _-]?key|chave( de acesso| secreta)?|secret)\s*[:=]\s*\S+'
    -- "token AbC123xyz…": a palavra seguida de um valor com dígito e 8+ caracteres.
    or coalesce(p_text, '') ~* '\m(token|password|senha)\M\s+(?=\S*[0-9])\S{8,}'
$$;

grant execute on function public.text_has_credential(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.processes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 120),
  title text not null check (length(btrim(title)) between 2 and 160),
  squad public.squad not null,
  summary text check (summary is null or length(summary) <= 1000),
  trigger_description text check (trigger_description is null or length(trigger_description) <= 500),
  frequency public.process_frequency not null default 'sob_demanda',
  owner_role text check (owner_role is null or length(owner_role) <= 120),
  order_index int not null default 0,
  is_published boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index processes_squad_idx on public.processes (squad, order_index);

create table public.process_steps (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes (id) on delete cascade,
  order_index int not null default 0,
  title text not null check (length(btrim(title)) between 2 and 200),
  description text check (description is null or length(description) <= 5000),
  responsible_role text check (responsible_role is null or length(responsible_role) <= 120),
  system_area public.process_system_area not null default 'nenhum',
  system_link text check (system_link is null or length(system_link) <= 500),
  done_criteria text check (done_criteria is null or length(done_criteria) <= 1000),
  estimated_minutes int check (estimated_minutes is null or estimated_minutes between 1 and 1440),
  is_blocking boolean not null default false,
  -- Ferramenta embutida no passo (ex.: gerador do nome da pasta do Drive).
  tool text check (tool is null or tool in ('pasta_drive')),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index process_steps_process_idx on public.process_steps (process_id, order_index);

create table public.process_runs (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes (id) on delete cascade,
  started_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  context_entity_type text check (context_entity_type is null or context_entity_type in ('project', 'pauta', 'deal', 'company')),
  context_entity_id uuid,
  context_label text check (context_label is null or length(context_label) <= 200)
);

create index process_runs_process_idx on public.process_runs (process_id, started_at desc);
create index process_runs_started_by_idx on public.process_runs (started_by, finished_at);

create table public.process_run_steps (
  run_id uuid not null references public.process_runs (id) on delete cascade,
  step_id uuid not null references public.process_steps (id) on delete cascade,
  done_by uuid references public.profiles (id) on delete set null default auth.uid(),
  done_at timestamptz not null default now(),
  note text check (note is null or length(note) <= 500),
  primary key (run_id, step_id)
);

create trigger processes_set_updated_at
  before update on public.processes
  for each row execute function public.set_updated_at();

-- Quem editou por último + bloqueio de credenciais.
create function public.processes_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.text_has_credential(new.title) or public.text_has_credential(new.summary)
     or public.text_has_credential(new.trigger_description) or public.text_has_credential(new.owner_role) then
    raise exception 'Não guarde senhas, logins ou tokens nos processos. Escreva "o login da empresa, disponível no gerenciador de senhas".'
      using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger processes_guard
  before insert or update on public.processes
  for each row execute function public.processes_guard();

create function public.process_steps_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.text_has_credential(new.title) or public.text_has_credential(new.description)
     or public.text_has_credential(new.done_criteria) or public.text_has_credential(new.system_link)
     or public.text_has_credential(new.responsible_role) then
    raise exception 'Não guarde senhas, logins ou tokens nos passos. Escreva "o login da empresa, disponível no gerenciador de senhas".'
      using errcode = '22023';
  end if;
  if new.system_link is not null and new.system_link !~ '^(/[A-Za-z0-9/_?=&#%.-]*|https?://\S+)$' then
    raise exception 'Link inválido: use uma rota do sistema (/clientes) ou um endereço https://.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger process_steps_guard
  before insert or update on public.process_steps
  for each row execute function public.process_steps_guard();

-- Passo marcado só em execução aberta; quem marca fica registrado.
create function public.process_run_steps_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.process_runs r where r.id = new.run_id and r.finished_at is not null) then
    raise exception 'Esta execução já foi concluída.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.process_steps s join public.process_runs r on r.process_id = s.process_id
    where s.id = new.step_id and r.id = new.run_id
  ) then
    raise exception 'O passo não é deste processo.' using errcode = '22023';
  end if;
  new.done_by := auth.uid();
  new.done_at := now();
  return new;
end;
$$;

create trigger process_run_steps_guard
  before insert on public.process_run_steps
  for each row execute function public.process_run_steps_guard();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.processes enable row level security;
alter table public.process_steps enable row level security;
alter table public.process_runs enable row level security;
alter table public.process_run_steps enable row level security;

-- Quem lê vê os publicados e ativos; quem edita vê também rascunhos e arquivados.
create policy "processes_select" on public.processes for select to authenticated
  using (
    public.can_edit_process_squad(squad)
    or (public.can_read_process_squad(squad) and is_published and archived_at is null)
  );
create policy "processes_insert" on public.processes for insert to authenticated
  with check (public.can_edit_process_squad(squad));
create policy "processes_update" on public.processes for update to authenticated
  using (public.can_edit_process_squad(squad))
  with check (public.can_edit_process_squad(squad));
create policy "processes_delete" on public.processes for delete to authenticated
  using (public.can_edit_process_squad(squad));

create function public.process_squad(p_process_id uuid)
returns public.squad
language sql
stable
security definer
set search_path = ''
as $$
  select p.squad from public.processes p where p.id = p_process_id
$$;

revoke all on function public.process_squad(uuid) from public, anon;
grant execute on function public.process_squad(uuid) to authenticated;

create policy "process_steps_select" on public.process_steps for select to authenticated
  using (exists (select 1 from public.processes p where p.id = process_id));
create policy "process_steps_insert" on public.process_steps for insert to authenticated
  with check (public.can_edit_process_squad(public.process_squad(process_id)));
create policy "process_steps_update" on public.process_steps for update to authenticated
  using (public.can_edit_process_squad(public.process_squad(process_id)))
  with check (public.can_edit_process_squad(public.process_squad(process_id)));
create policy "process_steps_delete" on public.process_steps for delete to authenticated
  using (public.can_edit_process_squad(public.process_squad(process_id)));

-- Execuções: de quem iniciou; a liderança do squad (head, diretoria, master) acompanha.
create function public.can_see_process_run(p_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.process_runs r
    join public.processes p on p.id = r.process_id
    where r.id = p_run_id
      and (r.started_by = auth.uid() or public.can_edit_process_squad(p.squad))
  )
$$;

revoke all on function public.can_see_process_run(uuid) from public, anon;
grant execute on function public.can_see_process_run(uuid) to authenticated;

create policy "process_runs_select" on public.process_runs for select to authenticated
  using (started_by = auth.uid() or public.can_edit_process_squad(public.process_squad(process_id)));
create policy "process_runs_insert" on public.process_runs for insert to authenticated
  with check (started_by = auth.uid() and public.can_read_process_squad(public.process_squad(process_id)));
create policy "process_runs_update" on public.process_runs for update to authenticated
  using (started_by = auth.uid() or public.can_edit_process_squad(public.process_squad(process_id)))
  with check (started_by = auth.uid() or public.can_edit_process_squad(public.process_squad(process_id)));
create policy "process_runs_delete" on public.process_runs for delete to authenticated
  using (started_by = auth.uid() or public.can_edit_process_squad(public.process_squad(process_id)));

create policy "process_run_steps_select" on public.process_run_steps for select to authenticated
  using (public.can_see_process_run(run_id));
create policy "process_run_steps_insert" on public.process_run_steps for insert to authenticated
  with check (public.can_see_process_run(run_id));
create policy "process_run_steps_delete" on public.process_run_steps for delete to authenticated
  using (public.can_see_process_run(run_id));

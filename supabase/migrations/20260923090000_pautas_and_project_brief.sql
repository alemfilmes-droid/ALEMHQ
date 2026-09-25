-- Etapa B: projeto como briefing completo, pautas (quadro Kanban global) e handover.

-- ---------------------------------------------------------------------------
-- Projeto: campos que faltavam para virar um briefing completo
-- ---------------------------------------------------------------------------

alter table public.projects
  add column production_notes text,
  add column delivery_notes text,
  add column location_address text,
  add column location_notes text;

comment on column public.projects.owner_id is 'Líder do projeto (uma pessoa). Ver project_members para os responsáveis.';

-- Marcador de decisor no contato (usado no card clicável do contato).
alter table public.contacts add column is_decision_maker boolean not null default false;

-- ---------------------------------------------------------------------------
-- Pautas: enums
-- ---------------------------------------------------------------------------

create type public.pauta_column as enum ('sprint_backlog', 'em_andamento', 'revisao', 'entregue');

create type public.pauta_status as enum (
  'planejamento', 'captacao', 'edicao', 'revisao_interna', 'revisao_cliente', 'reajuste', 'aprovado'
);

create type public.pauta_capture_type as enum ('foto', 'video');

-- Gera "PT-YYYY-NNNN" de forma atômica (sem RLS: só o trigger, dono da tabela, escreve aqui).
create table public.pauta_code_counters (
  year int primary key,
  last_number int not null default 0
);

alter table public.pauta_code_counters enable row level security;

-- ---------------------------------------------------------------------------
-- Pautas: tabela principal
-- ---------------------------------------------------------------------------

create table public.pautas (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  briefing text,
  -- Sem default fixo de propósito: o trigger pautas_sync_column_status decide um dos dois a
  -- partir do outro (ou usa o par padrão) antes do NOT NULL ser checado — ver abaixo.
  board_column public.pauta_column not null,
  status public.pauta_status not null,
  priority public.project_priority not null default 'media',
  is_critical boolean not null default false,
  lead_id uuid not null references public.profiles (id) on delete restrict,
  current_assignee_id uuid references public.profiles (id) on delete set null,
  start_date date,
  due_date date,
  scheduled_at timestamptz,
  duration_minutes int check (duration_minutes is null or duration_minutes > 0),
  location_address text,
  contact_id uuid references public.contacts (id) on delete set null,
  contact_phone_override text,
  capture_type public.pauta_capture_type[] not null default '{}',
  format text,
  equipment_notes text,
  script_url text,
  drive_folder_url text,
  delivery_url text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index pautas_project_idx on public.pautas (project_id);
create index pautas_column_idx on public.pautas (board_column);
create index pautas_status_idx on public.pautas (status);
create index pautas_lead_idx on public.pautas (lead_id);
create index pautas_assignee_idx on public.pautas (current_assignee_id);
create index pautas_due_date_idx on public.pautas (due_date);
create index pautas_scheduled_idx on public.pautas (scheduled_at);

create trigger pautas_set_updated_at
  before update on public.pautas
  for each row execute function public.set_updated_at();

-- O contato precisa pertencer à empresa do projeto da pauta.
create function public.pautas_validate_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.contact_id is not null
     and not exists (
       select 1
       from public.contacts c
       join public.projects p on p.company_id = c.company_id
       where c.id = new.contact_id and p.id = new.project_id
     ) then
    raise exception 'O contato não pertence ao cliente deste projeto.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger pautas_validate_contact
  before insert or update of contact_id, project_id on public.pautas
  for each row execute function public.pautas_validate_contact();

-- Código sequencial por ano, atômico.
create function public.pautas_generate_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year int := extract(year from (now() at time zone 'America/Fortaleza'))::int;
  v_number int;
begin
  if new.code is not null then
    return new;
  end if;

  insert into public.pauta_code_counters (year, last_number)
  values (v_year, 1)
  on conflict (year) do update set last_number = public.pauta_code_counters.last_number + 1
  returning last_number into v_number;

  new.code := 'PT-' || v_year || '-' || lpad(v_number::text, 4, '0');
  return new;
end;
$$;

create trigger pautas_set_code
  before insert on public.pautas
  for each row execute function public.pautas_generate_code();

-- ---------------------------------------------------------------------------
-- Regra fixa coluna ↔ status (mesmas duas direções, sempre consistentes).
-- Arrastar entre colunas define um status padrão sensato para a coluna de destino;
-- trocar o status manualmente sempre define a coluna correspondente.
-- ---------------------------------------------------------------------------

create function public.pautas_sync_column_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status is null and new.board_column is null then
      new.status := 'planejamento';
      new.board_column := 'sprint_backlog';
    elsif new.status is not null then
      new.board_column := case new.status
        when 'planejamento' then 'sprint_backlog'
        when 'captacao' then 'em_andamento'
        when 'edicao' then 'em_andamento'
        when 'reajuste' then 'em_andamento'
        when 'revisao_interna' then 'revisao'
        when 'revisao_cliente' then 'revisao'
        when 'aprovado' then 'entregue'
      end;
    else
      new.status := case new.board_column
        when 'sprint_backlog' then 'planejamento'
        when 'em_andamento' then 'captacao'
        when 'revisao' then 'revisao_interna'
        when 'entregue' then 'aprovado'
      end;
    end if;
    return new;
  end if;

  -- UPDATE: status muda → deriva a coluna. Só a coluna muda (arrastar) → deriva um status padrão.
  if new.status is distinct from old.status then
    new.board_column := case new.status
      when 'planejamento' then 'sprint_backlog'
      when 'captacao' then 'em_andamento'
      when 'edicao' then 'em_andamento'
      when 'reajuste' then 'em_andamento'
      when 'revisao_interna' then 'revisao'
      when 'revisao_cliente' then 'revisao'
      when 'aprovado' then 'entregue'
    end;
  elsif new.board_column is distinct from old.board_column then
    new.status := case new.board_column
      when 'sprint_backlog' then 'planejamento'
      -- Volta para "Em andamento" já tendo passado da captação: assume edição, não recomeça do zero.
      when 'em_andamento' then
        case
          when old.status in ('edicao', 'revisao_interna', 'revisao_cliente', 'reajuste', 'aprovado') then 'edicao'
          else 'captacao'
        end
      when 'revisao' then 'revisao_interna'
      when 'entregue' then 'aprovado'
    end;
  end if;

  return new;
end;
$$;

create trigger pautas_sync_column_status
  before insert or update on public.pautas
  for each row execute function public.pautas_sync_column_status();

-- ---------------------------------------------------------------------------
-- Histórico: registra toda troca de status/responsável atual, com nota opcional
-- (passada via GUC de transação pelo handover — nunca vaza entre requisições).
-- ---------------------------------------------------------------------------

-- AFTER UPDATE sem "OF colunas": o trigger BEFORE acima pode mudar status/board_column como
-- efeito colateral (ex.: só a coluna foi arrastada) sem que a instrução do chamador liste essas
-- colunas — "OF status, current_assignee_id" não veria essa mudança. Filtra por OLD/NEW aqui dentro.
create function public.pautas_log_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text;
begin
  if tg_op = 'INSERT' then
    v_note := nullif(current_setting('app.handover_note', true), '');
    insert into public.pauta_status_history (pauta_id, from_status, to_status, from_assignee, to_assignee, changed_by, note)
    values (new.id, null, new.status, null, new.current_assignee_id, auth.uid(), v_note);
    return new;
  end if;

  if old.status is not distinct from new.status and old.current_assignee_id is not distinct from new.current_assignee_id then
    return new;
  end if;

  v_note := nullif(current_setting('app.handover_note', true), '');

  insert into public.pauta_status_history (pauta_id, from_status, to_status, from_assignee, to_assignee, changed_by, note)
  values (new.id, old.status, new.status, old.current_assignee_id, new.current_assignee_id, auth.uid(), v_note);

  return new;
end;
$$;

create trigger pautas_log_status_change
  after insert or update on public.pautas
  for each row execute function public.pautas_log_status_change();

-- ---------------------------------------------------------------------------
-- Notificações (reaproveita public.notify(), criado na etapa anterior).
-- ---------------------------------------------------------------------------

create function public.pautas_notify_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lead_id is distinct from auth.uid() then
    perform public.notify(new.lead_id, 'pauta_lead_assigned', 'Você é líder de uma pauta',
      new.title, 'pauta', new.id, '/pautas?pauta=' || new.id);
  end if;

  if new.current_assignee_id is not null
     and new.current_assignee_id is distinct from new.lead_id
     and new.current_assignee_id is distinct from auth.uid() then
    perform public.notify(new.current_assignee_id, 'pauta_assignee_changed', 'Você é responsável por uma pauta',
      new.title, 'pauta', new.id, '/pautas?pauta=' || new.id);
  end if;

  return new;
end;
$$;

create trigger pautas_notify_created
  after insert on public.pautas
  for each row execute function public.pautas_notify_on_insert();

create function public.pautas_notify_lead_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lead_id is distinct from auth.uid() then
    perform public.notify(new.lead_id, 'pauta_lead_assigned', 'Você é líder de uma pauta',
      new.title, 'pauta', new.id, '/pautas?pauta=' || new.id);
  end if;
  return new;
end;
$$;

create trigger pautas_notify_lead_update
  after update of lead_id on public.pautas
  for each row execute function public.pautas_notify_lead_change();

create function public.pautas_notify_assignee_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.current_assignee_id is not null and new.current_assignee_id is distinct from auth.uid() then
    perform public.notify(new.current_assignee_id, 'pauta_assignee_changed', 'Você é responsável por uma pauta',
      new.title, 'pauta', new.id, '/pautas?pauta=' || new.id);
  end if;
  return new;
end;
$$;

create trigger pautas_notify_assignee_update
  after update of current_assignee_id on public.pautas
  for each row execute function public.pautas_notify_assignee_change();

create function public.pautas_notify_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.board_column = 'revisao' and old.board_column is distinct from 'revisao' and new.lead_id is distinct from auth.uid() then
    perform public.notify(new.lead_id, 'pauta_in_review', 'Uma pauta foi para revisão',
      new.title, 'pauta', new.id, '/pautas?pauta=' || new.id);
  end if;
  return new;
end;
$$;

-- AFTER UPDATE sem "OF board_column": ir para revisão pode vir de uma troca de status (a coluna
-- muda por efeito colateral do trigger BEFORE), então precisa disparar mesmo sem o chamador
-- ter listado board_column explicitamente. O filtro OLD/NEW já está dentro da função.
create trigger pautas_notify_review_change
  after update on public.pautas
  for each row execute function public.pautas_notify_review();

-- ---------------------------------------------------------------------------
-- Responsáveis (multi, cada um com uma função de produção).
-- ---------------------------------------------------------------------------

create table public.pauta_members (
  pauta_id uuid not null references public.pautas (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  production_function public.production_function not null,
  added_by uuid references public.profiles (id) on delete set null default auth.uid(),
  added_at timestamptz not null default now(),
  primary key (pauta_id, profile_id, production_function)
);

create index pauta_members_profile_idx on public.pauta_members (profile_id);

create function public.pauta_members_notify_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
begin
  if new.profile_id is not distinct from auth.uid() then
    return new;
  end if;
  select title into v_title from public.pautas where id = new.pauta_id;
  perform public.notify(new.profile_id, 'pauta_member_added', 'Você foi adicionado a uma pauta',
    v_title, 'pauta', new.pauta_id, '/pautas?pauta=' || new.pauta_id);
  return new;
end;
$$;

create trigger pauta_members_notify_insert
  after insert on public.pauta_members
  for each row execute function public.pauta_members_notify_added();

-- ---------------------------------------------------------------------------
-- Comentários
-- ---------------------------------------------------------------------------

create table public.pauta_comments (
  id uuid primary key default gen_random_uuid(),
  pauta_id uuid not null references public.pautas (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index pauta_comments_pauta_idx on public.pauta_comments (pauta_id, created_at);

-- ---------------------------------------------------------------------------
-- Histórico de status (só leitura para usuários finais; grava só o trigger acima).
-- ---------------------------------------------------------------------------

create table public.pauta_status_history (
  id uuid primary key default gen_random_uuid(),
  pauta_id uuid not null references public.pautas (id) on delete cascade,
  from_status public.pauta_status,
  to_status public.pauta_status,
  from_assignee uuid references public.profiles (id) on delete set null,
  to_assignee uuid references public.profiles (id) on delete set null,
  changed_by uuid references public.profiles (id) on delete set null default auth.uid(),
  note text,
  created_at timestamptz not null default now()
);

create index pauta_status_history_pauta_idx on public.pauta_status_history (pauta_id, created_at);

-- ---------------------------------------------------------------------------
-- Permissões: quem vê e quem edita uma pauta.
-- ---------------------------------------------------------------------------

create function public.can_view_pauta(p_pauta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_director()
    or public.in_squad('audiovisual')
    or public.in_squad('comercial')
    or public.in_squad('financeiro')
    or exists (
      select 1 from public.pautas p
      where p.id = p_pauta_id and (p.lead_id = auth.uid() or p.current_assignee_id = auth.uid())
    )
    or exists (select 1 from public.pauta_members pm where pm.pauta_id = p_pauta_id and pm.profile_id = auth.uid())
    or exists (
      select 1
      from public.pautas p
      join public.project_members prm on prm.project_id = p.project_id
      where p.id = p_pauta_id and prm.profile_id = auth.uid()
    )
$$;

create function public.can_edit_pauta(p_pauta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_director()
    or public.in_squad('audiovisual')
    or exists (
      select 1 from public.pautas p
      where p.id = p_pauta_id and (p.lead_id = auth.uid() or p.current_assignee_id = auth.uid())
    )
    or exists (select 1 from public.pauta_members pm where pm.pauta_id = p_pauta_id and pm.profile_id = auth.uid())
$$;

create function public.can_manage_pautas()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_director() or public.in_squad('audiovisual')
$$;

revoke all on function public.can_view_pauta(uuid) from public, anon;
revoke all on function public.can_edit_pauta(uuid) from public, anon;
revoke all on function public.can_manage_pautas() from public, anon;
grant execute on function public.can_view_pauta(uuid) to authenticated;
grant execute on function public.can_edit_pauta(uuid) to authenticated;
grant execute on function public.can_manage_pautas() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.pautas enable row level security;
alter table public.pauta_members enable row level security;
alter table public.pauta_comments enable row level security;
alter table public.pauta_status_history enable row level security;
-- Sem policies: só o trigger (dono da tabela) grava aqui.
-- (pauta_code_counters já tem RLS habilitada acima.)

create policy "pautas_select" on public.pautas for select to authenticated
  using (public.can_view_pauta(id));

-- Só diretoria/audiovisual criam pautas; quem já está nela edita (líder, responsável atual, membro).
create policy "pautas_insert" on public.pautas for insert to authenticated
  with check (public.can_manage_pautas());

create policy "pautas_update" on public.pautas for update to authenticated
  using (public.can_edit_pauta(id))
  with check (public.can_edit_pauta(id));

create policy "pauta_members_select" on public.pauta_members for select to authenticated
  using (public.can_view_pauta(pauta_id));
create policy "pauta_members_write" on public.pauta_members for all to authenticated
  using (public.can_edit_pauta(pauta_id))
  with check (public.can_edit_pauta(pauta_id));

create policy "pauta_comments_select" on public.pauta_comments for select to authenticated
  using (public.can_view_pauta(pauta_id));
create policy "pauta_comments_insert" on public.pauta_comments for insert to authenticated
  with check (public.can_view_pauta(pauta_id) and author_id = auth.uid());
create policy "pauta_comments_update_own" on public.pauta_comments for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
create policy "pauta_comments_delete_own_or_director" on public.pauta_comments for delete to authenticated
  using (author_id = auth.uid() or public.is_director());

create policy "pauta_status_history_select" on public.pauta_status_history for select to authenticated
  using (public.can_view_pauta(pauta_id));

-- ---------------------------------------------------------------------------
-- View para o quadro (sem nenhum dado financeiro).
-- ---------------------------------------------------------------------------

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
  ) as comments_count
from public.pautas pt
join public.projects pr on pr.id = pt.project_id
left join public.companies c on c.id = pr.company_id
join public.profiles lead on lead.id = pt.lead_id
left join public.profiles assignee on assignee.id = pt.current_assignee_id
left join public.contacts ct on ct.id = pt.contact_id
where pt.archived_at is null;

revoke all on public.pautas_with_details from anon;

-- ---------------------------------------------------------------------------
-- Contadores do quadro, respeitando RLS e os filtros ativos.
-- ---------------------------------------------------------------------------

create function public.pautas_summary(
  p_project_id uuid default null,
  p_lead_id uuid default null,
  p_assignee_id uuid default null,
  p_company_id uuid default null,
  p_priority public.project_priority default null,
  p_search text default null
)
returns table (em_andamento bigint, concluidas bigint, criticas bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*) filter (where p.board_column = 'em_andamento') as em_andamento,
    count(*) filter (where p.board_column = 'entregue') as concluidas,
    count(*) filter (
      where p.is_critical or (p.due_date is not null and p.due_date < current_date and p.board_column <> 'entregue')
    ) as criticas
  from public.pautas p
  join public.projects pr on pr.id = p.project_id
  where p.archived_at is null
    and (p_project_id is null or p.project_id = p_project_id)
    and (p_lead_id is null or p.lead_id = p_lead_id)
    and (p_assignee_id is null or p.current_assignee_id = p_assignee_id)
    and (p_company_id is null or pr.company_id = p_company_id)
    and (p_priority is null or p.priority = p_priority)
    and (p_search is null or p.title ilike '%' || p_search || '%')
$$;

revoke all on function public.pautas_summary(uuid, uuid, uuid, uuid, public.project_priority, text) from public, anon;
grant execute on function public.pautas_summary(uuid, uuid, uuid, uuid, public.project_priority, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Handover ("Passar adiante"): status, responsável atual, prazo da etapa, nota,
-- e adiciona o novo responsável à equipe da pauta na função escolhida — tudo atômico.
-- ---------------------------------------------------------------------------

create function public.pauta_handover(
  p_pauta_id uuid,
  p_status public.pauta_status,
  p_assignee_id uuid,
  p_function public.production_function,
  p_due_date date default null,
  p_note text default null
)
returns public.pautas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.pautas;
begin
  if not public.can_edit_pauta(p_pauta_id) then
    raise exception 'Você não tem permissão para mover esta pauta.' using errcode = '42501';
  end if;

  perform set_config('app.handover_note', coalesce(p_note, ''), true);

  update public.pautas
  set status = p_status,
      current_assignee_id = p_assignee_id,
      due_date = coalesce(p_due_date, due_date)
  where id = p_pauta_id
  returning * into v_row;

  if not found then
    raise exception 'Pauta não encontrada.' using errcode = '22023';
  end if;

  insert into public.pauta_members (pauta_id, profile_id, production_function)
  values (p_pauta_id, p_assignee_id, p_function)
  on conflict do nothing;

  return v_row;
end;
$$;

revoke all on function public.pauta_handover(uuid, public.pauta_status, uuid, public.production_function, date, text) from public, anon;
grant execute on function public.pauta_handover(uuid, public.pauta_status, uuid, public.production_function, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Mover só a coluna (arrastar no quadro) — mais simples que o handover completo.
-- ---------------------------------------------------------------------------

create function public.pauta_move_column(p_pauta_id uuid, p_column public.pauta_column)
returns public.pautas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.pautas;
begin
  if not public.can_edit_pauta(p_pauta_id) then
    raise exception 'Você não tem permissão para mover esta pauta.' using errcode = '42501';
  end if;

  update public.pautas set board_column = p_column where id = p_pauta_id
  returning * into v_row;

  if not found then
    raise exception 'Pauta não encontrada.' using errcode = '22023';
  end if;

  return v_row;
end;
$$;

revoke all on function public.pauta_move_column(uuid, public.pauta_column) from public, anon;
grant execute on function public.pauta_move_column(uuid, public.pauta_column) to authenticated;

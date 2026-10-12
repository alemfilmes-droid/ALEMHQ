-- Prospecção (Módulo 1/5, 1/2): configuração da prospecção semiautomática por WhatsApp
-- (docs/prospeccao/spec.md). Só tabelas e tipos NOVOS — nada existente é alterado.
--
-- Leitura: qualquer usuário ativo (o card do lead vai ler scripts e objeções nos próximos módulos).
-- Escrita: só o master (Configurações > Prospecção). Não há DELETE de playbook, script, cadência ou
-- objeção: desativa-se. Feriados e sugestões de "cliente da casa" podem ser removidos pelo master.
--
-- Editar um script vale só para os próximos envios: o histórico (Módulo 3) guarda o texto já
-- renderizado, nunca uma referência ao script.
--
-- Rollback (só se ainda não houver uso): drop table public.prospect_settings, public.prospect_holidays,
-- public.prospect_house_suggestions, public.prospect_objections, public.prospect_scripts,
-- public.prospect_cadences, public.prospect_playbooks; drop type public.prospect_holiday_scope,
-- public.prospect_objection_action, public.prospect_script_kind, public.prospect_touch_zero_variant,
-- public.prospect_cadence_type, public.prospect_audience.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.prospect_audience as enum ('escola', 'empresa');
create type public.prospect_cadence_type as enum ('sazonal', 'relacionamento');
-- Qual Toque 0 (achar o decisor) o playbook usa.
create type public.prospect_touch_zero_variant as enum ('escola_matricula_recorrente', 'escola_espetaculos', 'empresa');
create type public.prospect_script_kind as enum ('toque_zero', 'toque', 'sem_gancho', 'reativacao', 'cliente_da_casa');
create type public.prospect_objection_action as enum ('registrar', 'pedir_data_reativacao', 'novo_decisor');
create type public.prospect_holiday_scope as enum ('nacional', 'rn', 'natal');

-- ---------------------------------------------------------------------------
-- Cadências: dias de cada toque (dias úteis, a partir do Toque 1) e prazo de reativação (dias corridos)
-- ---------------------------------------------------------------------------

create table public.prospect_cadences (
  cadence_type public.prospect_cadence_type primary key,
  touch_offsets int[] not null check (
    cardinality(touch_offsets) between 1 and 12
    and touch_offsets[1] = 0
    and array_position(touch_offsets, null) is null
  ),
  reactivation_days int not null check (reactivation_days between 1 and 365),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

-- Dias estritamente crescentes (check não aceita subconsulta).
create function public.prospect_offsets_increasing(p_offsets int[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(p_offsets[i] > p_offsets[i - 1]), true)
  from generate_series(2, cardinality(p_offsets)) as i
$$;

grant execute on function public.prospect_offsets_increasing(int[]) to authenticated;

alter table public.prospect_cadences
  add constraint prospect_cadences_increasing check (public.prospect_offsets_increasing(touch_offsets));

-- ---------------------------------------------------------------------------
-- Playbooks
-- ---------------------------------------------------------------------------

create table public.prospect_playbooks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
  name text not null check (length(btrim(name)) between 2 and 80),
  audience public.prospect_audience not null,
  cadence_type public.prospect_cadence_type not null references public.prospect_cadences (cadence_type),
  touch_zero_variant public.prospect_touch_zero_variant not null,
  -- Vazio = URL pendente (a tela avisa).
  link_base text not null default '' check (length(link_base) <= 500),
  -- Playbooks 1 e 2: o {link} recebe ?escola=<nome do lead codificado>.
  link_appends_school_param boolean not null default false,
  -- Texto do {case} (playbook 6).
  case_text text check (case_text is null or length(case_text) <= 500),
  suggested_goal_id uuid references public.goals (id) on delete set null,
  active boolean not null default true,
  position int not null default 0,
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prospect_playbooks_position_idx on public.prospect_playbooks (position);

-- ---------------------------------------------------------------------------
-- Scripts. Compartilhados (playbook_id nulo): Toque 0 por variante, versão sem gancho e cliente da
-- casa por público. Do playbook: toques 1..N e reativação (corpo vazio permitido — spec 4.9).
-- ---------------------------------------------------------------------------

create table public.prospect_scripts (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid references public.prospect_playbooks (id) on delete restrict,
  kind public.prospect_script_kind not null,
  touch_number int check (touch_number is null or touch_number between 1 and 12),
  touch_zero_variant public.prospect_touch_zero_variant,
  audience public.prospect_audience,
  body text not null default '' check (length(body) <= 4000),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  constraint prospect_scripts_shape check (
    case kind
      when 'toque_zero' then playbook_id is null and touch_zero_variant is not null and audience is null and touch_number is null
      when 'sem_gancho' then playbook_id is null and audience is not null and touch_zero_variant is null and touch_number is null
      when 'cliente_da_casa' then playbook_id is null and audience is not null and touch_zero_variant is null and touch_number is null
      when 'toque' then playbook_id is not null and touch_number is not null and touch_zero_variant is null and audience is null
      when 'reativacao' then playbook_id is not null and touch_number is null and touch_zero_variant is null and audience is null
    end
  ),
  constraint prospect_scripts_body_required check (kind = 'reativacao' or length(btrim(body)) > 0),
  constraint prospect_scripts_unique unique nulls not distinct (playbook_id, kind, touch_number, touch_zero_variant, audience)
);

-- ---------------------------------------------------------------------------
-- Objeções e respostas rápidas (fixas, sem variáveis — iguais às do WhatsApp Business do SDR)
-- ---------------------------------------------------------------------------

create table public.prospect_objections (
  id uuid primary key default gen_random_uuid(),
  shortcut text not null unique check (shortcut ~ '^/[a-z0-9]+(-[a-z0-9]+)*$' and length(shortcut) <= 40),
  label text not null check (length(btrim(label)) between 2 and 120),
  response_body text not null check (length(btrim(response_body)) between 2 and 2000),
  hq_action public.prospect_objection_action not null default 'registrar',
  active boolean not null default true,
  position int not null default 0,
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Cliente da casa: quem fechou o playbook X recebe a sugestão Y (ordem = preferência)
-- ---------------------------------------------------------------------------

create table public.prospect_house_suggestions (
  closed_playbook_id uuid not null references public.prospect_playbooks (id) on delete cascade,
  suggested_playbook_id uuid not null references public.prospect_playbooks (id) on delete cascade,
  position int not null default 0,
  primary key (closed_playbook_id, suggested_playbook_id),
  constraint prospect_house_suggestions_distinct check (closed_playbook_id <> suggested_playbook_id)
);

-- ---------------------------------------------------------------------------
-- Feriados (pulados na cadência). recurring = vale todo ano no mesmo dia/mês (o ano da data é
-- ignorado). Os móveis (Carnaval, Sexta-feira Santa, Corpus Christi) entram ano a ano.
-- ---------------------------------------------------------------------------

create table public.prospect_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  name text not null check (length(btrim(name)) between 2 and 120),
  scope public.prospect_holiday_scope not null,
  recurring boolean not null default false,
  -- Feriado local ainda não confirmado (a tela mostra "a confirmar").
  needs_confirmation boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint prospect_holidays_unique unique (holiday_date, scope)
);

-- ---------------------------------------------------------------------------
-- Parâmetros gerais (linha única): reuniões e metas de esforço do SDR
-- ---------------------------------------------------------------------------

create table public.prospect_settings (
  id boolean primary key default true check (id),
  meeting_duration_minutes int not null default 45 check (meeting_duration_minutes between 1 and 480),
  -- [{ "start": "09:00", "end": "12:00" }, …] em America/Fortaleza, só dias úteis.
  meeting_windows jsonb not null default '[]'::jsonb check (jsonb_typeof(meeting_windows) = 'array'),
  daily_touch_target int not null default 0 check (daily_touch_target between 0 and 1000),
  weekly_meeting_target int not null default 0 check (weekly_meeting_target between 0 and 1000),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at / updated_by
-- ---------------------------------------------------------------------------

create function public.prospect_stamp_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger prospect_cadences_stamp before update on public.prospect_cadences
  for each row execute function public.prospect_stamp_update();
create trigger prospect_playbooks_stamp before update on public.prospect_playbooks
  for each row execute function public.prospect_stamp_update();
create trigger prospect_scripts_stamp before update on public.prospect_scripts
  for each row execute function public.prospect_stamp_update();
create trigger prospect_objections_stamp before update on public.prospect_objections
  for each row execute function public.prospect_stamp_update();
create trigger prospect_settings_stamp before update on public.prospect_settings
  for each row execute function public.prospect_stamp_update();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.prospect_cadences enable row level security;
alter table public.prospect_playbooks enable row level security;
alter table public.prospect_scripts enable row level security;
alter table public.prospect_objections enable row level security;
alter table public.prospect_house_suggestions enable row level security;
alter table public.prospect_holidays enable row level security;
alter table public.prospect_settings enable row level security;

create policy "prospect_cadences_select" on public.prospect_cadences for select to authenticated using (public.is_active_user());
create policy "prospect_cadences_update" on public.prospect_cadences for update to authenticated
  using (public.is_master()) with check (public.is_master());

create policy "prospect_playbooks_select" on public.prospect_playbooks for select to authenticated using (public.is_active_user());
create policy "prospect_playbooks_insert" on public.prospect_playbooks for insert to authenticated with check (public.is_master());
create policy "prospect_playbooks_update" on public.prospect_playbooks for update to authenticated
  using (public.is_master()) with check (public.is_master());

create policy "prospect_scripts_select" on public.prospect_scripts for select to authenticated using (public.is_active_user());
create policy "prospect_scripts_insert" on public.prospect_scripts for insert to authenticated with check (public.is_master());
create policy "prospect_scripts_update" on public.prospect_scripts for update to authenticated
  using (public.is_master()) with check (public.is_master());

create policy "prospect_objections_select" on public.prospect_objections for select to authenticated using (public.is_active_user());
create policy "prospect_objections_insert" on public.prospect_objections for insert to authenticated with check (public.is_master());
create policy "prospect_objections_update" on public.prospect_objections for update to authenticated
  using (public.is_master()) with check (public.is_master());

create policy "prospect_house_suggestions_select" on public.prospect_house_suggestions for select to authenticated using (public.is_active_user());
create policy "prospect_house_suggestions_insert" on public.prospect_house_suggestions for insert to authenticated with check (public.is_master());
create policy "prospect_house_suggestions_delete" on public.prospect_house_suggestions for delete to authenticated using (public.is_master());

create policy "prospect_holidays_select" on public.prospect_holidays for select to authenticated using (public.is_active_user());
create policy "prospect_holidays_insert" on public.prospect_holidays for insert to authenticated with check (public.is_master());
create policy "prospect_holidays_update" on public.prospect_holidays for update to authenticated
  using (public.is_master()) with check (public.is_master());
create policy "prospect_holidays_delete" on public.prospect_holidays for delete to authenticated using (public.is_master());

create policy "prospect_settings_select" on public.prospect_settings for select to authenticated using (public.is_active_user());
create policy "prospect_settings_update" on public.prospect_settings for update to authenticated
  using (public.is_master()) with check (public.is_master());

grant select, update on public.prospect_cadences to authenticated;
grant select, insert, update on public.prospect_playbooks to authenticated;
grant select, insert, update on public.prospect_scripts to authenticated;
grant select, insert, update on public.prospect_objections to authenticated;
grant select, insert, delete on public.prospect_house_suggestions to authenticated;
grant select, insert, update, delete on public.prospect_holidays to authenticated;
grant select, update on public.prospect_settings to authenticated;

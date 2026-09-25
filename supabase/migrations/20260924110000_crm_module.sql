-- Módulo CRM: funil de vendas, qualificação, reuniões, atividades e o handoff "Ganho → Cliente + Projeto".

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.deal_stage as enum (
  'prospeccao', 'primeiro_contato', 'qualificado', 'reuniao_agendada',
  'reuniao_realizada', 'proposta_enviada', 'negociacao', 'ganho', 'perdido'
);

create type public.deal_loss_reason as enum (
  'preco', 'timing', 'sem_resposta', 'sem_fit', 'concorrente', 'orcamento_interno', 'outro'
);

create type public.activity_kind as enum (
  'ligacao', 'whatsapp', 'email', 'reuniao', 'proposta', 'nota', 'outro'
);

create type public.deal_meeting_outcome as enum (
  'agendada', 'realizada', 'nao_compareceu', 'remarcada', 'cancelada'
);

-- Ordem do funil, só para comparar progresso (ex.: uma reunião de acompanhamento não deve
-- regredir um negócio que já está em etapa mais avançada). 'ganho' e 'perdido' empatam no topo:
-- nenhum dos dois deve ser "regredido de volta" por um efeito colateral de outro trigger.
create function public.deal_stage_rank(p_stage public.deal_stage)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_stage
    when 'prospeccao' then 0
    when 'primeiro_contato' then 1
    when 'qualificado' then 2
    when 'reuniao_agendada' then 3
    when 'reuniao_realizada' then 4
    when 'proposta_enviada' then 5
    when 'negociacao' then 6
    when 'ganho' then 7
    when 'perdido' then 7
  end
$$;

-- ---------------------------------------------------------------------------
-- Código sequencial "NEG-YYYY-NNN", mesmo padrão de pauta_code_counters.
-- ---------------------------------------------------------------------------

create table public.crm_code_counters (
  year int primary key,
  last_number int not null default 0
);

alter table public.crm_code_counters enable row level security;
-- Sem policies: só o trigger (dono da tabela) grava aqui.

-- ---------------------------------------------------------------------------
-- deals
-- ---------------------------------------------------------------------------

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  company_id uuid not null references public.companies (id) on delete restrict,
  primary_contact_id uuid references public.contacts (id) on delete set null,
  title text not null check (length(btrim(title)) > 0),
  stage public.deal_stage not null default 'prospeccao',
  owner_id uuid not null references public.profiles (id) on delete restrict,
  estimated_value numeric(14, 2) check (estimated_value is null or estimated_value >= 0),
  expected_close_date date,
  service_interest public.service_type[] not null default '{}',
  source public.company_source,
  lost_reason public.deal_loss_reason,
  lost_note text,
  won_at timestamptz,
  lost_at timestamptz,
  stage_changed_at timestamptz not null default now(),
  next_action text,
  next_action_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint deals_lost_requires_reason check (stage <> 'perdido' or lost_reason is not null)
);

create index deals_stage_idx on public.deals (stage);
create index deals_owner_idx on public.deals (owner_id);
create index deals_company_idx on public.deals (company_id);
create index deals_next_action_at_idx on public.deals (next_action_at);
create index deals_expected_close_date_idx on public.deals (expected_close_date);

-- O contato precisa pertencer à empresa do negócio.
create function public.deals_validate_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.primary_contact_id is not null
     and not exists (
       select 1 from public.contacts c
       where c.id = new.primary_contact_id and c.company_id = new.company_id
     ) then
    raise exception 'O contato não pertence à empresa do negócio.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger deals_validate_contact
  before insert or update of company_id, primary_contact_id on public.deals
  for each row execute function public.deals_validate_contact();

create function public.deals_generate_code()
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

  insert into public.crm_code_counters (year, last_number)
  values (v_year, 1)
  on conflict (year) do update set last_number = public.crm_code_counters.last_number + 1
  returning last_number into v_number;

  new.code := 'NEG-' || v_year || '-' || lpad(v_number::text, 3, '0');
  return new;
end;
$$;

create trigger deals_set_code
  before insert on public.deals
  for each row execute function public.deals_generate_code();

-- Só o handoff (close_deal_won, abaixo) pode marcar 'ganho' — sinalizado pela GUC de transação,
-- mesmo padrão de transfer_master()/app.allow_master_transfer. Arrastar o card no funil não basta.
-- Sem JWT (service role, seed, migração): o guard deixa passar, mesmo padrão de profiles_guard_update.
create function public.deals_guard_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.stage = 'ganho' and old.stage is distinct from 'ganho'
     and coalesce(current_setting('app.allow_deal_won', true), '') is distinct from 'true' then
    raise exception 'Use "Marcar como ganho" para fechar o negócio.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger deals_guard_stage
  before update of stage on public.deals
  for each row execute function public.deals_guard_stage();

-- Um negócio não avança além de "Qualificado" sem a qualificação preenchida (orçamento, tipo de
-- projeto, prazo desejado e contato com o decisor). "Perdido" nunca é bloqueado: pode-se perder um
-- negócio em qualquer etapa.
create function public.deals_guard_qualification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stage in ('reuniao_agendada', 'reuniao_realizada', 'proposta_enviada', 'negociacao', 'ganho')
     and not exists (
       select 1 from public.deal_qualification q
       where q.deal_id = new.id
         and coalesce(btrim(q.budget_range), '') <> ''
         and coalesce(btrim(q.project_type), '') <> ''
         and coalesce(btrim(q.desired_timeline), '') <> ''
         and q.decision_maker_contacted is not null
     ) then
    raise exception 'Qualifique o negócio antes de avançar para esta etapa.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger deals_guard_qualification
  before insert or update of stage on public.deals
  for each row execute function public.deals_guard_qualification();

-- Carimba won_at/lost_at/stage_changed_at e limpa os campos de perda ao reabrir um negócio perdido
-- (ou o won_at, ao tirar um negócio de "Ganho" — não há fluxo de reabertura hoje, mas evita um
-- estado inconsistente se alguém corrigir manualmente).
create function public.deals_set_stage_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    new.stage_changed_at := now();
  end if;

  if new.stage = 'ganho' and (tg_op = 'INSERT' or old.stage is distinct from 'ganho') then
    new.won_at := coalesce(new.won_at, now());
  end if;
  if new.stage = 'perdido' and (tg_op = 'INSERT' or old.stage is distinct from 'perdido') then
    new.lost_at := coalesce(new.lost_at, now());
  end if;

  if tg_op = 'UPDATE' then
    if new.stage <> 'perdido' and old.stage = 'perdido' then
      new.lost_reason := null;
      new.lost_note := null;
      new.lost_at := null;
    end if;
    if new.stage <> 'ganho' and old.stage = 'ganho' then
      new.won_at := null;
    end if;
  end if;

  return new;
end;
$$;

create trigger deals_set_stage_timestamps
  before insert or update on public.deals
  for each row execute function public.deals_set_stage_timestamps();

-- Só quem gerencia todos os negócios (ver can_access_all_deals) pode reatribuir o responsável;
-- o dono de um negócio próprio não se transfere sozinho para outra pessoa. Sem JWT: deixa passar.
create function public.deals_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.owner_id is distinct from old.owner_id and not public.can_access_all_deals() then
    raise exception 'Você não pode reatribuir o responsável deste negócio.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger deals_guard_update
  before update on public.deals
  for each row execute function public.deals_guard_update();

create trigger deals_set_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();

create function public.deals_log_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.log_activity('created', 'deal', new.id, jsonb_build_object('title', new.title));
  return new;
end;
$$;

create trigger deals_log_created
  after insert on public.deals
  for each row execute function public.deals_log_created();

create function public.deals_log_stage_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stage is distinct from old.stage then
    perform public.log_activity('stage_changed', 'deal', new.id, jsonb_build_object('from', old.stage, 'to', new.stage));
  end if;
  return new;
end;
$$;

create trigger deals_log_stage_change
  after update on public.deals
  for each row execute function public.deals_log_stage_change();

create function public.deals_notify_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.owner_id is not distinct from new.owner_id then
    return new;
  end if;
  if new.owner_id is not distinct from auth.uid() then
    return new;
  end if;
  perform public.notify(
    new.owner_id, 'deal_assigned', 'Você é responsável por um negócio',
    new.title, 'deal', new.id, '/crm?negocio=' || new.id
  );
  return new;
end;
$$;

create trigger deals_notify_owner
  after insert or update of owner_id on public.deals
  for each row execute function public.deals_notify_owner();

-- ---------------------------------------------------------------------------
-- deal_qualification (1:1 com deals)
-- ---------------------------------------------------------------------------

create table public.deal_qualification (
  deal_id uuid primary key references public.deals (id) on delete cascade,
  budget_range text,
  project_type text,
  desired_timeline text,
  decision_maker_contacted boolean,
  pain_point text,
  notes text,
  qualified_at timestamptz,
  qualified_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger deal_qualification_set_updated_at
  before update on public.deal_qualification
  for each row execute function public.set_updated_at();

-- Carimba quando os 4 campos obrigatórios ficam preenchidos pela primeira vez.
create function public.deal_qualification_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.qualified_at is null
     and coalesce(btrim(new.budget_range), '') <> ''
     and coalesce(btrim(new.project_type), '') <> ''
     and coalesce(btrim(new.desired_timeline), '') <> ''
     and new.decision_maker_contacted is not null then
    new.qualified_at := now();
    new.qualified_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger deal_qualification_stamp
  before insert or update on public.deal_qualification
  for each row execute function public.deal_qualification_stamp();

-- ---------------------------------------------------------------------------
-- deal_activities (linha do tempo)
-- ---------------------------------------------------------------------------

create table public.deal_activities (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  kind public.activity_kind not null,
  body text not null check (length(btrim(body)) > 0),
  occurred_at timestamptz not null default now(),
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index deal_activities_deal_idx on public.deal_activities (deal_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- deal_meetings
-- ---------------------------------------------------------------------------

create table public.deal_meetings (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_minutes int not null default 60 check (duration_minutes > 0),
  attendee_id uuid not null references public.profiles (id) on delete restrict,
  location_or_link text,
  outcome public.deal_meeting_outcome not null default 'agendada',
  outcome_note text,
  -- Vínculo futuro com o módulo de agenda. Sem FK por enquanto.
  calendar_event_id text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index deal_meetings_deal_idx on public.deal_meetings (deal_id, scheduled_at);

-- Criar uma reunião agenda o negócio (sem regredir uma etapa já mais avançada) e notifica quem vai
-- atender, com o resumo da qualificação já registrada.
create function public.deal_meetings_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deal public.deals;
  v_summary text;
begin
  select * into v_deal from public.deals where id = new.deal_id;

  if public.deal_stage_rank(v_deal.stage) < public.deal_stage_rank('reuniao_agendada') then
    update public.deals set stage = 'reuniao_agendada' where id = new.deal_id;
  end if;

  select concat_ws(' · ', nullif(btrim(q.budget_range), ''), nullif(btrim(q.project_type), ''), nullif(btrim(q.desired_timeline), ''))
  into v_summary
  from public.deal_qualification q
  where q.deal_id = new.deal_id;

  if new.attendee_id is not distinct from auth.uid() then
    return new;
  end if;
  perform public.notify(
    new.attendee_id, 'deal_meeting_scheduled', 'Você tem uma reunião de negócio',
    coalesce(v_deal.title, '') || ' — ' || coalesce(v_summary, 'Sem qualificação registrada.'),
    'deal', new.deal_id, '/crm?negocio=' || new.deal_id
  );
  return new;
end;
$$;

create trigger deal_meetings_after_insert
  after insert on public.deal_meetings
  for each row execute function public.deal_meetings_after_insert();

-- Marcar a reunião como realizada avança o negócio (sem regredir uma etapa já mais avançada).
create function public.deal_meetings_after_outcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.outcome = 'realizada' and old.outcome is distinct from 'realizada' then
    update public.deals
    set stage = 'reuniao_realizada'
    where id = new.deal_id and public.deal_stage_rank(stage) < public.deal_stage_rank('reuniao_realizada');
  end if;
  return new;
end;
$$;

create trigger deal_meetings_after_outcome
  after update of outcome on public.deal_meetings
  for each row execute function public.deal_meetings_after_outcome();

-- ---------------------------------------------------------------------------
-- Vínculo com projects (deferido desde o Módulo 2A) e com receivables (deferido desde o Financeiro).
-- ---------------------------------------------------------------------------

alter table public.projects add column deal_id uuid references public.deals (id) on delete set null;
create index projects_deal_idx on public.projects (deal_id);

alter table public.receivables add constraint receivables_deal_id_fkey foreign key (deal_id) references public.deals (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------

-- Diretoria e master leem/escrevem todos os negócios; head só dentro do squad comercial que gerencia.
create function public.can_access_all_deals()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_master() or public.is_director() or (public.is_head() and 'comercial' = any(public.managed_squads()))
$$;

-- Quem enxerga um negócio específico: gestão plena, ou o próprio dono (SDR/BDR só vê o que é seu).
create function public.can_access_deal(p_deal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.deals d
    where d.id = p_deal_id and (public.can_access_all_deals() or d.owner_id = auth.uid())
  )
$$;

revoke all on function public.can_access_all_deals() from public, anon;
revoke all on function public.can_access_deal(uuid) from public, anon;
grant execute on function public.can_access_all_deals() to authenticated;
grant execute on function public.can_access_deal(uuid) to authenticated;

alter table public.deals enable row level security;
alter table public.deal_qualification enable row level security;
alter table public.deal_activities enable row level security;
alter table public.deal_meetings enable row level security;

create policy "deals_select" on public.deals for select to authenticated
  using (public.can_access_all_deals() or owner_id = auth.uid());

create policy "deals_insert" on public.deals for insert to authenticated
  with check (public.can_access_all_deals() or (public.in_squad('comercial') and owner_id = auth.uid()));

create policy "deals_update" on public.deals for update to authenticated
  using (public.can_access_all_deals() or owner_id = auth.uid())
  with check (public.can_access_all_deals() or owner_id = auth.uid());

create policy "deals_delete" on public.deals for delete to authenticated
  using (public.is_master() or public.is_director());

create policy "deal_qualification_select" on public.deal_qualification for select to authenticated
  using (public.can_access_deal(deal_id));
create policy "deal_qualification_write" on public.deal_qualification for all to authenticated
  using (public.can_access_deal(deal_id))
  with check (public.can_access_deal(deal_id));

create policy "deal_activities_select" on public.deal_activities for select to authenticated
  using (public.can_access_deal(deal_id));
create policy "deal_activities_insert" on public.deal_activities for insert to authenticated
  with check (public.can_access_deal(deal_id) and author_id = auth.uid());
create policy "deal_activities_update_own" on public.deal_activities for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
create policy "deal_activities_delete" on public.deal_activities for delete to authenticated
  using (author_id = auth.uid() or public.can_access_all_deals());

create policy "deal_meetings_select" on public.deal_meetings for select to authenticated
  using (public.can_access_deal(deal_id));
create policy "deal_meetings_insert" on public.deal_meetings for insert to authenticated
  with check (public.can_access_deal(deal_id));
create policy "deal_meetings_update" on public.deal_meetings for update to authenticated
  using (public.can_access_deal(deal_id))
  with check (public.can_access_deal(deal_id));
create policy "deal_meetings_delete" on public.deal_meetings for delete to authenticated
  using (public.can_access_all_deals());

-- ---------------------------------------------------------------------------
-- Handoff "Ganho → Cliente + Projeto": atômico, uma única chamada.
-- Só diretoria/master ou head do squad comercial podem fechar um negócio como ganho.
-- ---------------------------------------------------------------------------

create function public.close_deal_won(
  p_deal_id uuid,
  p_project_name text,
  p_project_model public.project_model,
  p_contract_value numeric,
  p_tier public.client_tier,
  p_start_date date,
  p_end_date date,
  p_project_owner_id uuid
)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deal public.deals;
  v_project public.projects;
begin
  -- Sem JWT (service role, seed, migração): deixa passar, mesmo padrão de profiles_guard_update.
  if auth.uid() is not null and not public.can_access_all_deals() then
    raise exception 'Você não tem permissão para fechar negócios como ganhos.' using errcode = '42501';
  end if;

  select * into v_deal from public.deals where id = p_deal_id for update;
  if not found then
    raise exception 'Negócio não encontrado.' using errcode = '22023';
  end if;
  if v_deal.stage = 'ganho' then
    raise exception 'Este negócio já foi marcado como ganho.' using errcode = '22023';
  end if;

  perform set_config('app.allow_deal_won', 'true', true);
  update public.deals set stage = 'ganho' where id = p_deal_id;

  update public.companies
  set lifecycle = 'client', tier = p_tier
  where id = v_deal.company_id;

  insert into public.projects (
    name, company_id, contact_id, deal_id, model, stage, owner_id, due_date, start_date, end_date, created_by
  ) values (
    p_project_name, v_deal.company_id, v_deal.primary_contact_id, p_deal_id, p_project_model, 'planejamento', p_project_owner_id,
    case when p_project_model = 'transacional' then p_end_date else null end,
    case when p_project_model = 'recorrente' then p_start_date else null end,
    case when p_project_model = 'recorrente' then p_end_date else null end,
    auth.uid()
  )
  returning * into v_project;

  insert into public.project_members (project_id, profile_id) values (v_project.id, p_project_owner_id) on conflict do nothing;

  if p_contract_value is not null and public.has_finance_access() then
    insert into public.project_financials (project_id, contract_value) values (v_project.id, p_contract_value);
  end if;

  perform public.log_activity('won', 'deal', p_deal_id, jsonb_build_object('project_id', v_project.id));

  return v_project;
end;
$$;

revoke all on function public.close_deal_won(uuid, text, public.project_model, numeric, public.client_tier, date, date, uuid) from public, anon;
grant execute on function public.close_deal_won(uuid, text, public.project_model, numeric, public.client_tier, date, date, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

create view public.deals_with_details
with (security_invoker = true) as
select
  d.*,
  c.name as company_name,
  c.lifecycle as company_lifecycle,
  ct.full_name as primary_contact_name,
  owner.full_name as owner_name,
  owner.avatar_url as owner_avatar_url,
  (select count(*)::int from public.deal_activities a where a.deal_id = d.id) as activities_count,
  (select max(a.occurred_at) from public.deal_activities a where a.deal_id = d.id) as last_activity_at,
  exists (
    select 1 from public.deal_qualification q
    where q.deal_id = d.id
      and coalesce(btrim(q.budget_range), '') <> ''
      and coalesce(btrim(q.project_type), '') <> ''
      and coalesce(btrim(q.desired_timeline), '') <> ''
      and q.decision_maker_contacted is not null
  ) as is_qualified,
  greatest(0, extract(day from now() - d.stage_changed_at))::int as days_in_stage
from public.deals d
join public.companies c on c.id = d.company_id
left join public.contacts ct on ct.id = d.primary_contact_id
join public.profiles owner on owner.id = d.owner_id
where d.archived_at is null;

revoke all on public.deals_with_details from anon;

-- Negócios abertos sem atividade nos últimos 7 dias, ou com a próxima ação vencida. Alimenta o
-- painel e o card de início — a RLS de `deals` (por trás de deals_with_details) já decide, por
-- baixo, quem enxerga cada linha. Parte de deals_with_details (não de `deals` puro) para já trazer
-- company_name pronto — PostgREST não embeda automaticamente a partir de views sem FK.
create view public.deals_needing_attention
with (security_invoker = true) as
select d.*
from public.deals_with_details d
where d.stage not in ('ganho', 'perdido')
  and (
    (d.next_action_at is not null and d.next_action_at < now())
    or d.last_activity_at is null
    or d.last_activity_at < now() - interval '7 days'
  );

revoke all on public.deals_needing_attention from anon;

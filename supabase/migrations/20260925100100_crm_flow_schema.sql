-- Fluxo comercial (2/3): esquema — enums, colunas, tabelas novas, RLS e permissões.
-- A lógica (triggers, funções, views) está em 20260925100200_crm_flow_logic.sql.

-- ---------------------------------------------------------------------------
-- As views dependem de deals.*; saem agora e voltam recriadas na migração de lógica.
-- ---------------------------------------------------------------------------

drop view if exists public.deals_needing_attention;
drop view if exists public.deals_with_details;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.prospection_goal as enum (
  'recorrencia', 'campanha_institucional', 'cobertura_evento', 'ativacao_marca',
  'producao_conteudo', 'video_institucional', 'outro'
);

create type public.deal_interaction_kind as enum (
  'tentativa_contato', 'resposta_cliente', 'reuniao', 'proposta', 'negociacao', 'direcionamento', 'nota'
);

create type public.deal_interaction_channel as enum (
  'email', 'whatsapp', 'ligacao', 'instagram', 'linkedin', 'presencial', 'meet', 'outro'
);

create type public.meeting_outcome as enum (
  'enviar_proposta', 'follow_up_sdr', 'sem_interesse', 'remarcar', 'nao_compareceu', 'fechado_na_call'
);

create type public.proposal_channel as enum (
  'whatsapp_pdf', 'email', 'ligacao', 'meet', 'presencial', 'outro'
);

create type public.proposal_status as enum ('enviada', 'em_negociacao', 'aceita', 'recusada');

create type public.commitment_kind as enum ('reuniao_comercial', 'captacao', 'entrega', 'interno');

create type public.commitment_status as enum ('agendado', 'realizado', 'nao_compareceu', 'remarcado', 'cancelado');

create type public.reheat_status as enum ('aguardando', 'notificado', 'em_reaquecimento', 'descartado');

create type public.direction_task as enum (
  'marcar_reuniao_ceo', 'qualificar_melhor', 'call_kickoff', 'enviar_material', 'aguardar_retorno', 'descartar'
);

create type public.commission_kind as enum ('padrao', 'reaquecido');

-- ---------------------------------------------------------------------------
-- Empresas: segmento de atuação (preenchido ao criar o prospect pelo CRM)
-- ---------------------------------------------------------------------------

alter table public.companies add column segment text;

-- ---------------------------------------------------------------------------
-- Permissões: líder do squad comercial (o "Head Comercial" é definido por liderança de squad,
-- não por cargo — uma pessoa pode liderar mais de um squad e a liderança pode mudar de mãos).
-- ---------------------------------------------------------------------------

create function public.is_squad_lead(p_squad public.squad)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profile_squads ps
    join public.profiles p on p.id = ps.profile_id
    where ps.profile_id = auth.uid() and ps.squad = p_squad and ps.is_lead and p.is_active
  )
$$;

revoke all on function public.is_squad_lead(public.squad) from public, anon;
grant execute on function public.is_squad_lead(public.squad) to authenticated;

-- Quem cuida da revisão de qualificação: líder do squad comercial (preferindo quem tem nível "head"),
-- depois qualquer head com squad comercial, por fim o master.
create function public.crm_head_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.id
      from public.profile_squads ps
      join public.profiles p on p.id = ps.profile_id
      where ps.squad = 'comercial' and ps.is_lead and p.is_active
      order by (p.org_level = 'head') desc, p.created_at
      limit 1
    ),
    (
      select p.id
      from public.profile_squads ps
      join public.profiles p on p.id = ps.profile_id
      where ps.squad = 'comercial' and p.org_level = 'head' and p.is_active
      order by p.created_at
      limit 1
    ),
    (select p.id from public.profiles p where p.org_level = 'master' and p.is_active limit 1)
  )
$$;

revoke all on function public.crm_head_id() from public, anon;
grant execute on function public.crm_head_id() to authenticated;

create or replace function public.can_access_all_deals()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_master()
    or public.is_director()
    or (public.is_head() and 'comercial' = any(public.managed_squads()))
    or public.is_squad_lead('comercial')
$$;

-- ---------------------------------------------------------------------------
-- deals: responsável atual, objetivos, reaquecimento, venda direta, direcionamento
-- ---------------------------------------------------------------------------

alter table public.deals
  add column responsible_id uuid references public.profiles (id) on delete set null,
  add column prospection_goals public.prospection_goal[] not null default '{}',
  add column reheat_due_at timestamptz,
  add column reheat_status public.reheat_status,
  add column is_reheated boolean not null default false,
  add column fast_track boolean not null default false,
  add column direction_task public.direction_task,
  add column direction_note text,
  drop column service_interest;

create index deals_responsible_idx on public.deals (responsible_id);
create index deals_reheat_due_idx on public.deals (reheat_due_at) where reheat_status = 'aguardando';

-- Backfill: quem está com a bola é o dono; negócios perdidos não têm responsável.
update public.deals set responsible_id = owner_id where stage <> 'perdido';

-- Próxima ação passa a ser obrigatória em negócios abertos.
update public.deals
set next_action = coalesce(nullif(btrim(next_action), ''), 'Definir próxima ação'),
    next_action_at = coalesce(next_action_at, now())
where stage not in ('ganho', 'perdido');

alter table public.deals
  add constraint deals_next_action_required check (
    stage in ('ganho', 'perdido')
    or (next_action is not null and btrim(next_action) <> '' and next_action_at is not null)
  );

-- ---------------------------------------------------------------------------
-- commitments: agenda interna (o módulo de calendário vai espelhar esta tabela)
-- ---------------------------------------------------------------------------

create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  kind public.commitment_kind not null default 'interno',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_or_link text,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  deal_id uuid references public.deals (id) on delete cascade,
  pauta_id uuid references public.pautas (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  status public.commitment_status not null default 'agendado',
  notes text,
  -- Reservado para a sincronização futura com o Google Calendar.
  google_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commitments_ends_after_start check (ends_at >= starts_at)
);

create index commitments_owner_idx on public.commitments (owner_id, starts_at);
create index commitments_deal_idx on public.commitments (deal_id);

create trigger commitments_set_updated_at
  before update on public.commitments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- deal_meetings: agora só guarda o agendamento e o RESULTADO; a agenda de verdade é commitments.
-- ---------------------------------------------------------------------------

drop trigger if exists deal_meetings_after_outcome on public.deal_meetings;
drop function if exists public.deal_meetings_after_outcome();

alter table public.deal_meetings
  add column result public.meeting_outcome,
  add column result_registered_at timestamptz,
  add column result_registered_by uuid references public.profiles (id) on delete set null,
  add column commitment_id uuid references public.commitments (id) on delete set null;

alter table public.deal_meetings rename column outcome_note to result_note;

update public.deal_meetings set
  result = case outcome::text
    when 'realizada' then 'enviar_proposta'::public.meeting_outcome
    when 'nao_compareceu' then 'nao_compareceu'::public.meeting_outcome
    when 'remarcada' then 'remarcar'::public.meeting_outcome
    when 'cancelada' then 'sem_interesse'::public.meeting_outcome
  end,
  result_registered_at = case when outcome::text <> 'agendada' then now() end;

alter table public.deal_meetings drop column outcome;
drop type public.deal_meeting_outcome;

-- Reuniões que já existiam ganham o compromisso correspondente.
with created as (
  insert into public.commitments (title, kind, starts_at, ends_at, location_or_link, owner_id, created_by, deal_id, status)
  select
    'Reunião — ' || d.title,
    'reuniao_comercial',
    m.scheduled_at,
    m.scheduled_at + make_interval(mins => m.duration_minutes),
    m.location_or_link,
    m.attendee_id,
    m.created_by,
    m.deal_id,
    case m.result
      when 'nao_compareceu' then 'nao_compareceu'::public.commitment_status
      when 'remarcar' then 'remarcado'::public.commitment_status
      when 'sem_interesse' then 'cancelado'::public.commitment_status
      when 'enviar_proposta' then 'realizado'::public.commitment_status
      else 'agendado'::public.commitment_status
    end
  from public.deal_meetings m
  join public.deals d on d.id = m.deal_id
  order by m.created_at
  returning id, deal_id, starts_at, owner_id
)
update public.deal_meetings m
set commitment_id = c.id
from created c
where c.deal_id = m.deal_id and c.starts_at = m.scheduled_at and c.owner_id = m.attendee_id;

-- ---------------------------------------------------------------------------
-- deal_interactions: registro obrigatório de contato (toda mudança de etapa exige um)
-- ---------------------------------------------------------------------------

create table public.deal_interactions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  kind public.deal_interaction_kind not null,
  channel public.deal_interaction_channel,
  approach text,
  body text not null check (length(btrim(body)) > 0),
  responded boolean,
  responded_to_interaction_id uuid references public.deal_interactions (id) on delete set null,
  -- Etapa em que o negócio estava quando a interação aconteceu (preenchida por trigger).
  stage public.deal_stage not null,
  -- Preenchida quando a interação justifica uma mudança de etapa; o banco a consome ao mudar.
  stage_to public.deal_stage,
  consumed_at timestamptz,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index deal_interactions_deal_idx on public.deal_interactions (deal_id, occurred_at desc);

-- As anotações que já existiam viram interações do tipo "nota".
insert into public.deal_interactions (deal_id, kind, body, stage, author_id, occurred_at, consumed_at)
select a.deal_id, 'nota', a.body, d.stage, a.author_id, a.occurred_at, now()
from public.deal_activities a
join public.deals d on d.id = a.deal_id;

delete from public.deal_activities;

-- ---------------------------------------------------------------------------
-- deal_proposals / deal_negotiations
-- ---------------------------------------------------------------------------

create table public.deal_proposals (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  sent_channel public.proposal_channel not null,
  document_url text,
  scope_notes text,
  sent_at timestamptz not null default now(),
  sent_by uuid references public.profiles (id) on delete set null default auth.uid(),
  status public.proposal_status not null default 'enviada',
  created_at timestamptz not null default now()
);

create index deal_proposals_deal_idx on public.deal_proposals (deal_id, sent_at desc);

create table public.deal_negotiations (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  proposal_id uuid not null references public.deal_proposals (id) on delete cascade,
  client_counter_amount numeric(14, 2) check (client_counter_amount is null or client_counter_amount > 0),
  our_counter_amount numeric(14, 2) check (our_counter_amount is null or our_counter_amount > 0),
  agreed_amount numeric(14, 2) check (agreed_amount is null or agreed_amount > 0),
  channel public.deal_interaction_channel,
  notes text not null check (length(btrim(notes)) > 0),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index deal_negotiations_deal_idx on public.deal_negotiations (deal_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Comissão e probabilidade por etapa (configurações)
-- ---------------------------------------------------------------------------

create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  kind public.commission_kind not null,
  percent numeric(5, 2) not null check (percent >= 0 and percent <= 100),
  effective_from timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid()
);

create index commission_rules_kind_idx on public.commission_rules (kind, effective_from desc);

insert into public.commission_rules (kind, percent, effective_from, updated_by)
values ('padrao', 3, '2026-01-01', null), ('reaquecido', 5, '2026-01-01', null);

create table public.deal_stage_probabilities (
  stage public.deal_stage primary key,
  probability numeric(4, 3) not null check (probability >= 0 and probability <= 1),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.deal_stage_probabilities (stage, probability) values
  ('prospeccao', 0.05),
  ('primeiro_contato', 0.10),
  ('tentativas_contato', 0.10),
  ('qualificado', 0.20),
  ('reuniao_agendada', 0.30),
  ('reuniao_realizada', 0.40),
  ('proposta_enviada', 0.50),
  ('negociacao', 0.70),
  ('ganho', 1),
  ('perdido', 0);

-- ---------------------------------------------------------------------------
-- Pautas ligadas a negócios
-- ---------------------------------------------------------------------------

alter table public.pautas add column deal_id uuid references public.deals (id) on delete set null;
create index pautas_deal_idx on public.pautas (deal_id);

-- Recriada (não CREATE OR REPLACE): o novo campo de public.pautas entra no meio da lista via "pt.*".
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
  creator.full_name as created_for_name
from public.pautas pt
left join public.projects pr on pr.id = pt.project_id
left join public.companies c on c.id = pr.company_id
join public.profiles lead on lead.id = pt.lead_id
left join public.profiles assignee on assignee.id = pt.current_assignee_id
left join public.profiles creator on creator.id = pt.created_for
left join public.contacts ct on ct.id = pt.contact_id
where pt.archived_at is null;

revoke all on public.pautas_with_details from anon;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- Quem enxerga um negócio: gestão plena, o SDR dono, ou quem está com a bola agora.
create or replace function public.can_access_deal(p_deal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.deals d
    where d.id = p_deal_id
      and (public.can_access_all_deals() or d.owner_id = auth.uid() or d.responsible_id = auth.uid())
  )
$$;

drop policy "deals_select" on public.deals;
drop policy "deals_update" on public.deals;

create policy "deals_select" on public.deals for select to authenticated
  using (public.can_access_all_deals() or owner_id = auth.uid() or responsible_id = auth.uid());

create policy "deals_update" on public.deals for update to authenticated
  using (public.can_access_all_deals() or owner_id = auth.uid() or responsible_id = auth.uid())
  with check (public.can_access_all_deals() or owner_id = auth.uid() or responsible_id = auth.uid());

alter table public.commitments enable row level security;
alter table public.deal_interactions enable row level security;
alter table public.deal_proposals enable row level security;
alter table public.deal_negotiations enable row level security;
alter table public.commission_rules enable row level security;
alter table public.deal_stage_probabilities enable row level security;

create policy "commitments_select" on public.commitments for select to authenticated
  using (
    owner_id = auth.uid()
    or created_by = auth.uid()
    or public.is_master()
    or public.is_director()
    or (deal_id is not null and public.can_access_deal(deal_id))
  );
create policy "commitments_insert" on public.commitments for insert to authenticated
  with check (created_by = auth.uid() and public.is_active_user());
create policy "commitments_update" on public.commitments for update to authenticated
  using (owner_id = auth.uid() or created_by = auth.uid() or public.is_master() or public.is_director())
  with check (owner_id = auth.uid() or created_by = auth.uid() or public.is_master() or public.is_director());
create policy "commitments_delete" on public.commitments for delete to authenticated
  using (created_by = auth.uid() or public.is_master() or public.is_director());

create policy "deal_interactions_select" on public.deal_interactions for select to authenticated
  using (public.can_access_deal(deal_id));
create policy "deal_interactions_insert" on public.deal_interactions for insert to authenticated
  with check (public.can_access_deal(deal_id) and author_id = auth.uid());
create policy "deal_interactions_delete" on public.deal_interactions for delete to authenticated
  using (public.can_access_all_deals());

create policy "deal_proposals_select" on public.deal_proposals for select to authenticated
  using (public.can_access_deal(deal_id));
create policy "deal_proposals_insert" on public.deal_proposals for insert to authenticated
  with check (public.can_access_deal(deal_id));
create policy "deal_proposals_update" on public.deal_proposals for update to authenticated
  using (public.can_access_deal(deal_id))
  with check (public.can_access_deal(deal_id));

create policy "deal_negotiations_select" on public.deal_negotiations for select to authenticated
  using (public.can_access_deal(deal_id));
create policy "deal_negotiations_insert" on public.deal_negotiations for insert to authenticated
  with check (public.can_access_deal(deal_id));

-- Comissão: qualquer pessoa ativa lê as regras (o cálculo do próprio SDR depende delas); só
-- master/diretoria editam. Uma nova regra é uma nova linha, com vigência a partir de effective_from.
create policy "commission_rules_select" on public.commission_rules for select to authenticated
  using (public.is_active_user());
create policy "commission_rules_write" on public.commission_rules for all to authenticated
  using (public.is_master() or public.is_director())
  with check (public.is_master() or public.is_director());

create policy "deal_stage_probabilities_select" on public.deal_stage_probabilities for select to authenticated
  using (public.has_finance_access() or public.can_access_all_deals() or public.in_squad('comercial'));
create policy "deal_stage_probabilities_write" on public.deal_stage_probabilities for all to authenticated
  using (public.is_master() or public.is_director())
  with check (public.is_master() or public.is_director());

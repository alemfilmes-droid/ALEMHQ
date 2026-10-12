-- Prospecção (Módulo 2/5): campos do lead, histórico de toques, objeções do lead e o registro de
-- toque enviado (docs/prospeccao/spec.md, seções 3 e 6). Só acréscimos: negócios sem playbook ficam
-- exatamente como estão e fora da cadência.
--
-- O status da cadência NÃO é guardado: é calculado na leitura a partir destes fatos
-- (lib/prospeccao/cadence.ts). Aqui só ficam datas e escolhas do usuário.
--
-- Rollback (só se ainda não houver uso): drop function public.prospect_record_touch,
-- public.prospect_mark_responded; drop table public.prospect_lead_objections, public.prospect_touch_logs;
-- alter table public.deals drop column prospect_* (todas as listadas abaixo);
-- alter table public.prospect_playbooks drop column crm_goal.

-- ---------------------------------------------------------------------------
-- Playbook → objetivo do CRM (o cadastro de negócio exige pelo menos um)
-- ---------------------------------------------------------------------------

alter table public.prospect_playbooks add column crm_goal public.prospection_goal not null default 'outro';

update public.prospect_playbooks p
set crm_goal = v.goal::public.prospection_goal
from (values
  ('campanha-matricula', 'campanha_institucional'),
  ('espetaculos-eventos', 'cobertura_evento'),
  ('conteudo-recorrente-escolas', 'producao_conteudo'),
  ('filme-institucional', 'video_institucional'),
  ('conteudo-recorrente-empresas', 'producao_conteudo'),
  ('eventos-aftermovie', 'cobertura_evento')
) as v (slug, goal)
where p.slug = v.slug and p.crm_goal = 'outro';

-- ---------------------------------------------------------------------------
-- Campos de prospecção no lead (deals)
-- ---------------------------------------------------------------------------

alter table public.deals
  add column prospect_playbook_id uuid references public.prospect_playbooks (id) on delete restrict,
  add column prospect_lead_type public.prospect_audience,
  -- false = contato de secretaria/recepção: a cadência começa no Toque 0.
  add column prospect_contact_is_decision_maker boolean,
  add column prospect_decision_maker_name text check (prospect_decision_maker_name is null or length(prospect_decision_maker_name) <= 120),
  add column prospect_decision_maker_role text check (prospect_decision_maker_role is null or length(prospect_decision_maker_role) <= 80),
  add column prospect_decision_maker_whatsapp text check (prospect_decision_maker_whatsapp is null or length(prospect_decision_maker_whatsapp) <= 20),
  -- Quando o decisor foi cadastrado: o Toque 1 vence nesse dia útil.
  add column prospect_decision_maker_set_at timestamptz,
  add column prospect_hook text check (prospect_hook is null or length(prospect_hook) <= 120),
  add column prospect_goal_id uuid references public.goals (id) on delete set null,
  add column prospect_last_delivered_project text check (prospect_last_delivered_project is null or length(prospect_last_delivered_project) <= 160),
  add column prospect_cadence_started_at timestamptz,
  -- "Respondeu": a cadência para na hora.
  add column prospect_replied_at timestamptz,
  add column prospect_paused_at timestamptz,
  add column prospect_pause_reason text check (prospect_pause_reason is null or length(prospect_pause_reason) <= 300),
  -- Última retomada: o toque pendente vence a partir dela, não de antes da pausa.
  add column prospect_resumed_at timestamptz,
  add column prospect_discarded_at timestamptz,
  add column prospect_discard_reason text check (prospect_discard_reason is null or length(prospect_discard_reason) <= 300),
  -- Objeção com data ("sem verba", "me chama depois"): substitui a reativação calculada.
  add column prospect_manual_reactivation_on date,
  add constraint deals_prospect_started check (prospect_playbook_id is null or prospect_cadence_started_at is not null),
  add constraint deals_prospect_pause_reason check (prospect_paused_at is null or prospect_pause_reason is not null),
  add constraint deals_prospect_discard_reason check (prospect_discarded_at is null or prospect_discard_reason is not null);

create index deals_prospect_playbook_idx on public.deals (prospect_playbook_id) where prospect_playbook_id is not null;

-- ---------------------------------------------------------------------------
-- Histórico de toques (imutável). touch_number: 0..N; nulo = reativação.
-- script_kind diz qual script foi usado (sem_gancho e cliente_da_casa são variações do Toque 1).
-- ---------------------------------------------------------------------------

create table public.prospect_touch_logs (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  touch_number int check (touch_number is null or touch_number between 0 and 12),
  script_kind public.prospect_script_kind not null,
  playbook_id uuid not null references public.prospect_playbooks (id) on delete restrict,
  script_id uuid references public.prospect_scripts (id) on delete set null,
  -- Texto exato gerado (Módulo 3). Nunca é renderizado de novo.
  rendered_text text not null check (length(btrim(rendered_text)) between 1 and 4000),
  sent_at timestamptz not null default now(),
  sent_by uuid references public.profiles (id) on delete set null default auth.uid(),
  interaction_id uuid references public.deal_interactions (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint prospect_touch_logs_shape check (
    -- Reativação com script vazio usa o Toque 1 (spec 4.9): touch_number nulo com outro script.
    case script_kind
      when 'toque_zero' then touch_number = 0
      when 'reativacao' then touch_number is null
      when 'toque' then touch_number is null or touch_number >= 1
      else touch_number is null or touch_number = 1
    end
  )
);

create index prospect_touch_logs_deal_idx on public.prospect_touch_logs (deal_id, sent_at);

create function public.prospect_touch_logs_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'O histórico de toques não pode ser alterado.' using errcode = '42501';
end;
$$;

create trigger prospect_touch_logs_immutable before update on public.prospect_touch_logs
  for each row execute function public.prospect_touch_logs_immutable();

alter table public.prospect_touch_logs enable row level security;

create policy "prospect_touch_logs_select" on public.prospect_touch_logs for select to authenticated
  using (public.can_access_deal(deal_id));
create policy "prospect_touch_logs_insert" on public.prospect_touch_logs for insert to authenticated
  with check (public.can_access_deal(deal_id) and sent_by = auth.uid());

grant select, insert on public.prospect_touch_logs to authenticated;

-- ---------------------------------------------------------------------------
-- Objeções registradas no lead (relatório: quais aparecem, em que playbook, quantas viram reunião)
-- ---------------------------------------------------------------------------

create table public.prospect_lead_objections (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  objection_id uuid not null references public.prospect_objections (id) on delete restrict,
  playbook_id uuid references public.prospect_playbooks (id) on delete restrict,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index prospect_lead_objections_deal_idx on public.prospect_lead_objections (deal_id, created_at);

alter table public.prospect_lead_objections enable row level security;

create policy "prospect_lead_objections_select" on public.prospect_lead_objections for select to authenticated
  using (public.can_access_deal(deal_id));
create policy "prospect_lead_objections_insert" on public.prospect_lead_objections for insert to authenticated
  with check (public.can_access_deal(deal_id) and created_by = auth.uid());

grant select, insert on public.prospect_lead_objections to authenticated;

-- ---------------------------------------------------------------------------
-- Marcar enviado: histórico do toque + tentativa no histórico de contatos + funil.
-- Primeiro toque → "Primeiro contato"; os seguintes → "Tentativas de contato". Nunca recua de etapa.
-- O próximo toque é calculado na leitura; aqui só se grava o fato.
-- ---------------------------------------------------------------------------

create function public.prospect_record_touch(
  p_deal_id uuid,
  p_touch_number int,
  p_script_kind public.prospect_script_kind,
  p_script_id uuid,
  p_rendered_text text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_deal record;
  v_playbook_name text;
  v_first boolean;
  v_target public.deal_stage;
  v_interaction uuid;
  v_log uuid;
  v_label text := case when p_touch_number is null then 'Reativação' else 'Toque ' || p_touch_number end;
begin
  select d.id, d.stage, d.prospect_playbook_id, d.prospect_paused_at, d.prospect_discarded_at
  into v_deal
  from public.deals d
  where d.id = p_deal_id;

  if v_deal.id is null then
    raise exception 'Negócio não encontrado ou sem permissão.' using errcode = '42501';
  end if;
  if v_deal.prospect_playbook_id is null then
    raise exception 'Escolha um playbook para o lead entrar na cadência.' using errcode = '23514';
  end if;
  if v_deal.prospect_paused_at is not null or v_deal.prospect_discarded_at is not null then
    raise exception 'O lead está pausado ou descartado.' using errcode = '23514';
  end if;

  select p.name into v_playbook_name from public.prospect_playbooks p where p.id = v_deal.prospect_playbook_id;
  v_first := not exists (select 1 from public.prospect_touch_logs t where t.deal_id = p_deal_id);
  v_target := case when v_first then 'primeiro_contato'::public.deal_stage else 'tentativas_contato'::public.deal_stage end;
  if public.deal_stage_rank(v_deal.stage) >= public.deal_stage_rank(v_target) then
    v_target := null;
  end if;

  -- O toque anterior ficou sem resposta (se tivesse, o "Respondeu" teria parado a cadência).
  update public.deal_interactions
  set responded = false
  where deal_id = p_deal_id and kind = 'tentativa_contato' and responded is null;

  insert into public.deal_interactions (deal_id, kind, channel, approach, body, summary, stage_to)
  values (
    p_deal_id, 'tentativa_contato', 'whatsapp', 'Prospecção · ' || coalesce(v_playbook_name, 'playbook'),
    p_rendered_text, v_label || ' enviado pelo WhatsApp', v_target
  )
  returning id into v_interaction;

  if v_target is not null then
    update public.deals set stage = v_target where id = p_deal_id;
  end if;

  insert into public.prospect_touch_logs (deal_id, touch_number, script_kind, playbook_id, script_id, rendered_text, interaction_id)
  values (p_deal_id, p_touch_number, p_script_kind, v_deal.prospect_playbook_id, p_script_id, p_rendered_text, v_interaction)
  returning id into v_log;

  return v_log;
end;
$$;

revoke all on function public.prospect_record_touch(uuid, int, public.prospect_script_kind, uuid, text) from public, anon;
grant execute on function public.prospect_record_touch(uuid, int, public.prospect_script_kind, uuid, text) to authenticated;

-- "Respondeu": para a cadência e liga a resposta à última tentativa (mesmo padrão do "Cliente respondeu").
create function public.prospect_mark_responded(p_deal_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_attempt uuid;
begin
  update public.deals
  set prospect_replied_at = coalesce(prospect_replied_at, now())
  where id = p_deal_id and prospect_playbook_id is not null;
  if not found then
    raise exception 'Negócio não encontrado, sem permissão ou fora da cadência.' using errcode = '42501';
  end if;

  select i.id into v_attempt
  from public.deal_interactions i
  where i.deal_id = p_deal_id and i.kind = 'tentativa_contato'
  order by i.occurred_at desc, i.created_at desc
  limit 1;

  if v_attempt is not null then
    update public.deal_interactions set responded = true where id = v_attempt;
  end if;

  insert into public.deal_interactions (deal_id, kind, channel, body, responded_to_interaction_id)
  values (p_deal_id, 'resposta_cliente', 'whatsapp', 'Respondeu no WhatsApp (prospecção).', v_attempt);
end;
$$;

revoke all on function public.prospect_mark_responded(uuid) from public, anon;
grant execute on function public.prospect_mark_responded(uuid) to authenticated;

-- Bloco 4 — CRM (relatório do Paulo).
--
-- 4.1 Horário efetivo do contato: "Registrar contato" e "Marcar enviado" aceitam o horário real da
--     abordagem (até 7 dias para trás, nunca no futuro). occurred_at / sent_at = horário efetivo (usado
--     pela cadência e pelas metas); created_at continua sendo o momento real do registro (auditoria).
-- 4.2 Etapa "Em análise": exige data de retorno (a próxima ação); a cadência pausa até lá e, na data, o
--     lead volta para "Chamar hoje". O toque de retorno devolve o negócio para "Tentativas de contato".
-- 4.3 Histórico de abordagens: o autor e a diretoria/admin editam canal, horário efetivo e observação;
--     excluir = riscar (motivo obrigatório), nunca apagar. Riscados saem da cadência e da meta de toques.
--     Toda edição/risco fica em deal_interaction_history (imutável).
--
-- Só adiciona (colunas, tabela, funções). As funções deal_log_interaction e prospect_record_touch são
-- recriadas com um parâmetro a mais no fim (p_occurred_at, opcional): chamadas antigas continuam valendo.

-- ---------------------------------------------------------------------------
-- 4.2 Etapa "Em análise" em todas as tabelas de etapa
-- ---------------------------------------------------------------------------

insert into public.deal_stage_probabilities (stage, probability) values ('em_analise', 0.15)
on conflict (stage) do nothing;

-- Mesmo nível de "Tentativas de contato": ainda é prospecção (antes de Qualificado).
create or replace function public.deal_stage_rank(p_stage public.deal_stage)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_stage
    when 'prospeccao' then 0
    when 'primeiro_contato' then 1
    when 'tentativas_contato' then 2
    when 'em_analise' then 2
    when 'qualificado' then 3
    when 'reuniao_agendada' then 4
    when 'reuniao_realizada' then 5
    when 'proposta_enviada' then 6
    when 'negociacao' then 7
    when 'ganho' then 8
    when 'perdido' then 8
  end
$$;

create or replace function public.crm_stage_label(p_stage public.deal_stage)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_stage
    when 'prospeccao' then 'Prospecção'
    when 'primeiro_contato' then 'Primeiro contato'
    when 'tentativas_contato' then 'Tentativas de contato'
    when 'em_analise' then 'Em análise'
    when 'qualificado' then 'Qualificado'
    when 'reuniao_agendada' then 'Reunião agendada'
    when 'reuniao_realizada' then 'Reunião realizada'
    when 'proposta_enviada' then 'Proposta enviada'
    when 'negociacao' then 'Negociação'
    when 'ganho' then 'Ganho'
    when 'perdido' then 'Perdido'
  end
$$;

create or replace function public.crm_pauta_status(p_stage public.deal_stage)
returns public.pauta_status
language sql
immutable
set search_path = ''
as $$
  select case public.crm_pauta_column(p_stage)
    when 'sprint_backlog' then 'planejamento'
    when 'revisao' then 'revisao_interna'
    when 'entregue' then 'aprovado'
    else case when p_stage in ('tentativas_contato', 'em_analise') then 'aguardando_retorno' else 'em_execucao' end
  end::public.pauta_status
$$;

-- Bola: "Em análise" ainda é prospecção — fica com o SDR (mesma regra das etapas de prospecção).
create or replace function public.deals_route_responsible()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.responsible_id := coalesce(new.responsible_id, case when new.stage = 'perdido' then null else new.owner_id end);
    return new;
  end if;

  if new.stage is not distinct from old.stage then
    -- Quem estava com o próprio SDR continua com ele se o dono mudar.
    if new.owner_id is distinct from old.owner_id and old.responsible_id is not distinct from old.owner_id then
      new.responsible_id := new.owner_id;
    end if;
    return new;
  end if;

  if new.stage in ('prospeccao', 'primeiro_contato', 'tentativas_contato', 'em_analise') then
    new.responsible_id := new.owner_id;
  elsif new.stage = 'qualificado' then
    new.responsible_id := coalesce(public.crm_head_id(), new.owner_id);
  elsif new.stage = 'reuniao_agendada' then
    new.responsible_id := coalesce(
      (select m.attendee_id from public.deal_meetings m where m.deal_id = new.id and m.result is null order by m.created_at desc limit 1),
      new.responsible_id
    );
  elsif new.stage = 'perdido' then
    new.responsible_id := null;
  elsif new.stage in ('reuniao_realizada', 'proposta_enviada', 'negociacao') then
    -- Continua com quem está com a bola (o atendente da reunião); na venda direta é sempre o SDR.
    if new.fast_track then
      new.responsible_id := new.owner_id;
    end if;
  end if;
  -- 'ganho': close_deal_won define o atendimento.
  return new;
end;
$$;

-- "Em análise" sem data de retorno não existe: a data é a próxima ação.
create function public.deals_analysis_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stage = 'em_analise' and new.next_action_at is null then
    raise exception 'Informe a data de retorno: o cliente está avaliando.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger deals_analysis_guard
  before insert or update of stage, next_action_at on public.deals
  for each row execute function public.deals_analysis_guard();

-- ---------------------------------------------------------------------------
-- 4.1 / 4.3 Colunas novas e histórico
-- ---------------------------------------------------------------------------

alter table public.deal_interactions
  add column if not exists edited_at timestamptz,
  add column if not exists edited_by uuid references public.profiles (id) on delete set null,
  -- Riscado: só a data fica aqui (todos veem o risco). Quem riscou e o motivo ficam no histórico,
  -- que só a diretoria/admin lê.
  add column if not exists deleted_at timestamptz;

alter table public.prospect_touch_logs add column if not exists deleted_at timestamptz;

create index if not exists prospect_touch_logs_active_idx on public.prospect_touch_logs (deal_id, sent_at) where deleted_at is null;

-- O histórico de toques continua imutável para todo mundo; só as funções de edição/risco abaixo
-- acompanham o horário efetivo e o risco da abordagem ligada (sent_at / deleted_at, nada mais).
create or replace function public.prospect_touch_logs_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('alem.touch_sync', true) = 'on'
     and (to_jsonb(new) - 'sent_at' - 'deleted_at') = (to_jsonb(old) - 'sent_at' - 'deleted_at') then
    return new;
  end if;
  raise exception 'O histórico de toques não pode ser alterado.' using errcode = '42501';
end;
$$;

-- Diretoria/admin: edita e risca qualquer abordagem e vê o motivo de quem riscou.
create function public.crm_is_ceo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or public.is_director()
$$;

grant execute on function public.crm_is_ceo() to authenticated;

create table public.deal_interaction_history (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null references public.deal_interactions (id) on delete cascade,
  deal_id uuid not null references public.deals (id) on delete cascade,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now(),
  action text not null check (action in ('EDIT', 'DELETE')),
  -- { "campo": { "before": …, "after": … } }
  changes jsonb not null check (jsonb_typeof(changes) = 'object'),
  reason text check (reason is null or length(reason) <= 500)
);

create index deal_interaction_history_interaction_idx on public.deal_interaction_history (interaction_id, changed_at desc);

create function public.deal_interaction_history_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'O histórico de abordagens não pode ser alterado nem apagado.' using errcode = '42501';
end;
$$;

create trigger deal_interaction_history_immutable before update or delete on public.deal_interaction_history
  for each row execute function public.deal_interaction_history_immutable();

alter table public.deal_interaction_history enable row level security;

-- Edições: quem acessa o negócio. Risco (motivo, quem e quando): só diretoria/admin.
create policy "deal_interaction_history_select" on public.deal_interaction_history for select to authenticated
  using (public.can_access_deal(deal_id) and (action <> 'DELETE' or public.crm_is_ceo()));

revoke all on public.deal_interaction_history from anon, authenticated;
grant select on public.deal_interaction_history to authenticated;

-- ---------------------------------------------------------------------------
-- Regras comuns
-- ---------------------------------------------------------------------------

-- Horário efetivo de um registro novo: agora (padrão) ou até 7 dias para trás; nunca no futuro
-- (2 min de folga para o relógio do celular).
create function public.crm_effective_time(p_at timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_at is null then
    return now();
  end if;
  if p_at > now() + interval '2 minutes' then
    raise exception 'O horário do contato não pode ser no futuro.' using errcode = '22023';
  end if;
  if p_at < now() - interval '7 days' then
    raise exception 'Só dá para registrar contatos de até 7 dias atrás.' using errcode = '22023';
  end if;
  return p_at;
end;
$$;


-- ---------------------------------------------------------------------------
-- 4.1 "Registrar contato" com horário efetivo
-- ---------------------------------------------------------------------------

drop function if exists public.deal_log_interaction(uuid, public.deal_interaction_kind, public.deal_interaction_channel, text, text, uuid, text, timestamptz, boolean, text, text);

create function public.deal_log_interaction(
  p_deal_id uuid,
  p_kind public.deal_interaction_kind,
  p_channel public.deal_interaction_channel,
  p_approach text,
  p_body text,
  p_responded_to uuid default null,
  p_next_action text default null,
  p_next_action_at timestamptz default null,
  p_previous_responded boolean default null,
  p_summary text default null,
  p_next_step text default null,
  p_occurred_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_prev uuid;
  v_link uuid := p_responded_to;
  v_summary text := nullif(btrim(coalesce(p_summary, '')), '');
  v_at timestamptz := public.crm_effective_time(p_occurred_at);
begin
  if not public.can_access_deal(p_deal_id) then
    raise exception 'Você não tem acesso a este negócio.' using errcode = '42501';
  end if;

  if p_kind = 'tentativa_contato' then
    if v_summary is null then
      raise exception 'Escreva o resumo do que aconteceu.' using errcode = '23514';
    end if;
    -- A tentativa anterior ainda sem resposta registrada: quem registra a nova diz se ela teve resposta.
    select i.id into v_prev
    from public.deal_interactions i
    where i.deal_id = p_deal_id and i.kind = 'tentativa_contato' and i.responded is null and i.deleted_at is null
    order by i.occurred_at desc, i.created_at desc
    limit 1;
    if v_prev is not null then
      if p_previous_responded is null then
        raise exception 'Informe se a tentativa anterior teve resposta.' using errcode = '23514';
      end if;
      update public.deal_interactions set responded = p_previous_responded where id = v_prev;
      v_link := coalesce(v_link, v_prev);
    end if;
  end if;

  if p_kind = 'resposta_cliente' and p_responded_to is not null then
    update public.deal_interactions set responded = true
    where id = p_responded_to and deal_id = p_deal_id and kind = 'tentativa_contato';
  end if;

  insert into public.deal_interactions (deal_id, kind, channel, approach, body, summary, next_step, responded_to_interaction_id, author_id, occurred_at)
  values (
    p_deal_id, p_kind, p_channel, nullif(btrim(p_approach), ''),
    coalesce(nullif(btrim(coalesce(p_body, '')), ''), v_summary, ''),
    v_summary, nullif(btrim(coalesce(p_next_step, '')), ''), v_link, auth.uid(), v_at
  )
  returning id into v_id;

  if nullif(btrim(p_next_action), '') is not null and p_next_action_at is not null then
    update public.deals set next_action = btrim(p_next_action), next_action_at = p_next_action_at where id = p_deal_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.deal_log_interaction(uuid, public.deal_interaction_kind, public.deal_interaction_channel, text, text, uuid, text, timestamptz, boolean, text, text, timestamptz) from public, anon;
grant execute on function public.deal_log_interaction(uuid, public.deal_interaction_kind, public.deal_interaction_channel, text, text, uuid, text, timestamptz, boolean, text, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 4.1 / 4.2 "Marcar enviado" com horário efetivo; o toque de retorno tira o lead de "Em análise"
-- ---------------------------------------------------------------------------

drop function if exists public.prospect_record_touch(uuid, int, public.prospect_script_kind, uuid, text);

create function public.prospect_record_touch(
  p_deal_id uuid,
  p_touch_number int,
  p_script_kind public.prospect_script_kind,
  p_script_id uuid,
  p_rendered_text text,
  p_occurred_at timestamptz default null
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
  v_attempts uuid[];
  v_pending jsonb;
  v_interaction uuid;
  v_log uuid;
  v_op uuid;
  v_at timestamptz := public.crm_effective_time(p_occurred_at);
  v_label text := case when p_touch_number is null then 'Reativação' else 'Toque ' || p_touch_number end;
begin
  select d.id, d.stage, d.prospect_playbook_id, d.prospect_paused_at, d.prospect_discarded_at, d.next_action, d.next_action_at
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
  v_first := not exists (select 1 from public.prospect_touch_logs t where t.deal_id = p_deal_id and t.deleted_at is null);
  v_target := case when v_first then 'primeiro_contato'::public.deal_stage else 'tentativas_contato'::public.deal_stage end;
  if v_deal.stage = 'em_analise' then
    -- Retorno de quem estava avaliando: volta para as tentativas e a cadência segue normal.
    v_target := 'tentativas_contato';
  elsif public.deal_stage_rank(v_deal.stage) >= public.deal_stage_rank(v_target) then
    v_target := null;
  end if;

  -- O toque anterior ficou sem resposta (se tivesse, o "Respondeu" teria parado a cadência).
  with marked as (
    update public.deal_interactions
    set responded = false
    where deal_id = p_deal_id and kind = 'tentativa_contato' and responded is null
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_attempts from marked;

  insert into public.deal_interactions (deal_id, kind, channel, approach, body, summary, stage_to, occurred_at)
  values (
    p_deal_id, 'tentativa_contato', 'whatsapp', 'Prospecção · ' || coalesce(v_playbook_name, 'playbook'),
    p_rendered_text, v_label || ' enviado pelo WhatsApp', v_target, v_at
  )
  returning id into v_interaction;

  if v_target is not null then
    update public.deals set stage = v_target where id = p_deal_id;
  end if;

  insert into public.prospect_touch_logs (deal_id, touch_number, script_kind, playbook_id, script_id, rendered_text, interaction_id, sent_at)
  values (p_deal_id, p_touch_number, p_script_kind, v_deal.prospect_playbook_id, p_script_id, p_rendered_text, v_interaction, v_at)
  returning id into v_log;

  delete from public.prospect_pending_sends s where s.deal_id = p_deal_id
  returning jsonb_build_object(
    'touch_number', s.touch_number, 'script_kind', s.script_kind, 'script_id', s.script_id,
    'body', s.body, 'recipient', s.recipient, 'created_at', s.created_at
  ) into v_pending;

  -- Só a última operação do lead pode ser desfeita.
  delete from public.prospect_undo_ops where deal_id = p_deal_id;
  insert into public.prospect_undo_ops (deal_id, kind, payload)
  values (p_deal_id, 'toque', jsonb_build_object(
    'touch_log_id', v_log,
    'interaction_id', v_interaction,
    'stage_before', v_deal.stage,
    'stage_after', v_target,
    'attempts_marked', to_jsonb(v_attempts),
    'next_action', v_deal.next_action,
    'next_action_at', v_deal.next_action_at,
    'pending', v_pending
  ))
  returning id into v_op;

  return v_op;
end;
$$;

revoke all on function public.prospect_record_touch(uuid, int, public.prospect_script_kind, uuid, text, timestamptz) from public, anon;
grant execute on function public.prospect_record_touch(uuid, int, public.prospect_script_kind, uuid, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 4.3 Editar e riscar abordagens
-- ---------------------------------------------------------------------------

-- Lê a abordagem travada e confere quem pode (autor ou diretoria/admin, com acesso ao negócio).
create function public.crm_lock_interaction(p_interaction_id uuid)
returns public.deal_interactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.deal_interactions;
begin
  select * into v_row from public.deal_interactions where id = p_interaction_id for update;
  if v_row.id is null or not public.can_access_deal(v_row.deal_id) then
    raise exception 'Registro não encontrado ou sem permissão.' using errcode = '42501';
  end if;
  if v_row.kind not in ('tentativa_contato', 'resposta_cliente') then
    raise exception 'Só as abordagens (tentativas e respostas) são editadas por aqui.' using errcode = '22023';
  end if;
  if v_row.author_id is distinct from auth.uid() and not public.crm_is_ceo() then
    raise exception 'Só quem registrou ou a diretoria altera esta abordagem.' using errcode = '42501';
  end if;
  if v_row.deleted_at is not null then
    raise exception 'Este registro está riscado.' using errcode = '22023';
  end if;
  return v_row;
end;
$$;

revoke all on function public.crm_lock_interaction(uuid) from public, anon, authenticated;

create function public.deal_interaction_update(
  p_interaction_id uuid,
  p_channel public.deal_interaction_channel,
  p_occurred_at timestamptz,
  p_summary text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.deal_interactions := public.crm_lock_interaction(p_interaction_id);
  v_new public.deal_interactions;
  v_created timestamptz;
  v_changes jsonb;
begin
  if p_occurred_at is null then
    raise exception 'Informe a data e o horário do contato.' using errcode = '22023';
  end if;
  if p_occurred_at > now() + interval '2 minutes' then
    raise exception 'O horário do contato não pode ser no futuro.' using errcode = '22023';
  end if;
  select d.created_at into v_created from public.deals d where d.id = v_old.deal_id;
  if p_occurred_at < v_created - interval '7 days' then
    raise exception 'O horário não pode ser anterior à criação do negócio.' using errcode = '22023';
  end if;

  update public.deal_interactions
  set channel = p_channel,
      occurred_at = p_occurred_at,
      summary = coalesce(nullif(btrim(coalesce(p_summary, '')), ''), summary),
      edited_at = now(),
      edited_by = auth.uid()
  where id = p_interaction_id
  returning * into v_new;

  select coalesce(jsonb_object_agg(f, jsonb_build_object('before', to_jsonb(v_old) -> f, 'after', to_jsonb(v_new) -> f)), '{}'::jsonb)
  into v_changes
  from unnest(array['channel', 'occurred_at', 'summary']) as f
  where (to_jsonb(v_old) -> f) is distinct from (to_jsonb(v_new) -> f);

  if v_changes = '{}'::jsonb then
    return;
  end if;

  insert into public.deal_interaction_history (interaction_id, deal_id, changed_by, action, changes, reason)
  values (p_interaction_id, v_old.deal_id, auth.uid(), 'EDIT', v_changes, nullif(btrim(coalesce(p_reason, '')), ''));

  -- Toque da prospecção ligado: a cadência passa a contar do horário corrigido.
  if v_changes ? 'occurred_at' then
    perform set_config('alem.touch_sync', 'on', true);
    update public.prospect_touch_logs set sent_at = v_new.occurred_at where interaction_id = p_interaction_id;
    perform set_config('alem.touch_sync', 'off', true);
  end if;
end;
$$;

create function public.deal_interaction_delete(p_interaction_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.deal_interactions := public.crm_lock_interaction(p_interaction_id);
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is null or length(v_reason) < 3 then
    raise exception 'Informe o motivo para riscar o registro.' using errcode = '22023';
  end if;

  update public.deal_interactions set deleted_at = now() where id = p_interaction_id;

  insert into public.deal_interaction_history (interaction_id, deal_id, changed_by, action, changes, reason)
  values (p_interaction_id, v_old.deal_id, auth.uid(), 'DELETE',
    jsonb_build_object('deleted_at', jsonb_build_object('before', null, 'after', now())), v_reason);

  -- Riscado sai da cadência e da meta de toques (o toque ligado também fica riscado).
  perform set_config('alem.touch_sync', 'on', true);
  update public.prospect_touch_logs set deleted_at = now() where interaction_id = p_interaction_id;
  perform set_config('alem.touch_sync', 'off', true);
end;
$$;

revoke all on function public.deal_interaction_update(uuid, public.deal_interaction_channel, timestamptz, text, text) from public, anon;
revoke all on function public.deal_interaction_delete(uuid, text) from public, anon;
grant execute on function public.deal_interaction_update(uuid, public.deal_interaction_channel, timestamptz, text, text) to authenticated;
grant execute on function public.deal_interaction_delete(uuid, text) to authenticated;

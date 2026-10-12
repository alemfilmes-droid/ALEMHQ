-- Prospecção (Módulo 3/5): rascunho de envio pendente e "Desfazer" de Marcar enviado / Respondeu.
-- Só acréscimos; as duas funções do Módulo 2 são substituídas por versões que também gravam o
-- registro de desfazer.
--
-- Desfazer: cada operação guarda o estado anterior em prospect_undo_ops. Só quem fez desfaz, só a
-- última operação do lead e só por 2 minutos (o aviso na tela dura 10 s; a folga cobre conexão lenta).
-- Depois disso o histórico de toques é imutável.
--
-- Rollback (só se ainda não houver uso): drop function public.prospect_undo(uuid); recriar
-- prospect_record_touch / prospect_mark_responded da migração 20261011090000; drop table
-- public.prospect_undo_ops, public.prospect_pending_sends; drop type public.prospect_undo_kind;
-- alter table public.deals drop column prospect_cadence_restarted_at.

-- ---------------------------------------------------------------------------
-- Correção do Módulo 2: deals tem SELECT por coluna desde a privacidade dos valores
-- (20260928090000). As colunas de prospecção não são de valor: leitura liberada como as demais.
-- ---------------------------------------------------------------------------

grant select (
  prospect_playbook_id, prospect_lead_type, prospect_contact_is_decision_maker, prospect_decision_maker_name,
  prospect_decision_maker_role, prospect_decision_maker_whatsapp, prospect_decision_maker_set_at, prospect_hook,
  prospect_goal_id, prospect_last_delivered_project, prospect_cadence_started_at, prospect_replied_at,
  prospect_paused_at, prospect_pause_reason, prospect_resumed_at, prospect_discarded_at, prospect_discard_reason,
  prospect_manual_reactivation_on
) on public.deals to authenticated;

-- Novo decisor (objeção /nao-sou-eu) com "Reiniciar a cadência no Toque 1": a partir desta data o
-- motor ignora os toques anteriores e conta de novo a partir do Toque 1.
alter table public.deals add column prospect_cadence_restarted_at timestamptz;
grant select (prospect_cadence_restarted_at) on public.deals to authenticated;

-- ---------------------------------------------------------------------------
-- Rascunho do envio: o texto final (com as edições) que foi aberto no WhatsApp. Um por lead.
-- ---------------------------------------------------------------------------

create table public.prospect_pending_sends (
  deal_id uuid primary key references public.deals (id) on delete cascade,
  touch_number int check (touch_number is null or touch_number between 0 and 12),
  script_kind public.prospect_script_kind not null,
  script_id uuid references public.prospect_scripts (id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 4000),
  recipient text not null check (recipient ~ '^55[0-9]{11}$'),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.prospect_pending_sends enable row level security;

create policy "prospect_pending_sends_select" on public.prospect_pending_sends for select to authenticated
  using (public.can_access_deal(deal_id));
create policy "prospect_pending_sends_insert" on public.prospect_pending_sends for insert to authenticated
  with check (public.can_access_deal(deal_id));
create policy "prospect_pending_sends_update" on public.prospect_pending_sends for update to authenticated
  using (public.can_access_deal(deal_id)) with check (public.can_access_deal(deal_id));
create policy "prospect_pending_sends_delete" on public.prospect_pending_sends for delete to authenticated
  using (public.can_access_deal(deal_id));

grant select, insert, update, delete on public.prospect_pending_sends to authenticated;

-- ---------------------------------------------------------------------------
-- Operações que podem ser desfeitas
-- ---------------------------------------------------------------------------

create type public.prospect_undo_kind as enum ('toque', 'respondeu');

create table public.prospect_undo_ops (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  kind public.prospect_undo_kind not null,
  payload jsonb not null,
  created_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

create index prospect_undo_ops_deal_idx on public.prospect_undo_ops (deal_id, created_at desc);

alter table public.prospect_undo_ops enable row level security;

-- Só as funções abaixo gravam e apagam; a pessoa enxerga as próprias.
create policy "prospect_undo_ops_select" on public.prospect_undo_ops for select to authenticated
  using (created_by = auth.uid());
create policy "prospect_undo_ops_insert" on public.prospect_undo_ops for insert to authenticated
  with check (created_by = auth.uid() and public.can_access_deal(deal_id));
create policy "prospect_undo_ops_delete" on public.prospect_undo_ops for delete to authenticated
  using (created_by = auth.uid());

grant select, insert, delete on public.prospect_undo_ops to authenticated;

-- ---------------------------------------------------------------------------
-- Marcar enviado (substitui a versão do Módulo 2): agora consome o rascunho e guarda o desfazer.
-- Retorna o id da operação de desfazer.
-- ---------------------------------------------------------------------------

create or replace function public.prospect_record_touch(
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
  v_attempts uuid[];
  v_pending jsonb;
  v_interaction uuid;
  v_log uuid;
  v_op uuid;
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
  v_first := not exists (select 1 from public.prospect_touch_logs t where t.deal_id = p_deal_id);
  v_target := case when v_first then 'primeiro_contato'::public.deal_stage else 'tentativas_contato'::public.deal_stage end;
  if public.deal_stage_rank(v_deal.stage) >= public.deal_stage_rank(v_target) then
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

-- ---------------------------------------------------------------------------
-- Respondeu (substitui a versão do Módulo 2): agora guarda o desfazer e retorna o id dele.
-- ---------------------------------------------------------------------------

drop function public.prospect_mark_responded(uuid);

create function public.prospect_mark_responded(p_deal_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_replied_before timestamptz;
  v_attempt uuid;
  v_attempt_responded boolean;
  v_interaction uuid;
  v_op uuid;
begin
  select d.prospect_replied_at into v_replied_before
  from public.deals d
  where d.id = p_deal_id and d.prospect_playbook_id is not null;
  if not found then
    raise exception 'Negócio não encontrado, sem permissão ou fora da cadência.' using errcode = '42501';
  end if;

  update public.deals set prospect_replied_at = now() where id = p_deal_id;

  select i.id, i.responded into v_attempt, v_attempt_responded
  from public.deal_interactions i
  where i.deal_id = p_deal_id and i.kind = 'tentativa_contato'
  order by i.occurred_at desc, i.created_at desc
  limit 1;

  if v_attempt is not null then
    update public.deal_interactions set responded = true where id = v_attempt;
  end if;

  insert into public.deal_interactions (deal_id, kind, channel, body, responded_to_interaction_id)
  values (p_deal_id, 'resposta_cliente', 'whatsapp', 'Respondeu no WhatsApp (prospecção).', v_attempt)
  returning id into v_interaction;

  delete from public.prospect_undo_ops where deal_id = p_deal_id;
  insert into public.prospect_undo_ops (deal_id, kind, payload)
  values (p_deal_id, 'respondeu', jsonb_build_object(
    'interaction_id', v_interaction,
    'attempt_id', v_attempt,
    'attempt_responded', v_attempt_responded,
    'replied_before', v_replied_before
  ))
  returning id into v_op;

  return v_op;
end;
$$;

revoke all on function public.prospect_mark_responded(uuid) from public, anon;
grant execute on function public.prospect_mark_responded(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Desfazer: reverte tudo o que a operação gravou. security definer porque apaga do histórico
-- imutável e devolve a etapa do funil por fora da regra de mudança de etapa (crm_system_move).
-- ---------------------------------------------------------------------------

create function public.prospect_undo(p_op_id uuid)
returns public.prospect_undo_kind
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op public.prospect_undo_ops;
  v_payload jsonb;
  v_log public.prospect_touch_logs;
begin
  select * into v_op from public.prospect_undo_ops where id = p_op_id;
  if v_op.id is null or v_op.created_by is distinct from auth.uid() then
    raise exception 'Não dá mais para desfazer.' using errcode = '42501';
  end if;
  if v_op.created_at < now() - interval '2 minutes' then
    delete from public.prospect_undo_ops where id = p_op_id;
    raise exception 'O prazo para desfazer acabou.' using errcode = '23514';
  end if;
  v_payload := v_op.payload;

  perform set_config('app.crm_system', 'true', true);

  if v_op.kind = 'toque' then
    select * into v_log from public.prospect_touch_logs where id = (v_payload ->> 'touch_log_id')::uuid;
    if v_log.id is null
       or exists (select 1 from public.prospect_touch_logs t where t.deal_id = v_op.deal_id and t.sent_at > v_log.sent_at) then
      raise exception 'Não dá mais para desfazer: o lead já tem outro toque.' using errcode = '23514';
    end if;

    delete from public.prospect_touch_logs where id = v_log.id;
    delete from public.deal_interactions where id = (v_payload ->> 'interaction_id')::uuid;
    update public.deal_interactions
    set responded = null
    where id in (select jsonb_array_elements_text(v_payload -> 'attempts_marked')::uuid);

    update public.deals d
    set stage = case
          when v_payload ->> 'stage_after' is not null and d.stage::text = v_payload ->> 'stage_after'
          then (v_payload ->> 'stage_before')::public.deal_stage
          else d.stage
        end,
        next_action = v_payload ->> 'next_action',
        next_action_at = (v_payload ->> 'next_action_at')::timestamptz
    where d.id = v_op.deal_id;

    if jsonb_typeof(v_payload -> 'pending') = 'object' then
      insert into public.prospect_pending_sends (deal_id, touch_number, script_kind, script_id, body, recipient, created_by, created_at)
      values (
        v_op.deal_id,
        (v_payload -> 'pending' ->> 'touch_number')::int,
        (v_payload -> 'pending' ->> 'script_kind')::public.prospect_script_kind,
        (v_payload -> 'pending' ->> 'script_id')::uuid,
        v_payload -> 'pending' ->> 'body',
        v_payload -> 'pending' ->> 'recipient',
        auth.uid(),
        (v_payload -> 'pending' ->> 'created_at')::timestamptz
      )
      on conflict (deal_id) do nothing;
    end if;
  else
    delete from public.deal_interactions where id = (v_payload ->> 'interaction_id')::uuid;
    update public.deal_interactions
    set responded = (v_payload ->> 'attempt_responded')::boolean
    where id = (v_payload ->> 'attempt_id')::uuid;
    update public.deals
    set prospect_replied_at = (v_payload ->> 'replied_before')::timestamptz
    where id = v_op.deal_id;
  end if;

  delete from public.prospect_undo_ops where id = p_op_id;
  return v_op.kind;
end;
$$;

revoke all on function public.prospect_undo(uuid) from public, anon;
grant execute on function public.prospect_undo(uuid) to authenticated;

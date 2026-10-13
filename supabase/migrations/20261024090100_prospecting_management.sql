-- "Gerenciar prospecção" (pedido do Anderson, 12/10/2026): CEO/admin e Head comercial — NUNCA o SDR.
--
-- • Editar cadência: playbook, toque atual e data do próximo toque. A cadência recalcula a partir daí
--   (prospect_override_*; os toques enviados antes da edição não contam para a numeração).
-- • Reiniciar cadência: recomeça do Toque 1 (ou Toque 0 sem decisor) com o playbook escolhido; os toques
--   anteriores ficam no histórico como "ciclo anterior" (prospect_cadence_restarted_at, que já existia).
-- • Remover da prospecção: sai da cadência e das listas; o negócio continua no funil; volta com "Reiniciar".
-- • Apagar prospecção: apaga de vez os toques (e os registros de tentativa que eles criaram na linha do tempo),
--   objeções, rascunhos pendentes e os dados da cadência; o negócio continua no funil. As metas de esforço são
--   calculadas na hora a partir dos toques, então se ajustam sozinhas.
-- • Toda ação vai para prospect_management_log (imutável).
--
-- As colunas de gestão só mudam por estas funções (gatilho), mesmo para quem pode editar o negócio.
-- Só adiciona colunas (nulas), uma tabela nova, funções e gatilhos.

alter table public.deals
  add column if not exists prospect_removed_at timestamptz,
  add column if not exists prospect_removed_by uuid references public.profiles (id) on delete set null,
  add column if not exists prospect_override_touch int check (prospect_override_touch is null or prospect_override_touch between 0 and 20),
  add column if not exists prospect_override_due date,
  add column if not exists prospect_override_at timestamptz;

-- ---------------------------------------------------------------------------
-- Quem pode: master, admin e Head comercial (espelha canManageLeadCadence no código)
-- ---------------------------------------------------------------------------

create function public.can_manage_lead_cadence()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_master()
    or public.is_admin()
    or (public.is_head() and 'comercial' = any (public.managed_squads()))
    or public.is_squad_lead('comercial')
$$;

grant execute on function public.can_manage_lead_cadence() to authenticated;

create function public.deals_guard_prospect_management()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('alem.prospect_manage', true) = 'on' then
    return new;
  end if;
  if new.prospect_removed_at is distinct from old.prospect_removed_at
     or new.prospect_removed_by is distinct from old.prospect_removed_by
     or new.prospect_override_touch is distinct from old.prospect_override_touch
     or new.prospect_override_due is distinct from old.prospect_override_due
     or new.prospect_override_at is distinct from old.prospect_override_at then
    raise exception 'Só a gestão da prospecção (CEO/admin ou Head comercial) altera a cadência por aqui.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger deals_guard_prospect_management before update on public.deals
  for each row execute function public.deals_guard_prospect_management();

-- ---------------------------------------------------------------------------
-- Registro imutável
-- ---------------------------------------------------------------------------

create table public.prospect_management_log (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null,
  lead_name text not null,
  action text not null check (action in ('editar', 'reiniciar', 'remover', 'apagar')),
  actor_id uuid references public.profiles (id) on delete set null,
  details jsonb not null check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index prospect_management_log_deal_idx on public.prospect_management_log (deal_id, created_at desc);

create function public.prospect_management_log_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'O registro da gestão da prospecção não pode ser alterado nem apagado.' using errcode = '42501';
end;
$$;

create trigger prospect_management_log_immutable before update or delete on public.prospect_management_log
  for each row execute function public.prospect_management_log_immutable();

alter table public.prospect_management_log enable row level security;

create policy "prospect_management_log_select" on public.prospect_management_log for select to authenticated
  using (public.can_manage_lead_cadence());

revoke insert, update, delete, truncate on public.prospect_management_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Uso interno: trava o negócio, confere a permissão e devolve o nome do lead
-- ---------------------------------------------------------------------------

create function public.prospect_manage_begin(p_deal_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if not public.can_manage_lead_cadence() then
    raise exception 'Só o CEO/admin e o Head comercial gerenciam a prospecção.' using errcode = '42501';
  end if;
  select c.name into v_name
  from public.deals d join public.companies c on c.id = d.company_id
  where d.id = p_deal_id
  for update of d;
  if v_name is null then
    raise exception 'Lead não encontrado.' using errcode = '22023';
  end if;
  perform set_config('alem.prospect_manage', 'on', true);
  return v_name;
end;
$$;

revoke all on function public.prospect_manage_begin(uuid) from public, anon, authenticated;

create function public.prospect_playbook_touches(p_playbook_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select cardinality(c.touch_offsets) from public.prospect_playbooks p
  join public.prospect_cadences c on c.cadence_type = p.cadence_type
  where p.id = p_playbook_id and p.active
$$;

revoke all on function public.prospect_playbook_touches(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ações
-- ---------------------------------------------------------------------------

create function public.prospect_manage_edit(p_deal_id uuid, p_playbook_id uuid, p_touch int, p_due date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := public.prospect_manage_begin(p_deal_id);
  v_total int := public.prospect_playbook_touches(p_playbook_id);
  d public.deals;
begin
  select * into d from public.deals where id = p_deal_id;
  if d.prospect_cadence_started_at is null or d.prospect_removed_at is not null then
    raise exception 'Este lead não está na cadência. Use "Reiniciar cadência".' using errcode = '23514';
  end if;
  if v_total is null then
    raise exception 'Escolha um playbook ativo.' using errcode = '23514';
  end if;
  if p_touch is null or p_touch < 0 or p_touch > v_total then
    raise exception 'Escolha um toque entre 0 e %.', v_total using errcode = '23514';
  end if;
  if p_due is null or p_due < (now() at time zone 'America/Fortaleza')::date then
    raise exception 'A data do próximo toque não pode ser no passado.' using errcode = '23514';
  end if;

  update public.deals
  set prospect_playbook_id = p_playbook_id,
      prospect_override_touch = p_touch,
      prospect_override_due = p_due,
      prospect_override_at = now(),
      prospect_manual_reactivation_on = null,
      prospect_paused_at = null,
      prospect_pause_reason = null,
      prospect_discarded_at = null,
      prospect_discard_reason = null
  where id = p_deal_id;

  insert into public.prospect_management_log (deal_id, lead_name, action, actor_id, details)
  values (p_deal_id, v_name, 'editar', auth.uid(), jsonb_build_object(
    'playbook_from', d.prospect_playbook_id, 'playbook_to', p_playbook_id, 'touch', p_touch, 'due', p_due));
end;
$$;

create function public.prospect_manage_restart(p_deal_id uuid, p_playbook_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := public.prospect_manage_begin(p_deal_id);
  d public.deals;
begin
  if public.prospect_playbook_touches(p_playbook_id) is null then
    raise exception 'Escolha um playbook ativo.' using errcode = '23514';
  end if;
  select * into d from public.deals where id = p_deal_id;

  update public.deals
  set prospect_playbook_id = p_playbook_id,
      prospect_cadence_started_at = coalesce(prospect_cadence_started_at, now()),
      prospect_cadence_restarted_at = now(),
      prospect_removed_at = null,
      prospect_removed_by = null,
      prospect_override_touch = null,
      prospect_override_due = null,
      prospect_override_at = null,
      prospect_replied_at = null,
      prospect_manual_reactivation_on = null,
      prospect_paused_at = null,
      prospect_pause_reason = null,
      prospect_resumed_at = null,
      prospect_discarded_at = null,
      prospect_discard_reason = null
  where id = p_deal_id;

  insert into public.prospect_management_log (deal_id, lead_name, action, actor_id, details)
  values (p_deal_id, v_name, 'reiniciar', auth.uid(), jsonb_build_object(
    'playbook_from', d.prospect_playbook_id, 'playbook_to', p_playbook_id,
    'previous_cycle_touches', (select count(*) from public.prospect_touch_logs t where t.deal_id = p_deal_id and t.deleted_at is null)));
end;
$$;

create function public.prospect_manage_remove(p_deal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := public.prospect_manage_begin(p_deal_id);
begin
  if not exists (select 1 from public.deals where id = p_deal_id and prospect_cadence_started_at is not null and prospect_removed_at is null) then
    raise exception 'Este lead não está na cadência.' using errcode = '23514';
  end if;
  update public.deals set prospect_removed_at = now(), prospect_removed_by = auth.uid() where id = p_deal_id;
  insert into public.prospect_management_log (deal_id, lead_name, action, actor_id, details)
  values (p_deal_id, v_name, 'remover', auth.uid(), '{}'::jsonb);
end;
$$;

-- Apagar: confirma com o nome do lead. O negócio, o funil e o resto da linha do tempo ficam.
create function public.prospect_manage_erase(p_deal_id uuid, p_confirm_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := public.prospect_manage_begin(p_deal_id);
  v_interactions uuid[];
  v_counts jsonb;
  v_touches int;
  v_objections int;
  v_pending int;
  v_undo int;
  v_records int;
begin
  if not public.client_name_matches(p_confirm_name, v_name) then
    raise exception 'Digite o nome exato do lead para confirmar.' using errcode = '23514';
  end if;

  v_interactions := array(select t.interaction_id from public.prospect_touch_logs t where t.deal_id = p_deal_id and t.interaction_id is not null);

  -- Exceção dos históricos imutáveis (toques e edições de abordagem), só dentro desta função.
  perform set_config('alem.client_erasure', 'on', true);
  delete from public.prospect_undo_ops where deal_id = p_deal_id;
  get diagnostics v_undo = row_count;
  delete from public.prospect_touch_logs where deal_id = p_deal_id;
  get diagnostics v_touches = row_count;
  delete from public.deal_interactions where id = any (v_interactions);
  get diagnostics v_records = row_count;
  delete from public.prospect_lead_objections where deal_id = p_deal_id;
  get diagnostics v_objections = row_count;
  delete from public.prospect_pending_sends where deal_id = p_deal_id;
  get diagnostics v_pending = row_count;
  perform set_config('alem.client_erasure', 'off', true);

  update public.deals
  set prospect_playbook_id = null,
      prospect_cadence_started_at = null,
      prospect_cadence_restarted_at = null,
      prospect_removed_at = null,
      prospect_removed_by = null,
      prospect_override_touch = null,
      prospect_override_due = null,
      prospect_override_at = null,
      prospect_replied_at = null,
      prospect_manual_reactivation_on = null,
      prospect_paused_at = null,
      prospect_pause_reason = null,
      prospect_resumed_at = null,
      prospect_discarded_at = null,
      prospect_discard_reason = null
  where id = p_deal_id;

  v_counts := jsonb_build_object('touches', v_touches, 'timeline_records', v_records, 'objections', v_objections,
    'pending_drafts', v_pending, 'undo_ops', v_undo);
  insert into public.prospect_management_log (deal_id, lead_name, action, actor_id, details)
  values (p_deal_id, v_name, 'apagar', auth.uid(), v_counts);
  return v_counts;
end;
$$;

revoke all on function public.prospect_manage_edit(uuid, uuid, int, date) from public, anon;
revoke all on function public.prospect_manage_restart(uuid, uuid) from public, anon;
revoke all on function public.prospect_manage_remove(uuid) from public, anon;
revoke all on function public.prospect_manage_erase(uuid, text) from public, anon;
grant execute on function public.prospect_manage_edit(uuid, uuid, int, date) to authenticated;
grant execute on function public.prospect_manage_restart(uuid, uuid) to authenticated;
grant execute on function public.prospect_manage_remove(uuid) to authenticated;
grant execute on function public.prospect_manage_erase(uuid, text) to authenticated;

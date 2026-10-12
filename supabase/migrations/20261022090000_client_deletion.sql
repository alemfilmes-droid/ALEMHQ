-- Bloco 8C — Excluir clientes (pedido do Anderson). Só a conta master (is_master()).
--
-- • Resumo do que está ligado ao cliente: client_deletion_summary().
-- • Sem nenhum histórico → apagar de vez (digitando o nome exato): client_delete().
-- • Com histórico → Lixeira (nada é apagado): o cliente some das telas e das listas de escolha;
--   negócios arquivados (a cadência para); projetos e pautas em aberto finalizados ("Encerrado —
--   cliente excluído") e escondidos; reuniões futuras escolhidas canceladas (a sincronização tira do
--   Google); "cliente da casa" pendente cancelado. O financeiro NÃO muda (continua nos relatórios).
-- • Lixeira: restaurar (client_restore), excluir definitivamente (client_purge — só sem lançamentos
--   financeiros e sem contar em metas) e anonimizar para a LGPD (client_anonymize — "Removido" nos
--   dados pessoais; valores, datas e categorias ficam).
-- • Registro imutável de cada ação: client_deletion_log (sem o nome do cliente, para a anonimização
--   valer de fato).
--
-- Só adiciona colunas (nulas ou com padrão), uma tabela nova e funções/gatilhos. Os gatilhos de
-- histórico imutável passam a aceitar a exceção da conta master (alem.client_erasure), só dentro de
-- client_purge e client_anonymize.

alter table public.companies
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles (id) on delete set null,
  add column if not exists delete_reason text check (delete_reason is null or length(delete_reason) <= 300),
  add column if not exists anonymized_at timestamptz;

create index if not exists companies_deleted_idx on public.companies (deleted_at) where deleted_at is not null;

-- Marca do que a exclusão escondeu (a restauração desfaz exatamente isso).
alter table public.deals add column if not exists hidden_by_client_deletion boolean not null default false;
alter table public.projects add column if not exists hidden_by_client_deletion boolean not null default false;
alter table public.pautas add column if not exists hidden_by_client_deletion boolean not null default false;

-- ---------------------------------------------------------------------------
-- Registro imutável
-- ---------------------------------------------------------------------------

create table public.client_deletion_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  action text not null check (action in ('excluido', 'excluido_permanentemente', 'restaurado', 'excluido_definitivamente', 'anonimizado')),
  actor_id uuid references public.profiles (id) on delete set null,
  summary jsonb not null check (jsonb_typeof(summary) = 'object'),
  created_at timestamptz not null default now()
);

create index client_deletion_log_company_idx on public.client_deletion_log (company_id, created_at desc);

create function public.client_deletion_log_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'O registro de exclusões não pode ser alterado nem apagado.' using errcode = '42501';
end;
$$;

create trigger client_deletion_log_immutable before update or delete on public.client_deletion_log
  for each row execute function public.client_deletion_log_immutable();

alter table public.client_deletion_log enable row level security;

create policy "client_deletion_log_select" on public.client_deletion_log for select to authenticated
  using (public.is_master());

revoke insert, update, delete, truncate on public.client_deletion_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Históricos imutáveis: exceção só para excluir definitivamente / anonimizar (conta master)
-- ---------------------------------------------------------------------------

create or replace function public.deal_interaction_history_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('alem.client_erasure', true) = 'on' then
    return coalesce(new, old);
  end if;
  raise exception 'O histórico de abordagens não pode ser alterado nem apagado.' using errcode = '42501';
end;
$$;

create or replace function public.financial_entry_history_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Anonimizar troca só textos pessoais; o histórico nunca é apagado.
  if tg_op = 'UPDATE' and current_setting('alem.client_erasure', true) = 'on' then
    return new;
  end if;
  raise exception 'O histórico de alterações não pode ser alterado nem apagado.' using errcode = '42501';
end;
$$;

create or replace function public.prospect_touch_logs_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('alem.client_erasure', true) = 'on' then
    return new;
  end if;
  if current_setting('alem.touch_sync', true) = 'on'
     and (to_jsonb(new) - 'sent_at' - 'deleted_at') = (to_jsonb(old) - 'sent_at' - 'deleted_at') then
    return new;
  end if;
  raise exception 'O histórico de toques não pode ser alterado.' using errcode = '42501';
end;
$$;

-- ---------------------------------------------------------------------------
-- Cliente excluído não ganha projeto, pauta nem negócio novo
-- ---------------------------------------------------------------------------

create function public.client_is_deleted(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.companies c where c.id = p_company_id and c.deleted_at is not null)
$$;

create function public.block_deleted_client()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_company uuid;
begin
  if tg_table_name = 'pautas' then
    if new.source <> 'manual' or new.is_standalone then
      return new;
    end if;
    v_company := coalesce((select pr.company_id from public.projects pr where pr.id = new.project_id), new.direct_company_id);
  else
    v_company := new.company_id;
  end if;
  if v_company is not null and public.client_is_deleted(v_company) then
    raise exception 'Este cliente foi excluído. Restaure o cliente na Lixeira antes de usar.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger projects_block_deleted_client before insert on public.projects
  for each row execute function public.block_deleted_client();
create trigger deals_block_deleted_client before insert on public.deals
  for each row execute function public.block_deleted_client();
create trigger pautas_block_deleted_client before insert on public.pautas
  for each row execute function public.block_deleted_client();

-- ---------------------------------------------------------------------------
-- Regras puras (os mesmos casos de lib/clients/deletion-cases.json)
-- ---------------------------------------------------------------------------

create function public.client_deletion_flags(p_counts jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with n as (
    select
      coalesce((p_counts ->> 'receivables_open')::int, 0) + coalesce((p_counts ->> 'receivables_paid')::int, 0)
        + coalesce((p_counts ->> 'receivables_cancelled')::int, 0) + coalesce((p_counts ->> 'payables_open')::int, 0)
        + coalesce((p_counts ->> 'payables_paid')::int, 0) + coalesce((p_counts ->> 'payables_cancelled')::int, 0) as finance,
      coalesce((p_counts ->> 'goal_contributions')::int, 0) as goals,
      coalesce((p_counts ->> 'projects_total')::int, 0) + coalesce((p_counts ->> 'pautas_open')::int, 0)
        + coalesce((p_counts ->> 'deals_total')::int, 0) + coalesce((p_counts ->> 'meetings_future')::int, 0)
        + coalesce((p_counts ->> 'meetings_past')::int, 0) + coalesce((p_counts ->> 'budgets')::int, 0) as other
  )
  select jsonb_build_object(
    'has_dependencies', n.finance + n.goals + n.other > 0,
    'can_purge', n.finance = 0 and n.goals = 0
  )
  from n
$$;

create function public.client_name_matches(p_typed text, p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(btrim(coalesce(p_typed, '')), '\s+', ' ', 'g') <> ''
     and regexp_replace(btrim(coalesce(p_typed, '')), '\s+', ' ', 'g') = regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g')
$$;

-- ---------------------------------------------------------------------------
-- Contagem do que está ligado ao cliente (uso interno)
-- ---------------------------------------------------------------------------

create function public.client_deletion_counts(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_deals uuid[] := array(select d.id from public.deals d where d.company_id = p_company_id);
  v_projects uuid[] := array(select pr.id from public.projects pr where pr.company_id = p_company_id);
  v_counts jsonb;
begin
  select jsonb_build_object(
    'projects_total', cardinality(v_projects),
    'projects_active', (
      select count(*) from public.projects pr
      where pr.id = any (v_projects) and not pr.is_internal and pr.finalized_at is null
        and pr.stage not in ('entregue', 'cancelado', 'encerrado')
    ),
    'pautas_open', (
      select count(*) from public.pautas pt
      where pt.archived_at is null and pt.status <> 'aprovado' and pt.source = 'manual' and not pt.is_standalone
        and (pt.project_id = any (v_projects) or (pt.project_id is null and pt.direct_company_id = p_company_id))
    ),
    'deals_total', cardinality(v_deals),
    'deals_open', (
      select count(*) from public.deals d where d.id = any (v_deals) and d.archived_at is null and d.stage not in ('ganho', 'perdido')
    ),
    'cadences_active', (
      select count(*) from public.deals d
      where d.id = any (v_deals) and d.archived_at is null and d.prospect_cadence_started_at is not null
        and d.prospect_discarded_at is null
        and d.stage in ('prospeccao', 'primeiro_contato', 'tentativas_contato', 'em_analise')
    ),
    'meetings_future', (
      select count(*) from public.commitments cm
      where cm.status = 'agendado' and cm.starts_at > now()
        and (cm.company_id = p_company_id or cm.deal_id = any (v_deals) or cm.project_id = any (v_projects))
    ) + (
      select count(*) from public.deal_meetings m
      where m.deal_id = any (v_deals) and m.commitment_id is null and m.result is null and m.scheduled_at > now()
    ),
    'meetings_past', (
      select count(*) from public.commitments cm
      where cm.status <> 'cancelado' and cm.starts_at <= now()
        and (cm.company_id = p_company_id or cm.deal_id = any (v_deals) or cm.project_id = any (v_projects))
    ) + (
      select count(*) from public.deal_meetings m
      where m.deal_id = any (v_deals) and m.commitment_id is null and (m.result is not null or m.scheduled_at <= now())
    ),
    'budgets', (
      select count(*) from public.budgets b
      where b.company_id = p_company_id or b.deal_id = any (v_deals) or b.project_id = any (v_projects)
    ),
    'goal_contributions', (
      select count(*) from public.goal_entries ge where ge.deal_id = any (v_deals)
    ) + (
      select count(*) from public.goal_contract_payouts gp where gp.deal_id = any (v_deals)
    ),
    'receivables_open', (
      select count(*) from public.receivables x where x.company_id = p_company_id and x.cancelled_at is null and x.received_at is null
    ),
    'receivables_paid', (
      select count(*) from public.receivables x where x.company_id = p_company_id and x.cancelled_at is null and x.received_at is not null
    ),
    'receivables_cancelled', (
      select count(*) from public.receivables x where x.company_id = p_company_id and x.cancelled_at is not null
    ),
    'payables_open', (
      select count(*) from public.payables pa
      where (pa.company_id = p_company_id or pa.project_id = any (v_projects)) and pa.cancelled_at is null and pa.paid_at is null
    ),
    'payables_paid', (
      select count(*) from public.payables pa
      where (pa.company_id = p_company_id or pa.project_id = any (v_projects)) and pa.cancelled_at is null and pa.paid_at is not null
    ),
    'payables_cancelled', (
      select count(*) from public.payables pa
      where (pa.company_id = p_company_id or pa.project_id = any (v_projects)) and pa.cancelled_at is not null
    ),
    'contacts', (select count(*) from public.contacts ct where ct.company_id = p_company_id)
  ) into v_counts;
  return v_counts || public.client_deletion_flags(v_counts);
end;
$$;

revoke all on function public.client_deletion_counts(uuid) from public, anon, authenticated;

create function public.client_require_master()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_master() then
    raise exception 'Só a conta master exclui, restaura ou anonimiza clientes.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.client_require_master() from public, anon, authenticated;

-- Prévia para a janela "Excluir cliente": contagens + reuniões futuras (para escolher cancelar).
create function public.client_deletion_summary(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_deals uuid[];
  v_projects uuid[];
begin
  perform public.client_require_master();
  if not exists (select 1 from public.companies c where c.id = p_company_id) then
    raise exception 'Cliente não encontrado.' using errcode = '22023';
  end if;
  v_deals := array(select d.id from public.deals d where d.company_id = p_company_id);
  v_projects := array(select pr.id from public.projects pr where pr.company_id = p_company_id);
  return public.client_deletion_counts(p_company_id) || jsonb_build_object(
    'meetings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cm.id, 'title', cm.title, 'starts_at', cm.starts_at, 'owner', o.full_name,
        'on_google', cm.google_event_id is not null
      ) order by cm.starts_at)
      from public.commitments cm
      left join public.profiles o on o.id = cm.owner_id
      where cm.status = 'agendado' and cm.starts_at > now()
        and (cm.company_id = p_company_id or cm.deal_id = any (v_deals) or cm.project_id = any (v_projects))
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.client_deletion_summary(uuid) from public, anon;
grant execute on function public.client_deletion_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Excluir: sem histórico → apaga de vez; com histórico → Lixeira
-- ---------------------------------------------------------------------------

create function public.client_delete(
  p_company_id uuid,
  p_confirm_name text,
  p_reason text default null,
  p_cancel_commitment_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.companies;
  v_counts jsonb;
  v_deals uuid[];
  v_projects uuid[];
  v_open_projects uuid[];
  v_prev_system text := current_setting('app.pauta_system', true);
  v_label text := 'Encerrado — cliente excluído';
  v_stamp text := to_char((now() at time zone 'America/Fortaleza')::date, 'DD/MM/YYYY');
  v_sync uuid[] := '{}';
  v_cancelled int := 0;
  v_pautas int := 0;
  v_recipient uuid;
  r record;
begin
  perform public.client_require_master();
  if length(btrim(coalesce(p_reason, ''))) > 300 then
    raise exception 'O motivo pode ter no máximo 300 letras.' using errcode = '23514';
  end if;

  select * into c from public.companies where id = p_company_id for update;
  if not found then
    raise exception 'Cliente não encontrado.' using errcode = '22023';
  end if;
  if c.deleted_at is not null then
    raise exception 'Este cliente já está na Lixeira.' using errcode = '23514';
  end if;

  v_counts := public.client_deletion_counts(p_company_id);

  -- Sem nenhum histórico: apaga de vez (contatos saem junto).
  if not (v_counts ->> 'has_dependencies')::boolean then
    if not public.client_name_matches(p_confirm_name, c.name) then
      raise exception 'Digite o nome exato do cliente para confirmar.' using errcode = '23514';
    end if;
    insert into public.client_deletion_log (company_id, action, actor_id, summary)
    values (p_company_id, 'excluido_permanentemente', auth.uid(), v_counts);
    delete from public.companies where id = p_company_id;
    return jsonb_build_object('mode', 'permanent', 'sync_profiles', '[]'::jsonb);
  end if;

  v_deals := array(select d.id from public.deals d where d.company_id = p_company_id);
  v_projects := array(select pr.id from public.projects pr where pr.company_id = p_company_id);
  v_open_projects := array(select public.closure_target_projects(p_company_id, null));

  update public.companies
  set deleted_at = now(), deleted_by = auth.uid(), delete_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where id = p_company_id;

  -- Reuniões futuras que a pessoa escolheu cancelar (a sincronização tira do Google).
  for r in
    update public.commitments cm set status = 'cancelado'
    where cm.id = any (coalesce(p_cancel_commitment_ids, '{}'))
      and cm.status = 'agendado' and cm.starts_at > now()
      and (cm.company_id = p_company_id or cm.deal_id = any (v_deals) or cm.project_id = any (v_projects))
    returning cm.owner_id, cm.attendees
  loop
    v_sync := v_sync || r.owner_id || r.attendees;
    v_cancelled := v_cancelled + 1;
  end loop;

  -- Negócios arquivados (somem do CRM e do "Chamar hoje"; a cadência para; a pauta do negócio acompanha).
  update public.deals set archived_at = now(), hidden_by_client_deletion = true
  where company_id = p_company_id and archived_at is null;

  -- Projetos em aberto → encerrados; todos os projetos do cliente saem das listas.
  update public.projects set stage = 'encerrado', closed_at = now() where id = any (v_open_projects);
  update public.projects set hidden_by_client_deletion = true where id = any (v_projects);
  update public.project_invoice_schedules set active = false where project_id = any (v_projects) and active;

  -- Pautas abertas → finalizadas e marcadas; responsáveis avisados. Depois todas saem dos quadros.
  perform set_config('app.pauta_system', 'true', true);
  for r in
    select pt.id, pt.title, pt.lead_id, pt.current_assignee_id
    from public.pautas pt
    where pt.archived_at is null and pt.status <> 'aprovado' and pt.source = 'manual' and not pt.is_standalone
      and (pt.project_id = any (v_projects) or (pt.project_id is null and pt.direct_company_id = p_company_id))
  loop
    update public.pautas set status = 'aprovado', closure_label = v_label where id = r.id;
    insert into public.pauta_logs (pauta_id, author_id, kind, body)
    values (r.id, auth.uid(), 'registro', v_label || ' em ' || v_stamp || '.');
    foreach v_recipient in array array[r.current_assignee_id, r.lead_id] loop
      if v_recipient is not null and v_recipient is distinct from auth.uid() then
        perform public.notify(v_recipient, 'pauta_closed', 'Pauta encerrada: não siga com ela',
          r.title || ' · ' || v_label, 'pauta', r.id, '/minhas-pautas?pauta=' || r.id);
      end if;
      exit when r.current_assignee_id is not distinct from r.lead_id;
    end loop;
    v_pautas := v_pautas + 1;
  end loop;
  update public.pautas pt set archived_at = now(), hidden_by_client_deletion = true
  where pt.archived_at is null and pt.source = 'manual' and not pt.is_standalone
    and (pt.project_id = any (v_projects) or (pt.project_id is null and pt.direct_company_id = p_company_id));
  perform set_config('app.pauta_system', coalesce(v_prev_system, ''), true);

  -- "Cliente da casa" que ainda não virou negócio: cancelado.
  update public.prospect_house_entries set cancelled_at = now()
  where company_id = p_company_id and deal_id is null and cancelled_at is null;

  insert into public.client_deletion_log (company_id, action, actor_id, summary)
  values (p_company_id, 'excluido', auth.uid(),
    v_counts || jsonb_build_object('meetings_cancelled', v_cancelled, 'pautas_finalized', v_pautas, 'projects_closed', cardinality(v_open_projects)));

  return jsonb_build_object(
    'mode', 'trash',
    'sync_profiles', to_jsonb(array(select distinct x from unnest(v_sync) x where x is not null))
  );
end;
$$;

revoke all on function public.client_delete(uuid, text, text, uuid[]) from public, anon;
grant execute on function public.client_delete(uuid, text, text, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Lixeira: listar, restaurar, excluir definitivamente, anonimizar
-- ---------------------------------------------------------------------------

create function public.client_trash_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.client_require_master();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name, 'logo_url', c.logo_url, 'deleted_at', c.deleted_at,
      'deleted_by', p.full_name, 'reason', c.delete_reason, 'anonymized_at', c.anonymized_at,
      'counts', public.client_deletion_counts(c.id)
    ) order by c.deleted_at desc)
    from public.companies c
    left join public.profiles p on p.id = c.deleted_by
    where c.deleted_at is not null
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.client_trash_list() from public, anon;
grant execute on function public.client_trash_list() to authenticated;

create function public.client_trashed(p_company_id uuid)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.companies;
begin
  perform public.client_require_master();
  select * into c from public.companies where id = p_company_id for update;
  if not found then
    raise exception 'Cliente não encontrado.' using errcode = '22023';
  end if;
  if c.deleted_at is null then
    raise exception 'Este cliente não está na Lixeira.' using errcode = '23514';
  end if;
  return c;
end;
$$;

revoke all on function public.client_trashed(uuid) from public, anon, authenticated;

-- Restaurar: o cliente e os negócios voltam; projetos e pautas continuam finalizados (reativar à mão).
create function public.client_restore(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.companies := public.client_trashed(p_company_id);
  v_prev_system text := current_setting('app.pauta_system', true);
begin
  if c.anonymized_at is not null then
    raise exception 'Cliente anonimizado não pode ser restaurado.' using errcode = '23514';
  end if;

  update public.companies set deleted_at = null, deleted_by = null, delete_reason = null where id = p_company_id;
  update public.deals set archived_at = null, hidden_by_client_deletion = false
  where company_id = p_company_id and hidden_by_client_deletion;
  update public.projects set hidden_by_client_deletion = false where company_id = p_company_id and hidden_by_client_deletion;

  perform set_config('app.pauta_system', 'true', true);
  update public.pautas pt set archived_at = null, hidden_by_client_deletion = false
  where pt.hidden_by_client_deletion
    and (pt.direct_company_id = p_company_id or pt.project_id in (select pr.id from public.projects pr where pr.company_id = p_company_id));
  perform set_config('app.pauta_system', coalesce(v_prev_system, ''), true);

  insert into public.client_deletion_log (company_id, action, actor_id, summary)
  values (p_company_id, 'restaurado', auth.uid(), public.client_deletion_counts(p_company_id));
end;
$$;

revoke all on function public.client_restore(uuid) from public, anon;
grant execute on function public.client_restore(uuid) to authenticated;

-- Excluir definitivamente: só sem lançamentos financeiros e sem contar em metas.
create function public.client_purge(p_company_id uuid, p_confirm_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.companies := public.client_trashed(p_company_id);
  v_counts jsonb := public.client_deletion_counts(p_company_id);
  v_deals uuid[] := array(select d.id from public.deals d where d.company_id = p_company_id);
  v_projects uuid[] := array(select pr.id from public.projects pr where pr.company_id = p_company_id);
  v_finance int;
begin
  v_finance := (v_counts ->> 'receivables_open')::int + (v_counts ->> 'receivables_paid')::int + (v_counts ->> 'receivables_cancelled')::int
    + (v_counts ->> 'payables_open')::int + (v_counts ->> 'payables_paid')::int + (v_counts ->> 'payables_cancelled')::int;
  if v_finance > 0 then
    raise exception 'Este cliente tem lançamentos financeiros e não pode ser apagado definitivamente.' using errcode = '23514';
  end if;
  if (v_counts ->> 'goal_contributions')::int > 0 then
    raise exception 'Este cliente conta em metas da equipe e não pode ser apagado definitivamente.' using errcode = '23514';
  end if;
  if not public.client_name_matches(p_confirm_name, c.name) then
    raise exception 'Digite o nome exato do cliente para confirmar.' using errcode = '23514';
  end if;

  insert into public.client_deletion_log (company_id, action, actor_id, summary)
  values (p_company_id, 'excluido_definitivamente', auth.uid(), v_counts);

  perform set_config('app.pauta_system', 'true', true);
  perform set_config('alem.client_erasure', 'on', true);
  delete from public.pautas where deal_id = any (v_deals) or direct_company_id = p_company_id;
  delete from public.commitments where company_id = p_company_id or project_id = any (v_projects);
  delete from public.budgets where company_id = p_company_id or deal_id = any (v_deals) or project_id = any (v_projects);
  delete from public.projects where id = any (v_projects);
  delete from public.deals where id = any (v_deals);
  delete from public.companies where id = p_company_id;
  perform set_config('alem.client_erasure', 'off', true);
  perform set_config('app.pauta_system', '', true);
end;
$$;

revoke all on function public.client_purge(uuid, text) from public, anon;
grant execute on function public.client_purge(uuid, text) to authenticated;

-- Anonimizar (LGPD): "Removido" nos dados pessoais; valores, datas e categorias ficam. Sem volta.
create function public.client_anonymize(p_company_id uuid, p_confirm text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.companies := public.client_trashed(p_company_id);
  v_deals uuid[] := array(select d.id from public.deals d where d.company_id = p_company_id);
  v_projects uuid[] := array(select pr.id from public.projects pr where pr.company_id = p_company_id);
  v_gone constant text := 'Removido';
begin
  if c.anonymized_at is not null then
    raise exception 'Este cliente já foi anonimizado.' using errcode = '23514';
  end if;
  if coalesce(p_confirm, '') <> 'ANONIMIZAR' then
    raise exception 'Digite ANONIMIZAR para confirmar.' using errcode = '23514';
  end if;

  perform set_config('alem.client_erasure', 'on', true);

  update public.companies
  set name = v_gone, document = null, website = null, instagram = null, logo_url = null,
      health_note = null, source_detail = null, delete_reason = null, anonymized_at = now()
  where id = p_company_id;

  update public.contacts set full_name = v_gone, job_title = null, email = null, phone = null where company_id = p_company_id;

  update public.deals
  set title = v_gone,
      prospect_hook = case when prospect_hook is null then null else v_gone end,
      prospect_decision_maker_name = case when prospect_decision_maker_name is null then null else v_gone end,
      prospect_decision_maker_role = null,
      prospect_decision_maker_whatsapp = null,
      lost_note = case when lost_note is null then null else v_gone end,
      next_action = case when next_action is null then null else v_gone end,
      direction_note = case when direction_note is null then null else v_gone end,
      prospect_pause_reason = case when prospect_pause_reason is null then null else v_gone end,
      prospect_discard_reason = case when prospect_discard_reason is null then null else v_gone end
  where id = any (v_deals);

  update public.deal_interactions
  set body = v_gone,
      approach = case when approach is null then null else v_gone end,
      summary = case when summary is null then null else v_gone end,
      next_step = case when next_step is null then null else v_gone end
  where deal_id = any (v_deals);
  update public.deal_interaction_history
  set changes = (select coalesce(jsonb_object_agg(k, jsonb_build_object('before', v_gone, 'after', v_gone)), '{}'::jsonb) from jsonb_object_keys(changes) k),
      reason = case when reason is null then null else v_gone end
  where deal_id = any (v_deals);
  update public.deal_notes set body = v_gone where deal_id = any (v_deals);
  update public.deal_activities set body = v_gone where deal_id = any (v_deals);
  update public.deal_negotiations set notes = v_gone where deal_id = any (v_deals);
  update public.deal_qualification
  set budget_range = null, project_type = null, desired_timeline = null, pain_point = null, notes = null
  where deal_id = any (v_deals);
  update public.deal_meetings set location_or_link = null, result_note = null where deal_id = any (v_deals);
  update public.deal_proposals set scope_notes = null, document_url = null where deal_id = any (v_deals);
  update public.prospect_touch_logs set rendered_text = v_gone where deal_id = any (v_deals);
  update public.prospect_pending_sends set body = v_gone, recipient = v_gone where deal_id = any (v_deals);
  delete from public.prospect_undo_ops where deal_id = any (v_deals);

  update public.client_closures
  set description = v_gone, notes = null, pending_receivables_note = null, pending_payables_note = null
  where company_id = p_company_id;

  update public.commitments
  set title = v_gone, notes = null, location_or_link = null, meet_link = null, external_attendees = '[]'::jsonb
  where company_id = p_company_id or deal_id = any (v_deals) or project_id = any (v_projects);

  update public.budgets set client_name = v_gone, notes = null
  where company_id = p_company_id or deal_id = any (v_deals) or project_id = any (v_projects);

  -- Financeiro: só as observações (valores, datas e categorias ficam); o histórico de edição também.
  update public.receivables set notes = null where company_id = p_company_id and notes is not null;
  update public.payables set notes = null
  where (company_id = p_company_id or project_id = any (v_projects)) and notes is not null;
  update public.financial_entry_history h
  set changes = jsonb_set(h.changes, '{notes}', jsonb_build_object('before', v_gone, 'after', v_gone))
  where h.changes ? 'notes'
    and (
      (h.entry_type = 'receivable' and h.entry_id in (select x.id from public.receivables x where x.company_id = p_company_id))
      or (h.entry_type = 'payable' and h.entry_id in (
        select pa.id from public.payables pa where pa.company_id = p_company_id or pa.project_id = any (v_projects)
      ))
    );

  perform set_config('alem.client_erasure', 'off', true);

  insert into public.client_deletion_log (company_id, action, actor_id, summary)
  values (p_company_id, 'anonimizado', auth.uid(), public.client_deletion_counts(p_company_id));
end;
$$;

revoke all on function public.client_anonymize(uuid, text) from public, anon;
grant execute on function public.client_anonymize(uuid, text) to authenticated;

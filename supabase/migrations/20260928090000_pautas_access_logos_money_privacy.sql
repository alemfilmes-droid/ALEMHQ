-- Pautas (criação por gestão, exclusão pelo criador, squad escolhido), logos (bucket corrigido e 5 MB)
-- e bloqueio de valores do CRM para quem não tem acesso ao financeiro.

-- ===========================================================================
-- 1. PAUTAS
-- ===========================================================================

-- Quem criou a pauta passa a enxergá-la e (se gerencia pautas) a editá-la — um head de outro squad
-- que cria uma pauta de projeto precisa continuar vendo o que criou.
create or replace function public.can_view_pauta(p_pauta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (
      public.can_manage_pautas()
      and 'audiovisual' = any(public.managed_squads())
      and exists (select 1 from public.pautas p where p.id = p_pauta_id and not p.is_standalone)
    )
    or exists (
      select 1 from public.pautas p
      where p.id = p_pauta_id
        and (
          p.lead_id = auth.uid()
          or p.current_assignee_id = auth.uid()
          or p.previous_assignee_id = auth.uid()
          or p.created_by = auth.uid()
        )
    )
    or exists (select 1 from public.pauta_members pm where pm.pauta_id = p_pauta_id and pm.profile_id = auth.uid())
    or exists (
      select 1
      from public.pautas p
      join public.project_members prm on prm.project_id = p.project_id
      where p.id = p_pauta_id and prm.profile_id = auth.uid()
    )
$$;

create or replace function public.can_edit_pauta(p_pauta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.can_fully_manage_pauta()
    or exists (
      select 1 from public.pautas p
      where p.id = p_pauta_id
        and (
          p.lead_id = auth.uid()
          or p.current_assignee_id = auth.uid()
          or (p.created_by = auth.uid() and public.can_manage_pautas())
        )
    )
    or exists (select 1 from public.pauta_members pm where pm.pauta_id = p_pauta_id and pm.profile_id = auth.uid())
$$;

-- Criar: pauta de PROJETO só quem gerencia pautas (master, diretoria, head) — can_manage_pautas() —
-- e sempre em nome próprio (created_by). Tarefa interna (is_standalone): qualquer pessoa, só para si.
-- As pautas criadas pelo CRM passam por funções SECURITY DEFINER e não dependem desta policy.
drop policy if exists "pautas_insert" on public.pautas;
create policy "pautas_insert" on public.pautas for insert to authenticated
  with check (
    (not is_standalone and public.can_manage_pautas() and created_by = auth.uid())
    or (is_standalone and created_for = auth.uid() and lead_id = auth.uid() and current_assignee_id = auth.uid())
  );

-- Apagar: SÓ quem criou a pauta — nem a diretoria apaga a pauta de outra pessoa (arquiva).
-- Membros, comentários e histórico saem em cascata (FKs on delete cascade).
drop policy if exists "pautas_delete_creator" on public.pautas;
create policy "pautas_delete_creator" on public.pautas for delete to authenticated
  using (created_by = auth.uid() and public.is_active_user());

-- Responsáveis: gestão plena, ou quem gerencia pautas e criou esta pauta.
drop policy if exists "pauta_members_write" on public.pauta_members;
create policy "pauta_members_write" on public.pauta_members for all to authenticated
  using (
    public.can_fully_manage_pauta()
    or (public.can_manage_pautas() and exists (select 1 from public.pautas p where p.id = pauta_id and p.created_by = auth.uid()))
  )
  with check (
    public.can_fully_manage_pauta()
    or (public.can_manage_pautas() and exists (select 1 from public.pautas p where p.id = pauta_id and p.created_by = auth.uid()))
  );

-- Edição de campos de gestão: gestão plena, dono de tarefa avulsa, ou quem criou a pauta de projeto
-- (e gerencia pautas).
create or replace function public.pautas_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.can_fully_manage_pauta() then
    return new;
  end if;

  if new.is_standalone and new.created_for = auth.uid() then
    return new;
  end if;

  if old.created_by = auth.uid() and public.can_manage_pautas() then
    return new;
  end if;

  if new.title is distinct from old.title
     or new.lead_id is distinct from old.lead_id
     or new.priority is distinct from old.priority
     or new.is_critical is distinct from old.is_critical
     or new.project_id is distinct from old.project_id
     or new.contact_id is distinct from old.contact_id then
    raise exception 'Você só pode alterar o status e os campos operacionais desta pauta.' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Squad: pauta de projeto agora guarda o squad escolhido na criação (quem cria já passou pela
-- policy de gestão); sem escolha, o padrão de sempre. Tarefa do CRM é sempre comercial; tarefa
-- interna só num squad da própria pessoa.
create or replace function public.pautas_set_squad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_default public.squad := public.pauta_default_squad(new.is_standalone, new.deal_id, coalesce(new.created_for, new.lead_id));
begin
  if new.squad is null or new.deal_id is not null then
    new.squad := v_default;
    return new;
  end if;

  if not new.is_standalone then
    return new;
  end if;

  if new.squad <> v_default and not exists (
    select 1 from public.profile_squads ps
    where ps.profile_id = coalesce(new.created_for, new.lead_id) and ps.squad = new.squad
  ) then
    raise exception 'Escolha um dos seus squads para esta tarefa.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.pautas_guard_squad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.squad is distinct from old.squad
     and auth.uid() is not null
     and not (
       public.can_fully_manage_pauta()
       or public.is_director()
       or (old.is_standalone and old.created_for = auth.uid())
       or (old.created_by = auth.uid() and public.can_manage_pautas())
     ) then
    raise exception 'Uma pauta não muda de squad pelo quadro.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Exclusão registrada no log de atividades (quem, o quê, de qual projeto).
create or replace function public.pautas_log_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.log_activity(
    'deleted', 'pauta', old.id,
    jsonb_build_object('title', old.title, 'code', old.code, 'project_id', old.project_id, 'is_standalone', old.is_standalone)
  );
  return old;
end;
$$;

drop trigger if exists pautas_log_delete on public.pautas;
create trigger pautas_log_delete
  after delete on public.pautas
  for each row execute function public.pautas_log_delete();

-- ===========================================================================
-- 2. LOGOS E AVATARES
-- ===========================================================================

-- O bug do "Não foi possível enviar o logo": nas policies abaixo, a subconsulta em companies usava
-- `storage.foldername(name)` sem qualificar — e dentro dela `name` é companies.name (o nome do
-- cliente), não o caminho do arquivo. A condição nunca era verdadeira e todo upload era recusado.
create or replace function public.is_company_logo_path(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    storage.filename(p_object_name) ~ '^logo\.(jpg|jpeg|png|webp)$'
    and exists (
      select 1 from public.companies c
      where c.id::text = (storage.foldername(p_object_name))[1]
    )
$$;

revoke all on function public.is_company_logo_path(text) from public, anon;
grant execute on function public.is_company_logo_path(text) to authenticated;

drop policy if exists "company_logos_insert_managers" on storage.objects;
create policy "company_logos_insert_managers"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'company-logos'
    and public.can_manage_company_logos()
    and public.is_company_logo_path(storage.objects.name)
  );

drop policy if exists "company_logos_update_managers" on storage.objects;
create policy "company_logos_update_managers"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'company-logos' and public.can_manage_company_logos())
  with check (
    bucket_id = 'company-logos'
    and public.can_manage_company_logos()
    and public.is_company_logo_path(storage.objects.name)
  );

-- 5 MB para logos e fotos (antes 2 MB).
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id in ('company-logos', 'avatars');

-- ===========================================================================
-- 3. VALORES DO CRM: SÓ PARA QUEM TEM ACESSO AO FINANCEIRO
-- ===========================================================================
-- Regra: quem não tem has_finance_access() (squad diretoria/financeiro, ou a concessão manual) não
-- RECEBE valor nenhum — nem mascarado. Isso vale no banco, independentemente da UI:
-- - SELECT por coluna: as colunas de valor de deals, deal_proposals e deal_negotiations deixam de
--   ser legíveis pelo papel `authenticated`. Escrever continua permitido (o SDR registra a proposta).
-- - Leitura de valores só por funções SECURITY DEFINER que conferem has_finance_access().

revoke select on public.deals from authenticated, anon;
grant select (
  archived_at, code, company_id, created_at, created_by, direction_note, direction_task, expected_close_date,
  fast_track, id, is_reheated, lost_at, lost_note, lost_reason, next_action, next_action_at, owner_id,
  primary_contact_id, prospection_goals, reheat_due_at, reheat_status, responsible_id, source, stage,
  stage_changed_at, title, updated_at, won_at
) on public.deals to authenticated;

revoke select on public.deal_proposals from authenticated, anon;
grant select (created_at, deal_id, document_url, id, scope_notes, sent_at, sent_by, sent_channel, status)
  on public.deal_proposals to authenticated;

revoke select on public.deal_negotiations from authenticated, anon;
grant select (channel, created_at, created_by, deal_id, id, notes, proposal_id)
  on public.deal_negotiations to authenticated;

-- Valores de um negócio (valor estimado, última proposta, comissão). Sem acesso ao financeiro — ou
-- sem acesso ao negócio — tudo nulo.
create or replace function public.deal_money(p_deal_id uuid)
returns table (estimated_value numeric, latest_proposal_amount numeric, commission_percent numeric, commission_amount numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.estimated_value,
    lp.amount,
    public.crm_commission_percent(d.is_reheated),
    case when d.estimated_value is not null
      then round(d.estimated_value * public.crm_commission_percent(d.is_reheated) / 100, 2) end
  from public.deals d
  left join lateral (
    select p.amount from public.deal_proposals p
    where p.deal_id = d.id
    order by p.sent_at desc, p.created_at desc
    limit 1
  ) lp on true
  where d.id = p_deal_id
    and public.has_finance_access()
    and public.can_access_deal(d.id)
$$;

revoke all on function public.deal_money(uuid) from public, anon;
grant execute on function public.deal_money(uuid) to authenticated;

-- Propostas e negociações de um negócio, com valores só para quem tem acesso ao financeiro.
create or replace function public.deal_proposals_list(p_deal_id uuid)
returns table (
  id uuid, deal_id uuid, amount numeric, sent_channel public.proposal_channel, document_url text,
  scope_notes text, sent_at timestamptz, sent_by uuid, status public.proposal_status, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.deal_id,
    case when public.has_finance_access() then p.amount end,
    p.sent_channel, p.document_url, p.scope_notes, p.sent_at, p.sent_by, p.status, p.created_at
  from public.deal_proposals p
  where p.deal_id = p_deal_id and public.can_access_deal(p_deal_id)
  order by p.sent_at desc
$$;

create or replace function public.deal_negotiations_list(p_deal_id uuid)
returns table (
  id uuid, deal_id uuid, proposal_id uuid, client_counter_amount numeric, our_counter_amount numeric,
  agreed_amount numeric, channel public.deal_interaction_channel, notes text, created_by uuid, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    n.id, n.deal_id, n.proposal_id,
    case when public.has_finance_access() then n.client_counter_amount end,
    case when public.has_finance_access() then n.our_counter_amount end,
    case when public.has_finance_access() then n.agreed_amount end,
    n.channel, n.notes, n.created_by, n.created_at
  from public.deal_negotiations n
  where n.deal_id = p_deal_id and public.can_access_deal(p_deal_id)
  order by n.created_at desc
$$;

revoke all on function public.deal_proposals_list(uuid) from public, anon;
revoke all on function public.deal_negotiations_list(uuid) from public, anon;
grant execute on function public.deal_proposals_list(uuid) to authenticated;
grant execute on function public.deal_negotiations_list(uuid) to authenticated;

-- Views do funil sem `d.*` (que expandiria para a coluna de valor): colunas explícitas e valores
-- vindos de deal_money(). Continuam security_invoker — a RLS de deals decide as linhas.
drop view if exists public.deals_needing_attention;
drop view if exists public.deals_with_details;

create view public.deals_with_details
with (security_invoker = true) as
select
  d.id,
  d.code,
  d.company_id,
  d.primary_contact_id,
  d.title,
  d.owner_id,
  d.responsible_id,
  d.stage,
  d.stage_changed_at,
  d.prospection_goals,
  m.estimated_value,
  d.expected_close_date,
  d.source,
  d.next_action,
  d.next_action_at,
  d.fast_track,
  d.is_reheated,
  d.reheat_status,
  d.reheat_due_at,
  d.direction_task,
  d.direction_note,
  d.lost_reason,
  d.lost_note,
  d.lost_at,
  d.won_at,
  d.archived_at,
  d.created_by,
  d.created_at,
  d.updated_at,
  c.name as company_name,
  c.lifecycle as company_lifecycle,
  ct.full_name as primary_contact_name,
  owner.full_name as owner_name,
  owner.avatar_url as owner_avatar_url,
  resp.full_name as responsible_name,
  resp.avatar_url as responsible_avatar_url,
  (select count(*)::int from public.deal_interactions i where i.deal_id = d.id) as interactions_count,
  s.last_interaction_at,
  public.crm_deal_qualified(d.id) as is_qualified,
  greatest(0, extract(day from now() - d.stage_changed_at))::int as days_in_stage,
  exists (select 1 from public.deal_meetings mt where mt.deal_id = d.id and mt.result is null) as has_pending_meeting,
  (
    select mt.id from public.deal_meetings mt where mt.deal_id = d.id and mt.result is null order by mt.scheduled_at limit 1
  ) as pending_meeting_id,
  m.latest_proposal_amount,
  lp.status as latest_proposal_status,
  lp.sent_at as latest_proposal_sent_at,
  m.commission_percent,
  m.commission_amount,
  (
    d.responsible_id = d.owner_id
    and d.stage in ('reuniao_agendada', 'reuniao_realizada')
    and exists (
      select 1 from public.deal_meetings mt
      where mt.deal_id = d.id
        and mt.result in ('follow_up_sdr', 'sem_interesse', 'nao_compareceu')
        and mt.result_registered_at > now() - interval '7 days'
    )
  ) as returned_from_meeting,
  s.hours_since_last_interaction,
  s.hours_in_current_stage,
  s.next_action_overdue,
  s.next_action_today,
  s.stale_prospection,
  s.needs_update,
  s.reheat_ready,
  s.can_reheat,
  s.temperature,
  s.temperature_reason,
  c.logo_url as company_logo_url
from public.deals d
join public.companies c on c.id = d.company_id
left join public.contacts ct on ct.id = d.primary_contact_id
join public.profiles owner on owner.id = d.owner_id
left join public.profiles resp on resp.id = d.responsible_id
left join public.deals_sla s on s.deal_id = d.id
left join lateral (
  select p.status, p.sent_at
  from public.deal_proposals p
  where p.deal_id = d.id
  order by p.sent_at desc, p.created_at desc
  limit 1
) lp on true
left join lateral public.deal_money(d.id) m on true
where d.archived_at is null;

revoke all on public.deals_with_details from anon;
grant select on public.deals_with_details to authenticated;

create view public.deals_needing_attention
with (security_invoker = true) as
select d.*
from public.deals_with_details d
where (d.stage not in ('ganho', 'perdido') and d.temperature <> 'neutral') or d.can_reheat;

revoke all on public.deals_needing_attention from anon;
grant select on public.deals_needing_attention to authenticated;

-- Interações: o registro da proposta gravava "Proposta de R$ X enviada." no texto, que qualquer
-- pessoa com acesso ao negócio lê. O valor sai do texto (fica só em deal_proposals.amount).
create or replace function public.deal_interactions_strip_money()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body is not null then
    new.body := regexp_replace(new.body, '^Proposta de R\$ ?[0-9.,]+ enviada\.', 'Proposta enviada.');
  end if;
  return new;
end;
$$;

drop trigger if exists deal_interactions_strip_money on public.deal_interactions;
create trigger deal_interactions_strip_money
  before insert or update of body on public.deal_interactions
  for each row execute function public.deal_interactions_strip_money();

update public.deal_interactions
set body = regexp_replace(body, '^Proposta de R\$ ?[0-9.,]+ enviada\.', 'Proposta enviada.')
where body ~ '^Proposta de R\$';

-- Visão geral do cliente: valor em negociação só com acesso ao financeiro; contagens do comercial
-- só sobre os negócios que a pessoa pode ver (SDR/BDR: os próprios).
create or replace function public.company_overview(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_today date := (now() at time zone 'America/Fortaleza')::date;
  v_base jsonb;
  v_last_delivered jsonb;
  v_next_delivery jsonb;
  v_crm jsonb;
  v_pautas_open int;
  v_money boolean := public.has_finance_access();
begin
  if not public.can_read_companies() then
    return null;
  end if;
  select * into v_company from public.companies where id = p_company_id;
  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'projects_total', count(*),
    'projects_active', count(*) filter (where pr.stage not in ('entregue', 'cancelado')),
    'projects_delivered', count(*) filter (where pr.stage = 'entregue'),
    'projects_cancelled', count(*) filter (where pr.stage = 'cancelado')
  )
  into v_base
  from public.projects pr
  where pr.company_id = p_company_id and not pr.is_internal;

  select jsonb_build_object('at', pr.delivered_at, 'project_id', pr.id, 'name', pr.name)
  into v_last_delivered
  from public.projects pr
  where pr.company_id = p_company_id and pr.stage = 'entregue' and pr.delivered_at is not null
  order by pr.delivered_at desc
  limit 1;

  select jsonb_build_object('date', x.due_date, 'label', x.label, 'project_id', x.project_id)
  into v_next_delivery
  from (
    select pr.due_date, pr.name as label, pr.id as project_id
    from public.projects pr
    where pr.company_id = p_company_id and pr.stage not in ('entregue', 'cancelado', 'pausado') and pr.due_date >= v_today
    union all
    select pt.due_date, pt.title, pt.project_id
    from public.pautas pt
    join public.projects pr on pr.id = pt.project_id
    where pr.company_id = p_company_id and pt.archived_at is null and pt.board_column <> 'entregue' and pt.due_date >= v_today
  ) x
  order by x.due_date
  limit 1;

  select count(*)::int
  into v_pautas_open
  from public.pautas pt
  join public.projects pr on pr.id = pt.project_id
  where pr.company_id = p_company_id and pt.archived_at is null and pt.board_column <> 'entregue';

  if public.can_see_crm() then
    select jsonb_build_object(
      'won', count(*) filter (where d.stage = 'ganho'),
      'lost', count(*) filter (where d.stage = 'perdido'),
      'open', count(*) filter (where d.stage not in ('ganho', 'perdido')),
      'negotiation_value', case when v_money
        then coalesce(sum(lp.amount) filter (where d.stage not in ('ganho', 'perdido')), 0) end
    )
    into v_crm
    from public.deals d
    left join lateral (
      select p.amount from public.deal_proposals p
      where p.deal_id = d.id
      order by p.sent_at desc, p.created_at desc
      limit 1
    ) lp on true
    where d.company_id = p_company_id and d.archived_at is null and public.can_access_deal(d.id);

    v_crm := v_crm || coalesce((
      select jsonb_build_object('last_interaction_at', i.occurred_at, 'last_interaction_channel', i.channel)
      from public.deal_interactions i
      join public.deals d on d.id = i.deal_id
      where d.company_id = p_company_id and i.kind <> 'direcionamento' and public.can_access_deal(d.id)
      order by i.occurred_at desc
      limit 1
    ), '{}'::jsonb);
  end if;

  return v_base || jsonb_build_object(
    'pautas_open', v_pautas_open,
    'client_since', v_company.became_client_at,
    'source', v_company.source,
    'last_delivered', v_last_delivered,
    'next_delivery', v_next_delivery,
    'crm', v_crm
  );
end;
$$;

-- Linha do tempo do cliente: o valor do negócio ganho só vai no payload para quem tem acesso ao
-- financeiro; negócios só os que a pessoa pode ver.
create or replace function public.company_timeline(p_company_id uuid, p_limit int default 20)
returns table (event_at timestamptz, kind text, label text, ref_id uuid, meta jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select e.event_at, e.kind, e.label, e.ref_id, e.meta
  from (
    select c.created_at as event_at, 'cadastro'::text as kind, c.name as label, null::uuid as ref_id, '{}'::jsonb as meta
    from public.companies c
    where c.id = p_company_id

    union all
    select c.became_client_at, 'virou_cliente', c.name, null, '{}'::jsonb
    from public.companies c
    where c.id = p_company_id and c.became_client_at is not null

    union all
    select pr.created_at, 'projeto_criado', pr.name, pr.id, '{}'::jsonb
    from public.projects pr
    where pr.company_id = p_company_id

    union all
    select pr.delivered_at, 'projeto_entregue', pr.name, pr.id, '{}'::jsonb
    from public.projects pr
    where pr.company_id = p_company_id and pr.delivered_at is not null

    union all
    select d.won_at, 'negocio_ganho', d.title, d.id,
      case when public.has_finance_access() then jsonb_build_object('value', d.estimated_value) else '{}'::jsonb end
    from public.deals d
    where d.company_id = p_company_id and d.won_at is not null and public.can_see_crm() and public.can_access_deal(d.id)

    union all
    select d.lost_at, 'negocio_perdido', d.title, d.id, jsonb_build_object('reason', d.lost_reason)
    from public.deals d
    where d.company_id = p_company_id and d.lost_at is not null and public.can_see_crm() and public.can_access_deal(d.id)

    union all
    select a.created_at, 'saude', null, null, a.metadata
    from public.activity_log a
    where a.entity_type = 'company' and a.entity_id = p_company_id and a.action = 'health_changed'
  ) e
  where public.can_read_companies() and e.event_at is not null
  order by e.event_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 200)
$$;

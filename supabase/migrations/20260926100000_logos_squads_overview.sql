-- Logos de clientes, squad de origem das pautas, data de entrega do projeto e visão geral do cliente.
-- A agenda (commitments) está em 20260926100100_agenda.sql.

-- ---------------------------------------------------------------------------
-- Logo do cliente: coluna + bucket público "company-logos" ({company_id}/logo.{ext}, 2 MB)
-- ---------------------------------------------------------------------------

alter table public.companies
  add column logo_url text check (logo_url is null or logo_url ~ '^https?://');

-- Quem troca o logo: diretoria, squad comercial ou admin. Regra própria (a RLS de UPDATE em
-- companies é por papel), por isso a troca passa por set_company_logo() e pelas policies do bucket.
create function public.can_manage_company_logos()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and (public.is_admin() or public.is_director() or public.in_squad('comercial'))
$$;

create function public.set_company_logo(p_company_id uuid, p_logo_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- '' remove o logo (o gerador de tipos marca o argumento como obrigatório).
  p_logo_url := nullif(btrim(coalesce(p_logo_url, '')), '');
  if not public.can_manage_company_logos() then
    raise exception 'Você não tem permissão para alterar o logo deste cliente.' using errcode = '42501';
  end if;
  if p_logo_url is not null and p_logo_url !~ '^https?://' then
    raise exception 'Link de logo inválido.' using errcode = '22023';
  end if;

  update public.companies set logo_url = p_logo_url where id = p_company_id;
  if not found then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;

  perform public.log_activity(
    case when p_logo_url is null then 'logo_removed' else 'logo_changed' end, 'company', p_company_id, '{}'::jsonb
  );
end;
$$;

revoke all on function public.can_manage_company_logos() from public, anon;
revoke all on function public.set_company_logo(uuid, text) from public, anon;
grant execute on function public.can_manage_company_logos() to authenticated;
grant execute on function public.set_company_logo(uuid, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-logos', 'company-logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública pela URL do bucket; estas policies cobrem listagem e escrita.
create policy "company_logos_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'company-logos');

create policy "company_logos_insert_managers"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'company-logos'
    and public.can_manage_company_logos()
    and exists (select 1 from public.companies c where c.id::text = (storage.foldername(name))[1])
    and storage.filename(name) ~ '^logo\.(jpg|jpeg|png|webp)$'
  );

create policy "company_logos_update_managers"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'company-logos' and public.can_manage_company_logos())
  with check (
    bucket_id = 'company-logos'
    and public.can_manage_company_logos()
    and exists (select 1 from public.companies c where c.id::text = (storage.foldername(name))[1])
    and storage.filename(name) ~ '^logo\.(jpg|jpeg|png|webp)$'
  );

create policy "company_logos_delete_managers"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'company-logos' and public.can_manage_company_logos());

-- ---------------------------------------------------------------------------
-- Squad de origem da pauta: pauta de produção = audiovisual; tarefa criada pelo CRM = comercial;
-- tarefa avulsa = um squad da própria pessoa (o escolhido no formulário, ou o principal dela).
-- ---------------------------------------------------------------------------

alter table public.pautas add column squad public.squad;

create function public.pauta_default_squad(p_is_standalone boolean, p_deal_id uuid, p_owner_id uuid)
returns public.squad
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not p_is_standalone then 'audiovisual'::public.squad
    when p_deal_id is not null then 'comercial'::public.squad
    else coalesce(
      (
        select ps.squad
        from public.profile_squads ps
        where ps.profile_id = p_owner_id
        order by (ps.squad = 'diretoria'), ps.is_lead desc, ps.squad
        limit 1
      ),
      'audiovisual'::public.squad
    )
  end
$$;

revoke all on function public.pauta_default_squad(boolean, uuid, uuid) from public, anon;
grant execute on function public.pauta_default_squad(boolean, uuid, uuid) to authenticated;

-- Backfill sem disparar os gatilhos de negócio (histórico, notificações, updated_at).
alter table public.pautas disable trigger user;
update public.pautas
set squad = public.pauta_default_squad(is_standalone, deal_id, coalesce(created_for, lead_id));
alter table public.pautas enable trigger user;

alter table public.pautas alter column squad set not null;
create index pautas_squad_idx on public.pautas (squad);

create function public.pautas_set_squad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_default public.squad := public.pauta_default_squad(new.is_standalone, new.deal_id, coalesce(new.created_for, new.lead_id));
begin
  if new.squad is null or not new.is_standalone or new.deal_id is not null then
    new.squad := v_default;
    return new;
  end if;

  -- Tarefa avulsa: só pode nascer num squad de quem ela é.
  if new.squad <> v_default and not exists (
    select 1 from public.profile_squads ps
    where ps.profile_id = coalesce(new.created_for, new.lead_id) and ps.squad = new.squad
  ) then
    raise exception 'Escolha um dos seus squads para esta tarefa.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger pautas_set_squad
  before insert on public.pautas
  for each row execute function public.pautas_set_squad();

-- Trocar o squad de uma pauta já existente: só gestão plena, diretoria, ou o dono da tarefa avulsa.
-- (Arrastar entre squads no quadro pessoal não é permitido — a UI também avisa.)
create function public.pautas_guard_squad()
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
     ) then
    raise exception 'Uma pauta não muda de squad pelo quadro.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger pautas_guard_squad
  before update of squad on public.pautas
  for each row execute function public.pautas_guard_squad();

-- ---------------------------------------------------------------------------
-- Projeto: data em que foi entregue (carimbada pelo banco ao entrar na etapa "entregue")
-- ---------------------------------------------------------------------------

alter table public.projects add column delivered_at timestamptz;

alter table public.projects disable trigger user;
update public.projects set delivered_at = updated_at where stage = 'entregue';
alter table public.projects enable trigger user;

create function public.projects_stamp_delivery()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stage = 'entregue' then
    if tg_op = 'INSERT' or old.stage is distinct from 'entregue' then
      new.delivered_at := coalesce(new.delivered_at, now());
    end if;
  else
    new.delivered_at := null;
  end if;
  return new;
end;
$$;

create trigger projects_stamp_delivery
  before insert or update of stage on public.projects
  for each row execute function public.projects_stamp_delivery();

-- ---------------------------------------------------------------------------
-- Views: squad e logo nas pautas; logo nos negócios
-- ---------------------------------------------------------------------------

-- Recriada (não CREATE OR REPLACE): public.pautas ganhou "squad", que entra no meio de "pt.*".
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
  creator.full_name as created_for_name,
  c.logo_url as company_logo_url
from public.pautas pt
left join public.projects pr on pr.id = pt.project_id
left join public.companies c on c.id = pr.company_id
join public.profiles lead on lead.id = pt.lead_id
left join public.profiles assignee on assignee.id = pt.current_assignee_id
left join public.profiles creator on creator.id = pt.created_for
left join public.contacts ct on ct.id = pt.contact_id
where pt.archived_at is null;

revoke all on public.pautas_with_details from anon;

-- Mesma definição de 20260925100200_crm_flow_logic.sql, com o logo do cliente no fim da lista
-- (CREATE OR REPLACE aceita novas colunas só no fim; deals_needing_attention não muda).
create or replace view public.deals_with_details
with (security_invoker = true) as
select
  d.*,
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
  exists (select 1 from public.deal_meetings m where m.deal_id = d.id and m.result is null) as has_pending_meeting,
  (
    select m.id from public.deal_meetings m where m.deal_id = d.id and m.result is null order by m.scheduled_at limit 1
  ) as pending_meeting_id,
  lp.amount as latest_proposal_amount,
  lp.status as latest_proposal_status,
  lp.sent_at as latest_proposal_sent_at,
  case when d.owner_id = auth.uid() or public.can_access_all_deals()
    then public.crm_commission_percent(d.is_reheated) end as commission_percent,
  case when (d.owner_id = auth.uid() or public.can_access_all_deals()) and d.estimated_value is not null
    then round(d.estimated_value * public.crm_commission_percent(d.is_reheated) / 100, 2) end as commission_amount,
  (
    d.responsible_id = d.owner_id
    and d.stage in ('reuniao_agendada', 'reuniao_realizada')
    and exists (
      select 1 from public.deal_meetings m
      where m.deal_id = d.id
        and m.result in ('follow_up_sdr', 'sem_interesse', 'nao_compareceu')
        and m.result_registered_at > now() - interval '7 days'
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
  select p.amount, p.status, p.sent_at
  from public.deal_proposals p
  where p.deal_id = d.id
  order by p.sent_at desc, p.created_at desc
  limit 1
) lp on true
where d.archived_at is null;

revoke all on public.deals_with_details from anon;

-- ---------------------------------------------------------------------------
-- Visão geral do cliente: métricas e linha do tempo do relacionamento
-- ---------------------------------------------------------------------------

-- Espelha a capability "crm" de lib/auth/permissions.ts (master/diretoria/head ou squad comercial).
create function public.can_see_crm()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_org_level() in ('master', 'diretoria', 'head'), false) or public.in_squad('comercial')
$$;

revoke all on function public.can_see_crm() from public, anon;
grant execute on function public.can_see_crm() to authenticated;

-- Mesma regra de leitura de companies (equipe interna, freelancer fora).
create function public.can_read_companies()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and coalesce(public.current_access_role() in ('admin', 'coordinator', 'member', 'sdr', 'bdr'), false)
$$;

revoke all on function public.can_read_companies() from public, anon;
grant execute on function public.can_read_companies() to authenticated;

-- Números agregados do cliente (a mesma resposta para todo mundo que pode ver a empresa). O bloco
-- "crm" só vem para quem tem acesso ao CRM; o financeiro é calculado no app pelas queries do
-- financeiro, que já exigem has_finance_access().
create function public.company_overview(p_company_id uuid)
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

  -- Próxima entrega: o prazo mais próximo (hoje em diante) entre projetos e pautas em aberto.
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
      'negotiation_value', coalesce(sum(lp.amount) filter (where d.stage not in ('ganho', 'perdido')), 0)
    )
    into v_crm
    from public.deals d
    left join lateral (
      select p.amount from public.deal_proposals p
      where p.deal_id = d.id
      order by p.sent_at desc, p.created_at desc
      limit 1
    ) lp on true
    where d.company_id = p_company_id and d.archived_at is null;

    v_crm := v_crm || coalesce((
      select jsonb_build_object('last_interaction_at', i.occurred_at, 'last_interaction_channel', i.channel)
      from public.deal_interactions i
      join public.deals d on d.id = i.deal_id
      where d.company_id = p_company_id and i.kind <> 'direcionamento'
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

revoke all on function public.company_overview(uuid) from public, anon;
grant execute on function public.company_overview(uuid) to authenticated;

-- Linha do tempo do relacionamento: eventos-chave do cliente, do mais novo para o mais antigo.
-- Negócios ganhos/perdidos só para quem tem acesso ao CRM.
create function public.company_timeline(p_company_id uuid, p_limit int default 20)
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
    select d.won_at, 'negocio_ganho', d.title, d.id, jsonb_build_object('value', d.estimated_value)
    from public.deals d
    where d.company_id = p_company_id and d.won_at is not null and public.can_see_crm()

    union all
    select d.lost_at, 'negocio_perdido', d.title, d.id, jsonb_build_object('reason', d.lost_reason)
    from public.deals d
    where d.company_id = p_company_id and d.lost_at is not null and public.can_see_crm()

    union all
    select a.created_at, 'saude', null, null, a.metadata
    from public.activity_log a
    where a.entity_type = 'company' and a.entity_id = p_company_id and a.action = 'health_changed'
  ) e
  where public.can_read_companies() and e.event_at is not null
  order by e.event_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 200)
$$;

revoke all on function public.company_timeline(uuid, int) from public, anon;
grant execute on function public.company_timeline(uuid, int) to authenticated;

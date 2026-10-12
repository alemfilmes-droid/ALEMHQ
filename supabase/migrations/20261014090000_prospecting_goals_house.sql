-- Prospecção (Módulo 4B): metas automáticas pelo orçamento aprovado, cliente da casa e prazo de
-- volta (docs/prospeccao/spec.md, 3, 7.3 e 7.5). Só acréscimos; duas funções existentes ganham
-- versões novas (candidatos das metas e pauta antiga de reativação), mantendo o comportamento atual.
--
-- Rollback (só se ainda não houver uso): drop trigger goals_sync_from_budgets on public.budgets;
-- drop trigger goals_sync_from_prospect_goal on public.deals; drop trigger goal_entries_block_manual_on_auto
-- on public.goal_entries; drop trigger projects_prospect_house_entry on public.projects; drop table
-- public.prospect_house_entries; alter table public.deals drop column prospect_origin_deal_id,
-- drop column prospect_house_return_on; alter table public.prospect_playbooks drop column
-- uses_house_client_script; alter table public.prospect_settings drop column house_client_delay_days;
-- recriar goal_crm_candidates e create_reactivation_pautas das migrações 20261004090100 e 20261009090100.

-- ---------------------------------------------------------------------------
-- Configuração
-- ---------------------------------------------------------------------------

alter table public.prospect_settings
  add column house_client_delay_days int not null default 7 check (house_client_delay_days between 0 and 365);

-- Playbooks cujo primeiro toque de cliente da casa é o script "cliente da casa" (spec 4.5 e 4.7).
alter table public.prospect_playbooks add column uses_house_client_script boolean not null default false;
update public.prospect_playbooks set uses_house_client_script = true
where slug in ('conteudo-recorrente-escolas', 'conteudo-recorrente-empresas');

-- ---------------------------------------------------------------------------
-- Cliente da casa no lead
-- ---------------------------------------------------------------------------

alter table public.deals
  -- Negócio de onde este veio (o ganho que gerou a entrega): o histórico fica no original.
  add column prospect_origin_deal_id uuid references public.deals (id) on delete set null,
  -- Dia em que o cliente da casa entra na fila (entrega + prazo, em Fortaleza).
  add column prospect_house_return_on date;

grant select (prospect_origin_deal_id, prospect_house_return_on) on public.deals to authenticated;

-- Entregas de projeto que viram cliente da casa: uma por projeto (idempotente). O negócio é criado
-- pelo HQ na próxima leitura do CRM (features/prospeccao/house-clients.ts), que reivindica a linha.
create table public.prospect_house_entries (
  project_id uuid primary key references public.projects (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  project_name text not null,
  delivered_at timestamptz not null,
  origin_deal_id uuid references public.deals (id) on delete set null,
  claimed_at timestamptz,
  deal_id uuid references public.deals (id) on delete set null,
  created_at timestamptz not null default now()
);

create index prospect_house_entries_pending_idx on public.prospect_house_entries (created_at) where deal_id is null;

alter table public.prospect_house_entries enable row level security;
-- Só o servidor (service role) lê e grava; ninguém acessa pela API.

create function public.prospect_house_entry_on_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.delivered_at is null or new.company_id is null or new.is_internal then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.delivered_at is not null then
    return new;
  end if;
  -- Nunca trava a entrega do projeto: qualquer falha aqui vira só um aviso no log do banco.
  begin
    insert into public.prospect_house_entries (project_id, company_id, project_name, delivered_at, origin_deal_id)
    values (
      new.id, new.company_id, new.name, new.delivered_at,
      coalesce(
        new.deal_id,
        (select d.id from public.deals d where d.company_id = new.company_id and d.stage = 'ganho' order by d.won_at desc nulls last limit 1)
      )
    )
    on conflict (project_id) do nothing;
  exception when others then
    raise warning 'cliente da casa: entrega do projeto % não registrada (%)', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- Sem "update of delivered_at": quem preenche a data é o trigger BEFORE projects_stamp_delivery,
-- e "update of" só dispara quando a coluna vem no SET. A função confere a mudança.
create trigger projects_prospect_house_entry
  after insert or update on public.projects
  for each row execute function public.prospect_house_entry_on_delivery();

-- ---------------------------------------------------------------------------
-- Metas: o orçamento aprovado conta na meta vinculada do lead (spec 7.3)
-- ---------------------------------------------------------------------------

-- Igual à versão de 20261004090100, com duas mudanças nas metas de vendas: negócio com meta
-- vinculada conta pelo orçamento aprovado (o mais recente do negócio, chave budget:<id>) e não de
-- novo quando vira "Ganho". A reconciliação existente (goal_sync_crm_internal) desfaz o lançamento
-- se o orçamento deixar de estar aprovado.
create or replace function public.goal_crm_candidates(p_goal_id uuid)
returns table (source_key text, amount numeric, entry_date date, deal_id uuid, note text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  g public.goals%rowtype;
begin
  select * into g from public.goals where id = p_goal_id;
  if not found or not g.auto_from_crm then
    return;
  end if;

  if g.metric in ('vendas_valor', 'vendas_quantidade') then
    return query
    select 'deal:' || d.id, case when g.metric = 'vendas_valor' then public.goal_deal_value(d.id) else 1::numeric end,
      (d.won_at at time zone 'America/Fortaleza')::date, d.id,
      'Negócio ganho: ' || coalesce(d.code || ' · ', '') || d.title
    from public.deals d
    where d.owner_id = g.owner_id and d.stage = 'ganho' and d.won_at is not null and d.archived_at is null
      and d.prospect_goal_id is distinct from g.id
      and (d.won_at at time zone 'America/Fortaleza')::date between g.starts_on and g.ends_on;

    return query
    select 'budget:' || b.id, case when g.metric = 'vendas_valor' then public.budget_final_total(b.id) else 1::numeric end,
      (b.decided_at at time zone 'America/Fortaleza')::date, b.deal_id,
      'Orçamento aprovado: ' || coalesce(d.code || ' · ', '') || d.title
    from (
      select distinct on (b0.deal_id) b0.*
      from public.budgets b0
      where b0.status = 'aprovado' and b0.archived_at is null and b0.deal_id is not null and b0.decided_at is not null
      order by b0.deal_id, b0.decided_at desc
    ) b
    join public.deals d on d.id = b.deal_id
    where d.prospect_goal_id = g.id and d.archived_at is null
      and (b.decided_at at time zone 'America/Fortaleza')::date between g.starts_on and g.ends_on;
  elsif g.metric = 'novos_negocios' then
    return query
    select 'deal:' || d.id, 1::numeric, (d.created_at at time zone 'America/Fortaleza')::date, d.id,
      'Negócio novo: ' || coalesce(d.code || ' · ', '') || d.title
    from public.deals d
    where d.owner_id = g.owner_id and d.archived_at is null
      and (d.created_at at time zone 'America/Fortaleza')::date between g.starts_on and g.ends_on;
  elsif g.metric = 'reunioes_agendadas' then
    return query
    select 'commitment:' || c.id, 1::numeric, (c.created_at at time zone 'America/Fortaleza')::date, d.id,
      'Reunião agendada: ' || d.title || ' · ' || to_char(c.starts_at at time zone 'America/Fortaleza', 'DD/MM HH24:MI')
    from public.commitments c
    join public.deals d on d.id = c.deal_id
    where c.kind = 'reuniao_comercial' and c.status <> 'cancelado' and d.owner_id = g.owner_id
      and (c.created_at at time zone 'America/Fortaleza')::date between g.starts_on and g.ends_on;
  elsif g.metric = 'reunioes_realizadas' then
    return query
    select 'commitment:' || c.id, 1::numeric, (c.starts_at at time zone 'America/Fortaleza')::date, d.id,
      'Reunião realizada: ' || d.title || ' · ' || to_char(c.starts_at at time zone 'America/Fortaleza', 'DD/MM')
    from public.commitments c
    join public.deals d on d.id = c.deal_id
    where c.kind = 'reuniao_comercial' and c.status = 'realizado' and d.owner_id = g.owner_id
      and (c.starts_at at time zone 'America/Fortaleza')::date between g.starts_on and g.ends_on;
  end if;
end;
$$;

revoke all on function public.goal_crm_candidates(uuid) from public, anon, authenticated;

-- Status, valor ou vínculo de um orçamento mudou: reconcilia a meta vinculada do negócio.
create function public.goals_sync_from_budgets()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_goal uuid;
begin
  for v_goal in
    select distinct d.prospect_goal_id
    from public.deals d
    where d.prospect_goal_id is not null
      and d.id in (
        select x from unnest(array[
          case when tg_op in ('UPDATE', 'DELETE') then old.deal_id end,
          case when tg_op in ('INSERT', 'UPDATE') then new.deal_id end
        ]) as x where x is not null
      )
  loop
    perform public.goal_sync_crm_internal(v_goal);
  end loop;
  return null;
end;
$$;

create trigger goals_sync_from_budgets
  after insert or delete or update of status, deal_id, archived_at, decided_at on public.budgets
  for each row execute function public.goals_sync_from_budgets();

-- Trocou a meta vinculada do lead: reconcilia a antiga e a nova.
create function public.goals_sync_from_prospect_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.prospect_goal_id is not null then
    perform public.goal_sync_crm_internal(old.prospect_goal_id);
  end if;
  if new.prospect_goal_id is not null then
    perform public.goal_sync_crm_internal(new.prospect_goal_id);
  end if;
  return null;
end;
$$;

create trigger goals_sync_from_prospect_goal
  after update of prospect_goal_id on public.deals
  for each row when (old.prospect_goal_id is distinct from new.prospect_goal_id)
  execute function public.goals_sync_from_prospect_goal();

-- Meta automática não aceita lançamento à mão (evita contar duas vezes).
create function public.goal_entries_block_manual_on_auto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source = 'manual' and exists (select 1 from public.goals g where g.id = new.goal_id and g.auto_from_crm) then
    raise exception 'Esta meta é automática: o andamento vem do CRM.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger goal_entries_block_manual_on_auto
  before insert on public.goal_entries
  for each row execute function public.goal_entries_block_manual_on_auto();

-- ---------------------------------------------------------------------------
-- Pauta antiga de reativação: não dispara para quem volta como cliente da casa
-- ---------------------------------------------------------------------------

create or replace function public.create_reactivation_pautas()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Fortaleza')::date;
  v_sdr uuid;
  v_reviewer uuid;
  v_reviewer_name text;
  r record;
  v_pauta uuid;
  v_contact uuid;
begin
  select cs.prospect_sdr_id, cs.prospect_reviewer_id into v_sdr, v_reviewer from public.company_settings cs where cs.id;

  -- Sem SDR definido: a primeira pessoa ativa do comercial que não é head/diretoria.
  if v_sdr is null or not exists (select 1 from public.profiles where id = v_sdr and is_active) then
    select ps.profile_id into v_sdr
    from public.profile_squads ps
    join public.profiles p on p.id = ps.profile_id and p.is_active
    where ps.squad = 'comercial' and p.org_level not in ('master', 'diretoria', 'head')
    order by p.created_at
    limit 1;
  end if;
  -- Sem validador: head do comercial, senão o master.
  if v_reviewer is null or not exists (select 1 from public.profiles where id = v_reviewer and is_active) then
    select ps.profile_id into v_reviewer
    from public.profile_squads ps
    join public.profiles p on p.id = ps.profile_id and p.is_active
    where ps.squad = 'comercial' and p.org_level = 'head'
    order by p.created_at
    limit 1;
    if v_reviewer is null then
      select id into v_reviewer from public.profiles where org_level = 'master' and is_active limit 1;
    end if;
  end if;
  if v_sdr is null or v_reviewer is null then
    return;
  end if;
  select full_name into v_reviewer_name from public.profiles where id = v_reviewer;

  for r in
    select pr.id, pr.name, pr.company_id, pr.finalized_at, c.name as company_name
    from public.projects pr
    join public.companies c on c.id = pr.company_id
    where pr.finalized_at is not null
      and pr.reactivation_pauta_id is null
      and not pr.is_internal
      and pr.stage <> 'encerrado'
      and (pr.finalized_at at time zone 'America/Fortaleza')::date + 30 <= v_today
      and (pr.finalized_at at time zone 'America/Fortaleza')::date + 60 >= v_today
      -- Cliente já com outro projeto em andamento não precisa ser reativado.
      and not exists (
        select 1 from public.projects other
        where other.company_id = pr.company_id and other.id <> pr.id
          and other.finalized_at is null and other.stage not in ('entregue', 'cancelado', 'encerrado')
      )
      -- Cliente da casa (prospecção): a volta ao CRM é pela cadência, não por esta pauta.
      and not exists (select 1 from public.prospect_house_entries h where h.company_id = pr.company_id)
      -- Encerrado sem potencial de voltar: não prospectar.
      and not exists (
        select 1 from public.client_closures cc
        where cc.company_id = pr.company_id and cc.project_id is null and cc.reopened_at is null
          and cc.future_prospect_potential = 'nenhum'
      )
  loop
    select ct.id into v_contact from public.contacts ct
    where ct.company_id = r.company_id
    order by ct.is_decision_maker desc, ct.created_at
    limit 1;

    v_pauta := gen_random_uuid();
    insert into public.pautas (
      id, title, briefing, squad, priority, lead_id, current_assignee_id, created_by,
      direct_company_id, contact_id, start_date, due_date, board_column
    ) values (
      v_pauta,
      'Prospecção: reativar ' || r.company_name,
      'Missão: reativar o cliente ' || r.company_name || '.' || E'\n\n'
        || 'O projeto "' || r.name || '" foi finalizado em ' || to_char(r.finalized_at at time zone 'America/Fortaleza', 'DD/MM/YYYY') || ' (há 30 dias).' || E'\n\n'
        || '1. Analise o perfil do cliente e os últimos projetos com a Além (página do cliente → projetos e equipe do cliente: quem é quem e quem decide).' || E'\n'
        || '2. Monte uma proposta para esse cliente: produção de conteúdo recorrente, projeto transacional ou o que fizer mais sentido, com a estratégia de abordagem.' || E'\n'
        || '3. Antes de abordar, valide com ' || coalesce(v_reviewer_name, 'a gestão') || ': registre a estratégia e o produto na aba Registros e envie para revisão.' || E'\n'
        || '4. Validado, faça a abordagem dentro do prazo de 5 dias úteis e registre o retorno.',
      'comercial', 'alta', v_sdr, v_sdr, v_reviewer,
      r.company_id, v_contact, v_today, public.add_business_days(v_today, 5), 'sprint_backlog'
    );
    insert into public.pauta_members (pauta_id, profile_id, production_function, added_by)
    values (v_pauta, v_sdr, 'prospeccao', v_reviewer)
    on conflict do nothing;

    update public.projects set reactivation_pauta_id = v_pauta where id = r.id;
  end loop;
end;
$$;

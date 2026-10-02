-- Metas (2/2): metas com comissão, lançamentos com revisão, sincronização com o CRM, lembretes
-- diários, pagamento gerado no financeiro e os dados de pagamento de cada pessoa.
--
-- 1. goals: a diretoria (can_manage_company()) define responsável, métrica, alvo, período e a
--    comissão — percentual sobre o valor atingido ou valor por unidade — com um gatilho mínimo
--    (padrão 70%): abaixo dele não há comissão; a partir dele paga proporcional ao atingido.
-- 2. goal_entries: lançamentos. O responsável lança (entra "pendente"); a diretoria aprova ou
--    recusa. Metas com auto_from_crm recebem lançamentos sozinhas (negócios ganhos, reuniões,
--    negócios novos do dono no CRM) — também pendentes de revisão.
-- 3. Progresso e comissão: goals_with_progress (confirmado = só aprovados; potencial = aprovados +
--    pendentes). A mesma conta do app (features/goals/progress.ts) está em goal_commission().
-- 4. Notificações: meta nova, lançamento para revisar, revisão feita, marcos (50%, gatilho, 100%),
--    resumo diário às 8h (pg_cron) e fim de período.
-- 5. goal_approve(): fecha a meta e gera a conta a pagar "Comissão" para a pessoa, com os dados de
--    pagamento dela nas observações.
-- 6. payment_details: cada pessoa cadastra os próprios dados (Pix/conta); o financeiro lê.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.goal_metric as enum (
  'vendas_valor', 'vendas_quantidade', 'reunioes_agendadas', 'reunioes_realizadas', 'novos_negocios', 'personalizada'
);
create type public.goal_status as enum ('ativa', 'em_revisao', 'aprovada', 'cancelada');
create type public.goal_commission_mode as enum ('percentual', 'por_unidade');
create type public.goal_entry_status as enum ('pendente', 'aprovado', 'recusado');
create type public.goal_entry_source as enum ('manual', 'crm');
create type public.pix_key_type as enum ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria');
create type public.bank_account_type as enum ('corrente', 'poupanca', 'pagamento');

-- ---------------------------------------------------------------------------
-- payment_details: dados de pagamento de cada pessoa (uma linha por profile)
-- ---------------------------------------------------------------------------

create table public.payment_details (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  preferred_method public.payment_method not null default 'pix'
    check (preferred_method in ('pix', 'transferencia')),
  holder_name text check (holder_name is null or length(holder_name) <= 160),
  holder_document text check (holder_document is null or length(holder_document) <= 20),
  pix_key_type public.pix_key_type,
  pix_key text check (pix_key is null or length(pix_key) <= 160),
  bank_name text check (bank_name is null or length(bank_name) <= 120),
  bank_code text check (bank_code is null or length(bank_code) <= 10),
  agency text check (agency is null or length(agency) <= 20),
  account_number text check (account_number is null or length(account_number) <= 30),
  account_type public.bank_account_type,
  notes text check (notes is null or length(notes) <= 1000),
  updated_at timestamptz not null default now()
);

create trigger payment_details_set_updated_at
  before update on public.payment_details
  for each row execute function public.set_updated_at();

alter table public.payment_details enable row level security;

-- A própria pessoa lê e edita; o financeiro só lê (para pagar).
create policy "payment_details_select" on public.payment_details for select to authenticated
  using (profile_id = auth.uid() or public.has_finance_access());
create policy "payment_details_insert_own" on public.payment_details for insert to authenticated
  with check (profile_id = auth.uid() and public.is_active_user());
create policy "payment_details_update_own" on public.payment_details for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
create policy "payment_details_delete_own" on public.payment_details for delete to authenticated
  using (profile_id = auth.uid());

-- Texto curto com os dados de pagamento (vai nas observações da conta a pagar gerada).
create function public.payment_details_text(p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select concat_ws(' · ',
        'Forma preferida: ' || case pd.preferred_method when 'pix' then 'Pix' else 'Transferência' end,
        case when nullif(btrim(pd.pix_key), '') is not null then
          'Pix' || coalesce(' (' || case pd.pix_key_type
            when 'cpf' then 'CPF' when 'cnpj' then 'CNPJ' when 'email' then 'e-mail'
            when 'telefone' then 'telefone' when 'aleatoria' then 'chave aleatória' end || ')', '') || ': ' || pd.pix_key
        end,
        case when nullif(btrim(pd.bank_name), '') is not null or nullif(btrim(pd.account_number), '') is not null then
          concat_ws(' ',
            'Banco' || coalesce(' ' || nullif(btrim(pd.bank_code), ''), '') || coalesce(' ' || nullif(btrim(pd.bank_name), ''), ''),
            'ag. ' || nullif(btrim(pd.agency), ''),
            case pd.account_type when 'corrente' then 'c/c' when 'poupanca' then 'poupança' when 'pagamento' then 'conta pagamento' end,
            nullif(btrim(pd.account_number), '')
          )
        end,
        'Titular: ' || nullif(btrim(pd.holder_name), '') || coalesce(' (' || nullif(btrim(pd.holder_document), '') || ')', '')
      )
      from public.payment_details pd
      where pd.profile_id = p_profile_id
    ),
    'Dados de pagamento não cadastrados — a pessoa preenche em Perfil → Dados para pagamento.'
  )
$$;

revoke all on function public.payment_details_text(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 2 and 160),
  description text check (description is null or length(description) <= 2000),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  metric public.goal_metric not null,
  -- Unidade exibida nas metas personalizadas ("leads", "posts"); as demais têm rótulo fixo.
  unit_label text check (unit_label is null or length(unit_label) <= 40),
  -- Mantido pelo banco a partir da métrica (personalizada: escolhido na meta).
  is_money boolean not null default false,
  target_value numeric(14, 2) not null check (target_value > 0),
  starts_on date not null,
  ends_on date not null,
  commission_mode public.goal_commission_mode not null default 'percentual',
  -- percentual: 0–100 (% sobre o valor atingido). por_unidade: R$ por unidade atingida.
  commission_rate numeric(12, 2) not null default 0 check (commission_rate >= 0),
  -- Gatilho: abaixo deste % da meta não há comissão; a partir dele paga proporcional ao atingido.
  min_achievement_pct numeric(5, 2) not null default 70 check (min_achievement_pct >= 0 and min_achievement_pct <= 100),
  auto_from_crm boolean not null default false,
  status public.goal_status not null default 'ativa',
  -- Marcos já avisados (50, gatilho, 100) — para não repetir a notificação.
  milestones_notified numeric[] not null default '{}',
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  final_achieved numeric(14, 2),
  final_commission numeric(12, 2),
  payable_id uuid references public.payables (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_period_check check (ends_on >= starts_on),
  constraint goals_percent_rate_check check (commission_mode <> 'percentual' or commission_rate <= 100),
  constraint goals_percent_needs_money check (commission_mode <> 'percentual' or is_money)
);

create index goals_owner_idx on public.goals (owner_id, status);
create index goals_status_idx on public.goals (status, ends_on);

create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

-- Quem revisa as metas: diretoria e master ativos, mais quem criou a meta.
create function public.goal_reviewers(p_goal_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p
  where p.is_active
    and (
      p.org_level in ('master', 'diretoria')
      or exists (select 1 from public.profile_squads ps where ps.profile_id = p.id and ps.squad = 'diretoria')
    )
  union
  select g.created_by from public.goals g
  join public.profiles p on p.id = g.created_by and p.is_active
  where g.id = p_goal_id
$$;

revoke all on function public.goal_reviewers(uuid) from public, anon, authenticated;

create function public.can_view_goal(p_goal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.goals g
    where g.id = p_goal_id and (g.owner_id = auth.uid() or public.can_manage_company())
  )
$$;

revoke all on function public.can_view_goal(uuid) from public, anon;
grant execute on function public.can_view_goal(uuid) to authenticated;

-- Normaliza a meta e protege a aprovação (só por goal_approve()).
create function public.goals_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.is_money := case
    when new.metric = 'vendas_valor' then true
    when new.metric = 'personalizada' then new.is_money
    else false
  end;
  if new.metric = 'personalizada' then
    new.auto_from_crm := false;
  else
    new.unit_label := null;
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'aprovada' and current_setting('alem.goal_approving', true) is distinct from 'on' then
      raise exception 'Meta já aprovada: não pode mais ser alterada.' using errcode = '42501';
    end if;
    if new.status = 'aprovada' and old.status <> 'aprovada'
       and current_setting('alem.goal_approving', true) is distinct from 'on' then
      raise exception 'Use a aprovação da meta para aprová-la.' using errcode = '42501';
    end if;
    -- Mudou o alvo ou o gatilho: os marcos voltam a valer.
    if new.target_value <> old.target_value or new.min_achievement_pct <> old.min_achievement_pct then
      new.milestones_notified := '{}';
    end if;
  elsif new.status = 'aprovada' then
    raise exception 'Uma meta nova não nasce aprovada.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger goals_guard
  before insert or update on public.goals
  for each row execute function public.goals_guard();

alter table public.goals enable row level security;

create policy "goals_select" on public.goals for select to authenticated
  using (owner_id = auth.uid() or public.can_manage_company());
create policy "goals_insert_managers" on public.goals for insert to authenticated
  with check (public.can_manage_company());
create policy "goals_update_managers" on public.goals for update to authenticated
  using (public.can_manage_company())
  with check (public.can_manage_company());
create policy "goals_delete_managers" on public.goals for delete to authenticated
  using (public.can_manage_company() and status <> 'aprovada');

-- ---------------------------------------------------------------------------
-- goal_entries
-- ---------------------------------------------------------------------------

create table public.goal_entries (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  amount numeric(14, 2) not null check (amount >= 0),
  entry_date date not null default (now() at time zone 'America/Fortaleza')::date,
  note text check (note is null or length(note) <= 1000),
  link_url text check (link_url is null or length(link_url) <= 500),
  deal_id uuid references public.deals (id) on delete set null,
  source public.goal_entry_source not null default 'manual',
  -- Origem no CRM ("deal:<id>", "commitment:<id>"); evita lançar o mesmo evento duas vezes.
  source_key text,
  status public.goal_entry_status not null default 'pendente',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or length(review_note) <= 500),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goal_entries_source_key_unique unique (goal_id, source_key),
  constraint goal_entries_manual_positive check (source <> 'manual' or amount > 0)
);

create index goal_entries_goal_idx on public.goal_entries (goal_id, status, entry_date desc);
create index goal_entries_deal_idx on public.goal_entries (deal_id);

create trigger goal_entries_set_updated_at
  before update on public.goal_entries
  for each row execute function public.set_updated_at();

-- Quem lança só lança "pendente" e só mexe no que ainda está pendente; a revisão é da diretoria.
-- A sincronização do CRM (alem.goal_sync = on) passa direto.
create function public.goal_entries_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_goal public.goals%rowtype;
  v_manager boolean := public.can_manage_company();
begin
  if current_setting('alem.goal_sync', true) = 'on' then
    return new;
  end if;

  select * into v_goal from public.goals where id = new.goal_id;
  if v_goal.status in ('aprovada', 'cancelada') then
    raise exception 'Esta meta está encerrada.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.source := 'manual';
    new.source_key := null;
    new.created_by := auth.uid();
    if not v_manager then
      if v_goal.owner_id is distinct from auth.uid() then
        raise exception 'Só o responsável lança nesta meta.' using errcode = '42501';
      end if;
      if v_goal.status <> 'ativa' then
        raise exception 'O período desta meta terminou: os lançamentos estão em revisão.' using errcode = '42501';
      end if;
      new.status := 'pendente';
    end if;
    if new.status = 'pendente' then
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.review_note := null;
    else
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
    return new;
  end if;

  -- UPDATE
  new.goal_id := old.goal_id;
  new.source := old.source;
  new.source_key := old.source_key;
  new.created_by := old.created_by;
  if not v_manager then
    if v_goal.owner_id is distinct from auth.uid() or old.status <> 'pendente' or old.source <> 'manual' then
      raise exception 'Só dá para editar lançamentos seus que ainda estão pendentes.' using errcode = '42501';
    end if;
    new.status := old.status;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
    new.review_note := old.review_note;
  elsif new.status is distinct from old.status then
    if new.status = 'pendente' then
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.review_note := null;
    else
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
  end if;
  -- Valor de lançamento do CRM vem do CRM.
  if old.source = 'crm' then
    new.amount := old.amount;
    new.deal_id := old.deal_id;
  end if;
  return new;
end;
$$;

create trigger goal_entries_guard
  before insert or update on public.goal_entries
  for each row execute function public.goal_entries_guard();

alter table public.goal_entries enable row level security;

create policy "goal_entries_select" on public.goal_entries for select to authenticated
  using (public.can_view_goal(goal_id));
create policy "goal_entries_insert" on public.goal_entries for insert to authenticated
  with check (public.can_view_goal(goal_id));
create policy "goal_entries_update" on public.goal_entries for update to authenticated
  using (public.can_view_goal(goal_id))
  with check (public.can_view_goal(goal_id));
create policy "goal_entries_delete" on public.goal_entries for delete to authenticated
  using (
    public.can_view_goal(goal_id)
    and exists (select 1 from public.goals g where g.id = goal_id and g.status not in ('aprovada', 'cancelada'))
    and (public.can_manage_company() or (status = 'pendente' and source = 'manual'))
  );

-- ---------------------------------------------------------------------------
-- Comissão e formatação
-- ---------------------------------------------------------------------------

-- Comissão sobre um valor atingido. Abaixo do gatilho: zero. A partir dele: proporcional.
create function public.goal_commission(
  p_mode public.goal_commission_mode, p_rate numeric, p_min_pct numeric, p_target numeric, p_achieved numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_target > 0 and p_achieved > 0 and p_achieved * 100 / p_target >= p_min_pct then
      round(case p_mode when 'percentual' then p_achieved * p_rate / 100 else p_achieved * p_rate end, 2)
    else 0
  end
$$;

grant execute on function public.goal_commission(public.goal_commission_mode, numeric, numeric, numeric, numeric) to authenticated;

create function public.fmt_brl(p_value numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'R$ ' || translate(to_char(round(coalesce(p_value, 0), 2), 'FM999,999,999,990.00'), ',.', '.,')
$$;

create function public.fmt_qty(p_value numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select rtrim(rtrim(translate(to_char(round(coalesce(p_value, 0), 2), 'FM999,999,999,990.00'), ',.', '.,'), '0'), ',')
$$;

create function public.goal_fmt(p_is_money boolean, p_value numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_is_money then public.fmt_brl(p_value) else public.fmt_qty(p_value) end
$$;

-- ---------------------------------------------------------------------------
-- View com o progresso (RLS das tabelas vale: security_invoker)
-- ---------------------------------------------------------------------------

create view public.goals_with_progress
with (security_invoker = true) as
select
  g.*,
  o.full_name as owner_name,
  o.avatar_url as owner_avatar_url,
  coalesce(e.approved, 0)::numeric(14, 2) as approved_value,
  coalesce(e.pending, 0)::numeric(14, 2) as pending_value,
  coalesce(e.pending_count, 0)::int as pending_count,
  public.goal_commission(g.commission_mode, g.commission_rate, g.min_achievement_pct, g.target_value, coalesce(e.approved, 0)) as commission_confirmed,
  public.goal_commission(g.commission_mode, g.commission_rate, g.min_achievement_pct, g.target_value, coalesce(e.approved, 0) + coalesce(e.pending, 0)) as commission_potential
from public.goals g
left join public.profiles o on o.id = g.owner_id
left join lateral (
  select
    sum(x.amount) filter (where x.status = 'aprovado') as approved,
    sum(x.amount) filter (where x.status = 'pendente') as pending,
    count(*) filter (where x.status = 'pendente') as pending_count
  from public.goal_entries x
  where x.goal_id = g.id
) e on true;

revoke all on public.goals_with_progress from anon;

-- ---------------------------------------------------------------------------
-- Sincronização com o CRM
-- ---------------------------------------------------------------------------

-- Valor de um negócio ganho: proposta aceita mais recente, senão a última proposta, senão o estimado.
create function public.goal_deal_value(p_deal_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.amount from public.deal_proposals p where p.deal_id = d.id and p.status = 'aceita' order by p.sent_at desc, p.created_at desc limit 1),
    (select p.amount from public.deal_proposals p where p.deal_id = d.id order by p.sent_at desc, p.created_at desc limit 1),
    d.estimated_value,
    0
  )
  from public.deals d
  where d.id = p_deal_id
$$;

revoke all on function public.goal_deal_value(uuid) from public, anon, authenticated;

-- O que o CRM diz que conta para a meta (dono do negócio = responsável da meta, dentro do período).
create function public.goal_crm_candidates(p_goal_id uuid)
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
      and (d.won_at at time zone 'America/Fortaleza')::date between g.starts_on and g.ends_on;
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

-- Aplica o CRM na meta: entra o que é novo, atualiza o valor do que ainda está pendente e tira o que
-- deixou de valer (negócio reaberto, reunião cancelada). Só metas ativas.
create function public.goal_sync_crm_internal(p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.goal_status;
  v_keys text[];
begin
  select status into v_status from public.goals where id = p_goal_id;
  if v_status is distinct from 'ativa' then
    return;
  end if;

  perform set_config('alem.goal_sync', 'on', true);

  select coalesce(array_agg(c.source_key), '{}') into v_keys from public.goal_crm_candidates(p_goal_id) c;

  insert into public.goal_entries (goal_id, amount, entry_date, note, deal_id, source, source_key, created_by)
  select p_goal_id, c.amount, c.entry_date, c.note, c.deal_id, 'crm', c.source_key, null
  from public.goal_crm_candidates(p_goal_id) c
  on conflict (goal_id, source_key) do update
    set amount = excluded.amount, entry_date = excluded.entry_date, note = excluded.note, deal_id = excluded.deal_id
    where public.goal_entries.status = 'pendente'
      and (public.goal_entries.amount, public.goal_entries.entry_date, public.goal_entries.note)
        is distinct from (excluded.amount, excluded.entry_date, excluded.note);

  delete from public.goal_entries e
  where e.goal_id = p_goal_id and e.source = 'crm' and e.status = 'pendente' and not (e.source_key = any (v_keys));

  update public.goal_entries e
  set status = 'recusado', reviewed_by = null, reviewed_at = now(),
      review_note = 'Saiu do CRM (negócio reaberto/arquivado ou reunião cancelada).'
  where e.goal_id = p_goal_id and e.source = 'crm' and e.status = 'aprovado' and not (e.source_key = any (v_keys));

  perform set_config('alem.goal_sync', 'off', true);
end;
$$;

revoke all on function public.goal_sync_crm_internal(uuid) from public, anon, authenticated;

-- "Sincronizar agora" na tela da meta.
create function public.goal_sync_crm(p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_view_goal(p_goal_id) then
    raise exception 'Sem acesso a esta meta.' using errcode = '42501';
  end if;
  perform public.goal_sync_crm_internal(p_goal_id);
end;
$$;

revoke all on function public.goal_sync_crm(uuid) from public, anon;
grant execute on function public.goal_sync_crm(uuid) to authenticated;

-- Sincroniza as metas automáticas ativas de uma pessoa (chamado pelos gatilhos do CRM).
create function public.goal_sync_owner(p_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_goal uuid;
begin
  if p_owner_id is null then
    return;
  end if;
  for v_goal in
    select g.id from public.goals g where g.owner_id = p_owner_id and g.status = 'ativa' and g.auto_from_crm
  loop
    perform public.goal_sync_crm_internal(v_goal);
  end loop;
end;
$$;

revoke all on function public.goal_sync_owner(uuid) from public, anon, authenticated;

create function public.goals_sync_from_deals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.goal_sync_owner(old.owner_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id) then
    perform public.goal_sync_owner(new.owner_id);
  end if;
  return null;
end;
$$;

create trigger goals_sync_from_deals
  after insert or delete or update of stage, won_at, owner_id, archived_at, estimated_value, title on public.deals
  for each row execute function public.goals_sync_from_deals();

-- Reuniões comerciais (agendada, realizada, cancelada) mexem nas metas do dono do negócio.
create function public.goals_sync_from_commitments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.kind = 'reuniao_comercial' and old.deal_id is not null then
    perform public.goal_sync_owner((select d.owner_id from public.deals d where d.id = old.deal_id));
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.kind = 'reuniao_comercial' and new.deal_id is not null
     and (tg_op = 'INSERT' or new.deal_id is distinct from old.deal_id or old.kind <> 'reuniao_comercial') then
    perform public.goal_sync_owner((select d.owner_id from public.deals d where d.id = new.deal_id));
  end if;
  return null;
end;
$$;

create trigger goals_sync_from_commitments
  after insert or delete or update of status, kind, starts_at, deal_id on public.commitments
  for each row execute function public.goals_sync_from_commitments();

-- Proposta nova/aceita muda o valor de um negócio ganho.
create function public.goals_sync_from_proposals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.goal_sync_owner((
    select d.owner_id from public.deals d
    where d.id = case when tg_op = 'DELETE' then old.deal_id else new.deal_id end and d.stage = 'ganho'
  ));
  return null;
end;
$$;

create trigger goals_sync_from_proposals
  after insert or delete or update of amount, status on public.deal_proposals
  for each row execute function public.goals_sync_from_proposals();

-- ---------------------------------------------------------------------------
-- Marcos e notificações
-- ---------------------------------------------------------------------------

create function public.goal_check_milestones(p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.goals%rowtype;
  v_approved numeric;
  v_pct numeric;
  v_mark numeric;
  v_reviewer uuid;
  v_url text := '/metas/' || p_goal_id;
begin
  select * into g from public.goals where id = p_goal_id;
  if not found or g.status not in ('ativa', 'em_revisao') then
    return;
  end if;
  select coalesce(sum(amount), 0) into v_approved from public.goal_entries where goal_id = p_goal_id and status = 'aprovado';
  v_pct := v_approved * 100 / g.target_value;

  for v_mark in select distinct m from unnest(array[50::numeric, g.min_achievement_pct, 100::numeric]) m where m > 0 order by m loop
    if v_pct >= v_mark and not (v_mark = any (g.milestones_notified)) then
      if v_mark = 100 then
        perform public.notify(g.owner_id, 'goal_milestone', 'Meta batida! 🎯',
          g.title || ': ' || public.goal_fmt(g.is_money, v_approved) || ' de ' || public.goal_fmt(g.is_money, g.target_value) || '.',
          'goal', g.id, v_url);
        for v_reviewer in select r from public.goal_reviewers(g.id) r where r <> g.owner_id loop
          perform public.notify(v_reviewer, 'goal_milestone', 'Meta batida',
            g.title || ' · ' || coalesce((select full_name from public.profiles where id = g.owner_id), 'responsável') || ' chegou a 100%.',
            'goal', g.id, v_url);
        end loop;
      elsif v_mark = g.min_achievement_pct then
        perform public.notify(g.owner_id, 'goal_milestone', 'Comissão liberada',
          g.title || ': você passou de ' || public.fmt_qty(v_mark) || '% da meta. A comissão já conta.',
          'goal', g.id, v_url);
      else
        perform public.notify(g.owner_id, 'goal_milestone', 'Metade da meta',
          g.title || ': ' || public.fmt_qty(round(v_pct)) || '% confirmados. Segue o ritmo.',
          'goal', g.id, v_url);
      end if;
      update public.goals set milestones_notified = array_append(milestones_notified, v_mark) where id = g.id;
      g.milestones_notified := array_append(g.milestones_notified, v_mark);
    end if;
  end loop;
end;
$$;

revoke all on function public.goal_check_milestones(uuid) from public, anon, authenticated;

create function public.goals_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is distinct from auth.uid() then
    perform public.notify(new.owner_id, 'goal_assigned', 'Nova meta para você',
      new.title || ' · ' || to_char(new.starts_on, 'DD/MM') || ' a ' || to_char(new.ends_on, 'DD/MM')
        || ' · alvo ' || public.goal_fmt(new.is_money, new.target_value) || '.',
      'goal', new.id, '/metas/' || new.id);
  end if;
  -- Carga inicial do CRM em silêncio (o resumo diário já conta o que entrou).
  if new.auto_from_crm then
    perform set_config('alem.goal_quiet', 'on', true);
    perform public.goal_sync_crm_internal(new.id);
    perform set_config('alem.goal_quiet', 'off', true);
  end if;
  return null;
end;
$$;

create trigger goals_after_insert
  after insert on public.goals
  for each row execute function public.goals_after_insert();

create function public.goals_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'ativa' and (
    new.auto_from_crm is distinct from old.auto_from_crm or new.metric is distinct from old.metric
    or new.owner_id is distinct from old.owner_id or new.starts_on is distinct from old.starts_on
    or new.ends_on is distinct from old.ends_on or old.status <> 'ativa'
  ) then
    perform set_config('alem.goal_quiet', 'on', true);
    perform public.goal_sync_crm_internal(new.id);
    perform set_config('alem.goal_quiet', 'off', true);
  end if;
  if new.target_value is distinct from old.target_value or new.min_achievement_pct is distinct from old.min_achievement_pct then
    perform public.goal_check_milestones(new.id);
  end if;
  return null;
end;
$$;

create trigger goals_after_update
  after update of auto_from_crm, metric, owner_id, starts_on, ends_on, status, target_value, min_achievement_pct on public.goals
  for each row execute function public.goals_after_update();

create function public.goal_entries_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.goals%rowtype;
  v_reviewer uuid;
  v_url text;
begin
  select * into g from public.goals where id = new.goal_id;
  v_url := '/metas/' || g.id;

  if tg_op = 'INSERT' then
    if new.source = 'manual' and new.status = 'pendente' then
      for v_reviewer in select r from public.goal_reviewers(g.id) r where r <> g.owner_id and r is distinct from auth.uid() loop
        perform public.notify(v_reviewer, 'goal_entry_pending', 'Lançamento para revisar',
          coalesce((select full_name from public.profiles where id = g.owner_id), 'Responsável') || ' lançou '
            || public.goal_fmt(g.is_money, new.amount) || ' em ' || g.title || '.',
          'goal', g.id, v_url);
      end loop;
    elsif new.source = 'crm' and current_setting('alem.goal_quiet', true) is distinct from 'on' then
      perform public.notify(g.owner_id, 'goal_entry_auto', 'Entrou na sua meta',
        coalesce(new.note, 'Lançamento do CRM') || ' · aguardando revisão.', 'goal', g.id, v_url);
    end if;
  elsif new.status is distinct from old.status and new.status <> 'pendente' and g.owner_id is distinct from auth.uid() then
    perform public.notify(g.owner_id, 'goal_entry_reviewed',
      case when new.status = 'aprovado' then 'Lançamento aprovado' else 'Lançamento recusado' end,
      g.title || ' · ' || public.goal_fmt(g.is_money, new.amount) || coalesce(' · ' || new.review_note, '') || '.',
      'goal', g.id, v_url);
  end if;

  if new.status = 'aprovado' and (tg_op = 'INSERT' or old.status is distinct from 'aprovado' or old.amount <> new.amount) then
    perform public.goal_check_milestones(g.id);
  end if;
  return null;
end;
$$;

create trigger goal_entries_after_change
  after insert or update of status, amount on public.goal_entries
  for each row execute function public.goal_entries_after_change();

-- ---------------------------------------------------------------------------
-- Aprovação: fecha a meta e gera a conta a pagar da comissão
-- ---------------------------------------------------------------------------

create function public.goal_approve(p_goal_id uuid, p_due_date date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.goals%rowtype;
  v_pending int;
  v_achieved numeric;
  v_commission numeric;
  v_method public.payment_method;
  v_payable uuid;
  v_owner_name text;
  v_fin uuid;
begin
  if not public.can_manage_company() then
    raise exception 'Só a diretoria aprova metas.' using errcode = '42501';
  end if;
  select * into g from public.goals where id = p_goal_id for update;
  if not found then
    raise exception 'Meta não encontrada.' using errcode = 'P0002';
  end if;
  if g.status not in ('ativa', 'em_revisao') then
    raise exception 'Esta meta não está aberta para aprovação.' using errcode = '22023';
  end if;
  select count(*) into v_pending from public.goal_entries where goal_id = g.id and status = 'pendente';
  if v_pending > 0 then
    raise exception 'Revise os % lançamentos pendentes antes de aprovar.', v_pending using errcode = '22023';
  end if;

  select coalesce(sum(amount), 0) into v_achieved from public.goal_entries where goal_id = g.id and status = 'aprovado';
  v_commission := public.goal_commission(g.commission_mode, g.commission_rate, g.min_achievement_pct, g.target_value, v_achieved);
  select full_name into v_owner_name from public.profiles where id = g.owner_id;

  if v_commission > 0 then
    select preferred_method into v_method from public.payment_details where profile_id = g.owner_id;
    insert into public.payables (payee_profile_id, category, description, amount, due_date, payment_method, notes, is_fixed)
    values (
      g.owner_id, 'comissao',
      'Comissão · ' || g.title,
      v_commission,
      coalesce(p_due_date, (now() at time zone 'America/Fortaleza')::date),
      coalesce(v_method, 'pix'),
      'Meta "' || g.title || '" (' || to_char(g.starts_on, 'DD/MM/YYYY') || ' a ' || to_char(g.ends_on, 'DD/MM/YYYY') || ') · '
        || coalesce(v_owner_name, 'responsável') || ' atingiu ' || public.goal_fmt(g.is_money, v_achieved)
        || ' de ' || public.goal_fmt(g.is_money, g.target_value)
        || ' (' || public.fmt_qty(round(v_achieved * 100 / g.target_value, 1)) || '%) · comissão '
        || case g.commission_mode when 'percentual' then public.fmt_qty(g.commission_rate) || '% sobre o atingido'
             else public.fmt_brl(g.commission_rate) || ' por unidade' end
        || '.' || chr(10) || public.payment_details_text(g.owner_id)
    )
    returning id into v_payable;

    -- O financeiro (cobranças, notas, pagamentos) fica sabendo da comissão a pagar.
    for v_fin in
      select distinct ps.profile_id from public.profile_squads ps
      join public.profiles p on p.id = ps.profile_id and p.is_active
      where ps.squad = 'financeiro' and ps.profile_id is distinct from auth.uid()
    loop
      perform public.notify(v_fin, 'finance_commission', 'Comissão a pagar',
        coalesce(v_owner_name, 'Responsável') || ' · ' || public.fmt_brl(v_commission) || ' · vence '
          || to_char(coalesce(p_due_date, (now() at time zone 'America/Fortaleza')::date), 'DD/MM') || '.',
        'payable', v_payable, '/financeiro?aba=pagamentos');
    end loop;
  end if;

  perform set_config('alem.goal_approving', 'on', true);
  update public.goals
  set status = 'aprovada', approved_at = now(), approved_by = auth.uid(),
      final_achieved = v_achieved, final_commission = v_commission, payable_id = v_payable
  where id = g.id;
  perform set_config('alem.goal_approving', 'off', true);

  perform public.notify(g.owner_id, 'goal_approved', 'Meta aprovada',
    g.title || ' · ' || public.goal_fmt(g.is_money, v_achieved) || ' atingidos · '
      || case when v_commission > 0
           then 'comissão de ' || public.fmt_brl(v_commission) || ' lançada para pagamento em ' || to_char(coalesce(p_due_date, (now() at time zone 'America/Fortaleza')::date), 'DD/MM') || '.'
           else 'sem comissão (abaixo de ' || public.fmt_qty(g.min_achievement_pct) || '%).' end,
    'goal', g.id, '/metas/' || g.id);

  return v_payable;
end;
$$;

revoke all on function public.goal_approve(uuid, date) from public, anon;
grant execute on function public.goal_approve(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Lembretes diários (8h de Fortaleza)
-- ---------------------------------------------------------------------------

create function public.run_goal_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Fortaleza')::date;
  r record;
  v_reviewer uuid;
  v_days int;
  v_remaining numeric;
  v_body text;
begin
  -- Rede de segurança: aplica o CRM nas metas automáticas antes de qualquer conta.
  for r in select id from public.goals where status = 'ativa' and auto_from_crm loop
    perform public.goal_sync_crm_internal(r.id);
  end loop;

  -- Período terminou: vai para revisão.
  for r in
    update public.goals set status = 'em_revisao'
    where status = 'ativa' and ends_on < v_today
    returning id, title, owner_id
  loop
    perform public.notify(r.owner_id, 'goal_period_ended', 'Período da meta encerrado',
      r.title || ' · agora a diretoria revisa e aprova.', 'goal', r.id, '/metas/' || r.id);
  end loop;

  -- Resumo do dia para o responsável.
  for r in
    select g.* from public.goals_with_progress g
    join public.profiles p on p.id = g.owner_id and p.is_active
    where g.status = 'ativa' and g.starts_on <= v_today
  loop
    if public.notified_today(r.owner_id, 'goal_daily', r.id) then
      continue;
    end if;
    v_days := r.ends_on - v_today + 1;
    v_remaining := greatest(r.target_value - r.approved_value, 0);
    v_body := public.fmt_qty(round(r.approved_value * 100 / r.target_value)) || '% · '
      || public.goal_fmt(r.is_money, r.approved_value) || ' de ' || public.goal_fmt(r.is_money, r.target_value)
      || case when v_remaining > 0
           then ' · ' || case when v_days = 1 then 'último dia' else 'faltam ' || v_days || ' dias' end
             || ' (' || public.goal_fmt(r.is_money, round(v_remaining / v_days, 2)) || '/dia)'
           else ' · meta batida!' end
      || ' · comissão confirmada ' || public.fmt_brl(r.commission_confirmed)
      || case when r.pending_value > 0 then ' · ' || public.goal_fmt(r.is_money, r.pending_value) || ' a confirmar' else '' end;
    perform public.notify(r.owner_id, 'goal_daily', 'Meta: ' || r.title, v_body, 'goal', r.id, '/metas/' || r.id);
  end loop;

  -- Diretoria: o que espera revisão.
  for r in
    select g.id, g.title, g.owner_id, g.status, g.pending_count, g.owner_name
    from public.goals_with_progress g
    where (g.status = 'ativa' and g.pending_count > 0) or g.status = 'em_revisao'
  loop
    for v_reviewer in select x from public.goal_reviewers(r.id) x where x <> r.owner_id loop
      if not public.notified_today(v_reviewer, 'goal_review', r.id) then
        perform public.notify(v_reviewer, 'goal_review',
          case when r.status = 'em_revisao' then 'Meta aguardando aprovação' else 'Lançamentos para revisar' end,
          r.title || ' · ' || coalesce(r.owner_name, 'responsável')
            || case when r.pending_count > 0
                 then ' · ' || r.pending_count || case when r.pending_count = 1 then ' lançamento pendente' else ' lançamentos pendentes' end
                 else '' end || '.',
          'goal', r.id, '/metas/' || r.id);
      end if;
    end loop;
  end loop;
end;
$$;

revoke all on function public.run_goal_reminders() from public, anon, authenticated;

-- 11h UTC = 8h em Fortaleza (mesmo horário de alem-daily-reminders).
select cron.schedule('alem-goal-reminders', '0 11 * * *', 'select public.run_goal_reminders()');

-- Metas com comissão sobre contratos fechados (ex.: SDR).
--
-- A barra mede a quantidade (contas/negócios cadastrados, reuniões…), mas a comissão é um % sobre o
-- valor dos contratos FECHADOS dessas contas — cadastrar sem qualificar não paga nada. Se a meta
-- bater o mínimo (min_achievement_pct), vale commission_rate; abaixo dele, só fallback_rate (a
-- comissão fixa padrão, 3%).
--
-- Contratos podem fechar depois do fim do período: na aprovação a taxa fica travada (locked_rate),
-- o que já fechou vira conta a pagar e cada contrato que fechar depois gera o pagamento sozinho
-- (goal_contract_payouts evita pagar o mesmo contrato duas vezes).

alter table public.goals
  add column fallback_rate numeric(5, 2) not null default 3 check (fallback_rate >= 0 and fallback_rate <= 100),
  add column locked_rate numeric(5, 2) check (locked_rate is null or (locked_rate >= 0 and locked_rate <= 100));

alter table public.goals drop constraint goals_percent_rate_check;
alter table public.goals add constraint goals_percent_rate_check
  check (commission_mode = 'por_unidade' or commission_rate <= 100);

-- Contratos só existem para métricas em que cada lançamento é um negócio do CRM.
alter table public.goals add constraint goals_contracts_need_deals check (
  commission_mode <> 'contratos_fechados'
  or metric in ('novos_negocios', 'reunioes_agendadas', 'reunioes_realizadas', 'vendas_quantidade')
);

create table public.goal_contract_payouts (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  deal_id uuid not null references public.deals (id) on delete cascade,
  contract_value numeric(14, 2) not null,
  rate numeric(5, 2) not null,
  amount numeric(12, 2) not null,
  payable_id uuid references public.payables (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (goal_id, deal_id)
);

alter table public.goal_contract_payouts enable row level security;

-- Só leitura (quem vê a meta); as linhas nascem nas funções do banco.
create policy "goal_contract_payouts_select" on public.goal_contract_payouts for select to authenticated
  using (public.can_view_goal(goal_id));

-- Contratos fechados (negócios ganhos) entre os negócios lançados na meta.
create function public.goal_closed_contracts(p_goal_id uuid, p_include_pending boolean)
returns table (deal_id uuid, contract_value numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, public.goal_deal_value(d.id)
  from public.deals d
  where d.stage = 'ganho'
    and d.id in (
      select e.deal_id from public.goal_entries e
      where e.goal_id = p_goal_id and e.deal_id is not null
        and (e.status = 'aprovado' or (p_include_pending and e.status = 'pendente'))
    )
$$;

revoke all on function public.goal_closed_contracts(uuid, boolean) from public, anon, authenticated;

-- Taxa que vale: travada na aprovação; antes disso, a da meta se bater o mínimo, senão a fixa.
create function public.goal_contract_rate(p_rate numeric, p_fallback numeric, p_locked numeric, p_min_pct numeric, p_target numeric, p_achieved numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_locked, case when p_target > 0 and p_achieved * 100 / p_target >= p_min_pct then p_rate else p_fallback end)
$$;

grant execute on function public.goal_contract_rate(numeric, numeric, numeric, numeric, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- View com o progresso: g.* é expandido na criação — recria com as colunas novas e os contratos.
-- ---------------------------------------------------------------------------

drop view public.goals_with_progress;

create view public.goals_with_progress
with (security_invoker = true) as
select
  g.*,
  o.full_name as owner_name,
  o.avatar_url as owner_avatar_url,
  coalesce(e.approved, 0)::numeric(14, 2) as approved_value,
  coalesce(e.pending, 0)::numeric(14, 2) as pending_value,
  coalesce(e.pending_count, 0)::int as pending_count,
  coalesce(c.closed_value, 0)::numeric(14, 2) as closed_value,
  coalesce(c.closed_count, 0)::int as closed_count,
  coalesce(cp.closed_value, 0)::numeric(14, 2) as closed_value_potential,
  case when g.commission_mode = 'contratos_fechados'
    then round(coalesce(c.closed_value, 0)
      * public.goal_contract_rate(g.commission_rate, g.fallback_rate, g.locked_rate, g.min_achievement_pct, g.target_value, coalesce(e.approved, 0)) / 100, 2)
    else public.goal_commission(g.commission_mode, g.commission_rate, g.min_achievement_pct, g.target_value, coalesce(e.approved, 0))
  end as commission_confirmed,
  case when g.commission_mode = 'contratos_fechados'
    then round(coalesce(cp.closed_value, 0)
      * public.goal_contract_rate(g.commission_rate, g.fallback_rate, g.locked_rate, g.min_achievement_pct, g.target_value, coalesce(e.approved, 0) + coalesce(e.pending, 0)) / 100, 2)
    else public.goal_commission(g.commission_mode, g.commission_rate, g.min_achievement_pct, g.target_value, coalesce(e.approved, 0) + coalesce(e.pending, 0))
  end as commission_potential
from public.goals g
left join public.profiles o on o.id = g.owner_id
left join lateral (
  select
    sum(x.amount) filter (where x.status = 'aprovado') as approved,
    sum(x.amount) filter (where x.status = 'pendente') as pending,
    count(*) filter (where x.status = 'pendente') as pending_count
  from public.goal_entries x
  where x.goal_id = g.id
) e on true
left join lateral (
  select sum(cc.contract_value) as closed_value, count(*) as closed_count
  from public.goal_closed_contracts(g.id, false) cc
  where g.commission_mode = 'contratos_fechados' and public.can_view_goal(g.id)
) c on true
left join lateral (
  select sum(cc.contract_value) as closed_value
  from public.goal_closed_contracts(g.id, true) cc
  where g.commission_mode = 'contratos_fechados' and public.can_view_goal(g.id)
) cp on true;

revoke all on public.goals_with_progress from anon;

-- ---------------------------------------------------------------------------
-- Pagamento de contratos: um lote (na aprovação) ou um contrato (fechado depois).
-- ---------------------------------------------------------------------------

create function public.goal_pay_contracts(p_goal_id uuid, p_due_date date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.goals%rowtype;
  v_total numeric := 0;
  v_count int := 0;
  v_payable uuid;
  v_method public.payment_method;
  v_owner_name text;
  v_fin uuid;
  v_due date := coalesce(p_due_date, (now() at time zone 'America/Fortaleza')::date);
  r record;
begin
  select * into g from public.goals where id = p_goal_id;
  if g.locked_rate is null then
    return null;
  end if;

  for r in
    select cc.deal_id, cc.contract_value from public.goal_closed_contracts(g.id, false) cc
    where not exists (select 1 from public.goal_contract_payouts p where p.goal_id = g.id and p.deal_id = cc.deal_id)
  loop
    insert into public.goal_contract_payouts (goal_id, deal_id, contract_value, rate, amount)
    values (g.id, r.deal_id, r.contract_value, g.locked_rate, round(r.contract_value * g.locked_rate / 100, 2));
    v_total := v_total + round(r.contract_value * g.locked_rate / 100, 2);
    v_count := v_count + 1;
  end loop;

  if v_total <= 0 then
    return null;
  end if;

  select full_name into v_owner_name from public.profiles where id = g.owner_id;
  select preferred_method into v_method from public.payment_details where profile_id = g.owner_id;
  insert into public.payables (payee_profile_id, category, description, amount, due_date, payment_method, notes, is_fixed)
  values (
    g.owner_id, 'comissao',
    'Comissão · ' || g.title || case when v_count = 1 then ' (1 contrato)' else ' (' || v_count || ' contratos)' end,
    v_total, v_due, coalesce(v_method, 'pix'),
    'Meta "' || g.title || '" (' || to_char(g.starts_on, 'DD/MM/YYYY') || ' a ' || to_char(g.ends_on, 'DD/MM/YYYY') || ') · '
      || public.fmt_qty(g.locked_rate) || '% sobre ' || v_count || case when v_count = 1 then ' contrato fechado' else ' contratos fechados' end
      || ' (' || public.fmt_brl(round(v_total * 100 / g.locked_rate, 2)) || ')'
      || case when g.locked_rate = g.fallback_rate and g.locked_rate <> g.commission_rate then ' · meta abaixo do mínimo: comissão fixa' else '' end
      || '.' || chr(10) || public.payment_details_text(g.owner_id)
  )
  returning id into v_payable;

  update public.goal_contract_payouts set payable_id = v_payable where goal_id = g.id and payable_id is null;

  perform public.notify(g.owner_id, 'goal_contract_paid', 'Comissão de contrato lançada',
    g.title || ' · ' || public.fmt_brl(v_total) || ' (' || public.fmt_qty(g.locked_rate) || '%) para pagamento em ' || to_char(v_due, 'DD/MM') || '.',
    'goal', g.id, '/metas/' || g.id);

  for v_fin in
    select distinct ps.profile_id from public.profile_squads ps
    join public.profiles p on p.id = ps.profile_id and p.is_active
    where ps.squad = 'financeiro' and ps.profile_id is distinct from auth.uid()
  loop
    perform public.notify(v_fin, 'finance_commission', 'Comissão a pagar',
      coalesce(v_owner_name, 'Responsável') || ' · ' || public.fmt_brl(v_total) || ' · vence ' || to_char(v_due, 'DD/MM') || '.',
      'payable', v_payable, '/financeiro?aba=pagamentos');
  end loop;

  return v_payable;
end;
$$;

revoke all on function public.goal_pay_contracts(uuid, date) from public, anon, authenticated;

-- Contrato fechado depois da aprovação: paga sozinho na taxa travada (vence em 30 dias).
create function public.goals_pay_on_deal_won()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_goal uuid;
begin
  if new.stage <> 'ganho' or old.stage = 'ganho' then
    return null;
  end if;
  for v_goal in
    select distinct g.id from public.goals g
    join public.goal_entries e on e.goal_id = g.id and e.deal_id = new.id and e.status = 'aprovado'
    where g.status = 'aprovada' and g.commission_mode = 'contratos_fechados' and g.locked_rate is not null
  loop
    perform public.goal_pay_contracts(v_goal, (now() at time zone 'America/Fortaleza')::date + 30);
  end loop;
  return null;
end;
$$;

create trigger goals_pay_on_deal_won
  after update of stage on public.deals
  for each row execute function public.goals_pay_on_deal_won();

-- ---------------------------------------------------------------------------
-- Aprovação: trata o modo de contratos (trava a taxa e paga o que já fechou).
-- ---------------------------------------------------------------------------

create or replace function public.goal_approve(p_goal_id uuid, p_due_date date)
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
  v_rate numeric;
  v_due date := coalesce(p_due_date, (now() at time zone 'America/Fortaleza')::date);
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
  select full_name into v_owner_name from public.profiles where id = g.owner_id;

  if g.commission_mode = 'contratos_fechados' then
    v_rate := public.goal_contract_rate(g.commission_rate, g.fallback_rate, null, g.min_achievement_pct, g.target_value, v_achieved);
    perform set_config('alem.goal_approving', 'on', true);
    update public.goals
    set status = 'aprovada', approved_at = now(), approved_by = auth.uid(), final_achieved = v_achieved, locked_rate = v_rate
    where id = g.id;

    v_payable := public.goal_pay_contracts(g.id, v_due);
    select coalesce(sum(amount), 0) into v_commission from public.goal_contract_payouts where goal_id = g.id;
    update public.goals set payable_id = v_payable, final_commission = v_commission where id = g.id;
    perform set_config('alem.goal_approving', 'off', true);

    perform public.notify(g.owner_id, 'goal_approved', 'Meta aprovada',
      g.title || ' · ' || public.goal_fmt(g.is_money, v_achieved) || ' de ' || public.goal_fmt(g.is_money, g.target_value) || ' · '
        || case when v_rate = g.commission_rate
             then 'bateu o mínimo: ' || public.fmt_qty(v_rate) || '% sobre os contratos fechados'
             else 'abaixo do mínimo: só a comissão fixa de ' || public.fmt_qty(v_rate) || '%' end
        || '. Contratos que fecharem depois entram sozinhos.',
      'goal', g.id, '/metas/' || g.id);
    return v_payable;
  end if;

  v_commission := public.goal_commission(g.commission_mode, g.commission_rate, g.min_achievement_pct, g.target_value, v_achieved);

  if v_commission > 0 then
    select preferred_method into v_method from public.payment_details where profile_id = g.owner_id;
    insert into public.payables (payee_profile_id, category, description, amount, due_date, payment_method, notes, is_fixed)
    values (
      g.owner_id, 'comissao',
      'Comissão · ' || g.title,
      v_commission,
      v_due,
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

    for v_fin in
      select distinct ps.profile_id from public.profile_squads ps
      join public.profiles p on p.id = ps.profile_id and p.is_active
      where ps.squad = 'financeiro' and ps.profile_id is distinct from auth.uid()
    loop
      perform public.notify(v_fin, 'finance_commission', 'Comissão a pagar',
        coalesce(v_owner_name, 'Responsável') || ' · ' || public.fmt_brl(v_commission) || ' · vence ' || to_char(v_due, 'DD/MM') || '.',
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
           then 'comissão de ' || public.fmt_brl(v_commission) || ' lançada para pagamento em ' || to_char(v_due, 'DD/MM') || '.'
           else 'sem comissão (abaixo de ' || public.fmt_qty(g.min_achievement_pct) || '%).' end,
    'goal', g.id, '/metas/' || g.id);

  return v_payable;
end;
$$;

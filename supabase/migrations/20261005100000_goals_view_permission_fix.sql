-- Correção: a view goals_with_progress (security_invoker) chamava goal_closed_contracts, que não
-- tem execute para authenticated — /metas quebrava para todo mundo. A view passa a usar uma versão
-- que só responde para quem pode ver a meta (can_view_goal); a interna continua fechada (é usada
-- pelos pagamentos automáticos, disparados por quem mexe no CRM).

create function public.goal_closed_contracts_visible(p_goal_id uuid, p_include_pending boolean)
returns table (deal_id uuid, contract_value numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select c.deal_id, c.contract_value
  from public.goal_closed_contracts(p_goal_id, p_include_pending) c
  where public.can_view_goal(p_goal_id)
$$;

revoke all on function public.goal_closed_contracts_visible(uuid, boolean) from public, anon;
grant execute on function public.goal_closed_contracts_visible(uuid, boolean) to authenticated;

create or replace view public.goals_with_progress
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
  from public.goal_closed_contracts_visible(g.id, false) cc
  where g.commission_mode = 'contratos_fechados' and public.can_view_goal(g.id)
) c on true
left join lateral (
  select sum(cc.contract_value) as closed_value
  from public.goal_closed_contracts_visible(g.id, true) cc
  where g.commission_mode = 'contratos_fechados' and public.can_view_goal(g.id)
) cp on true;

revoke all on public.goals_with_progress from anon;

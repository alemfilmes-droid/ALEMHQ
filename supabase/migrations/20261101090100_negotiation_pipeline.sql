-- "Em negociação" (Financeiro): uma fonte só para o card do Dashboard e o detalhe (gaveta).
--
-- Devolve os candidatos crus — orçamentos não arquivados que já saíram do rascunho ou estão ligados a um negócio,
-- e negócios abertos do CRM com proposta — e a regra de soma fica em lib/finance/negotiation.ts (testada):
--   · Orçamento conta em Enviado ao cliente, Em análise e Em ajuste; Rascunho não conta; Não aprovado sai do total.
--   · Várias versões do mesmo número: vale a última que já saiu do rascunho.
--   · Negócio com orçamento ligado: conta só o orçamento (sem soma dupla).
-- Nada de custo interno: só cliente, descrição, valor, status e datas. Exige acesso ao financeiro.
--
-- Volta: drop function public.finance_negotiation_pipeline();

create function public.finance_negotiation_pipeline()
returns table (
  source text,
  id uuid,
  budget_number integer,
  budget_version integer,
  deal_code text,
  title text,
  company_id uuid,
  client_name text,
  status text,
  amount numeric,
  deal_id uuid,
  deal_stage public.deal_stage,
  probability numeric,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_finance_access() then
    raise exception 'Sem acesso ao financeiro.' using errcode = '42501';
  end if;

  return query
  select
    'budget'::text, b.id, b.number, b.version, null::text, b.title, b.company_id, coalesce(c.name, b.client_name),
    b.status::text, public.budget_final_total(b.id), b.deal_id, d.stage, coalesce(pr.probability, 0), b.updated_at
  from public.budgets b
  left join public.companies c on c.id = b.company_id
  left join public.deals d on d.id = b.deal_id
  left join public.deal_stage_probabilities pr on pr.stage = d.stage
  where b.archived_at is null
    and (b.status <> 'rascunho' or b.deal_id is not null)
    and (b.company_id is null or public.company_closed_since(b.company_id) is null
         or coalesce(b.sent_at, b.created_at) > public.company_closed_since(b.company_id))

  union all

  select
    'deal'::text, d.id, null::int, null::int, d.code, d.title, d.company_id, c.name,
    lp.status::text, lp.amount, d.id, d.stage, coalesce(pr.probability, 0), greatest(d.updated_at, lp.sent_at)
  from public.deals d
  join public.companies c on c.id = d.company_id
  join lateral (
    select p.amount, p.sent_at, p.status
    from public.deal_proposals p
    where p.deal_id = d.id
    order by p.sent_at desc, p.created_at desc
    limit 1
  ) lp on true
  left join public.deal_stage_probabilities pr on pr.stage = d.stage
  where d.archived_at is null and d.stage not in ('ganho', 'perdido')
    and (public.company_closed_since(d.company_id) is null or d.created_at > public.company_closed_since(d.company_id));
end;
$$;

revoke all on function public.finance_negotiation_pipeline() from public, anon;
grant execute on function public.finance_negotiation_pipeline() to authenticated;

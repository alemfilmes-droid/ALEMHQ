-- Orçamentos "Em análise" contam como em negociação no Financeiro, como "Enviado" e "Em ajuste".
-- Mesmo corpo de finance_budgets_in_negotiation (20261009090100) com o status novo.

create or replace function public.finance_budgets_in_negotiation()
returns table (
  budget_id uuid, number integer, version integer, client_name text, title text, status public.budget_status,
  total numeric, sent_at timestamptz, valid_until date, company_id uuid
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
  select b.id, b.number, b.version, b.client_name, b.title, b.status, public.budget_final_total(b.id), b.sent_at, b.valid_until, b.company_id
  from public.budgets b
  where b.status in ('enviado', 'em_analise', 'em_ajuste') and b.deal_id is null
    and (b.company_id is null or public.company_closed_since(b.company_id) is null
         or coalesce(b.sent_at, b.created_at) > public.company_closed_since(b.company_id))
  order by b.sent_at desc nulls last;
end;
$$;

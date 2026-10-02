-- Orçamentos: ordem do catálogo, vínculo com projeto e negócio do CRM, versões ("refazer"),
-- entregas para o cliente e os orçamentos em negociação no financeiro.
--
-- Preço (nova regra, mais clara para o cliente): valor do serviço por item = custo × (1 + FEE%)
-- (ou o preço fixado); imposto = serviço × imposto%; valor final = serviço + imposto.

alter table public.budget_catalog_items add column position int not null default 0;

update public.budget_catalog_items c
set position = ordered.rn
from (select id, row_number() over (partition by section order by name) as rn from public.budget_catalog_items) ordered
where ordered.id = c.id;

alter table public.budgets
  add column project_id uuid references public.projects (id) on delete set null,
  add column deal_id uuid references public.deals (id) on delete set null,
  add column deal_proposal_id uuid references public.deal_proposals (id) on delete set null,
  add column version int not null default 1,
  add column parent_id uuid references public.budgets (id) on delete set null,
  add column deliverables text[] not null default '{}',
  add column sent_at timestamptz,
  add column decided_at timestamptz,
  add column status_note text check (status_note is null or length(status_note) <= 1000);

create index budgets_company_idx on public.budgets (company_id);
create index budgets_deal_idx on public.budgets (deal_id);

-- Valor final de um orçamento (mesma conta do app).
create or replace function public.budget_final_total(p_budget_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(coalesce(sum(round(coalesce(i.unit_price_override, i.unit_cost * (1 + b.fee_pct / 100)), 2) * i.quantity), 0) * (1 + b.tax_pct / 100), 2)
  from public.budgets b
  left join public.budget_items i on i.budget_id = b.id
  where b.id = p_budget_id
  group by b.fee_pct, b.tax_pct
$$;

revoke all on function public.budget_final_total(uuid) from public, anon, authenticated;

-- Financeiro: orçamentos enviados/em ajuste (só cliente, projeto e valor — nada de custo interno).
-- Os que já viraram proposta de um negócio do CRM aparecem lá; aqui ficam os demais, para não somar 2x.
create or replace function public.finance_budgets_in_negotiation()
returns table (budget_id uuid, number int, version int, client_name text, title text, status public.budget_status, total numeric, sent_at timestamptz, valid_until date, company_id uuid)
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
  where b.status in ('enviado', 'em_ajuste') and b.deal_id is null
  order by b.sent_at desc nulls last;
end;
$$;

revoke all on function public.finance_budgets_in_negotiation() from public, anon;
grant execute on function public.finance_budgets_in_negotiation() to authenticated;

-- CRM: o master registra a proposta no negócio e atualiza o status dela pelo orçamento.
create or replace function public.budget_set_proposal_status(p_budget_id uuid, p_status public.proposal_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal uuid;
begin
  if not public.is_master() then
    raise exception 'Só o master altera orçamentos.' using errcode = '42501';
  end if;
  select deal_proposal_id into v_proposal from public.budgets where id = p_budget_id;
  if v_proposal is not null then
    update public.deal_proposals set status = p_status where id = v_proposal;
  end if;
end;
$$;

revoke all on function public.budget_set_proposal_status(uuid, public.proposal_status) from public, anon;
grant execute on function public.budget_set_proposal_status(uuid, public.proposal_status) to authenticated;

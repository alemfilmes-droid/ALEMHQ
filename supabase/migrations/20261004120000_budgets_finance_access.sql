-- Orçamentos: além do master, o squad Financeiro (auxiliar financeiro) passa a criar, editar, enviar
-- e acompanhar orçamentos, catálogo e imagens das apresentações. O "Perfil da Além" (identidade das
-- propostas, em company_settings) continua com quem administra a empresa.

create function public.can_manage_budgets()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and (public.is_master() or public.in_squad('financeiro'))
$$;

revoke all on function public.can_manage_budgets() from public, anon;
grant execute on function public.can_manage_budgets() to authenticated;

drop policy "budget_catalog_master" on public.budget_catalog_items;
drop policy "budgets_master" on public.budgets;
drop policy "budget_items_master" on public.budget_items;

create policy "budget_catalog_manage" on public.budget_catalog_items for all to authenticated
  using (public.can_manage_budgets()) with check (public.can_manage_budgets());
create policy "budgets_manage" on public.budgets for all to authenticated
  using (public.can_manage_budgets()) with check (public.can_manage_budgets());
create policy "budget_items_manage" on public.budget_items for all to authenticated
  using (public.can_manage_budgets()) with check (public.can_manage_budgets());

drop policy "budget_assets_insert_master" on storage.objects;
drop policy "budget_assets_update_master" on storage.objects;
drop policy "budget_assets_delete_master" on storage.objects;

create policy "budget_assets_insert_manage" on storage.objects for insert to authenticated
  with check (bucket_id = 'budget-assets' and public.can_manage_budgets());
create policy "budget_assets_update_manage" on storage.objects for update to authenticated
  using (bucket_id = 'budget-assets' and public.can_manage_budgets());
create policy "budget_assets_delete_manage" on storage.objects for delete to authenticated
  using (bucket_id = 'budget-assets' and public.can_manage_budgets());

-- Aprovado/em ajuste/recusado no orçamento atualiza a proposta registrada no CRM.
create or replace function public.budget_set_proposal_status(p_budget_id uuid, p_status public.proposal_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal uuid;
begin
  if not public.can_manage_budgets() then
    raise exception 'Sem acesso aos orçamentos.' using errcode = '42501';
  end if;
  select deal_proposal_id into v_proposal from public.budgets where id = p_budget_id;
  if v_proposal is not null then
    update public.deal_proposals set status = p_status where id = v_proposal;
  end if;
end;
$$;

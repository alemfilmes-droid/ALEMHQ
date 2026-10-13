-- Ajustes pedidos pelo Anderson antes da recategorização (13/10/2026).
--
-- • Reembolso de despesa mantém a categoria da despesa (ex.: o Drive da empresa continua em Software); só nunca fica
--   em Equipe e colaboradores (aí vira Outro). Mesmos casos de lib/finance/team-category-cases.json.
-- • Reembolso nunca aparece na Carteira de ninguém (não é remuneração): wallet_entries passa a ignorá-los.
-- • Recategorização com volta: payables_recategorization guarda o antes e o depois de cada lançamento, e
--   payables_recategorization_undo(lote) devolve exatamente o "antes" (só o master; histórico registra a volta).
--   Durante a gravação do antes/depois o gatilho da regra fica de lado (alem.team_category_restore), para não
--   recalcular por cima do valor guardado.
--
-- Só cria tabela e funções; recria payable_team_rule, payables_team_category e wallet_entries com o mesmo corpo +
-- os ajustes acima.

create or replace function public.payable_team_rule(
  p_category public.payable_category,
  p_payee_is_member boolean,
  p_is_pro_labore boolean,
  p_is_reimbursement boolean,
  p_type public.team_payment_type,
  p_has_commission_goal boolean
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_is_pro_labore or p_category = 'pro_labore' then
      jsonb_build_object('category', 'pessoal', 'type', 'pro_labore', 'lock', 'pro_labore')
    when p_is_reimbursement then
      jsonb_build_object('category', case when p_category in ('pessoal', 'comissao') then 'outro' else p_category::text end, 'type', null, 'lock', null)
    when p_payee_is_member or p_category in ('pessoal', 'comissao') then
      jsonb_build_object(
        'category', 'pessoal',
        'type', case when p_type = 'comissao' or p_category = 'comissao' or p_has_commission_goal then 'comissao' else 'pagamento_colaborador' end,
        'lock', case when p_payee_is_member then 'equipe' end)
    else
      jsonb_build_object('category', p_category, 'type', null, 'lock', null)
  end
$$;

create or replace function public.payables_team_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule jsonb;
  v_category public.payable_category;
  v_type public.team_payment_type;
  v_changes jsonb := '{}'::jsonb;
begin
  -- Gravação do antes/depois da recategorização (e a volta): os valores já vêm decididos.
  if current_setting('alem.team_category_restore', true) = 'on' then
    return new;
  end if;

  -- Edição que não mexe em categoria, favorecido nem marcas (ex.: dar baixa): nada muda.
  if tg_op = 'UPDATE'
     and new.category is not distinct from old.category
     and new.payee_profile_id is not distinct from old.payee_profile_id
     and new.is_pro_labore is not distinct from old.is_pro_labore
     and new.is_reimbursement is not distinct from old.is_reimbursement
     and new.team_payment_type is not distinct from old.team_payment_type
     and new.commission_goal_id is not distinct from old.commission_goal_id
     and new.company_id is not distinct from old.company_id
     and new.project_id is not distinct from old.project_id then
    return new;
  end if;

  v_rule := public.payable_team_rule(new.category, new.payee_profile_id is not null, new.is_pro_labore, new.is_reimbursement,
    new.team_payment_type, new.commission_goal_id is not null);
  v_category := (v_rule ->> 'category')::public.payable_category;
  v_type := (v_rule ->> 'type')::public.team_payment_type;

  if v_category is distinct from new.category then
    v_changes := v_changes || jsonb_build_object('category', jsonb_build_object('before', new.category, 'after', v_category));
  end if;
  if v_type is distinct from new.team_payment_type then
    v_changes := v_changes || jsonb_build_object('team_payment_type', jsonb_build_object('before', new.team_payment_type, 'after', v_type));
  end if;

  new.category := v_category;
  new.team_payment_type := v_type;
  new.is_pro_labore := coalesce(v_type = 'pro_labore', false);
  if new.is_pro_labore then
    new.is_reimbursement := false;
  end if;
  -- Reembolso ligado a cliente ou projeto não é custo da empresa.
  new.cost_scope := case when new.project_id is not null or (new.is_reimbursement and new.company_id is not null)
    then 'projeto'::public.cost_scope else 'empresa'::public.cost_scope end;

  if v_changes <> '{}'::jsonb then
    insert into public.financial_entry_history (entry_type, entry_id, changed_by, action, changes, reason)
    values ('payable', new.id, auth.uid(), 'EDIT', v_changes, 'Categorização automática: equipe e colaboradores');
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Carteira: reembolso não é remuneração
-- ---------------------------------------------------------------------------

create or replace function public.wallet_entries(p_profile_id uuid)
returns table (
  id uuid,
  description text,
  amount numeric,
  due_date date,
  payout_date date,
  paid_at date,
  category public.payable_category,
  team_payment_type public.team_payment_type,
  is_fixed boolean,
  commission_goal_id uuid,
  goal_title text,
  project_id uuid,
  project_name text,
  company_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_read_wallet(p_profile_id) then
    raise exception 'Você só pode ver a sua Carteira.' using errcode = '42501';
  end if;
  return query
  select pa.id, pa.description, pa.amount, pa.due_date, coalesce(pa.payout_date, pa.due_date), pa.paid_at::date, pa.category,
    pa.team_payment_type, pa.is_fixed, pa.commission_goal_id, g.title, pa.project_id, pr.name, coalesce(c.name, pc.name)
  from public.payables pa
  left join public.goals g on g.id = pa.commission_goal_id
  left join public.projects pr on pr.id = pa.project_id
  left join public.companies c on c.id = pa.company_id
  left join public.companies pc on pc.id = pr.company_id
  where pa.payee_profile_id = p_profile_id and pa.cancelled_at is null and not pa.is_reimbursement
  order by coalesce(pa.payout_date, pa.due_date);
end;
$$;

-- ---------------------------------------------------------------------------
-- Antes/depois e volta da recategorização
-- ---------------------------------------------------------------------------

create table public.payables_recategorization (
  id uuid primary key default gen_random_uuid(),
  batch text not null,
  payable_id uuid not null,
  before jsonb not null,
  after jsonb not null,
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  unique (batch, payable_id)
);

alter table public.payables_recategorization enable row level security;

create policy "payables_recategorization_select" on public.payables_recategorization for select to authenticated
  using (public.can_see_money());

revoke insert, update, delete, truncate on public.payables_recategorization from anon, authenticated;

-- Grava um estado (category, team_payment_type, is_pro_labore, is_reimbursement, cost_scope) sem passar pela regra.
create function public.payables_apply_state(p_payable_id uuid, p_state jsonb, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.payables;
  v_changes jsonb := '{}'::jsonb;
  k text;
begin
  select * into v_old from public.payables where id = p_payable_id for update;
  if not found then
    return;
  end if;
  foreach k in array array['category', 'team_payment_type', 'is_pro_labore', 'is_reimbursement', 'cost_scope'] loop
    if (to_jsonb(v_old) -> k) is distinct from (p_state -> k) then
      v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('before', to_jsonb(v_old) -> k, 'after', p_state -> k));
    end if;
  end loop;
  if v_changes = '{}'::jsonb then
    return;
  end if;

  perform set_config('alem.team_category_restore', 'on', true);
  update public.payables
  set category = (p_state ->> 'category')::public.payable_category,
      team_payment_type = (p_state ->> 'team_payment_type')::public.team_payment_type,
      is_pro_labore = (p_state ->> 'is_pro_labore')::boolean,
      is_reimbursement = (p_state ->> 'is_reimbursement')::boolean,
      cost_scope = (p_state ->> 'cost_scope')::public.cost_scope
  where id = p_payable_id;
  perform set_config('alem.team_category_restore', 'off', true);

  insert into public.financial_entry_history (entry_type, entry_id, changed_by, action, changes, reason)
  values ('payable', p_payable_id, auth.uid(), 'EDIT', v_changes, p_reason);
end;
$$;

revoke all on function public.payables_apply_state(uuid, jsonb, text) from public, anon, authenticated;

-- Volta de um lote inteiro: cada lançamento recebe de novo o "antes" guardado. Só o master.
create function public.payables_recategorization_undo(p_batch text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_count int := 0;
begin
  if auth.uid() is not null and not public.is_master() then
    raise exception 'Só o master desfaz a recategorização.' using errcode = '42501';
  end if;
  for r in select * from public.payables_recategorization where batch = p_batch and undone_at is null loop
    perform public.payables_apply_state(r.payable_id, r.before, 'Recategorização desfeita (lote ' || p_batch || ')');
    update public.payables_recategorization set undone_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.payables_recategorization_undo(text) from public, anon;
grant execute on function public.payables_recategorization_undo(text) to authenticated;

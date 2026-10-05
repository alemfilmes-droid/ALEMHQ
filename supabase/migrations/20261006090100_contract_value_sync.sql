-- Valor do contrato x orçamento: quando um orçamento ligado a um projeto muda o valor e o projeto já
-- tem contrato, o financeiro decide — substituir, somar como serviço adicional ou manter — e o
-- sistema reconcilia as parcelas e registra o histórico.
--
-- Parcelas: nada recebido + "regenerar" → cancela as pendentes e gera de novo com o total novo, nas
-- mesmas datas. Já houve recebimento (ou sem regenerar) → só a diferença: aumento vira uma parcela
-- nova; redução abate das pendentes, da última para a primeira. Linhas recebidas nunca mudam.
-- O plano (project_contract_plan) é mostrado antes de confirmar; a aplicação usa o mesmo plano.
-- Tudo exige acesso ao financeiro (has_finance_access()).

create table public.project_contract_changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  budget_id uuid references public.budgets (id) on delete set null,
  change_type text not null check (change_type in ('definicao', 'substituicao', 'adicional', 'manter')),
  previous_value numeric(14, 2),
  new_value numeric(14, 2),
  amount numeric(14, 2),
  description text check (description is null or length(description) <= 200),
  note text check (note is null or length(note) <= 500),
  receivables_summary jsonb not null default '[]'::jsonb,
  changed_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index project_contract_changes_project_idx on public.project_contract_changes (project_id, created_at desc);

alter table public.project_contract_changes enable row level security;

-- Só leitura, só financeiro. Linhas nascem em project_apply_contract_change().
create policy "project_contract_changes_finance" on public.project_contract_changes for select to authenticated
  using (public.has_finance_access());

-- Último total de orçamento já decidido: evita perguntar de novo pelo mesmo valor.
alter table public.budgets add column contract_synced_total numeric(14, 2);

-- ---------------------------------------------------------------------------
-- Situação de um orçamento em relação ao contrato do projeto
-- ---------------------------------------------------------------------------

create function public.budget_contract_status(p_budget_id uuid)
returns table (project_id uuid, project_name text, contract_value numeric, budget_total numeric, synced_total numeric, received_count int, pending_count int)
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
  select b.project_id, p.name, pf.contract_value, public.budget_final_total(b.id), b.contract_synced_total,
    (select count(*)::int from public.receivables r where r.project_id = b.project_id and r.received_at is not null and r.cancelled_at is null),
    (select count(*)::int from public.receivables r where r.project_id = b.project_id and r.received_at is null and r.cancelled_at is null)
  from public.budgets b
  join public.projects p on p.id = b.project_id
  left join public.project_financials pf on pf.project_id = b.project_id
  where b.id = p_budget_id;
end;
$$;

revoke all on function public.budget_contract_status(uuid) from public, anon;
grant execute on function public.budget_contract_status(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Plano: o que acontece com o contrato e as parcelas (sem gravar nada)
-- ---------------------------------------------------------------------------

create function public.project_contract_plan(p_project_id uuid, p_mode text, p_amount numeric, p_regenerate boolean, p_description text default null)
returns table (seq int, op text, receivable_id uuid, description text, amount numeric, due_date date, previous_amount numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_old numeric;
  v_new numeric;
  v_delta numeric;
  v_received int;
  v_pending int;
  v_today date := (now() at time zone 'America/Fortaleza')::date;
  v_seq int := 0;
  v_remaining numeric;
  v_base bigint;
  v_extra bigint;
  v_i int := 0;
  v_name text;
  r record;
begin
  if not public.has_finance_access() then
    raise exception 'Sem acesso ao financeiro.' using errcode = '42501';
  end if;
  if p_mode not in ('definicao', 'substituicao', 'adicional', 'manter') then
    raise exception 'Escolha como aplicar o valor.' using errcode = '22023';
  end if;
  if p_mode <> 'manter' and (p_amount is null or p_amount <= 0) then
    raise exception 'O valor precisa ser maior que zero.' using errcode = '22023';
  end if;

  select coalesce(pf.contract_value, 0), p.name into v_old, v_name
  from public.projects p left join public.project_financials pf on pf.project_id = p.id
  where p.id = p_project_id;
  v_new := case p_mode when 'substituicao' then p_amount when 'definicao' then p_amount when 'adicional' then v_old + p_amount else v_old end;
  v_delta := v_new - v_old;

  -- Contrato: sempre a primeira linha do plano.
  v_seq := v_seq + 1;
  seq := v_seq; op := 'contrato'; receivable_id := null; description := 'Valor do contrato'; amount := v_new; due_date := null; previous_amount := v_old;
  return next;

  if v_delta = 0 or p_mode = 'definicao' then
    return;
  end if;

  select count(*) filter (where x.received_at is not null), count(*) filter (where x.received_at is null)
  into v_received, v_pending
  from public.receivables x where x.project_id = p_project_id and x.cancelled_at is null;

  if v_received = 0 and p_regenerate and v_pending > 0 then
    -- Regenera: cancela as pendentes e cria de novo com o total novo, nas mesmas datas.
    v_base := round(v_new * 100)::bigint / v_pending;
    v_extra := round(v_new * 100)::bigint % v_pending;
    for r in
      select x.id, x.description, x.amount, x.due_date from public.receivables x
      where x.project_id = p_project_id and x.cancelled_at is null and x.received_at is null
      order by x.due_date, x.created_at
    loop
      v_i := v_i + 1;
      v_seq := v_seq + 1;
      seq := v_seq; op := 'cancelar'; receivable_id := r.id; description := r.description; amount := r.amount; due_date := r.due_date; previous_amount := r.amount;
      return next;
      v_seq := v_seq + 1;
      seq := v_seq; op := 'criar'; receivable_id := null;
      description := coalesce(v_name, 'Projeto') || ' — parcela ' || v_i || '/' || v_pending;
      amount := (v_base + case when v_i <= v_extra then 1 else 0 end)::numeric / 100; due_date := r.due_date; previous_amount := null;
      return next;
    end loop;
    return;
  end if;

  if v_delta > 0 then
    v_seq := v_seq + 1;
    seq := v_seq; op := 'criar'; receivable_id := null;
    description := coalesce(nullif(btrim(p_description), ''), case when p_mode = 'adicional' then 'Serviço adicional' else 'Ajuste do contrato' end)
      || ' — ' || coalesce(v_name, 'projeto');
    amount := v_delta;
    due_date := coalesce((select max(x.due_date) from public.receivables x where x.project_id = p_project_id and x.cancelled_at is null and x.received_at is null), v_today + 30);
    previous_amount := null;
    return next;
    return;
  end if;

  -- Redução: abate das pendentes, da última para a primeira. Recebidas nunca mudam.
  v_remaining := -v_delta;
  for r in
    select x.id, x.description, x.amount, x.due_date from public.receivables x
    where x.project_id = p_project_id and x.cancelled_at is null and x.received_at is null
    order by x.due_date desc, x.created_at desc
  loop
    exit when v_remaining <= 0;
    v_seq := v_seq + 1;
    seq := v_seq; receivable_id := r.id; description := r.description; due_date := r.due_date; previous_amount := r.amount;
    if r.amount <= v_remaining then
      op := 'cancelar'; amount := r.amount;
      v_remaining := v_remaining - r.amount;
    else
      op := 'reduzir'; amount := r.amount - v_remaining;
      v_remaining := 0;
    end if;
    return next;
  end loop;
  if v_remaining > 0 then
    v_seq := v_seq + 1;
    seq := v_seq; op := 'aviso'; receivable_id := null;
    description := 'Já foi recebido mais que o novo contrato: diferença a acertar com o cliente';
    amount := v_remaining; due_date := null; previous_amount := null;
    return next;
  end if;
end;
$$;

revoke all on function public.project_contract_plan(uuid, text, numeric, boolean, text) from public, anon;
grant execute on function public.project_contract_plan(uuid, text, numeric, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Aplicação: executa o plano, atualiza o contrato, registra histórico e activity_log
-- ---------------------------------------------------------------------------

create function public.project_apply_contract_change(
  p_project_id uuid, p_budget_id uuid, p_mode text, p_amount numeric, p_regenerate boolean, p_description text, p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_internal boolean;
  v_old numeric;
  v_new numeric;
  v_summary jsonb := '[]'::jsonb;
  v_budget_total numeric;
  r record;
  v_installment_total int;
begin
  if not public.has_finance_access() then
    raise exception 'Sem acesso ao financeiro.' using errcode = '42501';
  end if;
  select company_id, is_internal into v_company, v_internal from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'Projeto não encontrado.' using errcode = 'P0002';
  end if;
  if v_internal or v_company is null then
    raise exception 'Projetos internos não têm contrato.' using errcode = '22023';
  end if;
  if p_budget_id is not null then
    select public.budget_final_total(b.id) into v_budget_total from public.budgets b where b.id = p_budget_id and b.project_id = p_project_id;
    if v_budget_total is null then
      raise exception 'O orçamento não é deste projeto.' using errcode = '22023';
    end if;
  end if;

  select count(*) filter (where p.op = 'criar') into v_installment_total
  from public.project_contract_plan(p_project_id, p_mode, p_amount, p_regenerate, p_description) p
  where exists (select 1 from public.project_contract_plan(p_project_id, p_mode, p_amount, p_regenerate, p_description) q where q.op = 'cancelar')
    and not exists (select 1 from public.project_contract_plan(p_project_id, p_mode, p_amount, p_regenerate, p_description) q where q.op = 'reduzir');

  for r in select * from public.project_contract_plan(p_project_id, p_mode, p_amount, p_regenerate, p_description) order by seq loop
    if r.op = 'contrato' then
      v_old := r.previous_amount;
      v_new := r.amount;
      if p_mode <> 'manter' then
        insert into public.project_financials (project_id, contract_value) values (p_project_id, v_new)
        on conflict (project_id) do update set contract_value = excluded.contract_value;
      end if;
    elsif r.op = 'cancelar' then
      update public.receivables set cancelled_at = now()
      where id = r.receivable_id and received_at is null and cancelled_at is null;
    elsif r.op = 'reduzir' then
      update public.receivables set amount = r.amount
      where id = r.receivable_id and received_at is null and cancelled_at is null;
    elsif r.op = 'criar' then
      insert into public.receivables (company_id, project_id, description, amount, due_date, installment_number, installment_total)
      values (
        v_company, p_project_id, r.description, r.amount, r.due_date,
        case when v_installment_total > 0 then (substring(r.description from 'parcela ([0-9]+)/'))::int end,
        case when v_installment_total > 0 then v_installment_total end
      );
    end if;
    v_summary := v_summary || jsonb_build_object('op', r.op, 'description', r.description, 'amount', r.amount, 'due_date', r.due_date, 'previous_amount', r.previous_amount);
  end loop;

  insert into public.project_contract_changes (project_id, budget_id, change_type, previous_value, new_value, amount, description, note, receivables_summary)
  values (p_project_id, p_budget_id, p_mode, v_old, v_new, p_amount, nullif(btrim(coalesce(p_description, '')), ''), nullif(btrim(coalesce(p_note, '')), ''), v_summary);

  if p_budget_id is not null then
    update public.budgets set contract_synced_total = v_budget_total where id = p_budget_id;
  end if;

  perform public.log_activity('contract_value_changed', 'project', p_project_id,
    jsonb_build_object('mode', p_mode, 'previous_value', v_old, 'new_value', v_new, 'amount', p_amount, 'budget_id', p_budget_id, 'receivables', v_summary));

  perform public.project_margin_check(p_project_id);

  return jsonb_build_object('previous_value', v_old, 'new_value', v_new, 'operations', v_summary);
end;
$$;

revoke all on function public.project_apply_contract_change(uuid, uuid, text, numeric, boolean, text, text) from public, anon;
grant execute on function public.project_apply_contract_change(uuid, uuid, text, numeric, boolean, text, text) to authenticated;

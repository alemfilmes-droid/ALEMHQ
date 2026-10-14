-- Aprovar orçamento → recebimentos. Um único passo, transacional (approve_budget): liga ou cria o cliente e o
-- projeto, cria pautas iniciais a partir dos itens (só a descrição — custo do orçamento NUNCA vai para o
-- projeto), cria as parcelas no financeiro ou delega a data de pagamento a alguém do financeiro, marca o negócio
-- do CRM como ganho (mantendo o vínculo) e registra quem aprovou e quando. Se qualquer passo falhar, nada fica.
--
-- Recebimento "Data a definir": due_date nulo. Não entra no fluxo de caixa nem no "a receber" do mês, nunca fica
-- atrasado e não pode ter baixa até a data ser definida. Quem precisa definir fica em date_owner_id (com uma
-- pauta, que já notifica a pessoa); quando a data é preenchida, a pauta é arquivada com um registro.
--
-- Valor do contrato do projeto: preenchido com o total do orçamento SÓ quando está vazio (fica no histórico de
-- contrato como "definição"). A conta da margem (contrato − custos lançados) não muda.
--
-- Volta (se precisar): drop function public.approve_budget(uuid, jsonb); drop function public.budget_approval_total(uuid); drop function
-- public.receivable_define_dates(uuid, public.payment_method, jsonb); drop function
-- public.finance_people_for_delegation(); drop trigger receivables_date_defined on public.receivables; drop
-- function public.receivables_date_defined(); recriar receivables_with_status sem 'data_a_definir' (20261023090000);
-- update public.receivables set due_date = created_at::date where due_date is null; alter table public.receivables
-- alter column due_date set not null, drop column budget_id, drop column date_owner_id; alter table public.budgets
-- drop column approved_by, drop column approved_at; restaurar pautas_source_ref_type_check (20261007110000).

-- ---------------------------------------------------------------------------
-- Colunas
-- ---------------------------------------------------------------------------

alter table public.receivables alter column due_date drop not null;
alter table public.receivables
  add column budget_id uuid references public.budgets (id) on delete set null,
  add column date_owner_id uuid references public.profiles (id) on delete set null,
  add constraint receivables_dated_before_settle_check check (due_date is not null or received_at is null);

create index receivables_budget_idx on public.receivables (budget_id) where budget_id is not null;
create index receivables_date_pending_idx on public.receivables (created_at) where due_date is null and cancelled_at is null;

alter table public.budgets
  add column approved_by uuid references public.profiles (id) on delete set null,
  add column approved_at timestamptz;

alter table public.pautas drop constraint pautas_source_ref_type_check;
alter table public.pautas add constraint pautas_source_ref_type_check check (
  source_ref_type is null or source_ref_type in (
    'receivable', 'payable', 'weekly_report', 'monthly_close', 'client_invoices', 'payee_payments', 'receivable_date'
  )
);

-- ---------------------------------------------------------------------------
-- Status com "Data a definir" (r.* expandido de novo: inclui budget_id e date_owner_id)
-- ---------------------------------------------------------------------------

drop view if exists public.receivables_with_status;
create view public.receivables_with_status
with (security_invoker = true) as
select
  r.*,
  c.name as company_name,
  p.name as project_name,
  case
    when r.cancelled_at is not null then 'cancelado'
    when r.received_at is not null then 'recebido'
    when r.due_date is null then 'data_a_definir'
    when r.due_date < (now() at time zone 'America/Fortaleza')::date then 'atrasado'
    else 'pendente'
  end as status
from public.receivables r
left join public.companies c on c.id = r.company_id
left join public.projects p on p.id = r.project_id;

revoke all on public.receivables_with_status from anon;
grant select on public.receivables_with_status to authenticated;

-- ---------------------------------------------------------------------------
-- Quem pode receber a tarefa de definir a data: pessoas ativas do squad financeiro
-- ---------------------------------------------------------------------------

create function public.finance_people_for_delegation()
returns table (profile_id uuid, full_name text, avatar_url text, org_level public.org_level)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_manage_budgets() then
    raise exception 'Sem acesso aos orçamentos.' using errcode = '42501';
  end if;
  return query
  select p.id, p.full_name, p.avatar_url, p.org_level
  from public.profiles p
  join public.profile_squads ps on ps.profile_id = p.id and ps.squad = 'financeiro'
  where p.is_active
  order by case p.org_level when 'head' then 0 when 'executor' then 1 else 2 end, p.full_name;
end;
$$;

revoke all on function public.finance_people_for_delegation() from public, anon;
grant execute on function public.finance_people_for_delegation() to authenticated;

-- ---------------------------------------------------------------------------
-- Total do orçamento como o banco calcula (budget_final_total) — as parcelas precisam somar exatamente isto
-- ---------------------------------------------------------------------------

create function public.budget_approval_total(p_budget_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_manage_budgets() then
    raise exception 'Sem acesso aos orçamentos.' using errcode = '42501';
  end if;
  return public.budget_final_total(p_budget_id);
end;
$$;

revoke all on function public.budget_approval_total(uuid) from public, anon;
grant execute on function public.budget_approval_total(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Aprovar
-- ---------------------------------------------------------------------------
--
-- p_payload (montado e validado em lib/budgets/approval.ts; validado de novo aqui):
-- {
--   "note": "…",
--   "company": {"mode": "existing", "id": "…"} | {"mode": "new", "name", "document", "segment", "source"},
--   "project": {"mode": "existing", "id": "…"} | {"mode": "new", "name", "model", "stage", "date"},
--              (date = prazo de entrega no Transacional, início no Recorrente — exigido por projects_model_dates_check)
--   "pauta_item_ids": ["<budget_items.id>", …],
--   "payment": {"mode": "schedule", "method": "pix"|null, "installments": [{"amount": 1000.00, "due_date": "2026-11-10"}, …]}
--            | {"mode": "delegate", "assignee_id": "…"}
-- }

create function public.approve_budget(p_budget_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_budget public.budgets;
  v_total numeric;
  v_label text;
  v_company_id uuid;
  v_company_name text;
  v_project public.projects;
  v_payment jsonb := p_payload -> 'payment';
  v_count int;
  v_sum numeric;
  v_method public.payment_method;
  v_receivable_ids uuid[] := '{}';
  v_receivable_id uuid;
  v_pauta_ids uuid[] := '{}';
  v_assignee uuid;
  v_pauta_id uuid;
  v_deal public.deals;
  v_deal_result text := 'sem_crm';
  v_contract_set boolean := false;
  v_today date := (now() at time zone 'America/Fortaleza')::date;
  r record;
  v_i int := 0;
begin
  if not public.can_manage_budgets() then
    raise exception 'Só o master e o financeiro aprovam orçamentos.' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Dados da aprovação inválidos.' using errcode = '22023';
  end if;

  select * into v_budget from public.budgets b where b.id = p_budget_id for update;
  if v_budget.id is null then
    raise exception 'Orçamento não encontrado.' using errcode = '22023';
  end if;
  if v_budget.status = 'aprovado' then
    raise exception 'Este orçamento já foi aprovado.' using errcode = '23514';
  end if;
  if v_budget.status not in ('enviado', 'em_analise') then
    raise exception 'Só orçamentos enviados ao cliente ou em análise podem ser aprovados.' using errcode = '23514';
  end if;

  v_total := public.budget_final_total(v_budget.id);
  if coalesce(v_total, 0) <= 0 then
    raise exception 'O orçamento está sem valor.' using errcode = '23514';
  end if;
  v_label := 'Orçamento nº ' || lpad(v_budget.number::text, 4, '0') || case when v_budget.version > 1 then ' v' || v_budget.version else '' end;

  if v_budget.deal_id is not null then
    select * into v_deal from public.deals d where d.id = v_budget.deal_id for update;
  end if;

  -- 1) Cliente --------------------------------------------------------------
  if p_payload #>> '{company,mode}' = 'existing' then
    v_company_id := nullif(p_payload #>> '{company,id}', '')::uuid;
    if not exists (select 1 from public.companies c where c.id = v_company_id and c.deleted_at is null) then
      raise exception 'Cliente não encontrado.' using errcode = '22023';
    end if;
  elsif p_payload #>> '{company,mode}' = 'new' then
    if v_deal.id is not null then
      raise exception 'Este orçamento veio de um negócio do CRM: o cliente é o do negócio.' using errcode = '23514';
    end if;
    if length(btrim(coalesce(p_payload #>> '{company,name}', ''))) < 2 then
      raise exception 'Informe o nome do cliente.' using errcode = '23514';
    end if;
    insert into public.companies (name, document, segment, source, lifecycle, created_by)
    values (
      btrim(p_payload #>> '{company,name}'),
      nullif(btrim(coalesce(p_payload #>> '{company,document}', '')), ''),
      nullif(btrim(coalesce(p_payload #>> '{company,segment}', '')), ''),
      nullif(p_payload #>> '{company,source}', '')::public.company_source,
      'client',
      v_actor
    )
    returning id into v_company_id;
  else
    raise exception 'Escolha ou cadastre o cliente.' using errcode = '23514';
  end if;

  if v_deal.id is not null and v_deal.company_id is distinct from v_company_id then
    raise exception 'Este orçamento veio de um negócio do CRM: o cliente é o do negócio.' using errcode = '23514';
  end if;

  update public.companies set lifecycle = 'client' where id = v_company_id and lifecycle = 'prospect';
  select c.name into v_company_name from public.companies c where c.id = v_company_id;

  -- 2) Projeto --------------------------------------------------------------
  if p_payload #>> '{project,mode}' = 'existing' then
    select * into v_project from public.projects p where p.id = nullif(p_payload #>> '{project,id}', '')::uuid;
    if v_project.id is null then
      raise exception 'Projeto não encontrado.' using errcode = '22023';
    end if;
    if v_project.company_id is distinct from v_company_id then
      raise exception 'O projeto escolhido é de outro cliente.' using errcode = '23514';
    end if;
    if v_deal.id is not null and v_project.deal_id is null then
      update public.projects set deal_id = v_deal.id where id = v_project.id returning * into v_project;
    end if;
  elsif p_payload #>> '{project,mode}' = 'new' then
    if length(btrim(coalesce(p_payload #>> '{project,name}', ''))) < 2 then
      raise exception 'Informe o nome do projeto.' using errcode = '23514';
    end if;
    if nullif(p_payload #>> '{project,date}', '') is null then
      raise exception 'Informe o prazo de entrega (Transacional) ou o início (Recorrente) do projeto.' using errcode = '23514';
    end if;
    insert into public.projects (name, company_id, deal_id, model, stage, due_date, start_date, owner_id, created_by)
    values (
      btrim(p_payload #>> '{project,name}'),
      v_company_id,
      v_deal.id,
      coalesce(nullif(p_payload #>> '{project,model}', ''), 'transacional')::public.project_model,
      coalesce(nullif(p_payload #>> '{project,stage}', ''), 'planejamento')::public.project_stage,
      case when coalesce(nullif(p_payload #>> '{project,model}', ''), 'transacional') = 'transacional' then (p_payload #>> '{project,date}')::date end,
      case when p_payload #>> '{project,model}' = 'recorrente' then (p_payload #>> '{project,date}')::date end,
      v_actor,
      v_actor
    )
    returning * into v_project;
    insert into public.project_members (project_id, profile_id) values (v_project.id, v_actor) on conflict do nothing;
  else
    raise exception 'Escolha ou crie o projeto.' using errcode = '23514';
  end if;

  -- 3) Valor do contrato: só quando está vazio (a margem continua contrato − custos lançados à mão) ------
  if not exists (select 1 from public.project_financials pf where pf.project_id = v_project.id and pf.contract_value is not null) then
    insert into public.project_financials (project_id, contract_value) values (v_project.id, v_total)
    on conflict (project_id) do update set contract_value = excluded.contract_value;
    insert into public.project_contract_changes (project_id, budget_id, change_type, previous_value, new_value, amount, description, changed_by)
    values (v_project.id, v_budget.id, 'definicao', null, v_total, v_total, left(v_label || ' aprovado', 200), v_actor);
    v_contract_set := true;
  end if;

  -- 4) Pautas iniciais: só a descrição dos itens escolhidos (nada de custo, quantidade ou preço) --------
  if jsonb_typeof(p_payload -> 'pauta_item_ids') = 'array' and jsonb_array_length(p_payload -> 'pauta_item_ids') > 0 then
    if jsonb_array_length(p_payload -> 'pauta_item_ids') > 40 then
      raise exception 'Escolha até 40 itens para virar pauta.' using errcode = '23514';
    end if;
    for r in
      select i.id, i.description
      from public.budget_items i
      where i.budget_id = v_budget.id
        and i.id in (select value::uuid from jsonb_array_elements_text(p_payload -> 'pauta_item_ids'))
      order by i.section, i.position
    loop
      insert into public.pautas (project_id, title, briefing, squad, board_column, status, lead_id, current_assignee_id, created_by, priority)
      values (
        v_project.id, left(r.description, 200), 'Criada na aprovação do ' || v_label || '.',
        'audiovisual', 'sprint_backlog', 'planejamento', v_project.owner_id, v_project.owner_id, v_actor, 'media'
      )
      returning id into v_pauta_id;
      v_pauta_ids := v_pauta_ids || v_pauta_id;
    end loop;
    if coalesce(array_length(v_pauta_ids, 1), 0) <> jsonb_array_length(p_payload -> 'pauta_item_ids') then
      raise exception 'Algum item escolhido para pauta não é deste orçamento.' using errcode = '23514';
    end if;
  end if;

  -- 5) Pagamento ------------------------------------------------------------
  if v_payment ->> 'mode' = 'schedule' then
    v_count := coalesce(jsonb_array_length(v_payment -> 'installments'), 0);
    if v_count < 1 or v_count > 36 then
      raise exception 'Informe de 1 a 36 parcelas.' using errcode = '23514';
    end if;
    if exists (
      select 1 from jsonb_to_recordset(v_payment -> 'installments') as x(amount numeric, due_date date)
      where x.amount is null or x.amount <= 0 or x.due_date is null or x.amount <> round(x.amount, 2)
    ) then
      raise exception 'Cada parcela precisa de valor maior que zero e data.' using errcode = '23514';
    end if;
    select sum(x.amount) into v_sum from jsonb_to_recordset(v_payment -> 'installments') as x(amount numeric);
    if v_sum <> v_total then
      raise exception 'A soma das parcelas (%) precisa ser igual ao total do orçamento (%).', public.fmt_brl(v_sum), public.fmt_brl(v_total)
        using errcode = '23514';
    end if;
    v_method := nullif(v_payment ->> 'method', '')::public.payment_method;

    for r in
      select (t.item ->> 'amount')::numeric as amount, (t.item ->> 'due_date')::date as due_date, t.ord
      from jsonb_array_elements(v_payment -> 'installments') with ordinality as t(item, ord)
      order by t.ord
    loop
      v_i := v_i + 1;
      insert into public.receivables (
        company_id, project_id, deal_id, budget_id, description, installment_number, installment_total,
        amount, due_date, payment_method, created_by
      ) values (
        v_company_id, v_project.id, v_deal.id, v_budget.id,
        left(v_label || ' · ' || v_budget.title, 200),
        case when v_count > 1 then v_i end, case when v_count > 1 then v_count end,
        r.amount, r.due_date, v_method, v_actor
      )
      returning id into v_receivable_id;
      v_receivable_ids := v_receivable_ids || v_receivable_id;
    end loop;

  elsif v_payment ->> 'mode' = 'delegate' then
    v_assignee := nullif(v_payment ->> 'assignee_id', '')::uuid;
    if v_assignee is null or not exists (
      select 1 from public.profiles p join public.profile_squads ps on ps.profile_id = p.id and ps.squad = 'financeiro'
      where p.id = v_assignee and p.is_active
    ) then
      raise exception 'Escolha uma pessoa do financeiro para definir a data.' using errcode = '23514';
    end if;

    insert into public.receivables (company_id, project_id, deal_id, budget_id, description, amount, due_date, date_owner_id, created_by)
    values (v_company_id, v_project.id, v_deal.id, v_budget.id, left(v_label || ' · ' || v_budget.title, 200), v_total, null, v_assignee, v_actor)
    returning id into v_receivable_id;
    v_receivable_ids := v_receivable_ids || v_receivable_id;

    insert into public.pautas (
      title, briefing, squad, board_column, status, lead_id, current_assignee_id, created_by,
      project_id, is_standalone, due_date, priority, source, source_ref_type, source_ref_id, self_complete
    ) values (
      left('Definir data de pagamento — Orçamento #' || lpad(v_budget.number::text, 4, '0'), 200),
      'Cliente ' || v_company_name || ' aprovou o ' || v_label || ' (' || public.fmt_brl(v_total) || '). '
        || 'Combine a data (ou as parcelas) e preencha no recebimento em Financeiro › Recebimentos (filtro "Data a definir").'
        || coalesce(' Condições do orçamento: ' || nullif(btrim(v_budget.payment_terms), ''), ''),
      'financeiro', 'sprint_backlog', 'planejamento', coalesce(public.finance_lead_id(), v_actor), v_assignee, v_actor,
      v_project.id, false, v_today + 2, 'alta', 'auto_financeiro', 'receivable_date', v_receivable_id, true
    )
    returning id into v_pauta_id;
    -- A notificação para a pessoa sai do gatilho pautas_notify_created ("Nova pauta para você", com o link da
    -- pauta) — não notificamos de novo aqui para não chegar em dobro.
  else
    raise exception 'Defina o pagamento: datas agora ou delegar para o financeiro.' using errcode = '23514';
  end if;

  -- 6) CRM: o negócio vira ganho e o vínculo fica (orçamento, projeto e recebimentos guardam o deal_id) ----
  if v_deal.id is not null then
    if v_deal.stage = 'ganho' then
      v_deal_result := 'ja_ganho';
    elsif v_deal.stage = 'perdido' then
      v_deal_result := 'perdido';
    else
      insert into public.deal_interactions (deal_id, kind, body, stage, stage_to, consumed_at, author_id)
      values (v_deal.id, 'nota', 'Negócio ganho: ' || v_label || ' aprovado (' || public.fmt_brl(v_total) || ').', v_deal.stage, 'ganho', now(), v_actor);
      perform set_config('app.allow_deal_won', 'true', true);
      perform set_config('app.crm_system', 'true', true);
      update public.deals set stage = 'ganho', estimated_value = v_total where id = v_deal.id;
      perform set_config('app.allow_deal_won', 'false', true);
      perform set_config('app.crm_system', 'false', true);
      perform public.log_activity('won', 'deal', v_deal.id, jsonb_build_object('budget_id', v_budget.id, 'project_id', v_project.id));
      v_deal_result := 'ganho';
    end if;
    if v_budget.deal_proposal_id is not null then
      update public.deal_proposals set status = 'aceita' where id = v_budget.deal_proposal_id;
    end if;
  end if;

  -- 7) Orçamento aprovado + registro de quem aprovou ----------------------------------------------
  update public.budgets
  set status = 'aprovado',
      decided_at = now(),
      status_note = nullif(btrim(coalesce(p_payload ->> 'note', '')), ''),
      approved_by = v_actor,
      approved_at = now(),
      company_id = v_company_id,
      project_id = v_project.id,
      contract_synced_total = case when v_contract_set then v_total else contract_synced_total end
  where id = v_budget.id;

  perform public.log_activity('approved', 'budget', v_budget.id, jsonb_build_object(
    'total', v_total,
    'company_id', v_company_id,
    'project_id', v_project.id,
    'payment_mode', v_payment ->> 'mode',
    'receivable_ids', to_jsonb(v_receivable_ids),
    'pauta_ids', to_jsonb(v_pauta_ids),
    'deal_id', v_deal.id,
    'deal_result', v_deal_result,
    'contract_set', v_contract_set
  ));

  return jsonb_build_object(
    'company_id', v_company_id,
    'project_id', v_project.id,
    'receivable_ids', to_jsonb(v_receivable_ids),
    'pauta_ids', to_jsonb(v_pauta_ids),
    'deal_id', v_deal.id,
    'deal_result', v_deal_result,
    'contract_set', v_contract_set,
    'total', v_total
  );
end;
$$;

revoke all on function public.approve_budget(uuid, jsonb) from public, anon;
grant execute on function public.approve_budget(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Data definida (ou recebimento cancelado) → a pauta "Definir data de pagamento" sai do quadro, com registro
-- ---------------------------------------------------------------------------

create function public.receivables_date_defined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_body text;
begin
  if old.due_date is null and new.due_date is not null then
    v_body := 'Concluída: data de pagamento definida para ' || to_char(new.due_date, 'DD/MM/YYYY') || '.';
  elsif old.cancelled_at is null and new.cancelled_at is not null and new.due_date is null then
    v_body := 'Arquivada automaticamente: o recebimento foi cancelado.';
  else
    return new;
  end if;
  for r in
    select pt.id from public.pautas pt
    where pt.source = 'auto_financeiro' and pt.source_ref_type = 'receivable_date' and pt.source_ref_id = new.id and pt.archived_at is null
  loop
    insert into public.pauta_logs (pauta_id, author_id, kind, body) values (r.id, auth.uid(), 'registro', v_body);
    update public.pautas set archived_at = now() where id = r.id;
  end loop;
  return new;
end;
$$;

create trigger receivables_date_defined
  after update of due_date, cancelled_at on public.receivables
  for each row execute function public.receivables_date_defined();

-- ---------------------------------------------------------------------------
-- Definir a data (ou dividir em parcelas) de um recebimento "Data a definir" — tudo ou nada
-- ---------------------------------------------------------------------------
--
-- p_installments: [{"amount": 1000.00, "due_date": "2026-11-10"}, …], soma igual ao valor do recebimento.
-- A primeira parcela fica no próprio recebimento (mesmo id); as demais são criadas com os mesmos vínculos.

create function public.receivable_define_dates(p_receivable_id uuid, p_method public.payment_method, p_installments jsonb)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec public.receivables;
  v_count int;
  v_sum numeric;
  v_ids uuid[] := '{}';
  v_id uuid;
  r record;
begin
  if not public.has_finance_access() then
    raise exception 'Sem acesso ao financeiro.' using errcode = '42501';
  end if;
  select * into v_rec from public.receivables x where x.id = p_receivable_id for update;
  if v_rec.id is null then
    raise exception 'Recebimento não encontrado.' using errcode = '22023';
  end if;
  if v_rec.due_date is not null or v_rec.cancelled_at is not null or v_rec.received_at is not null then
    raise exception 'Este recebimento já tem data (ou foi cancelado/recebido).' using errcode = '23514';
  end if;

  v_count := case when jsonb_typeof(p_installments) = 'array' then jsonb_array_length(p_installments) else 0 end;
  if v_count < 1 or v_count > 36 then
    raise exception 'Informe de 1 a 36 parcelas.' using errcode = '23514';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_installments) as x(amount numeric, due_date date)
    where x.amount is null or x.amount <= 0 or x.due_date is null or x.amount <> round(x.amount, 2)
  ) then
    raise exception 'Cada parcela precisa de valor maior que zero e data.' using errcode = '23514';
  end if;
  select sum(x.amount) into v_sum from jsonb_to_recordset(p_installments) as x(amount numeric);
  if v_sum <> v_rec.amount then
    raise exception 'A soma das parcelas (%) precisa ser igual ao valor do recebimento (%).', public.fmt_brl(v_sum), public.fmt_brl(v_rec.amount)
      using errcode = '23514';
  end if;

  for r in
    select (t.item ->> 'amount')::numeric as amount, (t.item ->> 'due_date')::date as due_date, t.ord
    from jsonb_array_elements(p_installments) with ordinality as t(item, ord)
    order by t.ord
  loop
    if r.ord = 1 then
      update public.receivables
      set due_date = r.due_date, amount = r.amount,
          installment_number = case when v_count > 1 then 1 end, installment_total = case when v_count > 1 then v_count end,
          payment_method = coalesce(p_method, payment_method)
      where id = v_rec.id;
      v_ids := v_ids || v_rec.id;
    else
      insert into public.receivables (
        company_id, project_id, deal_id, budget_id, description, service_description, competence_month,
        installment_number, installment_total, amount, due_date, payment_method, requires_invoice, notes, date_owner_id, created_by
      ) values (
        v_rec.company_id, v_rec.project_id, v_rec.deal_id, v_rec.budget_id, v_rec.description, v_rec.service_description, v_rec.competence_month,
        r.ord, v_count, r.amount, r.due_date, coalesce(p_method, v_rec.payment_method), v_rec.requires_invoice, v_rec.notes, v_rec.date_owner_id, auth.uid()
      )
      returning id into v_id;
      v_ids := v_ids || v_id;
    end if;
  end loop;

  perform public.log_activity('dates_defined', 'receivable', v_rec.id, jsonb_build_object('receivable_ids', to_jsonb(v_ids), 'budget_id', v_rec.budget_id));
  return v_ids;
end;
$$;

revoke all on function public.receivable_define_dates(uuid, public.payment_method, jsonb) from public, anon;
grant execute on function public.receivable_define_dates(uuid, public.payment_method, jsonb) to authenticated;

-- Bloco 7 — Metas, comissões e comemoração (pedido do Anderson).
--
-- • "Finalizar meta" (CEO/admin) — goal_finalize(): Meta batida (comissão: percentual → o CEO informa o valor
--   final em R$; valor fixo → o valor da meta; por unidade → o calculado) ou Meta não alcançada (mostra quanto
--   faltou). NÃO cria o pagamento: o CEO e o squad financeiro recebem "Agendar pagamento da comissão de …" e o
--   financeiro lança à mão ("Referente a: Comissão"). Metas por contratos fechados continuam com a aprovação
--   anterior (pagamento por contrato).
-- • Pagamento "Referente a: Comissão" = categoria comissao + favorecido da equipe (beneficiário) + meta ligada
--   (opcional, payables.commission_goal_id). Ao lançar: o beneficiário recebe "Sua comissão de R$ X será paga em
--   DD/MM"; a meta mostra "Comissão agendada" e, depois da baixa, "Comissão paga".
-- • Comemoração (popup com confete), uma vez por comissão: commission_celebrations — nasce quando a meta é batida
--   com comissão ou quando entra um pagamento de comissão que não é de uma meta já comemorada.
--
-- Só adiciona colunas/tabela e cria/substitui funções; a view goals_with_progress é recriada com o mesmo corpo
-- (g.* é expandido na criação). Nenhum dado existente muda.

alter table public.goals
  add column if not exists outcome text check (outcome is null or outcome in ('batida', 'nao_batida'));
alter table public.payables
  add column if not exists commission_goal_id uuid references public.goals (id) on delete set null;

create index if not exists payables_commission_goal_idx on public.payables (commission_goal_id) where commission_goal_id is not null;

-- Valor fixo: o valor da meta, a partir do gatilho (min_achievement_pct; no formulário, 100% por padrão).
create or replace function public.goal_commission(
  p_mode public.goal_commission_mode, p_rate numeric, p_min_pct numeric, p_target numeric, p_achieved numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_target > 0 and p_achieved > 0 and p_achieved * 100 / p_target >= p_min_pct then
      round(case p_mode
        when 'percentual' then p_achieved * p_rate / 100
        when 'valor_fixo' then p_rate
        else p_achieved * p_rate
      end, 2)
    else 0
  end
$$;

drop view if exists public.goals_with_progress;
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
  from public.goal_closed_contracts_visible(g.id, false) cc
  where g.commission_mode = 'contratos_fechados' and public.can_view_goal(g.id)
) c on true
left join lateral (
  select sum(cc.contract_value) as closed_value
  from public.goal_closed_contracts_visible(g.id, true) cc
  where g.commission_mode = 'contratos_fechados' and public.can_view_goal(g.id)
) cp on true;

revoke all on public.goals_with_progress from anon;
grant select on public.goals_with_progress to authenticated;

-- ---------------------------------------------------------------------------
-- Comemoração: uma por comissão
-- ---------------------------------------------------------------------------

create table public.commission_celebrations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  goal_id uuid references public.goals (id) on delete set null,
  payable_id uuid references public.payables (id) on delete set null,
  goal_title text,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);

create unique index commission_celebrations_goal_idx on public.commission_celebrations (goal_id) where goal_id is not null and payable_id is null;
create unique index commission_celebrations_payable_idx on public.commission_celebrations (payable_id) where payable_id is not null;
create index commission_celebrations_unseen_idx on public.commission_celebrations (profile_id, created_at) where seen_at is null;

alter table public.commission_celebrations enable row level security;

create policy "commission_celebrations_select_own" on public.commission_celebrations for select to authenticated
  using (profile_id = auth.uid());

revoke all on public.commission_celebrations from anon, authenticated;
grant select on public.commission_celebrations to authenticated;

-- "Fechar" do popup: marca como vista (só a própria).
create function public.commission_celebration_seen(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.commission_celebrations set seen_at = now() where id = p_id and profile_id = auth.uid() and seen_at is null
$$;

revoke all on function public.commission_celebration_seen(uuid) from public, anon;
grant execute on function public.commission_celebration_seen(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Finalizar meta
-- ---------------------------------------------------------------------------

create function public.goal_finalize(p_goal_id uuid, p_reached boolean, p_commission numeric default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.goals%rowtype;
  v_pending int;
  v_achieved numeric;
  v_commission numeric := 0;
  v_missing numeric;
  v_owner_name text;
  v_recipient uuid;
begin
  if not public.crm_is_ceo() then
    raise exception 'Só o CEO ou um admin finaliza metas.' using errcode = '42501';
  end if;
  select * into g from public.goals where id = p_goal_id for update;
  if not found then
    raise exception 'Meta não encontrada.' using errcode = 'P0002';
  end if;
  if g.status not in ('ativa', 'em_revisao') then
    raise exception 'Esta meta já foi encerrada.' using errcode = '22023';
  end if;
  if g.commission_mode = 'contratos_fechados' then
    raise exception 'Metas por contratos fechados são encerradas pela aprovação (pagamento por contrato).' using errcode = '22023';
  end if;
  select count(*) into v_pending from public.goal_entries where goal_id = g.id and status = 'pendente';
  if v_pending > 0 then
    raise exception 'Revise os % lançamentos pendentes antes de finalizar.', v_pending using errcode = '22023';
  end if;

  select coalesce(sum(amount), 0) into v_achieved from public.goal_entries where goal_id = g.id and status = 'aprovado';
  select full_name into v_owner_name from public.profiles where id = g.owner_id;
  v_missing := greatest(0, round(100 - v_achieved * 100 / g.target_value, 1));

  if p_reached then
    v_commission := case g.commission_mode
      when 'percentual' then coalesce(p_commission, 0)
      when 'valor_fixo' then g.commission_rate
      else public.goal_commission(g.commission_mode, g.commission_rate, 0, g.target_value, v_achieved)
    end;
    if g.commission_mode = 'percentual' and v_commission <= 0 then
      raise exception 'Informe o valor final da comissão (R$), já calculado.' using errcode = '22023';
    end if;
  end if;

  perform set_config('alem.goal_approving', 'on', true);
  update public.goals
  set status = 'aprovada', approved_at = now(), approved_by = auth.uid(),
      final_achieved = v_achieved, final_commission = v_commission,
      outcome = case when p_reached then 'batida' else 'nao_batida' end
  where id = g.id;
  perform set_config('alem.goal_approving', 'off', true);

  if p_reached then
    perform public.notify(g.owner_id, 'goal_reached', 'Meta batida!',
      g.title || case when v_commission > 0 then ' · comissão de ' || public.fmt_brl(v_commission) || '. O financeiro vai agendar o pagamento.' else '.' end,
      'goal', g.id, '/metas/' || g.id);
  else
    perform public.notify(g.owner_id, 'goal_not_reached', 'Meta não alcançada',
      g.title || ' · faltaram ' || public.fmt_qty(v_missing) || '%.', 'goal', g.id, '/metas/' || g.id);
  end if;

  if p_reached and v_commission > 0 then
    -- CEO e squad financeiro: agendar o pagamento (o lançamento é manual, "Referente a: Comissão").
    for v_recipient in
      select p.id from public.profiles p where p.org_level = 'master' and p.is_active
      union
      select ps.profile_id from public.profile_squads ps join public.profiles p on p.id = ps.profile_id and p.is_active where ps.squad = 'financeiro'
    loop
      if v_recipient is distinct from auth.uid() then
        perform public.notify(v_recipient, 'goal_commission_to_schedule', 'Agendar pagamento de comissão',
          'Agendar pagamento da comissão de ' || coalesce(v_owner_name, 'responsável') || ' — ' || g.title || ' — ' || public.fmt_brl(v_commission),
          'goal', g.id, '/financeiro?aba=pagamentos');
      end if;
    end loop;

    insert into public.commission_celebrations (profile_id, amount, goal_id, goal_title)
    values (g.owner_id, v_commission, g.id, g.title)
    on conflict do nothing;
  end if;
end;
$$;

revoke all on function public.goal_finalize(uuid, boolean, numeric) from public, anon;
grant execute on function public.goal_finalize(uuid, boolean, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- Pagamento "Referente a: Comissão"
-- ---------------------------------------------------------------------------

create function public.payables_commission_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_goal public.goals%rowtype;
  v_when date;
begin
  if new.category <> 'comissao' or new.payee_profile_id is null or new.cancelled_at is not null then
    return null;
  end if;
  if new.commission_goal_id is not null then
    select * into v_goal from public.goals where id = new.commission_goal_id;
  end if;

  if tg_op = 'INSERT' or new.scheduled_for is distinct from old.scheduled_for then
    v_when := coalesce(new.scheduled_for, new.due_date);
    perform public.notify(new.payee_profile_id, 'commission_scheduled', 'Comissão agendada',
      'Sua comissão de ' || public.fmt_brl(new.amount) || ' será paga em ' || to_char(v_when, 'DD/MM') || '.'
        || coalesce(' Meta: ' || v_goal.title || '.', ''),
      'payable', new.id, coalesce('/metas/' || new.commission_goal_id, '/metas'));
  end if;

  if tg_op = 'UPDATE' and new.paid_at is not null and old.paid_at is null then
    perform public.notify(new.payee_profile_id, 'commission_paid', 'Comissão paga',
      'Sua comissão de ' || public.fmt_brl(new.amount) || ' foi paga.', 'payable', new.id, coalesce('/metas/' || new.commission_goal_id, '/metas'));
  end if;

  -- Comemoração: comissão nova para a pessoa (a de meta batida já foi comemorada na finalização).
  if tg_op = 'INSERT' and new.amount > 0 and not exists (
    select 1 from public.commission_celebrations c where c.goal_id = new.commission_goal_id and new.commission_goal_id is not null
  ) then
    insert into public.commission_celebrations (profile_id, amount, goal_id, payable_id, goal_title)
    values (new.payee_profile_id, new.amount, new.commission_goal_id, new.id, v_goal.title)
    on conflict do nothing;
  end if;
  return null;
end;
$$;

create trigger payables_commission_events
  after insert or update of scheduled_for, paid_at on public.payables
  for each row execute function public.payables_commission_events();

-- Histórico de comissão da meta (o dono e a diretoria veem; payables é só do financeiro pela RLS).
create function public.goal_commission_payments(p_goal_id uuid)
returns table (amount numeric, due_date date, scheduled_for date, paid_at date)
language sql
stable
security definer
set search_path = ''
as $$
  select pa.amount, pa.due_date, pa.scheduled_for, pa.paid_at
  from public.payables pa
  join public.goals g on g.id = p_goal_id
  where public.can_view_goal(p_goal_id)
    and pa.cancelled_at is null
    and (pa.commission_goal_id = p_goal_id or pa.id = g.payable_id)
  order by pa.due_date
$$;

revoke all on function public.goal_commission_payments(uuid) from public, anon;
grant execute on function public.goal_commission_payments(uuid) to authenticated;

-- Metas para o campo "Meta" do pagamento de comissão (quem tem acesso ao financeiro).
create function public.finance_commission_goals()
returns table (id uuid, title text, owner_id uuid, outcome text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.title, g.owner_id, g.outcome
  from public.goals g
  where public.has_finance_access() and g.status in ('ativa', 'em_revisao', 'aprovada')
  order by g.ends_on desc
  limit 200
$$;

revoke all on function public.finance_commission_goals() from public, anon;
grant execute on function public.finance_commission_goals() to authenticated;

-- payables_with_status: mesmo corpo, agora com commission_goal_id e cancel_reason/cancelled_by (pa.* é expandido na criação).
drop view if exists public.payables_with_status;
create view public.payables_with_status
with (security_invoker = true) as
select
  pa.*,
  p.name as project_name,
  coalesce(nullif(btrim(pa.payee_name), ''), pr.full_name) as payee_label,
  case
    when pa.cancelled_at is not null then 'cancelado'
    when pa.paid_at is not null then 'pago'
    when pa.due_date < (now() at time zone 'America/Fortaleza')::date then 'atrasado'
    else 'pendente'
  end as status
from public.payables pa
left join public.projects p on p.id = pa.project_id
left join public.profiles pr on pr.id = pa.payee_profile_id;

revoke all on public.payables_with_status from anon;
grant select on public.payables_with_status to authenticated;

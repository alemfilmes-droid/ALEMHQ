-- Regras de margem (nova política da Além):
--   saudável >= 40% · atenção 30–39,99% · crítico < 30%.
-- Abaixo de 30%: a diretoria é avisada NA HORA e o projeto fica sinalizado (projects.margin_alert_at).
-- Entre 30% e 40%: sem alerta imediato — o projeto entra no relatório mensal "Projetos abaixo da
-- meta de margem", enviado à diretoria no fechamento (dia 1, sobre o mês que fechou) e visível no
-- Financeiro.

alter table public.company_settings
  alter column healthy_margin_pct set default 40,
  alter column attention_margin_pct set default 30;

update public.company_settings set healthy_margin_pct = 40, attention_margin_pct = 30 where id;

alter table public.projects add column margin_alert_at timestamptz;

-- Margem planejada de um projeto (mesma conta de project_profitability), sem depender da RLS.
create function public.project_margin_pct(p_project_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case when coalesce(pf.contract_value, 0) > 0
    then round((pf.contract_value - coalesce((
      select sum(y.amount) from public.payables y where y.project_id = p_project_id and y.cancelled_at is null
    ), 0)) / pf.contract_value * 100, 1)
  end
  from public.project_financials pf
  where pf.project_id = p_project_id
$$;

revoke all on function public.project_margin_pct(uuid) from public, anon, authenticated;

-- Quem recebe os alertas de margem: diretoria (squad ou nível) e master, ativos.
create function public.margin_alert_recipients()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p
  where p.is_active
    and (p.org_level in ('master', 'diretoria')
      or exists (select 1 from public.profile_squads ps where ps.profile_id = p.id and ps.squad = 'diretoria'))
$$;

revoke all on function public.margin_alert_recipients() from public, anon, authenticated;

-- Reavalia um projeto: abaixo do crítico sinaliza e avisa (uma vez); voltando acima, limpa o sinal.
create function public.project_margin_check(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pct numeric := public.project_margin_pct(p_project_id);
  v_critical numeric;
  v_alerted timestamptz;
  v_name text;
  v_recipient uuid;
begin
  if p_project_id is null then
    return;
  end if;
  select attention_margin_pct into v_critical from public.company_settings where id;
  select margin_alert_at, name into v_alerted, v_name from public.projects where id = p_project_id;

  if v_pct is not null and v_pct < v_critical then
    if v_alerted is null then
      update public.projects set margin_alert_at = now() where id = p_project_id;
      for v_recipient in select public.margin_alert_recipients() loop
        perform public.notify(v_recipient, 'finance_margin_critical', 'Margem abaixo de ' || public.fmt_qty(v_critical) || '%',
          coalesce(v_name, 'Projeto') || ' está com ' || public.fmt_qty(v_pct) || '% de margem. Ver o processo "Projeto abaixo da margem".',
          'project', p_project_id, '/projetos/' || p_project_id || '?aba=financeiro');
      end loop;
    end if;
  elsif v_alerted is not null then
    update public.projects set margin_alert_at = null where id = p_project_id;
  end if;
end;
$$;

revoke all on function public.project_margin_check(uuid) from public, anon, authenticated;

create function public.payables_margin_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.project_id is not null then
    perform public.project_margin_check(old.project_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.project_id is not null
     and (tg_op = 'INSERT' or new.project_id is distinct from old.project_id) then
    perform public.project_margin_check(new.project_id);
  end if;
  return null;
end;
$$;

create trigger payables_margin_check
  after insert or delete or update of amount, cancelled_at, project_id on public.payables
  for each row execute function public.payables_margin_check();

create function public.project_financials_margin_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.project_margin_check(new.project_id);
  return null;
end;
$$;

create trigger project_financials_margin_check
  after insert or update of contract_value on public.project_financials
  for each row execute function public.project_financials_margin_check();

-- Sinaliza já os projetos que estão abaixo de 30% hoje (sem notificar o passado em massa).
update public.projects p set margin_alert_at = now()
where public.project_margin_pct(p.id) < (select attention_margin_pct from public.company_settings where id)
  and p.stage <> 'cancelado';

-- ---------------------------------------------------------------------------
-- Relatório mensal: projetos entre 30% e 40% (abaixo da meta, sem alerta imediato)
-- ---------------------------------------------------------------------------

create function public.finance_margin_below_target()
returns table (project_id uuid, project_name text, company_name text, contract_value numeric, payables_total numeric, margin_pct numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_healthy numeric;
  v_critical numeric;
begin
  if not public.has_finance_access() then
    raise exception 'Sem acesso ao financeiro.' using errcode = '42501';
  end if;
  select healthy_margin_pct, attention_margin_pct into v_healthy, v_critical from public.company_settings where id;
  return query
  select p.id, p.name, c.name, pf.contract_value,
    coalesce((select sum(y.amount) from public.payables y where y.project_id = p.id and y.cancelled_at is null), 0)::numeric,
    public.project_margin_pct(p.id)
  from public.projects p
  join public.project_financials pf on pf.project_id = p.id and pf.contract_value > 0
  left join public.companies c on c.id = p.company_id
  where not p.is_internal and p.stage <> 'cancelado'
    and public.project_margin_pct(p.id) >= v_critical and public.project_margin_pct(p.id) < v_healthy
  order by public.project_margin_pct(p.id);
end;
$$;

revoke all on function public.finance_margin_below_target() from public, anon;
grant execute on function public.finance_margin_below_target() to authenticated;

-- Dia 1: a diretoria recebe o relatório do mês que fechou.
create function public.notify_margin_monthly_report()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Fortaleza')::date;
  v_healthy numeric;
  v_critical numeric;
  v_count int;
  v_recipient uuid;
  v_month text;
begin
  if extract(day from v_today) <> 1 then
    return;
  end if;
  select healthy_margin_pct, attention_margin_pct into v_healthy, v_critical from public.company_settings where id;
  select count(*) into v_count
  from public.projects p
  join public.project_financials pf on pf.project_id = p.id and pf.contract_value > 0
  where not p.is_internal and p.stage <> 'cancelado'
    and public.project_margin_pct(p.id) >= v_critical and public.project_margin_pct(p.id) < v_healthy;
  v_month := to_char(v_today - 1, 'MM/YYYY');
  for v_recipient in select public.margin_alert_recipients() loop
    perform public.notify(v_recipient, 'finance_margin_report', 'Fechamento ' || v_month || ': margem abaixo da meta',
      case when v_count = 0 then 'Nenhum projeto entre ' || public.fmt_qty(v_critical) || '% e ' || public.fmt_qty(v_healthy) || '% de margem.'
           else v_count || case when v_count = 1 then ' projeto' else ' projetos' end || ' entre ' || public.fmt_qty(v_critical) || '% e '
             || public.fmt_qty(v_healthy) || '% de margem. Veja o relatório no Financeiro.' end,
      'report', null, '/financeiro#margem-abaixo-da-meta');
  end loop;
end;
$$;

revoke all on function public.notify_margin_monthly_report() from public, anon, authenticated;

create or replace function public.run_daily_all()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.run_daily_reminders();
  perform public.notify_overdue_finance();
  perform public.notify_finance_due_today();
  perform public.notify_invoices_due();
  perform public.create_reactivation_pautas();
  perform public.notify_margin_monthly_report();
end;
$$;

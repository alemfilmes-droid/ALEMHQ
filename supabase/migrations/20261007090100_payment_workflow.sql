-- Pagamento executável a partir da lista: dados para pagar, agendamento e baixa com atraso/multa.
--
-- Dados de pagamento:
--   • Equipe: payment_details (já existente, por pessoa). A própria pessoa e a diretoria editam;
--     só quem tem acesso ao financeiro (has_finance_access(), que inclui can_see_money()) lê.
--   • Favorecido avulso (sem cadastro): os campos payee_* direto no pagamento.
-- Agendar NÃO é pagar: o pagamento agendado continua pendente/atrasado em todo total, gráfico e KPI;
-- só ganha a marca "Agendado para dd/mm". No dia agendado (e todo dia depois, enquanto aberto) a
-- executora e o líder do financeiro são lembrados de dar baixa.
-- Baixa depois do vencimento exige o motivo; multa/juros entram no custo (amount) para a margem
-- refletir o valor real pago — o valor original fica em original_amount.
-- payables continua restrita ao financeiro pela RLS existente ("payables_finance_only").

alter table public.payables
  add column scheduled_for date,
  add column scheduled_at timestamptz,
  add column scheduled_by uuid references public.profiles (id) on delete set null,
  add column paid_late boolean not null default false,
  add column late_reason text check (late_reason is null or length(late_reason) <= 500),
  add column penalty_amount numeric(12, 2) check (penalty_amount is null or penalty_amount > 0),
  add column penalty_reason text check (penalty_reason is null or length(penalty_reason) <= 500),
  add column original_amount numeric(12, 2),
  add column payment_receipt_url text check (payment_receipt_url is null or (length(payment_receipt_url) <= 500 and payment_receipt_url ~* '^https?://')),
  add column payee_pix_key text check (payee_pix_key is null or length(payee_pix_key) <= 160),
  add column payee_pix_key_type public.pix_key_type,
  add column payee_holder_name text check (payee_holder_name is null or length(payee_holder_name) <= 160),
  add column payee_document text check (payee_document is null or length(payee_document) <= 20),
  add column payee_bank_name text check (payee_bank_name is null or length(payee_bank_name) <= 120),
  add column payee_bank_agency text check (payee_bank_agency is null or length(payee_bank_agency) <= 20),
  add column payee_bank_account text check (payee_bank_account is null or length(payee_bank_account) <= 30),
  add column payee_account_type public.bank_account_type,
  add constraint payables_late_needs_reason check (not paid_late or late_reason is not null),
  add constraint payables_penalty_needs_reason check (penalty_amount is null or penalty_reason is not null);

create index payables_scheduled_idx on public.payables (scheduled_for) where scheduled_for is not null and paid_at is null;

-- Baixa: atraso calculado pelo banco (não pela tela); multa soma no custo uma vez só.
create function public.payables_settlement_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.paid_at is not null and old.paid_at is null then
    new.paid_late := new.paid_at > new.due_date;
    if new.paid_late and nullif(btrim(coalesce(new.late_reason, '')), '') is null then
      raise exception 'Pagamento depois do vencimento: informe o motivo do atraso.' using errcode = '22023';
    end if;
    if new.penalty_amount is not null and old.penalty_amount is null then
      new.original_amount := old.amount;
      new.amount := old.amount + new.penalty_amount;
    end if;
  elsif new.paid_at is null and old.paid_at is not null then
    -- Baixa desfeita: volta ao valor original.
    new.paid_late := false;
    new.late_reason := null;
    if old.original_amount is not null then
      new.amount := old.original_amount;
      new.original_amount := null;
      new.penalty_amount := null;
      new.penalty_reason := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger payables_settlement_guard
  before update of paid_at, penalty_amount on public.payables
  for each row execute function public.payables_settlement_guard();

-- pa.* é expandido na criação: recria a view com as colunas novas (mesmo corpo).
drop view public.payables_with_status;

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

-- ---------------------------------------------------------------------------
-- Dados de pagamento da equipe: a diretoria também edita os de outras pessoas.
-- ---------------------------------------------------------------------------

create policy "payment_details_insert_directors" on public.payment_details for insert to authenticated
  with check (public.can_manage_company());
create policy "payment_details_update_directors" on public.payment_details for update to authenticated
  using (public.can_manage_company())
  with check (public.can_manage_company());

-- ---------------------------------------------------------------------------
-- Lembrete: pagamento agendado para hoje (ou antes) ainda sem baixa — todo dia até a baixa.
-- ---------------------------------------------------------------------------

create function public.notify_scheduled_payments()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Fortaleza')::date;
  r record;
  v_recipient uuid;
begin
  for r in
    select pa.id, pa.description, pa.amount, pa.scheduled_for,
      coalesce(nullif(btrim(pa.payee_name), ''), pr.full_name, 'favorecido') as payee
    from public.payables pa
    left join public.profiles pr on pr.id = pa.payee_profile_id
    where pa.paid_at is null and pa.cancelled_at is null and pa.scheduled_for is not null and pa.scheduled_for <= v_today
  loop
    for v_recipient in select distinct x from (select public.finance_executor_id() as x union select public.finance_lead_id()) people where x is not null loop
      if not public.notified_today(v_recipient, 'finance_payment_scheduled', r.id) then
        perform public.notify(v_recipient, 'finance_payment_scheduled',
          case when r.scheduled_for = v_today then 'Pagamento agendado para hoje — dar baixa'
               else 'Pagamento agendado em ' || to_char(r.scheduled_for, 'DD/MM') || ' ainda sem baixa' end,
          r.payee || ' · ' || r.description || ' · ' || public.fmt_brl(r.amount),
          'payable', r.id, '/financeiro?aba=pagamentos&pagamento=' || r.id);
      end if;
    end loop;
  end loop;
end;
$$;

revoke all on function public.notify_scheduled_payments() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Pagamentos feitos com atraso (relatório do fechamento): dias, multa e motivo.
-- ---------------------------------------------------------------------------

create function public.finance_late_payments(p_from date, p_to date)
returns table (payable_id uuid, payee text, description text, project_name text, due_date date, paid_at date, days_late int, amount numeric, penalty_amount numeric, late_reason text, penalty_reason text)
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
  select pa.id, coalesce(nullif(btrim(pa.payee_name), ''), pr.full_name, '—'), pa.description, p.name, pa.due_date, pa.paid_at,
    (pa.paid_at - pa.due_date)::int, pa.amount, pa.penalty_amount, pa.late_reason, pa.penalty_reason
  from public.payables pa
  left join public.profiles pr on pr.id = pa.payee_profile_id
  left join public.projects p on p.id = pa.project_id
  where pa.paid_late and pa.cancelled_at is null and pa.paid_at between p_from and p_to
  order by pa.paid_at desc;
end;
$$;

revoke all on function public.finance_late_payments(date, date) from public, anon;
grant execute on function public.finance_late_payments(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Job diário das 8h: tudo o que já rodava + pautas automáticas + lembrete de agendados.
-- ---------------------------------------------------------------------------

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
  perform public.finance_generate_auto_pautas();
  perform public.notify_scheduled_payments();
end;
$$;

-- Pautas automáticas do financeiro: uma vez só, e nunca a partir de atraso.
--
-- Problema: o gerador olhava 15 dias para trás, então recebimentos e pagamentos JÁ ATRASADOS (que já
-- geram o alerta de atraso) também viravam pauta — e o item ficava com pauta e alerta ao mesmo tempo.
-- 1. A pauta nasce só ANTES do vencimento (hoje até N dias à frente). Atraso continua sendo alerta do
--    financeiro; não gera pauta. Cada item gera no máximo uma pauta, para sempre (índice único, que
--    vale também para as arquivadas).
-- 2. Item com pauta automática aberta não recebe também os alertas "vence hoje"/"em atraso" do
--    financeiro — a pauta já tem os lembretes dela (prazo e atraso) para quem executa.
-- 3. As pautas criadas a partir de itens já vencidos são arquivadas com uma nota (e não voltam).

create function public.has_open_auto_pauta(p_ref_type text, p_ref_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pautas pt
    where pt.source = 'auto_financeiro' and pt.source_ref_type = p_ref_type and pt.source_ref_id = p_ref_id
      and pt.archived_at is null and pt.status <> 'aprovado'
  )
$$;

revoke all on function public.has_open_auto_pauta(text, uuid) from public, anon, authenticated;

create or replace function public.finance_generate_auto_pautas()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.company_settings%rowtype;
  v_today date := (now() at time zone 'America/Fortaleza')::date;
  v_lead uuid := public.finance_lead_id();
  v_payment_lead uuid := public.finance_payment_lead_id();
  v_executor uuid := public.finance_executor_id();
  v_count int := 0;
  v_target date;
  v_month date;
  v_month_day date;
  v_last date;
  r record;
begin
  -- Pelo cron (sem sessão) ou por quem tem financeiro; os demais não disparam nada.
  if auth.uid() is not null and not public.has_finance_access() then
    return 0;
  end if;
  select * into s from public.company_settings where id;

  -- a) Emitir nota fiscal — N dias antes do vencimento, recebimentos sem nota.
  if s.finance_auto_invoice then
    for r in
      select x.id, x.project_id, x.company_id, x.amount, x.due_date, x.installment_number, x.installment_total,
        coalesce(x.competence_month, x.due_date) as month, c.name as client, pr.name as project
      from public.receivables x
      join public.companies c on c.id = x.company_id
      left join public.projects pr on pr.id = x.project_id
      where x.received_at is null and x.cancelled_at is null
        and x.invoice_number is null and x.invoice_file_path is null
        -- Só antes do vencimento: atraso é alerta do financeiro, não vira pauta.
        and x.due_date between v_today and v_today + s.finance_invoice_days_before
    loop
      if public.finance_auto_pauta('receivable', r.id, null,
        'Emitir nota fiscal — ' || r.client,
        '**Cliente:** ' || r.client
          || chr(10) || '**Projeto:** ' || coalesce(r.project, 'sem projeto')
          || chr(10) || '**Parcela:** ' || coalesce(r.installment_number || '/' || r.installment_total, 'única')
          || chr(10) || '**Valor:** ' || public.fmt_brl(r.amount)
          || chr(10) || '**Vencimento:** ' || to_char(r.due_date, 'DD/MM/YYYY')
          || chr(10) || chr(10) || '**Salvar o PDF em:** ALÉM.FILMES > ADMINISTRATIVO > [02] CONTRATOS E NOTAS FISCAIS > '
          || to_char(r.month, 'YYYY') || ' > Q' || extract(quarter from r.month)::int || ' > ' || public.month_name_pt(r.month) || ' > ' || r.client
          || chr(10) || '**Nome do arquivo:** ' || to_char(r.month, 'YYYY MM') || ' ' || r.client
          || chr(10) || chr(10) || 'Depois de emitir, registre o número da nota no recebimento (Financeiro → Recebimentos → ⋯ → Anexar nota fiscal).'
          || chr(10) || 'Passo a passo: [Emissão e envio de nota fiscal](/fluxogramas/financeiro-emissao-nota-fiscal)',
        r.due_date, r.project_id, r.company_id, v_lead, v_executor, true) is not null then
        v_count := v_count + 1;
      end if;
    end loop;
  end if;

  -- b) Relatório semanal — no dia configurado (o mais recente até hoje).
  -- Só até 2 dias depois do dia certo (se o cron falhou); não cria relatório de semana antiga.
  v_target := v_today - ((extract(dow from v_today)::int - s.finance_weekly_dow + 7) % 7);
  if s.finance_auto_weekly and v_today - v_target <= 2 then
    if public.finance_auto_pauta('weekly_report', null, v_target,
      'Relatório semanal do financeiro — ' || to_char(v_target, 'DD/MM'),
      E'O relatório da semana precisa cobrir:\n- **Recebido na semana** (o que entrou, de quem)\n- **A receber** nos próximos 7 e 30 dias\n- **Em atraso** (cliente, valor, dias de atraso e a cobrança feita)\n- **Pagamentos efetuados** na semana\n- **Pendências** (notas a emitir, pagamentos a autorizar, dados faltando)\n\nEnvie à diretoria e conclua a pauta.',
      v_target, null, null, v_lead, v_executor, true) is not null then
      v_count := v_count + 1;
    end if;
  end if;

  -- c) Fechamento do mês — último dia (fim de semana: a sexta anterior). Cobre também o mês anterior
  --    se a geração dele falhou (até 7 dias depois).
  if s.finance_auto_monthly then
    foreach v_month in array array[date_trunc('month', v_today)::date, (date_trunc('month', v_today) - interval '1 month')::date] loop
      v_last := (v_month + interval '1 month' - interval '1 day')::date;
      v_month_day := v_last - case extract(dow from v_last)::int when 6 then 1 when 0 then 2 else 0 end;
      if v_today >= v_month_day and v_today <= v_month_day + 7 then
        if public.finance_auto_pauta('monthly_close', null, v_month,
          'Fechamento do mês — ' || lower(public.month_name_pt(v_month)) || '/' || to_char(v_month, 'YYYY'),
          E'- Conferir **recebimentos** e **pagamentos** do mês\n- Lançar os **custos fixos**\n- Revisar a **margem por projeto**\n- Montar o relatório **Projetos abaixo da meta de margem** (30–40%) — Financeiro → Painel\n- Sinalizar **imediatamente** à diretoria os projetos abaixo de 30%\n\nPasso a passo: [Fechamento mensal](/fluxogramas/financeiro-fechamento-mensal)',
          v_month_day, null, null, v_lead, v_executor, true) is not null then
          v_count := v_count + 1;
        end if;
      end if;
    end loop;
  end if;

  -- d) Pagamentos — líder diretoria; a executora executa e a pauta vai para Revisão.
  if s.finance_auto_payments then
    for r in
      select pa.id, pa.project_id, pa.company_id, pa.amount, pa.due_date, pa.category, pa.description,
        coalesce(nullif(btrim(pa.payee_name), ''), pr.full_name, 'favorecido') as payee, p.name as project
      from public.payables pa
      left join public.profiles pr on pr.id = pa.payee_profile_id
      left join public.projects p on p.id = pa.project_id
      where pa.paid_at is null and pa.cancelled_at is null
        -- Só antes do vencimento: atraso é alerta do financeiro, não vira pauta.
        and pa.due_date between v_today and v_today + s.finance_invoice_days_before
    loop
      if public.finance_auto_pauta('payable', r.id, null,
        case when r.category = 'freelancer' then 'Pagamento de freelancer — ' || r.payee else 'Pagamento — ' || r.payee || ' · ' || r.description end,
        '**Favorecido:** ' || r.payee
          || chr(10) || '**Valor:** ' || public.fmt_brl(r.amount)
          || chr(10) || '**Vencimento:** ' || to_char(r.due_date, 'DD/MM/YYYY')
          || chr(10) || '**Projeto:** ' || coalesce(r.project, 'custo da empresa')
          || chr(10) || '**Descrição:** ' || r.description
          || chr(10) || chr(10) || 'Peça a autorização no grupo do Financeiro, agende no banco e dê baixa em Financeiro → Pagamentos. Ao terminar, a pauta vai para a revisão da diretoria.'
          || chr(10) || 'Passo a passo: [Pagamento de freelancer](/fluxogramas/financeiro-pagamento-de-freelancer)',
        r.due_date, r.project_id, r.company_id, v_payment_lead, v_executor, false) is not null then
        v_count := v_count + 1;
      end if;
    end loop;
  end if;

  -- e) Origem resolvida: arquiva (ou manda para revisão) as pautas abertas.
  for r in
    select pt.id, pt.source_ref_type, x.cancelled_at as rec_cancelled, x.received_at, pa.cancelled_at as pay_cancelled, pa.paid_at
    from public.pautas pt
    left join public.receivables x on pt.source_ref_type = 'receivable' and x.id = pt.source_ref_id
    left join public.payables pa on pt.source_ref_type = 'payable' and pa.id = pt.source_ref_id
    where pt.source = 'auto_financeiro' and pt.archived_at is null and pt.status <> 'aprovado'
      and pt.source_ref_type in ('receivable', 'payable')
  loop
    if r.source_ref_type = 'receivable' and (r.rec_cancelled is not null or r.received_at is not null) then
      insert into public.pauta_logs (pauta_id, author_id, kind, body)
      values (r.id, null, 'registro', case when r.rec_cancelled is not null
        then 'Arquivada automaticamente: o recebimento foi cancelado.'
        else 'Arquivada automaticamente: o recebimento já foi recebido.' end);
      update public.pautas set archived_at = now() where id = r.id;
    elsif r.source_ref_type = 'payable' and r.pay_cancelled is not null then
      insert into public.pauta_logs (pauta_id, author_id, kind, body)
      values (r.id, null, 'registro', 'Arquivada automaticamente: o pagamento foi cancelado.');
      update public.pautas set archived_at = now() where id = r.id;
    elsif r.source_ref_type = 'payable' and r.paid_at is not null then
      update public.pautas set status = 'revisao_interna'
      where id = r.id and status not in ('revisao_interna', 'revisao_cliente', 'aprovado');
      if found then
        insert into public.pauta_logs (pauta_id, author_id, kind, body)
        values (r.id, null, 'entrega', 'Pagamento com baixa em ' || to_char(r.paid_at, 'DD/MM/YYYY') || ': pronto para a aprovação da diretoria.');
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;

create or replace function public.notify_overdue_finance()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Fortaleza')::date;
begin
  insert into public.notifications (recipient_id, type, title, body, entity_type, entity_id, url)
  select
    p.id, 'finance_overdue_receivable', 'Recebimento em atraso',
    r.description || ' — ' || c.name, 'receivable', r.id, '/financeiro?aba=recebimentos&status=atrasado'
  from public.receivables r
  join public.companies c on c.id = r.company_id
  cross join public.profiles p
  where r.received_at is null and r.cancelled_at is null and r.due_date < v_today
    and not public.has_open_auto_pauta('receivable', r.id)
    and p.is_active
    and (
      p.has_finance_access
      or exists (select 1 from public.profile_squads ps where ps.profile_id = p.id and ps.squad in ('diretoria', 'financeiro'))
    )
    and not exists (
      select 1 from public.notifications n
      where n.recipient_id = p.id and n.entity_type = 'receivable' and n.entity_id = r.id
        and n.created_at > now() - interval '1 day'
    );

  insert into public.notifications (recipient_id, type, title, body, entity_type, entity_id, url)
  select
    p.id, 'finance_overdue_payable', 'Pagamento em atraso',
    pa.description || ' — ' || coalesce(nullif(btrim(pa.payee_name), ''), pr.full_name, 'Favorecido não informado'),
    'payable', pa.id, '/financeiro?aba=pagamentos&status=atrasado'
  from public.payables pa
  left join public.profiles pr on pr.id = pa.payee_profile_id
  cross join public.profiles p
  where pa.paid_at is null and pa.cancelled_at is null and pa.due_date < v_today
    and not public.has_open_auto_pauta('payable', pa.id)
    and p.is_active
    and (
      p.has_finance_access
      or exists (select 1 from public.profile_squads ps where ps.profile_id = p.id and ps.squad in ('diretoria', 'financeiro'))
    )
    and not exists (
      select 1 from public.notifications n
      where n.recipient_id = p.id and n.entity_type = 'payable' and n.entity_id = pa.id
        and n.created_at > now() - interval '1 day'
    );
end;
$$;

create or replace function public.notify_finance_due_today()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Fortaleza')::date;
begin
  insert into public.notifications (recipient_id, type, title, body, entity_type, entity_id, url)
  select p.id, 'finance_due_today_receivable', 'Recebimento vence hoje',
    r.description || ' — ' || c.name, 'receivable', r.id, '/financeiro?aba=recebimentos'
  from public.receivables r
  join public.companies c on c.id = r.company_id
  cross join public.profiles p
  where r.received_at is null and r.cancelled_at is null and r.due_date = v_today
    and not public.has_open_auto_pauta('receivable', r.id)
    and p.is_active
    and (p.has_finance_access or exists (select 1 from public.profile_squads ps where ps.profile_id = p.id and ps.squad in ('diretoria', 'financeiro')))
    and not public.notified_today(p.id, 'finance_due_today_receivable', r.id);

  insert into public.notifications (recipient_id, type, title, body, entity_type, entity_id, url)
  select p.id, 'finance_due_today_payable', 'Pagamento vence hoje',
    pa.description || ' — ' || coalesce(nullif(btrim(pa.payee_name), ''), pr.full_name, 'Favorecido não informado'),
    'payable', pa.id, '/financeiro?aba=pagamentos'
  from public.payables pa
  left join public.profiles pr on pr.id = pa.payee_profile_id
  cross join public.profiles p
  where pa.paid_at is null and pa.cancelled_at is null and pa.due_date = v_today
    and not public.has_open_auto_pauta('payable', pa.id)
    and p.is_active
    and (p.has_finance_access or exists (select 1 from public.profile_squads ps where ps.profile_id = p.id and ps.squad in ('diretoria', 'financeiro')))
    and not public.notified_today(p.id, 'finance_due_today_payable', pa.id);
end;
$$;

-- Limpeza: pautas automáticas que nasceram de itens já vencidos.
with stale as (
  select pt.id
  from public.pautas pt
  left join public.receivables x on pt.source_ref_type = 'receivable' and x.id = pt.source_ref_id
  left join public.payables pa on pt.source_ref_type = 'payable' and pa.id = pt.source_ref_id
  where pt.source = 'auto_financeiro' and pt.archived_at is null and pt.status <> 'aprovado'
    and coalesce(x.due_date, pa.due_date) < (pt.created_at at time zone 'America/Fortaleza')::date
),
logged as (
  insert into public.pauta_logs (pauta_id, author_id, kind, body)
  select id, null, 'registro', 'Arquivada automaticamente: criada a partir de um item já vencido. Atraso é tratado pelo alerta do financeiro, não por pauta.'
  from stale
  returning pauta_id
)
update public.pautas set archived_at = now() where id in (select pauta_id from logged);

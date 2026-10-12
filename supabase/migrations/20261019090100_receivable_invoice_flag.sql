-- Recebimento com "Nota fiscal: Sim/Não" (pedido do Anderson, 12/10/2026). Com "Não", o financeiro não recebe a
-- tarefa automática de emitir a nota daquele recebimento (pauta "client_invoices" de finance_generate_auto_pautas).
-- Padrão: Sim (todos os recebimentos que já existem continuam como estão).
--
-- Só adiciona a coluna (com padrão) e recria finance_generate_auto_pautas com o mesmo corpo + o filtro.

alter table public.receivables add column if not exists requires_invoice boolean not null default true;

comment on column public.receivables.requires_invoice is 'Nota fiscal: Sim (padrão) gera a tarefa de emissão para o financeiro; Não, não gera.';

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
  v_key text;
  v_lines text;
  r record;
  g record;
begin
  if auth.uid() is not null and not public.has_finance_access() then
    return 0;
  end if;
  select * into s from public.company_settings where id;

  -- a) Nota fiscal: uma pauta por cliente por mês, quando a primeira parcela do mês entra na janela.
  if s.finance_auto_invoice then
    for g in
      select x.company_id, date_trunc('month', x.due_date)::date as month, min(x.due_date) as first_due, c.name as client
      from public.receivables x
      join public.companies c on c.id = x.company_id
      where x.received_at is null and x.cancelled_at is null
        and x.requires_invoice and x.invoice_number is null and x.invoice_file_path is null
        and x.due_date between v_today and v_today + s.finance_invoice_days_before
      group by x.company_id, date_trunc('month', x.due_date), c.name
    loop
      v_key := 'nf:' || g.company_id || ':' || to_char(g.month, 'YYYY-MM');
      -- Parcelas do cliente no mês (todas as em aberto, sem nota).
      v_lines := '';
      for r in
        select x.id, x.amount, x.due_date, x.installment_number, x.installment_total, pr.name as project
        from public.receivables x
        left join public.projects pr on pr.id = x.project_id
        where x.company_id = g.company_id and date_trunc('month', x.due_date)::date = g.month
          and x.received_at is null and x.cancelled_at is null and x.requires_invoice and x.invoice_number is null and x.invoice_file_path is null
        order by x.due_date
      loop
        v_lines := v_lines || chr(10) || '- ' || coalesce(r.project, 'sem projeto')
          || ' · parcela ' || coalesce(r.installment_number || '/' || r.installment_total, 'única')
          || ' · ' || public.fmt_brl(r.amount) || ' · vence ' || to_char(r.due_date, 'DD/MM') || ' [#' || left(r.id::text, 8) || ']';
        perform public.finance_auto_pauta_append(v_key, '[#' || left(r.id::text, 8) || ']',
          '- ' || coalesce(r.project, 'sem projeto') || ' · parcela ' || coalesce(r.installment_number || '/' || r.installment_total, 'única')
          || ' · ' || public.fmt_brl(r.amount) || ' · vence ' || to_char(r.due_date, 'DD/MM') || ' [#' || left(r.id::text, 8) || '] (incluída depois)');
      end loop;
      if public.finance_auto_pauta(v_key, 'client_invoices', g.company_id, g.month,
        'Emitir nota fiscal — ' || g.client || ' · ' || lower(public.month_name_pt(g.month)),
        '**Cliente:** ' || g.client || chr(10) || '**Mês:** ' || lower(public.month_name_pt(g.month)) || '/' || to_char(g.month, 'YYYY')
          || chr(10) || chr(10) || '**Parcelas do mês:**' || v_lines
          || chr(10) || chr(10) || '**Salvar o PDF em:** ALÉM.FILMES > ADMINISTRATIVO > [02] CONTRATOS E NOTAS FISCAIS > '
          || to_char(g.month, 'YYYY') || ' > Q' || extract(quarter from g.month)::int || ' > ' || public.month_name_pt(g.month) || ' > ' || g.client
          || chr(10) || '**Nome do arquivo:** ' || to_char(g.month, 'YYYY MM') || ' ' || g.client
          || chr(10) || chr(10) || 'Depois de emitir, registre o número da nota em cada recebimento (aqui na pauta ou em Financeiro → Recebimentos).'
          || chr(10) || 'Passo a passo: [Emissão e envio de nota fiscal](/fluxogramas/financeiro-emissao-nota-fiscal)',
        g.first_due, null, g.company_id, v_lead, v_executor, true) is not null then
        v_count := v_count + 1;
      end if;
    end loop;
  end if;

  -- b) Relatório semanal — no dia configurado (até 2 dias depois, se o cron falhou).
  v_target := v_today - ((extract(dow from v_today)::int - s.finance_weekly_dow + 7) % 7);
  if s.finance_auto_weekly and v_today - v_target <= 2 then
    if public.finance_auto_pauta('weekly:' || to_char(v_target, 'YYYY-MM-DD'), 'weekly_report', null, v_target,
      'Relatório semanal do financeiro — ' || to_char(v_target, 'DD/MM'),
      E'O relatório da semana precisa cobrir:\n- **Recebido na semana** (o que entrou, de quem)\n- **A receber** nos próximos 7 e 30 dias\n- **Em atraso** (cliente, valor, dias de atraso e a cobrança feita)\n- **Pagamentos efetuados** na semana\n- **Pendências** (notas a emitir, pagamentos a autorizar, dados faltando)\n\nEnvie à diretoria e conclua a pauta.',
      v_target, null, null, v_lead, v_executor, true) is not null then
      v_count := v_count + 1;
    end if;
  end if;

  -- c) Fechamento do mês — último dia (fim de semana: a sexta anterior); cobre o mês anterior se falhou.
  if s.finance_auto_monthly then
    foreach v_month in array array[date_trunc('month', v_today)::date, (date_trunc('month', v_today) - interval '1 month')::date] loop
      v_last := (v_month + interval '1 month' - interval '1 day')::date;
      v_month_day := v_last - case extract(dow from v_last)::int when 6 then 1 when 0 then 2 else 0 end;
      if v_today >= v_month_day and v_today <= v_month_day + 7 then
        if public.finance_auto_pauta('monthly:' || to_char(v_month, 'YYYY-MM'), 'monthly_close', null, v_month,
          'Fechamento do mês — ' || lower(public.month_name_pt(v_month)) || '/' || to_char(v_month, 'YYYY'),
          E'- Conferir **recebimentos** e **pagamentos** do mês\n- Lançar os **custos fixos**\n- Revisar a **margem por projeto**\n- Montar o relatório **Projetos abaixo da meta de margem** (30–40%) — Financeiro → Painel\n- Sinalizar **imediatamente** à diretoria os projetos abaixo de 30%\n\nPasso a passo: [Fechamento mensal](/fluxogramas/financeiro-fechamento-mensal)',
          v_month_day, null, null, v_lead, v_executor, true) is not null then
          v_count := v_count + 1;
        end if;
      end if;
    end loop;
  end if;

  -- d) Pagamentos: uma pauta por favorecido por mês. Líder: diretoria; vai para Revisão.
  if s.finance_auto_payments then
    for g in
      select public.finance_payee_key(pa.payee_profile_id, pa.payee_name) as payee_key,
        date_trunc('month', pa.due_date)::date as month, min(pa.due_date) as first_due,
        max(coalesce(nullif(btrim(pa.payee_name), ''), pr.full_name, 'favorecido')) as payee,
        bool_or(pa.category = 'freelancer') as freelancer
      from public.payables pa
      left join public.profiles pr on pr.id = pa.payee_profile_id
      where pa.paid_at is null and pa.cancelled_at is null
        and pa.due_date between v_today and v_today + s.finance_invoice_days_before
      group by 1, 2
    loop
      v_key := 'pag:' || g.payee_key || ':' || to_char(g.month, 'YYYY-MM');
      v_lines := '';
      for r in
        select pa.id, pa.amount, pa.due_date, pa.description, p.name as project
        from public.payables pa
        left join public.projects p on p.id = pa.project_id
        where public.finance_payee_key(pa.payee_profile_id, pa.payee_name) = g.payee_key
          and date_trunc('month', pa.due_date)::date = g.month
          and pa.paid_at is null and pa.cancelled_at is null
        order by pa.due_date
      loop
        v_lines := v_lines || chr(10) || '- ' || r.description || ' · ' || public.fmt_brl(r.amount) || ' · vence ' || to_char(r.due_date, 'DD/MM')
          || coalesce(' · ' || r.project, '') || ' [#' || left(r.id::text, 8) || ']';
        perform public.finance_auto_pauta_append(v_key, '[#' || left(r.id::text, 8) || ']',
          '- ' || r.description || ' · ' || public.fmt_brl(r.amount) || ' · vence ' || to_char(r.due_date, 'DD/MM')
          || coalesce(' · ' || r.project, '') || ' [#' || left(r.id::text, 8) || '] (incluído depois)');
      end loop;
      if public.finance_auto_pauta(v_key, 'payee_payments', null, g.month,
        case when g.freelancer then 'Pagamento de freelancer — ' else 'Pagamento — ' end || g.payee || ' · ' || lower(public.month_name_pt(g.month)),
        '**Favorecido:** ' || g.payee || chr(10) || chr(10) || '**Pagamentos do mês:**' || v_lines
          || chr(10) || chr(10) || 'Peça a autorização no grupo do Financeiro, agende no banco e dê baixa em Financeiro → Pagamentos. Ao terminar, a pauta vai para a revisão da diretoria.'
          || chr(10) || 'Passo a passo: [Pagamento de freelancer](/fluxogramas/financeiro-pagamento-de-freelancer)',
        g.first_due, null, null, v_payment_lead, v_executor, false) is not null then
        v_count := v_count + 1;
      end if;
    end loop;
  end if;

  -- e) Origem resolvida: arquiva quando nada mais do grupo está em aberto; pagamentos todos com baixa
  --    vão para Revisão.
  for r in
    select pt.id, pt.source_ref_type, pt.source_ref_id, pt.source_period, pt.source_key, pt.status
    from public.pautas pt
    where pt.source = 'auto_financeiro' and pt.archived_at is null and pt.status <> 'aprovado'
      and pt.source_ref_type in ('client_invoices', 'payee_payments')
  loop
    if r.source_ref_type = 'client_invoices' and not exists (
      select 1 from public.receivables x
      where x.company_id = r.source_ref_id and date_trunc('month', x.due_date)::date = r.source_period
        and x.cancelled_at is null and x.received_at is null
    ) then
      insert into public.pauta_logs (pauta_id, author_id, kind, body)
      values (r.id, null, 'registro', 'Arquivada automaticamente: as parcelas do mês deste cliente foram recebidas ou canceladas.');
      update public.pautas set archived_at = now() where id = r.id;
    elsif r.source_ref_type = 'payee_payments' then
      if not exists (
        select 1 from public.payables pa
        where 'pag:' || public.finance_payee_key(pa.payee_profile_id, pa.payee_name) || ':' || to_char(pa.due_date, 'YYYY-MM') = r.source_key
          and pa.cancelled_at is null
      ) then
        insert into public.pauta_logs (pauta_id, author_id, kind, body)
        values (r.id, null, 'registro', 'Arquivada automaticamente: os pagamentos do mês foram cancelados.');
        update public.pautas set archived_at = now() where id = r.id;
      elsif not exists (
        select 1 from public.payables pa
        where 'pag:' || public.finance_payee_key(pa.payee_profile_id, pa.payee_name) || ':' || to_char(pa.due_date, 'YYYY-MM') = r.source_key
          and pa.cancelled_at is null and pa.paid_at is null
      ) and r.status not in ('revisao_interna', 'revisao_cliente') then
        update public.pautas set status = 'revisao_interna' where id = r.id;
        insert into public.pauta_logs (pauta_id, author_id, kind, body)
        values (r.id, null, 'entrega', 'Todos os pagamentos do mês com baixa: pronto para a aprovação da diretoria.');
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;

-- Pautas automáticas do financeiro: UMA por cliente por mês (nota fiscal) e UMA por favorecido por
-- mês (pagamentos), registradas num livro próprio para nunca voltarem.
--
-- Problema: a trava "uma vez só" era o índice único da própria pauta. Pauta apagada liberava a trava e
-- a próxima rodada (cron das 8h ou abrir o Financeiro) criava de novo — parecia "criada por
-- notificação". E a nota fiscal era uma pauta por parcela, não por cliente.
--
-- 1. finance_auto_pauta_keys: livro do que já foi gerado (chave → pauta). Apagar ou arquivar a pauta
--    não apaga a chave: nada é recriado. Chaves:
--      nf:<cliente>:<aaaa-mm>        nota fiscal do cliente no mês (vencimento no mês)
--      pag:<favorecido>:<aaaa-mm>    pagamentos do favorecido no mês
--      weekly:<aaaa-mm-dd>           relatório semanal
--      monthly:<aaaa-mm>             fechamento do mês
-- 2. A pauta do mês nasce quando a primeira parcela/pagamento entra na janela (N dias antes do
--    vencimento) e lista tudo do cliente/favorecido no mês. Itens que entrarem depois, no mesmo mês,
--    são acrescentados à pauta aberta (sem pauta nova).
-- 3. Recebimentos atrasados continuam sendo só alerta do financeiro (nunca viram pauta).

create table public.finance_auto_pauta_keys (
  key text primary key,
  pauta_id uuid references public.pautas (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.finance_auto_pauta_keys enable row level security;
-- Sem policies: só as funções do banco (security definer) leem e escrevem.

alter table public.pautas add column source_key text;

-- Novos tipos de origem (agrupados) e unicidade pela chave (a antiga não serve para favorecido sem cadastro).
alter table public.pautas drop constraint pautas_source_ref_type_check;
alter table public.pautas add constraint pautas_source_ref_type_check check (
  source_ref_type is null or source_ref_type in ('receivable', 'payable', 'weekly_report', 'monthly_close', 'client_invoices', 'payee_payments')
);
drop index public.pautas_auto_source_unique;
create unique index pautas_auto_source_key_unique on public.pautas (source_key) where source = 'auto_financeiro' and source_key is not null;

-- Chave do favorecido: o cadastro (profile) ou o nome digitado.
create function public.finance_payee_key(p_profile_id uuid, p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_profile_id::text, 'nome-' || lower(btrim(coalesce(p_name, ''))))
$$;

-- Pautas já existentes entram no livro com a chave do mês (inclusive as arquivadas).
update public.pautas pt set source_key = case pt.source_ref_type
    when 'receivable' then (select 'nf:' || x.company_id || ':' || to_char(x.due_date, 'YYYY-MM') from public.receivables x where x.id = pt.source_ref_id)
    when 'payable' then (select 'pag:' || public.finance_payee_key(pa.payee_profile_id, pa.payee_name) || ':' || to_char(pa.due_date, 'YYYY-MM') from public.payables pa where pa.id = pt.source_ref_id)
    when 'weekly_report' then 'weekly:' || to_char(pt.source_period, 'YYYY-MM-DD')
    when 'monthly_close' then 'monthly:' || to_char(pt.source_period, 'YYYY-MM')
  end
where pt.source = 'auto_financeiro';

-- Duas pautas antigas na mesma chave (ex.: duas parcelas do mesmo cliente no mês): fica a mais antiga
-- com a chave; as outras abertas são arquivadas (o livro já cobre o mês).
with ranked as (
  select id, source_key, row_number() over (partition by source_key order by created_at) as rn
  from public.pautas where source = 'auto_financeiro' and source_key is not null
)
update public.pautas pt set source_key = null,
  archived_at = coalesce(pt.archived_at, now())
from ranked r
where r.id = pt.id and r.rn > 1;

insert into public.finance_auto_pauta_keys (key, pauta_id, created_at)
select source_key, id, created_at from public.pautas
where source = 'auto_financeiro' and source_key is not null
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Criação: o livro decide. Chave já registrada = nada a fazer (mesmo que a pauta tenha sido apagada).
-- ---------------------------------------------------------------------------

drop function public.finance_auto_pauta(text, uuid, date, text, text, date, uuid, uuid, uuid, uuid, boolean);

create function public.finance_auto_pauta(
  p_key text, p_ref_type text, p_ref_id uuid, p_period date, p_title text, p_briefing text, p_due date,
  p_project uuid, p_company uuid, p_lead uuid, p_executor uuid, p_self_complete boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_lead is null or p_executor is null then
    return null;
  end if;
  insert into public.finance_auto_pauta_keys (key) values (p_key) on conflict (key) do nothing;
  if not found then
    return null;
  end if;
  insert into public.pautas (
    title, briefing, squad, board_column, status, lead_id, current_assignee_id, created_by,
    project_id, direct_company_id, is_standalone, due_date, priority,
    source, source_ref_type, source_ref_id, source_period, source_key, self_complete
  )
  values (
    left(p_title, 200), p_briefing, 'financeiro', 'sprint_backlog', 'planejamento', p_lead, p_executor, p_lead,
    p_project, p_company, false, p_due, 'media',
    'auto_financeiro', p_ref_type, p_ref_id, p_period, p_key, p_self_complete
  )
  returning id into v_id;
  update public.finance_auto_pauta_keys set pauta_id = v_id where key = p_key;
  return v_id;
end;
$$;

revoke all on function public.finance_auto_pauta(text, text, uuid, date, text, text, date, uuid, uuid, uuid, uuid, boolean) from public, anon, authenticated;

-- Item novo no mesmo mês: acrescenta uma linha à pauta aberta (sem criar outra).
create function public.finance_auto_pauta_append(p_key text, p_marker text, p_line text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.pautas
  set briefing = briefing || chr(10) || p_line
  where source_key = p_key and source = 'auto_financeiro' and archived_at is null and status <> 'aprovado'
    and position(p_marker in coalesce(briefing, '')) = 0;
end;
$$;

revoke all on function public.finance_auto_pauta_append(text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Gerador
-- ---------------------------------------------------------------------------

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
        and x.invoice_number is null and x.invoice_file_path is null
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
          and x.received_at is null and x.cancelled_at is null and x.invoice_number is null and x.invoice_file_path is null
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

-- Item com pauta do mês aberta não recebe também os alertas "vence hoje"/"em atraso".
create or replace function public.has_open_auto_pauta(p_ref_type text, p_ref_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pautas pt
    where pt.source = 'auto_financeiro' and pt.archived_at is null and pt.status <> 'aprovado'
      and pt.source_key = case p_ref_type
        when 'receivable' then (select 'nf:' || x.company_id || ':' || to_char(x.due_date, 'YYYY-MM') from public.receivables x where x.id = p_ref_id)
        when 'payable' then (select 'pag:' || public.finance_payee_key(pa.payee_profile_id, pa.payee_name) || ':' || to_char(pa.due_date, 'YYYY-MM') from public.payables pa where pa.id = p_ref_id)
      end
  )
$$;

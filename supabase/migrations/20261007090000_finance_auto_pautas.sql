-- Pautas automáticas do financeiro: a rotina financeira vira trabalho visível nos quadros.
--
-- Onde moram: pautas de equipe (não avulsas) do squad financeiro — com o projeto e o cliente do
-- recebimento/pagamento quando houver, ou sem projeto/cliente (relatório semanal, fechamento). O
-- esquema já aceita pauta de equipe sem projeto (direct_company_id), então não criamos um "projeto
-- interno" artificial: a pauta aparece em /pautas, nas Minhas Pautas de quem executa e no quadro do
-- cliente quando é de cliente, sempre na cor do financeiro.
--
-- Geradas pelo sistema (nunca digitadas):
--   a) "Emitir nota fiscal — <cliente>": N dias antes do vencimento de cada recebimento sem nota.
--   b) "Relatório semanal do financeiro": no dia da semana configurado (padrão sábado).
--   c) "Fechamento do mês": no último dia do mês; caindo em fim de semana, na sexta anterior.
--   d) "Pagamento — <favorecido>": N dias antes do vencimento de cada pagamento em aberto.
-- a/b/c: a executora conclui sozinha (self_complete). d: líder = diretoria (master); a executora
-- termina a execução e a pauta vai para Revisão — só o líder aprova (regra do processo "Pagamento de
-- freelancer"). Baixa de recebimento NÃO vira pauta (depende do dinheiro cair).
--
-- Idempotente: (source_ref_type, source_ref_id, source_period) é único entre as automáticas.
-- Recebimento cancelado ou recebido → a pauta aberta é arquivada com uma nota. Pagamento cancelado →
-- arquivada; pagamento com baixa → vai para Revisão (aprovação do líder).

alter table public.pautas
  add column source text not null default 'manual' check (source in ('manual', 'auto_financeiro')),
  add column source_ref_type text check (source_ref_type is null or source_ref_type in ('receivable', 'payable', 'weekly_report', 'monthly_close')),
  add column source_ref_id uuid,
  add column source_period date,
  -- A executora pode concluir sozinha (sem revisão).
  add column self_complete boolean not null default false;

create unique index pautas_auto_source_unique on public.pautas (
  source_ref_type,
  coalesce(source_ref_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(source_period, '1900-01-01'::date)
) where source = 'auto_financeiro';

-- Configurações (diretoria): ligar/desligar cada gerador, antecedência e dia do relatório.
alter table public.company_settings
  add column finance_auto_invoice boolean not null default true,
  add column finance_invoice_days_before int not null default 5 check (finance_invoice_days_before between 0 and 60),
  add column finance_auto_weekly boolean not null default true,
  -- 0 = domingo … 6 = sábado.
  add column finance_weekly_dow int not null default 6 check (finance_weekly_dow between 0 and 6),
  add column finance_auto_monthly boolean not null default true,
  add column finance_auto_payments boolean not null default true,
  add column finance_executor_id uuid references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- View das pautas: pt.* é expandido na criação — recria com as colunas novas (mesmo corpo).
-- ---------------------------------------------------------------------------

drop view public.pautas_with_details;

create view public.pautas_with_details
with (security_invoker = true) as
select
  pt.*,
  pr.name as project_name,
  pr.is_internal as project_is_internal,
  coalesce(pr.company_id, pt.direct_company_id) as company_id,
  c.name as company_name,
  lead.full_name as lead_name,
  lead.avatar_url as lead_avatar_url,
  assignee.full_name as assignee_name,
  assignee.avatar_url as assignee_avatar_url,
  ct.full_name as contact_name,
  coalesce(nullif(btrim(pt.contact_phone_override), ''), ct.phone) as contact_phone,
  (
    select count(*)::int from public.pauta_comments cm where cm.pauta_id = pt.id
  ) as comments_count,
  creator.full_name as created_for_name,
  c.logo_url as company_logo_url,
  fl.full_name as freelancer_name,
  fl.phone as freelancer_phone,
  waiting.full_name as waiting_on_contact_name,
  waiting.job_title as waiting_on_contact_role,
  author.full_name as created_by_name,
  (
    select count(*)::int from public.pauta_logs lg where lg.pauta_id = pt.id
  ) as logs_count
from public.pautas pt
left join public.projects pr on pr.id = pt.project_id
left join public.companies c on c.id = coalesce(pr.company_id, pt.direct_company_id)
join public.profiles lead on lead.id = pt.lead_id
left join public.profiles assignee on assignee.id = pt.current_assignee_id
left join public.profiles creator on creator.id = pt.created_for
left join public.profiles author on author.id = pt.created_by
left join public.contacts ct on ct.id = pt.contact_id
left join public.contacts waiting on waiting.id = pt.waiting_on_contact_id
left join public.freelancers fl on fl.id = pt.freelancer_id
where pt.archived_at is null;

revoke all on public.pautas_with_details from anon;
grant select on public.pautas_with_details to authenticated;

-- ---------------------------------------------------------------------------
-- Quem lidera e quem executa
-- ---------------------------------------------------------------------------

-- Líder da rotina: head do financeiro; sem head, o master.
create function public.finance_lead_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.id from public.profiles p join public.profile_squads ps on ps.profile_id = p.id and ps.squad = 'financeiro'
      where p.is_active and p.org_level = 'head' order by p.created_at limit 1),
    (select p.id from public.profiles p where p.is_active and p.org_level = 'master' order by p.created_at limit 1)
  )
$$;

-- Líder dos pagamentos: a diretoria (o master); sem master, o líder da rotina.
create function public.finance_payment_lead_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.id from public.profiles p where p.is_active and p.org_level = 'master' order by p.created_at limit 1),
    public.finance_lead_id()
  )
$$;

-- Executora: a escolhida nas configurações; senão a primeira executora ativa do financeiro.
create function public.finance_executor_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.id from public.company_settings s join public.profiles p on p.id = s.finance_executor_id and p.is_active where s.id),
    (select p.id from public.profiles p join public.profile_squads ps on ps.profile_id = p.id and ps.squad = 'financeiro'
      where p.is_active and p.org_level = 'executor' order by p.created_at limit 1),
    public.finance_lead_id()
  )
$$;

revoke all on function public.finance_lead_id() from public, anon, authenticated;
revoke all on function public.finance_payment_lead_id() from public, anon, authenticated;
revoke all on function public.finance_executor_id() from public, anon, authenticated;

create function public.month_name_pt(p_date date)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'])[extract(month from p_date)::int]
$$;

-- Cria uma pauta automática (ou nada, se já existe). Devolve o id criado.
create function public.finance_auto_pauta(
  p_ref_type text, p_ref_id uuid, p_period date, p_title text, p_briefing text, p_due date,
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
  insert into public.pautas (
    title, briefing, squad, board_column, status, lead_id, current_assignee_id, created_by,
    project_id, direct_company_id, is_standalone, due_date, priority,
    source, source_ref_type, source_ref_id, source_period, self_complete
  )
  values (
    left(p_title, 200), p_briefing, 'financeiro', 'sprint_backlog', 'planejamento', p_lead, p_executor, p_lead,
    p_project, p_company, false, p_due, 'media',
    'auto_financeiro', p_ref_type, p_ref_id, p_period, p_self_complete
  )
  on conflict (source_ref_type, coalesce(source_ref_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(source_period, '1900-01-01'::date))
    where source = 'auto_financeiro'
    do nothing
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.finance_auto_pauta(text, uuid, date, text, text, date, uuid, uuid, uuid, uuid, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Gerador (cron diário + primeira abertura do financeiro no dia). Idempotente.
-- ---------------------------------------------------------------------------

create function public.finance_generate_auto_pautas()
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
        and x.due_date between v_today - 15 and v_today + s.finance_invoice_days_before
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
        and pa.due_date between v_today - 15 and v_today + s.finance_invoice_days_before
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

revoke all on function public.finance_generate_auto_pautas() from public, anon;
grant execute on function public.finance_generate_auto_pautas() to authenticated;

-- ---------------------------------------------------------------------------
-- Aprovação: rotinas (self_complete) a executora conclui sozinha; pagamentos seguem a regra de
-- sempre (só quem criou — a diretoria — aprova).
-- ---------------------------------------------------------------------------

create or replace function public.pautas_validate_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_active boolean;
begin
  if auth.uid() is null or new.is_standalone then
    return new;
  end if;

  if new.status = 'aprovado' and old.status is distinct from 'aprovado' then
    if old.created_by = auth.uid() then
      return new;
    end if;
    if old.self_complete and auth.uid() in (old.current_assignee_id, old.lead_id) then
      return new;
    end if;
    select coalesce(p.is_active, false) into v_creator_active from public.profiles p where p.id = old.created_by;
    if not coalesce(v_creator_active, false) and public.can_manage_pautas() then
      return new;
    end if;
    raise exception 'Só quem criou a pauta pode aprovar. Envie para revisão.' using errcode = '42501';
  end if;

  if old.status = 'aprovado' and new.status is distinct from 'aprovado' then
    if old.created_by = auth.uid() or public.can_fully_manage_pauta() or public.manages_pauta_squad(old.squad)
       or (old.self_complete and auth.uid() in (old.current_assignee_id, old.lead_id)) then
      return new;
    end if;
    raise exception 'Só quem criou a pauta pode reabrir uma pauta aprovada.' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Nova pauta automática: avisa só a executora (o líder é avisado quando chega em Revisão).
create or replace function public.pautas_notify_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := '/minhas-pautas?pauta=' || new.id;
  v_noun text := public.pauta_noun(new.squad);
  v_by text;
begin
  if new.deal_id is not null or new.is_standalone then
    return new;
  end if;

  select full_name into v_by from public.profiles where id = auth.uid();

  if new.current_assignee_id is not null and new.current_assignee_id is distinct from auth.uid() then
    perform public.notify(new.current_assignee_id, 'pauta_assignee_changed',
      'Nova ' || v_noun || ' para você',
      new.title || coalesce(' · por ' || v_by, case when new.source = 'auto_financeiro' then ' · gerada pelo sistema' end, ''), 'pauta', new.id, v_url);
  end if;

  if new.source <> 'auto_financeiro' and new.lead_id is distinct from auth.uid() and new.lead_id is distinct from new.current_assignee_id then
    perform public.notify(new.lead_id, 'pauta_lead_assigned',
      'Você é líder de uma nova ' || v_noun,
      new.title || coalesce(' · por ' || v_by, ''), 'pauta', new.id, v_url);
  end if;

  return new;
end;
$$;

-- Auditoria de baixas duplicadas — SOMENTE LEITURA (begin read only … rollback: nada é gravado).
--
-- O banco já impede duas baixas no MESMO item (a baixa só altera itens em aberto). Por isso a
-- procura é por GÊMEOS: dois itens diferentes que parecem ser o mesmo pagamento/recebimento
-- lançado duas vezes (por exemplo, recriado porque a baixa "não pegou") e que tiveram baixa.
--
-- nivel 'forte'   = mesmo favorecido/cliente, mesmo valor, mesmo vencimento, criados com até 30 min
--                   de diferença, e pelo menos um com baixa.
-- nivel 'atencao' = mesmo favorecido/cliente e mesmo valor, os DOIS com baixa em até 1 dia de
--                   diferença (pode ser legítimo, ex.: duas diárias iguais — conferir).
--
-- Rodar (Terminal, na pasta do projeto):
--   npx supabase db query --linked -f docs/auditoria-baixas.sql -o csv

begin read only;

with pay as (
  select pa.id, public.finance_payee_key(pa.payee_profile_id, pa.payee_name) as who,
         coalesce(pa.original_amount, pa.amount) as value, pa.amount, pa.description, pa.due_date,
         pa.paid_at, pa.created_at
  from public.payables pa
  where pa.cancelled_at is null
),
rec as (
  select x.id, x.company_id::text as who, x.amount as value, x.description, x.due_date,
         x.received_at, x.created_at
  from public.receivables x
  where x.cancelled_at is null
),
found as (
  select 'pagamento' as tipo, 'forte' as nivel, a.id as item_a, b.id as item_b, a.description as descricao_a,
         b.description as descricao_b, a.value as valor, a.due_date as venc_a, b.due_date as venc_b,
         a.paid_at as baixa_a, b.paid_at as baixa_b, a.created_at as criado_a, b.created_at as criado_b
  from pay a join pay b on a.id < b.id and a.who = b.who and a.value = b.value and a.due_date = b.due_date
  where abs(extract(epoch from a.created_at - b.created_at)) <= 1800 and (a.paid_at is not null or b.paid_at is not null)

  union all
  select 'pagamento', 'atencao', a.id, b.id, a.description, b.description, a.value, a.due_date, b.due_date,
         a.paid_at, b.paid_at, a.created_at, b.created_at
  from pay a join pay b on a.id < b.id and a.who = b.who and a.value = b.value
  where a.paid_at is not null and b.paid_at is not null and abs(a.paid_at - b.paid_at) <= 1
    and not (a.due_date = b.due_date and abs(extract(epoch from a.created_at - b.created_at)) <= 1800)

  union all
  select 'recebimento', 'forte', a.id, b.id, a.description, b.description, a.value, a.due_date, b.due_date,
         a.received_at, b.received_at, a.created_at, b.created_at
  from rec a join rec b on a.id < b.id and a.who = b.who and a.value = b.value and a.due_date = b.due_date
  where abs(extract(epoch from a.created_at - b.created_at)) <= 1800 and (a.received_at is not null or b.received_at is not null)

  union all
  select 'recebimento', 'atencao', a.id, b.id, a.description, b.description, a.value, a.due_date, b.due_date,
         a.received_at, b.received_at, a.created_at, b.created_at
  from rec a join rec b on a.id < b.id and a.who = b.who and a.value = b.value
  where a.received_at is not null and b.received_at is not null and abs(a.received_at - b.received_at) <= 1
    and not (a.due_date = b.due_date and abs(extract(epoch from a.created_at - b.created_at)) <= 1800)
)
select tipo, nivel, valor, descricao_a, descricao_b, venc_a, venc_b, baixa_a, baixa_b,
       to_char(criado_a at time zone 'America/Fortaleza', 'DD/MM/YYYY HH24:MI') as criado_a,
       to_char(criado_b at time zone 'America/Fortaleza', 'DD/MM/YYYY HH24:MI') as criado_b,
       item_a, item_b
from found
union all
-- Linha final sempre presente: totais conferidos (para saber que a consulta rodou mesmo sem achados).
select 'TOTAL', 'conferidos', null,
       (select count(*) from public.payables where paid_at is not null)::text || ' pagamentos com baixa',
       (select count(*) from public.receivables where received_at is not null)::text || ' recebimentos com baixa',
       null, null, null, null, null, null, null, null
order by 1 desc, 2, 3;

rollback;

-- Orçamentos: número aleatório, arquivamento e entregas com prazo.
--
-- 1. Número: em vez da sequência (0001, 0002…), um número aleatório de 4 dígitos (1000–9999) que não
--    está em uso. Arquivar mantém o número preso; só apagar o orçamento (todas as versões) o libera.
-- 2. Versões ("Refazer") repetem o número: o único passa a ser (número, versão). Antes, a unicidade
--    só no número impedia criar a versão 2.
-- 3. archived_at: some da lista principal, mas continua existindo (e segura o número).
-- 4. deliverable_items: entregas estruturadas [{item, deadline}] (ex.: "1 reels de 2 minutos" ·
--    "7 dias úteis após a captação"), no lugar da lista de texto. delivery_terms: prazo geral.

-- ---------------------------------------------------------------------------
-- Número
-- ---------------------------------------------------------------------------

alter table public.budgets drop constraint if exists budgets_number_key;
alter table public.budgets add constraint budgets_number_version_key unique (number, version);

create function public.budget_random_number()
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_number int;
  v_tries int := 0;
begin
  loop
    v_number := 1000 + floor(random() * 9000)::int;
    exit when not exists (select 1 from public.budgets b where b.number = v_number);
    v_tries := v_tries + 1;
    if v_tries > 20000 then
      raise exception 'Sem números de orçamento livres.' using errcode = '54000';
    end if;
  end loop;
  return v_number;
end;
$$;

revoke all on function public.budget_random_number() from public, anon, authenticated;

alter table public.budgets alter column number set default public.budget_random_number();
drop sequence if exists public.budget_number_seq;

-- Orçamentos que nunca foram enviados ao cliente ganham um número aleatório agora (todas as versões
-- do mesmo número juntas). Os já enviados mantêm o número que o cliente conhece.
do $$
declare
  r record;
  v_new int;
begin
  for r in
    select b.number from public.budgets b
    group by b.number
    having bool_and(b.sent_at is null)
  loop
    v_new := public.budget_random_number();
    update public.budgets set number = v_new where number = r.number;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Arquivamento
-- ---------------------------------------------------------------------------

alter table public.budgets add column archived_at timestamptz;
create index budgets_archived_idx on public.budgets (archived_at);

-- ---------------------------------------------------------------------------
-- Entregas com prazo
-- ---------------------------------------------------------------------------

alter table public.budgets
  add column deliverable_items jsonb not null default '[]'::jsonb check (jsonb_typeof(deliverable_items) = 'array'),
  add column delivery_terms text check (delivery_terms is null or length(delivery_terms) <= 500);

-- Leva as entregas atuais (do orçamento ou, se vazio, as da apresentação) para o formato novo.
update public.budgets b
set deliverable_items = coalesce(
  (
    select jsonb_agg(jsonb_build_object('item', btrim(d), 'deadline', '') order by ord)
    from unnest(
      case when cardinality(b.deliverables) > 0 then b.deliverables
           else array(select jsonb_array_elements_text(coalesce(b.presentation -> 'deliverables', '[]'::jsonb))) end
    ) with ordinality as x(d, ord)
    where btrim(d) <> ''
  ),
  '[]'::jsonb
);

alter table public.budgets drop column deliverables;
update public.budgets set presentation = presentation - 'deliverables' where presentation ? 'deliverables';

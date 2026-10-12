-- Baixa idempotente (relatório da Anna, item 3).
--
-- A baixa já só altera o item quando ele está em aberto (paid_at/received_at nulos), então nunca
-- há duas baixas no mesmo item. Faltava reconhecer a MESMA tentativa repetida: a tela gera uma chave
-- por formulário aberto e a grava junto com a baixa. Se a resposta se perder (4G fraco, app fechado)
-- e a tela reenviar, o servidor vê a chave igual e responde "registrado" em vez de erro.
--
-- Só adiciona colunas (nulas) e índices: nenhum dado existente muda. As views *_with_status não
-- expõem a coluna (pa.* / x.* foram expandidos quando elas foram criadas).

alter table public.payables add column if not exists settle_key uuid;
alter table public.receivables add column if not exists settle_key uuid;

create unique index if not exists payables_settle_key_idx on public.payables (settle_key) where settle_key is not null;
create unique index if not exists receivables_settle_key_idx on public.receivables (settle_key) where settle_key is not null;

comment on column public.payables.settle_key is 'Chave da tentativa de baixa (idempotência). Nula em baixas antigas.';
comment on column public.receivables.settle_key is 'Chave da tentativa de baixa (idempotência). Nula em baixas antigas.';

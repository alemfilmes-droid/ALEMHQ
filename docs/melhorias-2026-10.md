# Melhorias de outubro/2026 — registro de mudanças

Pacote de melhorias pedido pelo Anderson a partir dos relatórios da Anna Clara (financeiro) e do Paulo (comercial).
Ambiente de teste escolhido: **produção, com cuidado** (opção B) — banco validado em `begin … rollback`, telas
testadas só lendo, e o `db push` é sempre rodado pelo Anderson.

Branch: `melhorias-2026-10` (vai para o `main` só no Bloco 9).

## Bloco 1 — Baixa de pagamento que "não pega" (Anna, item 3)

**Causa encontrada**
- A janela de baixa chamava o servidor sem proteção: se a chamada falhava (4G fraco, app do iPhone fechado no
  meio, ou tela aberta desde antes de uma publicação nova da Vercel), o erro sumia calado — o botão parava de
  girar e nada era avisado. A Anna repetia e, depois de a tela recarregar, funcionava.
- O servidor trocava o motivo real do erro por "Não foi possível registrar".
- A baixa de recebimento confirmava com o texto errado ("Pagamento criado.").

**O que mudou**
- `lib/actions/client-action.ts` (novo): `runAction()` — toda chamada da tela devolve um resultado, nunca some
  calada. Sem internet → "Nada foi salvo: confira a internet"; HQ atualizado com a tela aberta → mensagem +
  botão "Recarregar o HQ". (Reaproveitado no Bloco 2.)
- `components/ui/action-error.tsx` (novo): caixa de erro com o botão "Recarregar o HQ".
- `lib/finance/settlement.ts` (novo): regra de idempotência. A mesma tentativa reenviada responde "registrado";
  baixa já feita por outra tentativa responde "já tinha baixa em dd/mm. Nada foi alterado". Nunca duas baixas.
- `features/finance/actions.ts`: baixa de pagamento e de recebimento gravam a chave da tentativa, mostram o
  motivo real das regras do banco e registram o erro técnico no log do servidor.
- `features/finance/components/settle-dialogs.tsx`: chave por janela aberta, botão "Registrando…" travado,
  janela não fecha enquanto salva, erro visível, lista atualizada na hora (`router.refresh`).
- Migração `20261017090000_settlement_keys.sql`: colunas `settle_key` (nulas) em `payables` e `receivables`
  + índice único. Só adiciona; nenhum dado muda. **Precisa ir para a produção ANTES do código.**
- Auditoria só de leitura: `docs/auditoria-baixas.sql` → resultado em `docs/auditoria-baixas.md`.

**Telas afetadas**: Financeiro → Pagamentos e Recebimentos ("Marcar como pago/recebido"), janela do pagamento
(link de notificação), aba Financeiro do projeto e do cliente.

**Testes**: `lib/actions/client-action.test.ts`, `lib/finance/settlement.test.ts`.

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

## Bloco 2 — Pauta que não muda de quadro (Anna, item 2)

**Causas encontradas** (o banco estava certo: a etapa era salva e o mapeamento etapa → quadro confere em
todos os squads; as permissões deixam encaminhar quem é responsável, líder, membro, criador-gestor ou gestor
do squad — nenhuma falha de permissão escondida na conta dela):
- **Minhas Pautas → Quadro** agrupava por **prioridade** para quem está em um squad só (caso da Anna). Mudar a
  etapa nunca mudava a coluna.
- **Minhas Pautas → Lista**: os grupos (Hoje, Esta semana, Acompanhando…) eram montados só no servidor. Depois
  de "Passar adiante", a pauta continuava no grupo antigo até recarregar. Uma edição feita na tela também
  escondia, para sempre, mudanças mais novas feitas por outra pessoa.
- **Pautas** (quadro geral e aba do projeto): o quadro guardava a lista da primeira carga e ignorava os dados
  novos do servidor; se a releitura da pauta depois do "Passar adiante" falhasse, o card ficava parado, calado.
- Arrastar card (Minhas Pautas) e salvar detalhes da pauta: falha de rede sumia sem aviso (mesma raiz do Bloco 1).

**O que mudou** (correção central, junto com o Bloco 1: "salvou, mas a tela não soube")
- `lib/my-pautas.ts` (novo): a MESMA regra de grupos no servidor e na tela. Com a bola em outra pessoa (passou
  adiante, ou só lidera), a pauta vai para **Acompanhando**; não repete em "Devolvidas". Edição da tela vale
  até o servidor ter versão mais nova.
- `features/minhas-pautas/queries.ts`, `types.ts`, `components/my-pautas-board.tsx`: usam essa regra e
  reagrupam na hora.
- `features/minhas-pautas/board.ts`: Quadro agrupa por **etapa** por padrão (Sprint Backlog → Em andamento →
  Revisão → Entregue) para todo mundo. Prioridade e Squad continuam no seletor "Agrupar".
- `features/pautas/components/kanban-board.tsx`: o quadro aceita os dados novos do servidor.
- `features/pautas/components/handover-dialog.tsx`: "Passar adiante" com `runAction`, e sempre atualiza o
  quadro do servidor depois de salvar.
- `my-pautas-kanban.tsx`, `pauta-details-tab.tsx`, `standalone-task-details-tab.tsx`: `runAction` (erro visível,
  arrasto desfeito se não salvou).
- Efeito colateral esperado: o card "Minhas Pautas" do Início e o contador "Hoje" deixam de contar pautas que a
  pessoa já passou adiante (o prazo é de quem está com a bola).

**Telas afetadas**: Minhas Pautas (Lista, Quadro, Calendário), Pautas, aba Pautas do projeto, Início (card
Minhas Pautas).

**Sem migração.** **Testes**: `lib/my-pautas.test.ts`, `lib/pautas.test.ts` (espelho do mapa etapa → quadro
lido do banco de produção).

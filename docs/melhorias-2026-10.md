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

## Bloco 3 — App do iPhone fechando nas Pautas (Anna, item 1)

**Causas encontradas**
- **Fotos e logos no tamanho original.** Avatares e logos (até 2 MB cada, ex.: foto de 12 MP do iPhone) eram
  carregados inteiros e só encolhidos na tela. Decodificada, cada foto ocupa ~48 MB de memória — em quadros
  com vários responsáveis e clientes, o iOS mata o app da tela de início.
- **Pautas carregava todo o histórico** de entregues e montava todos os cards de todas as colunas de uma vez.
- **Reabertura perdia o lugar**: o iOS reabre o app no Início; e quem desmarcou "Lembrar deste dispositivo"
  perdia o login a cada fechamento.
- Sem vazamentos: os temporizadores e "ouvintes" existentes já se desligam ao sair da tela.

**O que mudou**
- `lib/images/thumbnail.ts` + `next.config.ts` (`images.remotePatterns`, cache de 31 dias): avatar e logo do
  Storage passam pelo otimizador de imagens do Next/Vercel (já incluso) em 96 px (256 px em tela retina),
  com carregamento preguiçoso. Sem a otimização disponível, aparecem as iniciais (nunca quebra).
- `components/ui/avatar.tsx`, `components/companies/client-avatar.tsx`: usam a versão reduzida.
- `lib/images/downscale.ts`: fotos e logos novas são reduzidas no aparelho para 512 px antes do envio
  (`avatar-uploader.tsx`, `company-logo-uploader.tsx`).
- `app/(app)/pautas/page.tsx` + `features/pautas/queries.ts`: Entregues só dos últimos 30 dias, com
  "ver todas" (`?entregues=todas`). O contador "Concluídas" acompanha esse recorte.
- `components/kanban/kanban-lane.tsx`: 20 cards por coluna, "Mostrar mais (N)" para o resto (Pautas, aba do
  projeto e Minhas Pautas → Quadro).
- `lib/resume/*` + `components/layout/resume-place.tsx` (no AppShell): guarda a última tela (com filtros,
  que já ficam na URL) e a rolagem; ao reabrir o app da tela de início no Início em até 12 h, volta para lá.
  Links de notificação continuam abrindo o próprio destino.
- `components/kanban/use-remembered-scroll.ts`: cada coluna do quadro lembra a rolagem.
- `components/auth/login-form.tsx`: no app da tela de início o login fica sempre lembrado.
- `app/layout.tsx`: meta `apple-mobile-web-app-capable` explícita (iOS antigos). Manifesto conferido:
  `display: standalone`, `start_url: /inicio`, ícones 192/512/maskable e apple-touch-icon — ok.

**Medição antes/depois** (estimativa técnica; a contagem real sai de `docs/medicao-pautas.sql`, só leitura):
- Memória por foto/logo exibida: ~48 MB (12 MP decodificada) → ~0,26 MB (256 × 256).
- Cards montados no quadro de Pautas: todos → no máximo 20 por coluna (80 na tela).
- Pautas carregadas: todas as já entregues → só as entregues dos últimos 30 dias.
- **Medição real (produção, 12/10/2026, só totais):** 52 pautas no quadro antes e depois (as 20 entregues são
  todas dos últimos 30 dias — o recorte ainda não reduz nada; é prevenção para quando o histórico crescer);
  11 fotos/logos, média de 443 KB e a maior com 2.029 KB. Conclusão: hoje o volume de pautas é pequeno; o
  ganho real e imediato está nas imagens (uma foto de 2 MB do iPhone ocupa dezenas de MB decodificada).
- Não foi possível rodar a simulação de iPhone (WebKit) logado: exigiria entrar com senha de usuário real
  na produção. O teste no iPhone fica para o Bloco 9 (checklist).

**Telas afetadas**: todas que mostram avatar/logo; Pautas; aba Pautas do projeto; Minhas Pautas → Quadro;
login; abertura do app no iPhone.

**Sem migração.** **Testes**: `lib/images/thumbnail.test.ts`, `lib/images/downscale.test.ts`,
`lib/resume/place.test.ts`.

## Bloco 3B — Editar lançamento já baixado e "Estornar baixa" (pedido do Anderson)

**Antes**: pagamentos e recebimentos baixados não podiam ser corrigidos (só os em aberto); o único registro era
"criado / baixado / cancelado", sem o que mudou.

**Quem pode**: diretoria e squad financeiro (`can_see_money()`). Quem tem só a marca manual "acesso ao
financeiro" vê, mas não edita nem estorna. A regra vale no banco; a tela só esconde os botões.

**O que mudou**
- Migração `20261017100000_finance_entry_history.sql` (só adiciona):
  - tabela `financial_entry_history` (lançamento, quem, quando, ação EDIT | REVERSE_WRITE_OFF, campo a campo
    antes → depois, motivo) — imutável (trigger recusa alterar/apagar), leitura para quem vê o financeiro;
  - colunas `version`, `updated_by`, `edited_at` em `payables` e `receivables` (versão sobe a cada alteração);
  - `finance_edit_settled()` e `finance_reverse_settlement()`: conferem permissão, cancelado (somente leitura),
    baixado, versão (conflito → "Este lançamento foi alterado por [nome] agora há pouco…"), motivo obrigatório
    quando valor/data de pagamento mudam e no estorno, as mesmas regras da criação (valor > 0, datas, atraso com
    motivo) e gravam o histórico do que ficou salvo;
  - estorno limpa a baixa (data, comprovante, chave da tentativa; atraso e multa voltam pelo gatilho existente):
    a próxima baixa funciona e continua sem duplicar;
  - comissão de meta (`goals.payable_id`, `goal_contract_payouts.payable_id`): valor editado acompanha e o
    beneficiário é avisado da mudança ou do estorno (popup do Bloco 7 será marcado por comissão: edição não
    repete a comemoração);
  - nota fiscal anexada/trocada em recebimento já recebido também entra no histórico;
  - views `payables_with_status` / `receivables_with_status` recriadas com o mesmo corpo (expõem as colunas).
- Relatórios, totais, categorias e dashboards: todos são views/consultas calculadas na hora (nenhum total
  guardado) — refletem a edição assim que a tela atualiza.
- `lib/finance/settled-edit.ts`: espelho das regras (campos, motivo, permissão, mensagens) e texto do histórico.
- `features/finance/settled-actions.ts`: editar baixado, estornar e ler o histórico (servidor).
- `features/finance/rows.ts` (novo, extraído de `actions.ts`): formulário → colunas, compartilhado.
- `features/finance/schemas.ts`: mesmas regras da criação + dados da baixa + motivo.
- Tela: `payable-fields.tsx` e `receivable-identity-fields.tsx` (campos extraídos dos formulários existentes,
  sem mudança visual), `settled-payable-dialog.tsx`, `settled-receivable-dialog.tsx`,
  `reverse-settlement-dialog.tsx`, `entry-history.tsx` (lista + etiqueta "Editado"), `settled-row-actions.tsx`,
  `change-reason-field.tsx`, `use-settled-submit.ts`; menus ⋯ das listas e janela do pagamento.
- Recorrência e agendamento não são editados num lançamento já pago (são da série/da fila).

**Telas afetadas**: Financeiro → Pagamentos e Recebimentos (menu ⋯, etiqueta "Editado"), janela do pagamento,
abas Financeiro do projeto e do cliente.

**Testes**: `lib/finance/settled-edit.test.ts` (todos os tipos de campo, motivo, permissão, conflito, histórico) +
validação da migração no banco em `begin … rollback` (21 passos: motivo, conflito, estorno, nova baixa sem
duplicar, cancelado, histórico imutável, permissão negada, recebimento). A sincronização da comissão não foi
executada no banco (exigiria criar meta para um usuário real); foi revisada no código.

## Bloco 4 — CRM (relatório do Paulo)

**4.1 Horário do contato editável**
- "+ Registrar contato" e "Marcar enviado" (card do lead) usam agora por padrão; "Fiz em outro horário" /
  "Enviei em outro horário" abrem data e hora — até 7 dias para trás, nunca no futuro (tela, servidor e banco).
- O horário efetivo vai em `deal_interactions.occurred_at` e `prospect_touch_logs.sent_at` (cadência e meta de
  toques contam por ele); `created_at` continua sendo o momento real do registro (auditoria). O detalhe do
  contato mostra "registrado em …" quando os dois diferem.
- A cadência é calculada na leitura: o próximo toque passa a contar do horário efetivo, sem recálculo guardado.

**4.2 Etapa "Em análise"** (logo depois de "Tentativas de contato"; bola com o SDR)
- Valor novo `em_analise` (migração própria). Entrar nela pede a **data de retorno** (a próxima ação; o banco
  recusa sem data). A cadência fica pausada ("Em análise") até a data; nela o lead volta para **Chamar hoje**
  com o script de reativação. Enviar esse retorno devolve o negócio para "Tentativas de contato" e as regras
  normais voltam. Sem playbook, a data aparece como próxima ação do negócio (alertas e "vence hoje").
- Atualizados: ordem do funil, rótulos, probabilidade (15%), status da pauta do negócio, roteamento da bola.

**4.3 Histórico de abordagens** (linha do tempo do negócio)
- Autor do registro e diretoria/admin: **Editar** (canal, data/horário efetivo, observação) e **Riscar**
  (motivo obrigatório). O riscado continua visível, cortado, para todos; só a diretoria/admin toca nele para
  ver motivo, quem riscou e quando (o banco só devolve esses dados para eles).
- Riscados saem da cadência (lead e indicador de tentativas), das tentativas por canal e da meta de toques.
  Editar o horário de um toque da prospecção corrige também o toque ligado (a cadência recalcula).
- Histórico imutável de cada edição/risco em `deal_interaction_history` ("Editado · ver histórico").

**Migrações**: `20261018090000_crm_analysis_stage_enum.sql`, `20261018090100_crm_effective_time_and_approaches.sql`
(só adicionam; `deal_log_interaction` e `prospect_record_touch` ganham `p_occurred_at` opcional no fim).

**Telas afetadas**: CRM (funil com a coluna "Em análise", janela do negócio, Registrar contato, mudar etapa),
Chamar hoje / card do lead (Marcar enviado, histórico de toques), painel de esforço (meta de toques).

**Testes**: `lib/crm/effective-time.test.ts` (limites de 7 dias e futuro, fuso), `lib/prospeccao/cadence.test.ts`
(Em análise: pausa, retorno, feriado, saída; horário efetivo; riscado), `lib/crm/approaches.test.ts` (quem
edita/risca, quem vê o motivo, riscado fora da contagem). Migrações validadas no banco em `begin … rollback`
(regras de horário; funções e permissões criadas). O fluxo completo com um negócio real não foi executado no
banco (exigiria criar negócio/pessoa) — fica no checklist do Bloco 9.

## Bloco 5 — Bola, agenda e notificações (pedido do Anderson)

**Bola ("Com a bola agora" = `deals.responsible_id`, fonte única)**
- Regra pura `crm_ball_for_stage` (espelho `lib/crm/ball.ts`, casos em `lib/crm/ball-cases.json`): prospecção e
  "Em análise" → SDR; **Qualificado → o CEO** (conta master; antes ia para o líder do squad comercial);
  Reunião agendada → quem atende; reunião realizada, proposta e negociação → **volta para o SDR** (antes ficava
  com quem atendeu a reunião); perdido → ninguém; ganho → o fechamento define. Direcionamento do CEO → SDR
  (já era assim). Texto do resultado "Enviar proposta" atualizado ("O negócio volta para o SDR…").

**Marcar reunião** (prospecção e funil do CRM): escolha obrigatória **"Reunião com Anderson"** ou **"Reunião com
Paulo (kick-off)"** (primeiro nome do SDR dono do lead). Com o Anderson: horários livres do Google dele + HQ,
evento no Google dele, bola com ele. Com o SDR: horários da agenda do HQ do SDR (+ Google dele só se conectado),
evento na agenda dele, nada chega ao Anderson. Reagendar e cancelar mantêm quem atende. (`lib/prospeccao/meeting-host.ts`,
`features/prospeccao/busy-sources.ts`, `meeting-actions.ts`, `meeting-dialog.tsx`, `schedule-meeting-dialog.tsx`.)

**Agenda e Google**: item de negócio (prazo da pauta do CRM = próxima ação, abordagem vencida, compromisso do
negócio) só aparece para quem está com a bola ou participa do compromisso (`agenda_feed` e
`lib/google/calendar.server.ts`). Os itens do SDR saem da agenda do Anderson; nada é apagado — as tarefas
continuam no CRM; a próxima sincronização remove do Google só as cópias que o HQ tinha criado.

**Notificações — regra única** (`public.notification_rule`, aplicada por gatilho a TODA notificação inserida;
espelho `lib/notifications/routing.ts`, 57 casos em `lib/notifications/routing-cases.json`, conferidos no código e
no banco):
- Prazo/tarefa de negócio (próxima ação vencida, lead parado, prazo de pauta do CRM): só para quem está com a bola.
- CEO · audiovisual (e diretoria): como estava.
- CEO · comercial: só resposta/resolução de direcionamento dele, negócio enviado para a revisão dele
  (Qualificado), bola passando para ele (e prazos dos negócios em que ele está com a bola).
- CEO · financeiro: só **recebimento vencido** e **pagamento vencendo hoje**. Bloqueados: pagamento vencido, recebimento
  vencendo hoje, emitir nota, pagamento agendado sem baixa, relatório/alerta de margem, tarefas do financeiro.
- CEO · metas e comissões: como estão (o Bloco 7 define os lembretes).
- Demais (avisos, projetos): como estavam.

**Migração**: `20261019090000_ball_agenda_notifications.sql` (substitui funções com a mesma assinatura e cria
`ceo_id`, `crm_ball_for_stage`, `notification_rule`, `notification_allowed` e o gatilho `notifications_route`).

**Telas afetadas**: CRM (marcar reunião, resultado da reunião), Chamar hoje (Marcar reunião), Agenda, Google Agenda,
sino de notificações e push.

**Testes**: `lib/crm/ball.test.ts`, `lib/notifications/routing.test.ts`, `lib/prospeccao/meeting-host.test.ts`; os
mesmos casos de bola (12) e de notificação (57) conferidos contra o banco em `begin … rollback`.

### Bloco 5 — ajustes pedidos pelo Anderson (12/10/2026)
- **Bola depois da reunião**: continua com quem conduz — se a reunião foi com o Anderson e ele envia a proposta,
  fica com ele na proposta e na negociação. Volta para o SDR ao requalificar (voltar para etapas de prospecção),
  ao perder (perdido agora volta para o SDR, que decide o reaquecimento) ou pelo resultado da reunião (follow-up,
  sem interesse, não compareceu). Venda direta: sempre o SDR. Texto "Enviar proposta" voltou ao original.
- **Financeiro para o CEO**: só alertas de atraso — recebimento vencido e pagamento vencido.
- **Recebimento com "Nota fiscal: Sim/Não"** (migração `20261019090100_receivable_invoice_flag.sql`): chave no
  cadastro/edição do recebimento (padrão Sim; os recebimentos existentes continuam Sim). Com "Não", a geração das
  pautas automáticas do financeiro não cria a tarefa de emitir nota daquele recebimento (inclusive nas parcelas);
  a lista mostra "Sem nota fiscal".
- Casos conferidos no código e no banco: bola 15/15, notificações 57/57.

## Bloco 6 — Ciclo de vida do cliente (pedido do Anderson)

**Coluna "Inativos"**: o quadro de Clientes ganhou a coluna Inativos (churn, pausados e encerrados), cada um com a
etiqueta **Churn / Pausado / Encerrado** (sai do encerramento em aberto: churn → Churn; pausa → Pausado; fim de
contrato, projeto concluído ou outro → Encerrado). A aba **"Ex-clientes" duplicava isso e foi juntada à coluna**
(links antigos `?aba=ex-clientes` caem no quadro). "Ex-cliente" passou a se chamar "Inativo".

**Encerrar cliente (Churn ou Encerrado) — passo a passo** (`features/clients/components/close-flow/`):
1. Situação: Churn ou Encerrado (motivo), data, o que aconteceu, potencial futuro.
2. Projetos e pautas que serão finalizados (lista + "Entendi").
3. "O cliente ainda precisa pagar algo?" Sim → marca os recebimentos em aberto que continuam e pode lançar novos
   (descrição, valor, vencimento — criados no Financeiro); os não marcados são cancelados. Não → lista "serão
   cancelados" e exige confirmação explícita.
4. "Existem custos deste cliente a pagar?" — igual (lançamento novo pede também o favorecido).
5. Revisão e "Confirmar encerramento".
- Cancelar = status (`cancelled_at`) com `cancel_reason` "Encerramento do cliente (…)" e `cancelled_by`; nunca
  apaga. O que já foi pago/recebido nunca muda. Agora vale para TODO lançamento em aberto não marcado (antes, os
  vencidos e os agendados ficavam abertos sozinhos).
- Regra fixa no banco: cliente inativo não ganha projeto nem pauta nova até reativar (negócio do CRM e tarefas
  automáticas do financeiro continuam; projeto vindo de negócio ganho reativa o cliente, como já era).

**Pausar cliente**: projetos ativos → Pausado (guardando a etapa), pautas abertas → pausadas (saem dos quadros, não
são finalizadas); financeiro intacto. **Reativar**: se estava pausado, pergunta "Só o cliente" ou "Cliente, projetos
e pautas" (voltam à etapa de antes).

**Reabrir prospecção** (cliente inativo): negócio novo no CRM ligado ao cliente, com playbook, SDR (padrão: o SDR das
configurações) e objetivo; origem "cliente antigo"; o histórico continua no cliente e no negócio anterior.

**Último projeto**: ao finalizar o último projeto ativo do cliente, a diretoria vê "O cliente foi finalizado?" →
"Sim, encerrar cliente" (abre o encerramento como Encerrado / projeto concluído) ou "Não, cliente continua ativo".

**Cliente da casa**: continua para Encerrado; não para Churn (a entrega de projeto de cliente em churn não gera
retorno); no churn, retornos pendentes são cancelados (`prospect_house_entries.cancelled_at`) e o negócio de
retorno que ainda não começou é descartado.

**Encerrar projeto isolado**: continua na janela anterior (só para projeto).

**Migração**: `20261020090000_client_lifecycle.sql` (colunas nulas + funções `client_close`, `client_pause`,
`client_reactivate`, gatilhos de bloqueio; prévia inclui pautas diretas do cliente).

**Telas afetadas**: Clientes (quadro), página do cliente (Encerrar / Pausar / Reativar / Reabrir prospecção), projeto
(finalizar), Financeiro (cancelados e lançamentos novos), CRM (negócio reaberto), Pautas (pausadas/finalizadas).

**Testes**: `lib/clients/lifecycle.test.ts` (status, plano do financeiro Sim/Não, lançamento manual, último projeto) +
cenário completo no banco em `begin … rollback` (23 passos: encerrar com marcado/não marcado/vencido/pago, manuais,
bloqueio de projeto e pauta novos, reativar, pausar e reativar com tudo, churn cancelando cliente da casa, recusas).

## Bloco 7 — Metas, comissões e comemoração (pedido do Anderson)

**Tipo de comissão**: "Percentual (%)" ou **"Valor fixo (R$)"** (novo, migração `20261021090000`), além dos modos que já
existiam (por unidade, contratos fechados). Valor fixo paga o próprio valor a partir do gatilho da meta.

**Início**: quem tem meta ativa vê o card grande da meta no topo (já existia, com barra, números e prazo). O CEO vê o card
"Metas da equipe", agora com **cada pessoa, a meta, a % e a barra e o prazo** (antes eram só contagens).

**"Finalizar meta"** (CEO/admin, `goal_finalize`) — substitui o "Aprovar meta" (exceto metas por contratos fechados, que
seguem a aprovação com pagamento por contrato):
- **Meta batida**: percentual → o CEO informa o valor final em R$ (obrigatório); valor fixo → o valor aparece para confirmar;
  por unidade → calculado. Fica em "Encerradas" como **Meta batida** (verde) com a comissão. A pessoa é avisada; o CEO e o
  squad financeiro recebem **"Agendar pagamento da comissão de [nome] — [meta] — R$ X"**. **O pagamento não é criado
  sozinho** (antes a aprovação lançava o pagamento automaticamente).
- **Meta não alcançada**: em "Encerradas" no vermelho de erro do HQ (`--status-danger`, não o da marca), com "faltaram X%".

**Pagamento "Referente a: Comissão"** (categoria Comissão no Financeiro): beneficiário obrigatório (pessoa da equipe) e meta
ligada opcional (`payables.commission_goal_id`). Ao lançar, o beneficiário recebe "Sua comissão de R$ X será paga em DD/MM"
(de novo se a data agendada mudar); depois da baixa, "Comissão paga". A página da meta mostra "Comissão agendada" →
"Comissão paga" (`goal_commission_payments`: o dono e a diretoria veem; o financeiro vê todos os pagamentos).

**Comemoração**: popup "Parabéns, [primeiro nome]!" / "Você ganhou R$ X de comissão" (+ a meta), com confete em canvas
(sem biblioteca; sem confete com "reduzir movimento"), uma vez por comissão, na próxima tela aberta
(`commission_celebrations` + "visto"). Nasce na meta batida com comissão e em todo pagamento de comissão que não seja de
meta já comemorada (comissões avulsas também). Editar o valor depois não repete.

**Notificações de metas para o CEO** (regra única do Bloco 5): meta para finalizar, lançamento para revisar e "agendar
pagamento da comissão"; os demais avisos de meta (marcos, ritmo) não chegam a ele. Casos: 65.

**Migrações**: `20261021090000_goal_fixed_commission_enum.sql`, `20261021090100_goals_finalize_commissions.sql` (coluna
`goals.outcome`, `payables.commission_goal_id`, tabela `commission_celebrations`, funções; views `goals_with_progress` e
`payables_with_status` recriadas com o mesmo corpo).

**Telas afetadas**: Início (cards de meta), Metas (lista, Encerradas, página da meta: Finalizar, resultado e comissão),
formulário de meta, Financeiro (pagamento de comissão), popup em qualquer tela.

**Testes**: `lib/goals/finalize.test.ts` (fixo × percentual, batida × não, % que faltou), `lib/goals/celebration.test.ts`,
`lib/notifications/routing.test.ts`; cenário no banco em `begin … rollback` (18 passos: valor final obrigatório, sem
pagamento automático, comemoração única, avisos, não alcançada com 18%, pagamento ligado e avulso, paga, editar sem repetir).
O modo "valor fixo" não roda no banco antes de existir de fato (valor novo de enum); está coberto pelos testes do código.

## Bloco 8 — Telas largas no computador e rolagem do CRM (pedido do Anderson)

**Largura**: o esqueleto das telas (`components/layout/app-shell.tsx`) limitava tudo a 1280 px — daí o espaço vazio à
direita. No computador (≥1024 px) a tela agora usa a largura disponível, com teto de 1920 px em telas muito largas; no
celular nada muda. Vale para todas as telas que usam o esqueleto (Início, CRM, Clientes, Projetos, Pautas, Metas,
Financeiro, Agenda, Orçamentos). Textos longos continuam com largura confortável (descrição do cabeçalho limitada; páginas
de texto já tinham o próprio limite).

**Quadro do CRM** (`deal-kanban-board.tsx`, `components/kanban/use-fill-viewport.ts`, `components/ui/link-tabs.tsx`):
- A barrinha de rolagem ao lado das abas era o sublinhado da aba ativa vazando: as abas rolam só na horizontal, sem barra
  visível (vale para todas as abas do HQ).
- A altura do quadro era um cálculo fixo ("tela − 24rem") que não batia com o cabeçalho e fazia a página rolar junto. No
  computador o quadro mede onde começa e ocupa exatamente o resto da tela: **uma** rolagem horizontal (o quadro) e uma
  vertical por coluna; a página não rola em nenhuma direção.
- O "encaixe" por coluna (snap) agora só no celular: no computador deixava o trackpad e o shift+roda aos trancos.
- A janela de mudança de etapa recomeça do zero quando a etapa muda (achado no teste de arrastar).

**Teste em navegador de verdade** (página de teste com 60 negócios inventados, só numa cópia fora do projeto, já apagada):
1568×900 → largura útil 1238 px (antes ~1050), rolagem da página 0 na vertical e na horizontal, um único rolador
horizontal (o quadro) + um vertical por coluna, nenhuma barra perto das abas, quadro rolando 600 px na horizontal, snap
desligado; arrastar um card entre colunas abriu a janela da etapa ("Em análise" com o retorno sugerido para +7 dias).
Celular (375×812): sem rolagem para os lados, encaixe por coluna mantido, altura como antes. Em janelas muito baixas
(menos de ~860 px de altura) o quadro mantém 420 px de altura mínima e a página rola um pouco, de propósito.

**Sem migração.** Telas afetadas: todas no computador; CRM (quadro e abas); abas de todas as telas.

## Bloco 8C — Excluir clientes (pedido do Anderson)

(O pedido citava um "Bloco 8B", que não existe; este bloco entra logo depois do Bloco 8 e antes da publicação.)

**Quem pode**: só a conta master (decisão do Anderson) — `canDeleteClients()` na tela e nas ações; `is_master()` dentro de
cada função do banco, que é quem decide de verdade. Outros papéis recebem "Só a conta master exclui, restaura ou anonimiza
clientes." mesmo chamando o servidor direto.

**Por que não dá para simplesmente apagar**: o banco protege o histórico (recebimentos, projetos e negócios impedem apagar
o cliente; contatos e encerramentos somem junto; pagamentos, agenda, orçamentos e pautas avulsas perdem a ligação). Por
isso:

- **Resumo antes de tudo** (`client_deletion_summary`): projetos (total e ativos), pautas abertas, negócios e cadências
  ativas, reuniões futuras e passadas, orçamentos, lançamentos em metas, recebimentos e pagamentos (em aberto, pagos,
  cancelados) e contatos. A janela mostra em português simples (`dependencyLines`).
- **Sem nenhum histórico** (só contatos): "Excluir permanentemente" digitando o nome exato → o cliente e os contatos são
  apagados de verdade.
- **Com histórico → Lixeira** (`client_delete`): nada é apagado. O cliente ganha `deleted_at`, `deleted_by` e o motivo
  (opcional). Na mesma transação: negócios arquivados (somem do CRM e do "Chamar hoje"; a cadência para; a pauta do
  negócio acompanha); projetos em aberto → encerrados; pautas abertas → finalizadas com "Encerrado — cliente excluído" (os
  responsáveis são avisados); todos os projetos e pautas do cliente saem das listas; faturamento automático dos projetos
  desligado; "cliente da casa" pendente cancelado; reuniões futuras marcadas na janela → canceladas (a sincronização tira
  do Google de quem conectou a conta). **O financeiro não muda**: os lançamentos continuam contando e aparecem como
  "Nome (cliente excluído)". Metas e histórico de comissão ficam como estão.
- **O que a exclusão escondeu leva uma marca** (`hidden_by_client_deletion` em negócios, projetos e pautas), para a
  restauração desfazer exatamente isso.
- **Onde o cliente some**: Clientes (todas as abas e colunas), CRM, "Chamar hoje", Projetos (lista e quadro), Pautas,
  listas de escolha (Financeiro, CRM — inclusive a busca de duplicados ao criar negócio —, Pautas, Agenda, Orçamentos,
  projetos do cliente), "cliente da casa" e "Reabrir prospecção". A busca global do topo ainda é só um campo sem função
  (nada a esconder ali). Cliente excluído também não ganha projeto, negócio nem pauta nova (gatilho no banco).
- **Página de um cliente excluído** (link antigo, ou o Financeiro → cliente): aviso "Este cliente foi excluído em …",
  sem botões de ação.

**Lixeira** (Clientes → Lixeira, só a conta master; `client_trash_list`): data, quem excluiu, motivo e o resumo. Ações:
- **Restaurar** (`client_restore`): o cliente e os negócios voltam; projetos e pautas continuam finalizados (reativar à
  mão — a tela avisa).
- **Excluir definitivamente** (`client_purge`, digitando o nome exato): só sem lançamentos financeiros. Com lançamentos,
  o botão fica desligado com "Este cliente tem lançamentos financeiros e não pode ser apagado definitivamente." Também
  fica desligado quando o cliente **conta em metas** ("Este cliente conta em metas da equipe…"): apagar os negócios
  apagaria junto os pagamentos de comissão por contrato das metas.
- **Anonimizar (LGPD)** (`client_anonymize`, digitando ANONIMIZAR): "Removido" no nome, documento, site, Instagram,
  observações; contatos (nome, telefone, e-mail, cargo); no CRM, título, gancho, decisor e WhatsApp do decisor, mensagens,
  notas e registros de contato (inclusive o histórico de edição); reuniões; orçamentos (nome do cliente e observações);
  observações dos lançamentos (e do histórico de edição deles). Valores, datas e categorias ficam. Sem volta; cliente
  anonimizado não pode ser restaurado. Títulos de pautas e descrições de lançamentos ficam (são a descrição do serviço).

**Registro imutável** (`client_deletion_log`): quem, quando, a ação (enviado para a Lixeira, excluído permanentemente,
restaurado, excluído definitivamente, anonimizado) e o resumo do que estava ligado — sem o nome do cliente, para a
anonimização valer de fato. Ninguém altera nem apaga (gatilho); só a conta master lê.

**Históricos imutáveis**: os gatilhos de abordagens, toques e edições financeiras continuam recusando qualquer mudança,
com uma única exceção ligada só dentro de "Excluir definitivamente" e "Anonimizar" (`alem.client_erasure`).

**Sem rotina automática**: nada é apagado sozinho com o tempo.

**Migração**: `20261022090000_client_deletion.sql` (colunas novas em `companies`, marca em `deals`/`projects`/`pautas`,
tabela `client_deletion_log`, funções e gatilhos; as três funções de histórico imutável recriadas com a exceção).

**Testes**: `lib/clients/deletion.test.ts` (18: Lixeira × apagar de vez, trava do definitivo, confirmação por nome,
rótulo "(cliente excluído)", resumo em português); os mesmos 12 casos conferidos no banco (`client_deletion_flags`).
Cenário no banco em `begin … rollback` (54 passos, todos como esperado): sem histórico apaga cliente e contatos; nome
errado recusado; não-master recusado (42501) ao excluir e ao ver a Lixeira; Lixeira esconde negócio (fora da view do CRM),
cadência ativa vai a 0, projeto encerrado e escondido, pautas finalizadas e arquivadas, só a reunião marcada cancelada;
recebimentos e pagamentos idênticos antes e depois; projeto e negócio novos recusados; definitivo recusado com financeiro;
restaurar; anonimizar (palavra errada recusada; dados pessoais "Removido"/vazios; valores e datas iguais; restaurar
anonimizado recusado); definitivo de um prospect com histórico de abordagem editado; registro imutável. Página de teste da
Lixeira no navegador (computador e celular 375 px: sem rolagem para os lados, botões de 44 px; confirmação só liga com o
nome exato; aviso na cor de erro do HQ, não no vermelho da marca).

**Telas afetadas**: Clientes (aba Lixeira, menu ⋯ na página do cliente, aviso de excluído), Projetos, Pautas, CRM,
Agenda, Orçamentos, Financeiro (nome marcado e listas de escolha).

## Bloco 9 — Publicação (em andamento)

1. **Testes finais — PASSOU** (12/10/2026): 295 testes do código; checagem de tipos e lint sem erros; as 10 migrações
   pendentes em sequência no banco de produção dentro de `begin … rollback`; cenários refeitos por cima delas: 3B 21/21,
   4 6/6, notificações 65/65, bola 14/14 (o caso "Em análise" só no código), 6 23/23, 7 18/18, 8C 54/54. Auditoria de
   baixas refeita pelo Anderson: nenhuma duplicada (21 pagamentos e 5 recebimentos com baixa).
2. **Cópia de segurança**: `~/Documents/backup-alem-hq/2026-10-12/hq.dump` (pg_dump do Postgres.app, schemas public,
   auth e storage; 1,2 MB, 105 tabelas com dados). Como restaurar: `docs/backup-e-restauracao.md`. A senha do banco não
   é usada por nada do projeto (Vercel, .env.local, CLI e scripts usam só as chaves do Supabase).
3. **Variáveis de ambiente**: nenhuma nova. `NEXT_PUBLIC_SITE_URL` = https://hq.alemfilmes.com.br (domínio oficial).
4. **Migrações aplicadas** pelo Anderson (`npx supabase db push`): as 10, conferidas no banco (`migration list` sem
   pendências; "Em análise" e "Valor fixo" existem; contagens iguais às de antes: 19 recebimentos, 170 pagamentos,
   5 metas, 21 negócios, 51 pautas). Tipos regenerados do banco real (`npm run db:types` + ajustes manuais).
   - **Correção achada ao regenerar os tipos**: a view `receivables_with_status` não trazia "Nota fiscal: Sim/Não"
     (foi recriada no Bloco 3B, antes da coluna do Bloco 5). Sem a correção, a marca "Sem nota fiscal" não aparecia e
     editar um recebimento "Não" voltaria para "Sim". Migração `20261023090000_receivables_view_invoice_flag.sql`
     (recria a view com o mesmo corpo; validada em rollback: mesmas 19 linhas e mesma soma).
   - Correção aplicada pelo Anderson (`db push` da 11ª migração); conferida no banco: a view traz "Nota fiscal",
     mesmas 19 linhas e soma R$ 71.300,00; nenhuma migração pendente. Tipos regenerados de novo.
5. **Publicação** (12/10/2026, 19:57): `main` avançado de `ed14a5e` (versão anterior) para `1940174`; a Vercel publicou
   sozinha.
6. **Verificação depois de publicar** (só leitura, sem login), em https://hq.alemfilmes.com.br: login, esqueci a senha,
   privacidade, termos e manifesto respondem 200; Início, Clientes, Lixeira, CRM, Financeiro, Metas, Projetos, Pautas,
   Minhas pautas e Agenda pedem login (307 → /login com o retorno certo); metas do iPhone (tela cheia) presentes; build
   novo no ar (arquivos novos); alemhq.vercel.app também responde. As telas logadas ficam para o Anderson conferir com
   o checklist de cada bloco.

### Plano de volta

- **Se uma tela quebrar** (o mais provável e o mais simples): voltar o código para a versão anterior. Na Vercel:
  Deployments → a publicação anterior (commit `ed14a5e`, "Prospecção por WhatsApp no CRM") → ⋯ → **Promote to
  Production** (ou **Instant Rollback**). Leva segundos. O código antigo funciona com o banco novo: as migrações só
  adicionaram colunas, tabelas e funções. Depois, o Claude corrige e publica de novo.
- **Banco**: não há "desfazer" automático das migrações, e não é preciso — nenhuma apagou ou renomeou dado. Se uma regra
  nova do banco atrapalhar o trabalho, a correção é uma migração nova (não voltar a cópia).
- **Cópia de segurança** (`~/Documents/backup-alem-hq/2026-10-12/hq.dump`): só se dados forem perdidos ou estragados;
  ver `docs/backup-e-restauracao.md`. Restaurar apaga o que foi lançado depois da cópia — fazer junto com o Claude.

### Decisões em aberto

- **Metas "contratos fechados"**: continuam com o fluxo antigo ("Aprovar meta", pagamento automático por contrato);
  Finalizar meta (batida/não alcançada) vale para os outros tipos. Mudar para o fluxo novo é um pedido à parte.
- **Exclusão definitiva de cliente que conta em metas**: bloqueada (apagaria os pagamentos de comissão por contrato);
  para esses, usar Anonimizar (LGPD).
- **Anonimização**: títulos de pautas e descrições de lançamentos ficam (são a descrição do serviço); trocar também, se
  o Anderson pedir.
- **Busca global do topo**: continua sendo só um campo sem função (fora do escopo deste lote).

## Lote 10 — Agenda do CEO, gestão da prospecção e "Equipe e colaboradores" (pedido do Anderson, 12/10/2026)

### Diagnóstico
- **Prazos do CRM na agenda do Anderson**: cada negócio tem uma pauta-espelho cujo responsável é quem está com a bola
  (Bloco 5); em "Qualificado" a bola vai para o CEO. A agenda do HQ (agenda_feed) e a sincronização com o Google
  mostravam o prazo dessa pauta para quem está com a bola. Os 5 citados (Núcleo Educacional Semear, NEC Pinguinho de
  Gente, Escola Ativa, Ícaro Colégio e Curso, Colégio Vitória Kids) estavam em Qualificado com a bola com o Anderson, e
  os 5 — mais 1 — estavam no Google dele: **6 eventos "Prazo:" do CRM criados pelo HQ** (mais 1 prazo do financeiro,
  que não é do CRM e fica).
- **Head comercial** já existia (head com o squad Comercial ou líder do squad Comercial): nenhuma mudança de papel.
- **Pró-labore** já existia como categoria (30 lançamentos); "Equipe e colaboradores" era só um grupo do relatório
  Custos da empresa. Favorecido: pessoa do HQ (payee_profile_id) ou nome digitado. 15 despesas (13 Software,
  1 Deslocamento, 1 Outro) tinham uma pessoa do HQ como favorecida — reembolsos: decisão do Anderson, ficam em "Outro"
  com a marca "Reembolso de despesa" e, ligados a cliente/projeto, saem dos custos da empresa.

### 1. Prazos do CRM fora da agenda do CEO
Regra única `crm_pauta_on_agenda_rule` (SQL) = `crmPautaOnAgenda` (lib/agenda/crm-items.ts), mesmos 8 casos nos dois:
item da pauta-espelho do CRM só para quem está com a bola, nunca para o CEO. Usada pela agenda do HQ (agenda_feed
recriada com o mesmo corpo) e pela sincronização do Google (lib/google/calendar.server.ts) — o que deixa de valer é
apagado do Google na próxima sincronização, só os eventos que o HQ criou (marca própria do HQ em cada evento). As
reuniões "com Anderson" continuam (são compromissos da agenda, não a pauta-espelho). Bola, notificações e o card do
negócio não mudam. Conferido com as contas reais (contagem, em rollback): agenda do CEO 6 → 0 prazos do CRM; quem está
com a bola (não CEO) 10 → 10.

### 2. "Gerenciar prospecção" (CEO/admin e Head comercial)
Menu "Gerenciar" no card do lead (Chamar hoje/Prospecção) e na seção Prospecção do negócio: Editar cadência (playbook,
próximo toque e data — dia útil), Reiniciar cadência (Toque 1, ou Toque 0 sem decisor; toques antigos marcados "ciclo
anterior" no histórico), Remover da prospecção (sai da cadência e das listas; o negócio segue no funil; volta com
Reiniciar) e Apagar prospecção (separado, na cor de erro; digitar o nome do lead; apaga toques e as tentativas que eles
criaram na linha do tempo, objeções, rascunhos e dados da cadência; o negócio fica; metas de toques recalculam sozinhas).
Permissão: `canManageLeadCadence` (tela/ações) e `can_manage_lead_cadence()` (cada função do banco); as colunas de gestão
só mudam pelas funções (gatilho). Registro imutável `prospect_management_log`.

### 3. Equipe e colaboradores
"Pessoal/Equipe" passa a se chamar **Equipe e colaboradores**, com tipo (Pró-labore, Comissão, Pagamento a colaborador)
e as marcas "Pró-labore" e "Reembolso de despesa". Regra única `payable_team_rule` (SQL) = `teamCategoryRule`
(lib/finance/team-category.ts), 13 casos nos dois, aplicada por gatilho ao criar e ao editar categoria/favorecido/marcas
(dar baixa não mexe), inclusive na edição de lançamento já pago; cada troca automática vai para o histórico com
"Categorização automática: equipe e colaboradores". A comissão passa a ser reconhecida pelo tipo (avisos e comemoração
iguais). "Comissão" e "Pró-labore" saem da lista de categorias (viram tipos). Relatórios: Custos por categoria e Custos
da empresa mostram Equipe por tipo. Formulário: categoria travada com a nota "Definida automaticamente: …", seletor de
tipo, destrava e pede outra categoria quando o favorecido deixa de ser da equipe.
**Lançamentos antigos não mudam nesta migração**: a lista do que mudaria vai para o Anderson confirmar antes.

**Migrações**: `20261024090000_crm_deadlines_off_ceo_agenda.sql`, `20261024090100_prospecting_management.sql`,
`20261024090200_team_payments.sql`.

**Testes**: 326 no código (novos: agenda 8 casos, cadência editar/reiniciar 6, permissão da gestão 2, equipe 15).
Cenário no banco em rollback (25 passos ok): casos da agenda 8/8 e da equipe 13/13 iguais ao código; SDR barrado ao
remover e ao mexer direto nas colunas de gestão; editar (toque fora do playbook recusado); remover (negócio segue no
funil); reiniciar; apagar (nome errado recusado; 1 toque e 1 tentativa apagados; negócio continua); registro imutável;
favorecido do HQ → Equipe · Pagamento a colaborador com histórico; reembolso ligado a cliente → Outro, fora dos custos
da empresa; pró-labore; fornecedor livre; favorecido sai do HQ → destrava; lançamento pago editado → categoria
automática com pago/valor/vencimento iguais; comissão pela categoria antiga → Equipe · Comissão, com aviso e
comemoração; lançamentos antigos intocados (0). Formulário testado numa página de teste (computador e celular 375 px).

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

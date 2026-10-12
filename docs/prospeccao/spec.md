# Automação de Prospecção · HQ além.filmes

Oct 10, 2026 · @Anderson

> Transcrição fiel do PDF aprovado "Automação de Prospecção · HQ além.filmes" (17 páginas). Fonte única de verdade para os 5 módulos.
>
> **Nota de transcrição:** no PDF, os scripts aparecem quebrados pela largura da página. Essas quebras são de diagramação, não do texto: cada script abaixo é um único parágrafo, como no original. Os blocos de código guardam o texto exato (pontuação, acentos e variáveis) que vai para o banco.

Este documento descreve, com tudo já aprovado pelo Anderson, a automação de prospecção que deve ser construída dentro do HQ. Ele é a base para o agente que programa o HQ escrever o código.

## 1. Contexto, objetivo e princípios

**Quem usa:** Paulo, do squad comercial da além.filmes. Ele faz prospecção ativa por WhatsApp, qualifica o cliente e marca a reunião. Quem fecha é o Anderson (diretor).

**Objetivo:** o Paulo só gasta tempo conversando com cliente. Pesquisar o que mandar, escrever mensagem do zero, lembrar de follow-up, montar link e cadastrar meta à mão passa a ser trabalho do HQ.

**Princípios obrigatórios:**

- **Nada de painel isolado.** A prospecção vive dentro do CRM que já existe. O funil atual (cadastro, primeiro toque, tentativas, qualificação, reunião) continua sendo a base. O que se constrói são campos, filtros, botões e regras.
- **Tudo conversa com o resto do HQ:** Agenda, Orçamentos, Metas e Fluxograma (seção 7).
- **WhatsApp semiautomático, sem API.** A API oficial é inviável para a além. APIs não oficiais (Z-API, Evolution e similares) estão proibidas: risco de bloqueio do número comercial. O HQ abre o WhatsApp com a mensagem pronta; o Paulo confere e aperta enviar.
- **Um motor, vários playbooks.** A além não vende só matrícula. O mesmo mecanismo serve para escolas e empresas, e cada lead recebe um playbook.
- **Editável sem código.** Playbooks, scripts e cadências ficam em configuração, não no código. O Anderson troca um texto sem precisar de deploy.
- **Não pode virar mais um processo.** Cada lead deve se resolver em três ações: abrir, enviar, marcar como enviado.

## 2. Conceitos e playbooks

Todo lead do CRM recebe um playbook. O playbook define a cadência, os scripts e o link que o HQ usa.

**Glossário:**

- **Playbook:** combinação de público + produto + cadência + scripts + link.
- **Cadência:** sequência de toques com intervalos em dias úteis.
- **Toque:** uma mensagem enviada ao lead. Cada toque tem um script.
- **Decisor:** quem decide a compra (coordenação, direção, marketing). Diferente do contato de secretaria ou recepção.
- **Gancho:** uma observação real e curta sobre o lead que o Paulo preenche em cerca de 20 segundos olhando o Instagram (ex.: "vi que vocês abriram a unidade de Parnamirim"). Opcional: sem gancho, o HQ usa a versão "sem gancho" do script.
- **Cliente da casa:** lead que já fechou e teve entrega concluída. Volta ao CRM com um novo playbook sugerido.

**Playbooks iniciais:**

| # | Playbook | Público | Tipo de cadência | Link `{link}` |
|---|---|---|---|---|
| 1 | Campanha de matrícula | Escolas | Sazonal | Página de matrícula personalizada com `?escola=` (URL a confirmar) |
| 2 | Espetáculos e eventos | Escolas | Sazonal | Página independente de espetáculos (com os 3 pacotes) personalizada com `?escola=` |
| 3 | Conteúdo recorrente | Escolas | Relacionamento | www.alemfilmes.com.br |
| 4 | Filme institucional | Empresas | Relacionamento | www.alemfilmes.com.br |
| 5 | Conteúdo recorrente | Empresas | Relacionamento | www.alemfilmes.com.br |
| 6 | Eventos e aftermovie | Empresas | Sazonal | www.alemfilmes.com.br |

Novos playbooks (ex.: político, agências) devem entrar só por cadastro na tela de Configurações, sem código novo.

**Variáveis que o HQ preenche nos scripts:**

| Variável | De onde vem |
|---|---|
| `{saudacao}` | Hora do envio: "Bom dia" até 12h, "Boa tarde" até 18h, "Boa noite" depois |
| `{nome}` | Primeiro nome do decisor no lead |
| `{escola}` / `{empresa}` | Nome do lead |
| `{gancho}` | Campo gancho do lead |
| `{link}` | Link do playbook; nos playbooks 1 e 2, com `?escola=` + nome do lead codificado |
| `{case}` | Texto fixo do playbook 6: "a Acqua Coco no MotoGP Brasil e uma produção internacional para a Disrupty" |
| `{mês}` | Mês seguinte ao envio, por extenso |
| `{ano_seguinte}` | Ano seguinte ao envio (ex.: 2027) |
| `{ultimo_projeto}` | Nome do último projeto entregue para o cliente |

## 3. Cadências e regras automáticas

Existem dois tipos de cadência. Os dias contam a partir do Toque 1 e são dias úteis.

| Tipo | Usado em | Toques | Sem resposta, reativa em |
|---|---|---|---|
| Sazonal | Playbooks 1, 2 e 6 | Dia 0, 2, 5 e 10 (4 toques) | 30 dias |
| Relacionamento | Playbooks 3, 4 e 5 | Dia 0, 3, 8, 15 e 25 (5 toques) | 60 dias |

**Toque 0 (achar o decisor):** quando o contato cadastrado é de secretaria ou recepção, o lead começa no Toque 0. O script só pede o contato de quem decide. Quando o Paulo cadastra o decisor, a cadência começa no Toque 1.

**Regras automáticas:**

1. Marcou "enviado" → o toque é registrado no funil do CRM (primeiro toque ou tentativa) e o próximo toque é agendado.
2. Respondeu → o Paulo marca "Respondeu". A cadência para na hora e o lead vai para "Em conversa". Sai da fila de follow-up.
3. Reunião marcada → a etapa do funil muda e o evento é criado na agenda do Anderson (seção 7).
4. Fim da cadência sem resposta → o lead sai da fila com status "Sem resposta" e volta sozinho como "Reativar" no prazo do tipo de cadência, usando o script de reativação.
5. Fim de semana e feriado são pulados. O toque cai no próximo dia útil. Considerar feriados nacionais e de Natal/RN.
6. Horário sugerido: 9h–11h e 14h–16h. É sugestão visual, não bloqueio.
7. Toque atrasado (não enviado no dia previsto) continua na fila como "Atrasado" até ser enviado. Os próximos toques contam a partir do envio real, não da data prevista.
8. Objeção com data ("sem verba", "me chama depois") → o HQ pede a data ao Paulo e agenda a reativação nela (seção 5).
9. Cliente da casa → quando uma entrega é concluída, o lead volta ao CRM com o playbook sugerido e o script "cliente da casa" (seção 7).

**Sugestão de próximo playbook para cliente da casa:**

| Fechou | HQ sugere |
|---|---|
| Campanha de matrícula | Espetáculos e eventos, ou Conteúdo recorrente (escolas) |
| Espetáculos e eventos | Conteúdo recorrente (escolas), ou Campanha de matrícula |
| Filme institucional | Conteúdo recorrente (empresas) |
| Eventos e aftermovie | Conteúdo recorrente (empresas) |

## 4. Biblioteca de scripts

Textos aprovados, que entram como conteúdo inicial das Configurações. Quebras de linha fazem parte do texto. Regras de escrita para scripts futuros: tom direto e afirmativo, frases curtas, sem "incrível", "mágico" ou "adoraríamos", sem emoji, nunca falar de preço (o objetivo é sempre a reunião). O Toque 1 abre falando do lead e fecha com uma pergunta fácil de responder; o link só entra a partir do Toque 2.

### 4.1 Toque 0 (achar o decisor)

**Escolas · Matrícula e Recorrente**

```text
{saudacao}. Sou o Paulo, da além.filmes, produtora audiovisual de Natal. Preciso falar com quem cuida do marketing ou da campanha de matrícula da escola. Pode me passar o contato ou o nome da pessoa?
```

**Escolas · Espetáculos**

```text
{saudacao}. Sou o Paulo, da além.filmes, produtora audiovisual de Natal. Preciso falar com quem cuida dos eventos e espetáculos da escola. Pode me passar o contato ou o nome da pessoa?
```

**Empresas · todos os playbooks**

```text
{saudacao}. Sou o Paulo, da além.filmes, produtora audiovisual de Natal. Preciso falar com quem cuida do marketing da empresa. Pode me passar o contato ou o nome da pessoa?
```

### 4.2 Versão sem gancho (substitui o Toque 1 quando o campo gancho está vazio)

```text
{nome}, tudo bem? Sou o Paulo, da além.filmes. Pergunta rápida: hoje quem cuida dos vídeos do {escola}?
```

(Em empresas: "da {empresa}".)

### 4.3 Playbook 1 · Escolas · Campanha de matrícula

**Toque 1 · dia 0**

```text
{nome}, tudo bem? Vi o perfil do {escola} e {gancho}. Sou o Paulo, da além.filmes. A gente faz o filme da campanha de matrícula de escolas aqui em Natal. A campanha de {ano_seguinte} de vocês já está em produção?
```

**Toque 2 · dia 2**

```text
{nome}, preparei uma página com o nosso trabalho para o {escola}: {link} O case do Contemporâneo mostra o padrão: um filme que as famílias compartilham e que trabalha pela escola na captação.
```

**Toque 3 · dia 5**

```text
{nome}, as campanhas de matrícula estão sendo fechadas agora. Para o filme estar no ar a tempo, a captação precisa acontecer nas próximas semanas, e nossa agenda é por data. Qual horário fica bom para uma reunião com você essa semana?
```

**Toque 4 · dia 10 (encerramento)**

```text
{nome}, vou encerrar por aqui para não ocupar seu WhatsApp. Se a campanha do {escola} entrar em pauta, é só chamar. A página continua no ar: {link}
```

**Reativação · 30 dias**

```text
{nome}, retomando: estamos fechando a agenda de {mês} para filmes de matrícula. O {escola} já definiu o material da campanha de {ano_seguinte}?
```

### 4.4 Playbook 2 · Escolas · Espetáculos e eventos

**Toque 1 · dia 0**

```text
{nome}, tudo bem? Vi o perfil do {escola} e {gancho}. Sou o Paulo, da além.filmes. Filmamos espetáculos escolares com padrão de cinema, como o Fest Show do Contemporâneo e o Sarau Literário do Sistema. Quando é o próximo espetáculo de vocês?
```

**Toque 2 · dia 2**

```text
{nome}, preparei uma página para o {escola} com o filme do Fest Show: {link} É o padrão que entregamos: o aftermovie que as famílias compartilham e a íntegra multicâmera como registro oficial.
```

**Toque 3 · dia 5**

```text
{nome}, nossa agenda de cobertura é por data, e o fim de ano concentra os espetáculos. Qual horário fica bom para uma reunião com você essa semana?
```

**Toque 4 · dia 10 (encerramento)**

```text
{nome}, vou encerrar por aqui para não ocupar seu WhatsApp. Quando o próximo espetáculo do {escola} entrar em pauta, é só chamar. A página continua no ar: {link}
```

**Reativação · 30 dias**

```text
{nome}, retomando: estamos fechando a agenda de {mês}. O {escola} tem espetáculo ou formatura previstos?
```

### 4.5 Playbook 3 · Escolas · Conteúdo recorrente

Escopo e frequência ficam abertos e são definidos na reunião.

**Toque 1 · dia 0**

```text
{nome}, tudo bem? Vi os posts do {escola} e {gancho}. Sou o Paulo, da além.filmes. A gente produz conteúdo mensal para escolas, com padrão de cinema. Hoje quem faz os vídeos de vocês?
```

**Toque 2 · dia 3**

```text
{nome}, aqui está o padrão do nosso trabalho: {link}
```

**Toque 3 · dia 8 (conteúdo de valor)**

```text
{nome}, uma observação rápida: escola que mostra o cotidiano com qualidade chega na matrícula com a confiança das famílias já construída. A campanha começa meio ganha. É isso que o conteúdo mensal faz.
```

**Toque 4 · dia 15**

```text
{nome}, qual horário fica bom para uma reunião com você essa semana?
```

**Toque 5 · dia 25 (encerramento)**

```text
{nome}, vou encerrar por aqui. Quando o {escola} quiser planejar a comunicação do próximo ano, é só chamar.
```

**Cliente da casa (escolas)**

```text
Olá, {nome}. Depois do {ultimo_projeto}, ficou claro o quanto o {escola} tem para mostrar ao longo do ano. Queremos propor um formato mensal para manter esse padrão o ano inteiro. Qual horário fica bom para uma reunião essa semana?
```

### 4.6 Playbook 4 · Empresas · Filme institucional

**Toque 1 · dia 0**

```text
{nome}, tudo bem? Vi o perfil da {empresa} e {gancho}. Sou o Paulo, da além.filmes. A gente faz filme institucional com direção de cinema aqui em Natal. Vocês já têm um filme que apresente a empresa hoje?
```

**Toque 2 · dia 3**

```text
{nome}, aqui está o padrão do nosso trabalho: {link}
```

**Toque 3 · dia 8 (conteúdo de valor)**

```text
{nome}, uma observação: o institucional é a primeira impressão da empresa no site, na proposta e na reunião. Quando o filme é fraco, a empresa parece menor do que é.
```

**Toque 4 · dia 15**

```text
{nome}, qual horário fica bom para uma reunião com você essa semana?
```

**Toque 5 · dia 25 (encerramento)**

```text
{nome}, vou encerrar por aqui. Quando a {empresa} for renovar a apresentação institucional, é só chamar.
```

### 4.7 Playbook 5 · Empresas · Conteúdo recorrente

**Toque 1 · dia 0**

```text
{nome}, tudo bem? Vi os últimos posts da {empresa} e {gancho}. Sou o Paulo, da além.filmes. A gente assume a produção de vídeo mensal de empresas, com padrão de cinema. Hoje quem produz os vídeos de vocês?
```

**Toque 2 · dia 3**

```text
{nome}, aqui está o padrão do nosso trabalho: {link}
```

**Toque 3 · dia 8 (conteúdo de valor)**

```text
{nome}, marca forte nas redes vem de constância. Manter padrão todo mês é o difícil, e é exatamente essa parte que nós assumimos.
```

**Toque 4 · dia 15**

```text
{nome}, qual horário fica bom para uma reunião com você essa semana?
```

**Toque 5 · dia 25 (encerramento)**

```text
{nome}, vou encerrar por aqui. Quando a {empresa} quiser planejar o conteúdo do próximo trimestre, é só chamar.
```

**Cliente da casa (empresas)**

```text
Olá, {nome}. Depois do {ultimo_projeto}, ficou claro o quanto a {empresa} tem para mostrar. Queremos propor um formato mensal para manter esse padrão o ano inteiro. Qual horário fica bom para uma reunião essa semana?
```

### 4.8 Playbook 6 · Empresas · Eventos e aftermovie

**Toque 1 · dia 0**

```text
{nome}, tudo bem? Vi que a {empresa} {gancho}. Sou o Paulo, da além.filmes. Filmamos eventos como {case}. Vocês já têm alguém para o vídeo do evento?
```

**Toque 2 · dia 2**

```text
{nome}, aqui está o padrão: {link}. Um bom aftermovie continua trabalhando pela marca muito depois do evento.
```

**Toque 3 · dia 5**

```text
{nome}, nossa agenda de cobertura é por data. Qual horário fica bom para uma reunião com você essa semana?
```

**Toque 4 · dia 10 (encerramento)**

```text
{nome}, vou encerrar por aqui. Quando o próximo evento da {empresa} entrar em pauta, é só chamar.
```

### 4.9 Scripts ainda não escritos

Reativação dos playbooks 3, 4, 5 e 6 não foi definida. O sistema deve aceitar o campo vazio; enquanto estiver vazio, o lead reativado usa o Toque 1 do próprio playbook.

## 5. Objeções e respostas rápidas

As respostas abaixo são cadastradas à mão como respostas rápidas do WhatsApp Business no celular do Paulo (ele digita `/` e escolhe). São fixas, sem variáveis. O HQ deve guardar a mesma lista nas Configurações, como fonte única, e mostrar no card do lead para copiar quando ele estiver no computador.

| Atalho | Objeção | Ação no HQ |
|---|---|---|
| `/ja-temos` | "Já temos quem filme" | Registrar objeção |
| `/preco` | "Quanto custa?" | Registrar objeção |
| `/preco-espetaculo` | "Quanto custa?" (espetáculos) | Registrar objeção |
| `/sem-verba` | "Sem verba agora" | Pedir data e agendar reativação |
| `/nao-sou-eu` | "Fala com outra pessoa" | Abrir cadastro de novo decisor no mesmo lead |
| `/depois` | "Me chama depois" | Pedir data e agendar reativação |
| `/material` | "Manda material por aqui" | Registrar objeção |
| `/interferencia` | "A equipe atrapalha o evento?" | Registrar objeção |
| `/imagem` | "E o uso de imagem dos alunos?" | Registrar objeção |

**Respostas:**

`/ja-temos`

```text
Ótimo, sinal de que vídeo já é prioridade para vocês. Nosso diferencial está antes da câmera: estratégia e direção criativa. Cada vídeo nasce com objetivo claro, roteiro pensado e resultado para a marca. Uma conversa de 15 minutos mostra isso na prática. Qual horário fica bom essa semana?
```

`/preco`

```text
Cada projeto tem escopo próprio, por isso a proposta sai depois de uma conversa rápida. Você paga pelo que precisa, sem pacote inflado. Qual horário fica bom essa semana?
```

`/preco-espetaculo`

```text
Os pacotes estão no final da página que te mandei. Na reunião a gente ajusta ao tamanho do espetáculo de vocês. Qual horário fica bom essa semana?
```

`/sem-verba`

```text
Entendo. Quando vocês fecham o orçamento de comunicação? Te procuro nessa data para entrarmos no planejamento.
```

`/nao-sou-eu`

```text
Perfeito. Pode me passar o contato de quem cuida disso? Digo que falei com você.
```

`/depois`

```text
Combinado. Qual data fica melhor para eu te chamar?
```

`/material`

```text
Mando sim: www.alemfilmes.com.br. Para a proposta, uma conversa de 15 minutos com o Anderson, nosso diretor, resolve. Qual horário fica bom?
```

`/interferencia`

```text
Não. As posições de câmera são definidas com a coordenação antes do evento, no mapa de palco. A plateia não perde a visão e o espetáculo segue normal.
```

`/imagem`

```text
O material segue as autorizações de imagem que a escola já coleta das famílias e é entregue para uso institucional da escola.
```

**Registro de objeções:** no card do lead, um seletor "Objeção" com a lista acima. Cada registro guarda data e playbook. Isso alimenta um relatório simples: quais objeções mais aparecem e em quais playbooks, e quantos leads com cada objeção acabaram em reunião.

## 6. Mudanças no CRM e rotina do Paulo

**Campos novos no lead (somados aos que o CRM já tem):**

| Campo | Tipo | Observação |
|---|---|---|
| Playbook | Seleção (lista das Configurações) | Obrigatório para entrar na cadência |
| Tipo de lead | Escola / Empresa | Pode vir do playbook |
| Contato atual é decisor? | Sim / Não | "Não" inicia no Toque 0 |
| Decisor: nome, cargo, WhatsApp | Texto / telefone | Separado do contato geral (secretaria) |
| Gancho | Texto curto (até ~120 caracteres) | Opcional |
| Meta vinculada | Seleção (metas ativas) | Sugerida pelo playbook; ver seção 7 |
| Toque atual / próximo toque | Calculado | Número do toque e data prevista |
| Status da cadência | Calculado | Em cadência, Em conversa, Reunião marcada, Sem resposta, Reativar, Pausado |
| Objeções | Lista com data | Seção 5 |
| Último projeto entregue | Texto | Usado no script cliente da casa |

**Filtro "Chamar hoje"** dentro do CRM (não é painel novo): mostra os leads com toque previsto para hoje e os atrasados, atrasados primeiro. Deve ser a visão padrão do Paulo ao abrir o CRM. Mostra também um contador simples: "X toques para hoje".

**Ações no card do lead:**

1. **Enviar no WhatsApp** — monta a mensagem do toque atual com as variáveis preenchidas e abre o WhatsApp com o texto pronto (seção 9). Antes de abrir, mostra uma prévia editável. Se faltar variável obrigatória (ex.: nome do decisor), avisa e não abre.
2. **Marcar enviado** — aparece logo depois de abrir o WhatsApp. Registra o toque e agenda o próximo.
3. **Respondeu** — para a cadência e move para "Em conversa".
4. **Marcar reunião** — abre a sugestão de horários (seção 7).
5. **Objeção** — registra a objeção e mostra a resposta para copiar.
6. **Pausar / Descartar** — com motivo.

**Rotina do Paulo, do jeito que precisa funcionar:**

1. Abre o HQ e cai em "Chamar hoje".
2. Em cada lead: Enviar no WhatsApp → aperta enviar no WhatsApp → volta e clica Marcar enviado.
3. Quando alguém responde, clica Respondeu e conduz a conversa com as respostas rápidas.
4. Quando o cliente aceita reunião, clica Marcar reunião e oferece os horários sugeridos.
5. Para cadastrar lead novo: nome, WhatsApp, playbook, gancho (se tiver). A meta vem sugerida. O resto o HQ calcula.

## 7. Integrações com o resto do HQ

Cada passo da prospecção alimenta o módulo seguinte, sem redigitar nada.

### 7.1 Agenda (Google Agenda do Anderson, já conectado ao HQ)

- Ao clicar Marcar reunião, o HQ consulta a agenda e mostra dois horários livres nos próximos dias úteis, dentro do horário comercial. O Paulo oferece esses horários ao cliente (o HQ monta a frase pronta para copiar).
- Confirmado o horário, o HQ cria o evento na agenda do Anderson com resumo do lead: nome, escola/empresa, playbook, gancho, objeções e link do card no CRM.
- Quando existir a sincronização das pautas da WAWS com a agenda (desejo já registrado pelo Anderson), esses horários também contam como ocupados.

### 7.2 Orçamentos (já puxa dados do CRM)

- Reunião realizada → o lead aparece em Orçamentos com cliente, contato, playbook e produto já preenchidos.
- Orçamento recusado → volta ao CRM com motivo e data de reativação.
- Orçamento aprovado → conta na meta vinculada (7.3) e marca o lead como cliente.

### 7.3 Metas

Hoje as metas são criadas pelo Anderson e o Paulo cadastra à mão o andamento das dele. Isso passa a ser automático:

- Ao cadastrar o lead no CRM, o campo Meta vinculada já vem sugerido pelo playbook (ex.: playbook Campanha de matrícula → meta "campanhas de matrícula com escolas"). O Paulo pode trocar ou marcar "nenhuma".
- O mapeamento playbook → meta fica nas Configurações, porque as metas mudam a cada trimestre.
- Fechamento do lead (orçamento aprovado) soma sozinho na meta vinculada. Se a meta for de faturamento, soma o valor do orçamento.
- Metas de esforço do Paulo calculadas pelo CRM: toques enviados por dia e reuniões marcadas por semana. Os alvos são definidos pelo Anderson no painel de metas.

### 7.4 Fluxograma

O Fluxograma é o painel onde cada squad documenta o passo a passo das tarefas, para integrar novos membros. Ele não executa nada.

- Criar no fluxograma do squad comercial o processo "Como prospectar": cadastrar lead → escolher playbook → preencher gancho → Chamar hoje → enviar e marcar → respondeu → objeções → marcar reunião → orçamento.
- Cada passo com uma frase do que fazer e onde clicar, seguindo o padrão atual do fluxograma.

### 7.5 Cliente da casa

Quando um projeto do cliente é marcado como entregue no HQ, o lead volta ao CRM com o playbook sugerido (tabela da seção 3), o campo último projeto preenchido e o script "cliente da casa" como toque 1.

O agente deve identificar onde o HQ registra hoje a entrega concluída de um projeto e usar esse evento como gatilho.

### 7.6 Configurações (acesso só do Anderson)

- Cadastrar, editar e desativar playbooks.
- Editar scripts de cada toque, com lista das variáveis disponíveis e prévia com dados de exemplo.
- Editar cadências (dias de cada toque, prazo de reativação).
- Editar respostas de objeções.
- Editar links por playbook e o texto de `{case}`.
- Mapeamento playbook → meta.

Alterar um script vale para os próximos envios; o histórico do lead guarda o texto que foi realmente enviado.

## 8. Diretrizes visuais

O Paulo precisa entender o que fazer em cada lead com uma olhada. A interface segue o padrão visual que o HQ já usa; estas regras definem o que é específico desta funcionalidade. Esta parte não passou por aprovação etapa por etapa: o agente deve mostrar as telas ao Anderson antes de finalizar.

**Botões com cor por função (sempre ícone + texto, nunca só cor):**

| Ação | Cor de fundo | Ícone |
|---|---|---|
| Enviar no WhatsApp (ação principal do card) | Verde WhatsApp #25D366, texto escuro | Logo do WhatsApp |
| Marcar enviado | Verde mais escuro ou contorno verde | Check |
| Respondeu | Azul | Balão de conversa |
| Marcar reunião | Roxo | Calendário |
| Objeção | Âmbar | Escudo ou ponto de exclamação |
| Pausar / Descartar | Cinza, contorno | Pausa / lixeira |

**Status do lead como etiqueta colorida no card e na lista:**

| Status | Cor |
|---|---|
| Atrasado | Âmbar forte |
| Chamar hoje | Azul |
| Em cadência (próximo toque futuro) | Cinza |
| Em conversa | Verde |
| Reunião marcada | Roxo |
| Reativar | Azul-claro |
| Sem resposta / Descartado | Cinza apagado |

**Regras gerais:**

- O vermelho da marca (#E5231B) não é usado em botões, status ou alertas. Pelo manual da além.filmes ele existe só no "é" do logotipo.
- Um botão principal por card: "Enviar no WhatsApp", grande e no topo. As outras ações menores, abaixo.
- No card, a linha de topo mostra: nome do lead, playbook, "Toque 2 de 4" e a data do próximo toque.
- Prévia da mensagem em balão no estilo de conversa, para o Paulo conferir antes de abrir o WhatsApp.
- Contraste mínimo AA em todos os textos sobre cor.
- Funcionar bem no celular (o Paulo pode trabalhar de casa, pelo telefone): botões com no mínimo 44px de altura, card em coluna única, sem rolagem horizontal.
- Linguagem dos botões em verbo direto, curta, em português.

## 9. Regras técnicas, critérios de aceite e pontos em aberto

### 9.1 WhatsApp sem API

- Link no formato `https://wa.me/55DDDNUMERO?text=<mensagem>` com a mensagem codificada (`encodeURIComponent`). Quebras de linha viram `%0A`.
- Normalizar o telefone: só dígitos, com 55 na frente. Se faltar o DDD, assumir 84 e avisar no card.
- No `{link}` dos playbooks 1 e 2, o nome da escola também vai codificado no parâmetro `?escola=`.
- O HQ não tem como saber se a mensagem foi enviada. Por isso o registro depende do clique em Marcar enviado. O histórico do lead guarda o texto exato gerado.
- Proibido: API oficial, APIs não oficiais, extensões que automatizem envio, disparo em massa.

### 9.2 Critérios de aceite

- Nenhum painel novo: tudo acessível dentro do CRM, com Configurações para o Anderson.
- Cadastrar um lead com playbook gera a cadência certa, pulando fins de semana e feriados.
- Lead com contato de secretaria começa no Toque 0.
- "Enviar no WhatsApp" abre a conversa com o texto completo, variáveis preenchidas e acentos corretos, no computador e no celular.
- Sem gancho, o HQ usa a versão sem gancho.
- "Marcar enviado" registra o toque no funil existente e agenda o próximo.
- "Respondeu" para a cadência na hora.
- Fim da cadência sem resposta reaparece como "Reativar" em 30 ou 60 dias.
- "Marcar reunião" sugere dois horários livres reais da agenda e cria o evento com o resumo do lead.
- Reunião realizada aparece em Orçamentos já preenchida.
- Fechamento soma na meta vinculada sem ação manual.
- Alterar um script nas Configurações muda os próximos envios sem deploy.
- Todos os textos da seção 4 cadastrados exatamente como estão.
- Telas aprovadas pelo Anderson antes da entrega final.

### 9.3 Pontos em aberto (o agente confirma com o Anderson)

- URL final da página de matrícula usada no playbook 1.
- Scripts de reativação dos playbooks 3, 4, 5 e 6.
- Alvos das metas de esforço (toques por dia, reuniões por semana).
- Janela de horário e duração das reuniões na sugestão de agenda.
- Fonte dos feriados (nacionais + Natal/RN).
- Onde o HQ registra hoje a entrega concluída de um projeto (gatilho do cliente da casa).
- Prospecção por Instagram e ligação fica para depois; hoje é só WhatsApp. A estrutura de toque deve permitir adicionar canal no futuro.

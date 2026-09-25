# Além HQ

Sistema operacional interno da Além Filmes. **Módulo 1 — Fundação**: autenticação por convite, papéis e permissões, shell da aplicação, equipe e perfil. Módulos futuros (tarefas, agenda, clientes, projetos, CRM, avisos) existem apenas como páginas "Em construção".

Stack: Next.js 15 (App Router) · TypeScript strict · Tailwind CSS · Supabase (Postgres, Auth, Storage) · Zod + react-hook-form.

## Setup

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie o projeto no [Supabase](https://supabase.com) e copie `.env.example` para `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Preencha (Project Settings → API):
   | Variável | Uso |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave `anon` |
   | `SUPABASE_SERVICE_ROLE_KEY` | chave `service_role`. **Somente servidor.** Nunca a exponha nem use o prefixo `NEXT_PUBLIC_` |
   | `NEXT_PUBLIC_SITE_URL` | URL pública do app, sem barra final (local: `http://localhost:3000`) |

   As variáveis são validadas com Zod na inicialização; se faltar alguma, o app falha com uma mensagem clara.
3. Aplique as migrações (abaixo), configure o Auth (abaixo) e crie o primeiro admin.
4. Rode: `npm run dev` e abra <http://localhost:3000>.

Outros comandos: `npm run type-check`, `npm run lint`, `npm run build`.

## Migrações

Todo o schema está em `supabase/migrations`:

| Arquivo | Conteúdo |
|---|---|
| `20260921120000_profiles_and_access.sql` | enums `access_role` e `production_function`, tabela `profiles`, helpers (`current_access_role()`, `is_admin()`, `is_active_user()`), triggers de proteção e RLS |
| `20260921120100_invitations.sql` | tabela `invitations`, RLS (somente admin), `expire_stale_invitations()`, `accept_invitation()` e o trigger que cria o profile em `auth.users` |
| `20260921120200_storage_avatars.sql` | bucket público `avatars` (2 MB, JPG/PNG/WebP) e policies por pasta `{user_id}/` |
| `20260921130000_finance_access_and_activity_log.sql` | `profiles.has_finance_access` e `job_title`, `has_finance_access()`, `activity_log`, guard atualizado e backfill dos admins existentes |
| `20260921130100_companies_contacts_projects.sql` | `companies` (com origem e ciclo de vida), `contacts`, `projects` (internos sem cliente), `project_financials` e RLS |
| `20260921140000_finance_module.sql` | `receivables`, `payables`, views `receivables_with_status`, `payables_with_status` e `project_profitability` (security_invoker), `generate_installments()`, logs financeiros e RLS |
| `20260922100000_squads_health_model_owner_costs_margin.sql` | squads (`profile_squads`, `in_squad()`, `is_director()`, `can_see_money()`), saúde/nível do cliente, modelo comercial e novos campos do projeto, `project_members`, `notifications`, margem prevista na view `project_profitability` |
| `20260923090000_pautas_and_project_brief.sql` | campos que faltavam em `projects`/`contacts`, tabelas `pautas`, `pauta_members`, `pauta_comments`, `pauta_status_history`, `pauta_code_counters`, gatilhos de coluna↔status/código/histórico/notificações, `can_view_pauta()`/`can_edit_pauta()`/`can_manage_pautas()`, `pautas_summary()`, `pauta_handover()`, `pauta_move_column()`, view `pautas_with_details` e RLS |
| `20260926100000_logos_squads_overview.sql` | `companies.logo_url` + bucket público `company-logos` (2 MB, JPG/PNG/WebP, `{company_id}/logo.*`) e `set_company_logo()`; `pautas.squad` (derivado por trigger, protegido contra troca pelo quadro); `projects.delivered_at`; `company_logo_url` em `pautas_with_details`/`deals_with_details`; `company_overview()` e `company_timeline()` |
| `20260926100100_agenda.sql` | agenda em `commitments`: participantes, externos, dia inteiro, recorrência (RFC 5545), lembretes, visibilidade, colunas reservadas do Google; RLS nova; `agenda_feed()` (recorrência expandida, privados como "Ocupado", pautas agendadas derivadas) e `agenda_conflicts()` |

Aplicar no projeto hospedado:

```bash
npx supabase login
npx supabase link --project-ref <SEU_PROJECT_REF>
npx supabase db push
```

Para regenerar os tipos TypeScript após mudar o schema:

```bash
npm run db:types
```

> `types/database.ts` é gerado por `supabase gen types typescript --linked` (projeto conectado via `supabase link`, sem precisar de Docker/Supabase local). **Depois de regenerar, reaplique a correção manual em `generate_installments`**: o gerador não marca como aceitando NULL os parâmetros `p_project_id`, `p_company_id` e `p_payment_method`, embora a função os aceite (ver `supabase/migrations/20260921140000_finance_module.sql`). Adicione `| null` aos três em `Functions.generate_installments.Args` — o topo do arquivo tem um comentário lembrando disso — e rode `npm run type-check` para confirmar.

### Como o acesso é protegido

- RLS ativa em `profiles` e `invitations`. `profiles`: leitura para qualquer usuário **ativo**; o próprio usuário edita a própria linha, mas um trigger bloqueia mudanças em `access_role`, `functions`, `is_active` e `email` para não-admins; admin edita qualquer linha; não há DELETE (desative a conta).
- Usuário desativado deixa de enxergar dados (as policies exigem `is_active_user()`), é deslogado pelo middleware e tem o login bloqueado no Auth (`ban_duration`).
- Admin não pode alterar o próprio papel nem se desativar (trigger + server action).
- O trigger de criação do profile lê papel e funções do **convite pendente** (mesmos valores enviados como metadata), não de `raw_user_meta_data`, que o próprio usuário consegue editar. Sem convite, o profile nasce como `freelancer` sem funções.

## Configurar o Supabase Auth (painel)

1. **Desativar cadastro público** — Authentication → Sign In / Providers → desative **Allow new users to sign up**. Convites de admin continuam funcionando.
2. **URLs** — Authentication → URL Configuration:
   - **Site URL**: a URL de produção (ex.: `https://hq.alemfilmes.com`).
   - **Redirect URLs**: `https://hq.alemfilmes.com/auth/confirm`, `http://localhost:3000/auth/confirm`.
3. **Templates de e-mail em português** — Authentication → Email Templates. Cole o conteúdo de:
   - **Invite user** → `supabase/templates/invite.html` (assunto: `Seu acesso ao Além HQ`)
   - **Reset password** → `supabase/templates/recovery.html` (assunto: `Redefinição de senha — Além HQ`)

   Os links usam `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…`. Esse formato é obrigatório: é ele que permite ao servidor criar a sessão (`/auth/confirm`).
4. **Validade do link** — Authentication → Sign In / Providers → Email → **Email OTP Expiration**: use o máximo permitido (86400 s = 24 h). O convite registrado no sistema vale 7 dias; se o link do e-mail vencer antes, use **Reenviar** em Equipe.
5. **Senha** — mínimo de 8 caracteres (o app também valida letras e números).
6. **SMTP próprio (recomendado)** — o SMTP padrão do Supabase tem limite baixo de e-mails por hora. Configure um provedor em Authentication → SMTP Settings.

## Criar o primeiro admin

Ninguém entra sem convite, então a primeira conta precisa de bootstrap. Escolha uma opção:

**Opção A — conta já existe** (criada em Authentication → Users → Add user, com "Auto Confirm User" marcado e uma senha):

```bash
npm run create-first-admin -- seu-email@alemfilmes.com
```

O script (`scripts/create-first-admin.ts`, usa a service role key de `.env.local`) promove o profile para `admin`. No primeiro login, o app pede nome completo e uma nova senha.

**Opção B — conta ainda não existe**: rode o mesmo comando. Sem conta, ele envia um convite de administração para o e-mail (requer os templates configurados). Abra o link, defina nome e senha.

Depois disso, use **Equipe → Convidar pessoa** para trazer o restante do time.

## Deploy (Vercel)

Cadastre as 4 variáveis do `.env.example` no projeto da Vercel (a `SUPABASE_SERVICE_ROLE_KEY` como variável de servidor) e ajuste `NEXT_PUBLIC_SITE_URL` para o domínio de produção. Atualize também a Site URL e as Redirect URLs no Supabase.

## Estrutura

```
app/(auth)/        login, esqueci-senha, redefinir-senha, aceitar-convite (+ server actions)
app/(app)/         inicio, equipe, perfil, configuracoes e páginas "Em construção"
app/auth/confirm/  route handler que troca o token do e-mail por sessão
components/ui/     primitivos (shadcn/ui restilizado nos tokens da marca)
components/layout/ sidebar, topbar, drawer mobile, page header
lib/supabase/      server.ts, client.ts, admin.ts (server-only), middleware.ts
lib/auth/          permissions.ts (mapa único de permissões), roles.ts, session.ts
lib/validations/   schemas Zod
supabase/          config.toml, migrations, templates de e-mail
```

`lib/auth/permissions.ts` é a única fonte de verdade de acesso: middleware, sidebar e server actions o reutilizam.

## Regras de marca

Interface somente escura. O vermelho `#E5231B` é exclusivo do "é" do logo e não existe nos tokens (`app/globals.css`, `tailwind.config.ts`). Erros e estados são comunicados por ícone, rótulo, peso e contraste de cinza.

## Squads e permissões

Cada pessoa pode pertencer a vários squads (`profile_squads`): **Diretoria**, **Comercial**, **Audiovisual**, **Financeiro**. Três funções SQL somam a fonte de verdade, usadas tanto pela RLS quanto pelo mapa de permissões em `lib/auth/permissions.ts`:

- `is_director()` — só diretoria cria, edita ou arquiva projetos.
- `can_see_money()` — diretoria ou financeiro veem dados financeiros automaticamente.
- `in_squad('comercial')` — comercial (junto com diretoria) cadastra e edita empresas/contatos.

O acesso ao financeiro **não depende mais só da coluna** `profiles.has_finance_access`: ela virou uma concessão manual para exceções pontuais. O acesso efetivo é `can_see_money() OR has_finance_access`, calculado dentro da própria função `has_finance_access()` — por isso toda RLS e o `generate_installments()` que já chamavam essa função passaram a valer para squads sem precisar ser reescritos. Só quem já tem acesso ao financeiro concede ou revoga a exceção manual, e ninguém altera a própria. Gestão de equipe (convidar, mudar papel ou squads, desativar) continua exclusiva do papel `admin` — squads não dão esse poder.

A migração coloca a conta `admin` existente na diretoria automaticamente.

## Financeiro

Recebimentos (parcelas) e pagamentos (custos de projeto, freelancers e despesas gerais), com rentabilidade por projeto. O código fica em `features/finance/`.

- **Acesso:** somente `has_finance_access = true`. As tabelas, as views (`security_invoker`), `generate_installments()` e as linhas financeiras do `activity_log` exigem `has_finance_access()`; a rota `/financeiro` exige a capability `finance` no middleware. Ser admin não basta.
- **Status nunca é gravado:** `pendente`, `atrasado`, `recebido`/`pago` e `cancelado` são calculados nas views (atrasado = vencimento anterior a hoje em America/Fortaleza).
- **Dinheiro:** `numeric(12,2)` no banco e centavos inteiros no TypeScript (`features/finance/money.ts`). Parcelas somam exatamente o total.
- **Vínculos futuros:** `receivables.deal_id` e `receivables.task_id` existem sem FK, prontos para CRM e tarefas avulsas.

### Dados de demonstração (opcional)

```bash
npm run seed-demo -- --yes    # cria empresas, projetos, pautas, recebimentos e pagamentos "[Demo]"
npm run seed-demo -- --clean  # remove apenas o que começa com "[Demo]"
```

Cria 5 empresas (saúde e nível de ticket diferentes, incluindo um prospect sem tier), um projeto transacional, um recorrente (sem data de fim — "Em andamento desde…"), um projeto interno, um com custos altos o bastante para mostrar a margem em estado crítico, e 12 pautas espalhadas pelas 4 colunas do quadro (duas em atraso, duas críticas).

## Status coloridos

Uma paleta semântica separada da marca (`--status-success/warning/alert/danger` em `app/globals.css`, mapeada em `lib/status.ts`) indica saúde do cliente, etapa do projeto, squad, margem, coluna e status de pauta. Regra fixa: essas cores só aparecem em indicadores pequenos — ponto de 8px, barra de 3px, texto de percentual — nunca em fundo de botão, card ou gráfico. O vermelho da marca (`#E5231B`) continua exclusivo do "é" do logo.

## Pautas

CLIENTE → PROJETO → PAUTA: a pauta é a unidade de trabalho (uma captação, um vídeo, uma entrega) e sempre pertence a um projeto. O código fica em `features/pautas/`.

- **Quadro:** `/pautas` (todas as pautas, de todos os projetos) e a aba "Pautas" de cada projeto (mesmo componente `KanbanBoard`, filtrado) usam @dnd-kit para arrastar entre as 4 colunas fixas — Sprint Backlog, Em andamento, Revisão, Entregue. Só a coluna rola; a página, não.
- **Coluna ↔ status:** a relação é fixa e bidirecional, decidida só pelo trigger `pautas_sync_column_status` no banco (`planejamento`→Sprint Backlog; `captação/edição/reajuste`→Em andamento; `revisão interna/do cliente`→Revisão; `aprovado`→Entregue). Arrastar entre colunas escolhe um status padrão sensato para a nova coluna; a UI só espelha essa regra (`lib/pautas.ts`) para a prévia otimista do arrasto.
- **Handover ("Passar adiante"):** RPC `pauta_handover()` — troca status, responsável atual e prazo, adiciona a pessoa aos responsáveis na função escolhida e notifica, tudo atômico. O histórico (`pauta_status_history`) é gravado por um trigger único, tanto pelo handover quanto por uma troca simples de status ou por arrastar o card.
- **Acesso:** diretoria e squad audiovisual criam e editam qualquer pauta; líder, responsável atual e responsáveis editam a própria; comercial e financeiro só leem; freelancers veem as pautas dos projetos em que estão. Mesma regra nas funções `can_view_pauta()`/`can_edit_pauta()` do banco e na UI.

## Indicadores (`<MetricValue>`)

Todo número grande de painel usa `components/ui/metric-value.tsx` (`MetricValue`, `Metric`, `MetricGrid`). O valor nunca quebra linha: fica numa caixa com `container-type: inline-size` e a fonte é `clamp(mínimo, largura ÷ caracteres, máximo)` — encolhe com a coluna. `MetricGrid` põe cada métrica na própria coluna (`min-width: 0`, 24px de espaço). Não escreva `font-display text-3xl` num valor à mão.

## Logos de clientes

`<ClientAvatar>` (`components/companies/client-avatar.tsx`, tamanhos `sm`/`md`/`lg`) é o único jeito de mostrar o cliente: logo inteiro num quadrado neutro, ou monograma. Quem troca: diretoria, squad comercial ou admin (`can_manage_company_logos()` no banco, `canManageCompanyLogos()` na UI). O bucket `company-logos` é criado pela migração.

## Minhas Pautas

Três visões na mesma fonte de dados (`?visao=lista|quadro|calendario`): **Quadro** agrupa por squad, prioridade ou status (`?agrupar=`), arrasta só o que a pessoa pode mudar e nunca entre squads; **Calendário** é a semana de segunda a domingo (`?semana=`). O squad de cada pauta vem de `pautas.squad`.

## Agenda

`/agenda` (Mês, Semana, Dia, Agenda) lê tudo de `agenda_feed()`: compromissos com recorrência expandida, privados de outras pessoas como "Ocupado" e as pautas com `scheduled_at` do líder e dos responsáveis (derivadas, sem duplicar). Conflitos de horário vêm de `agenda_conflicts()`. **Google Agenda:** as colunas `google_event_id`, `google_calendar_id` e `google_sync_status` estão prontas; a conexão (OAuth por pessoa) entra depois da publicação.

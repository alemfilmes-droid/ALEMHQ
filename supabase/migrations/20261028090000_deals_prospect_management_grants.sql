-- Correção urgente (13/10/2026): CRM quebrado em Leads › Chamar hoje / Prospecção.
--
-- A leitura de public.deals é liberada coluna a coluna para `authenticated` (desde 20260928090000, para esconder
-- valores). A migração "Gerenciar prospecção" (20261024090100) criou as colunas abaixo sem o grant, então toda
-- leitura delas — a fila de prospecção, o detalhe do lead e o envio de toques — falhava com 42501
-- ("permission denied for table deals") para qualquer pessoa logada. Quem abre o CRM direto em Leads (squad
-- Comercial, ex.: SDR) via a tela de erro na hora.
--
-- Nenhuma delas é de valor: leitura liberada como as demais colunas de prospecção. A escrita continua só pelas
-- funções de gestão (gatilho deals_guard_prospect_management). Nenhum dado muda.
--
-- Teste que pega o próximo caso: lib/crm/column-grants.test.ts.

grant select (
  prospect_removed_at, prospect_removed_by, prospect_override_touch, prospect_override_due, prospect_override_at
) on public.deals to authenticated;

-- Valores novos de enum para o encerramento de cliente/projeto. Ficam numa migração própria: um valor
-- novo de enum não pode ser usado na mesma transação em que foi criado.
--
-- - company_lifecycle 'former_client': ex-cliente (encerrado por churn, fim de contrato etc.).
-- - project_stage 'encerrado': projeto encerrado junto com o cliente ou sozinho, com o motivo gravado.

alter type public.company_lifecycle add value if not exists 'former_client';
alter type public.project_stage add value if not exists 'encerrado';

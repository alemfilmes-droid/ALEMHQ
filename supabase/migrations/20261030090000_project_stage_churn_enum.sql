-- Projetos: estado "Churn" (o cliente saiu). Valor novo de enum em migração própria: não pode ser usado na
-- mesma transação em que é criado.

alter type public.project_stage add value if not exists 'churn';

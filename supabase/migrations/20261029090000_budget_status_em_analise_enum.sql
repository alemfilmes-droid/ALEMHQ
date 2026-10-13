-- Orçamentos: status "Em análise" (o cliente confirmou que está avaliando). Valor novo de enum em migração
-- própria: não pode ser usado na mesma transação em que é criado.

alter type public.budget_status add value if not exists 'em_analise' after 'enviado';

-- Etapa nova do funil "Em análise" (relatório do Paulo, item 02): o cliente recebeu o material e está
-- avaliando internamente. Fica logo depois de "Tentativas de contato". Valor novo de enum vai numa
-- migração própria: não pode ser usado na mesma transação em que foi criado.

alter type public.deal_stage add value if not exists 'em_analise' after 'tentativas_contato';

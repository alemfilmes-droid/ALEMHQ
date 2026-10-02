-- Metas (comissão sobre contratos): modo novo de comissão. Valor novo de enum vai em migração
-- separada (não pode ser usado na mesma transação em que nasce).

alter type public.goal_commission_mode add value if not exists 'contratos_fechados';

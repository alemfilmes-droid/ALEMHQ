-- Orçamento "em ajuste" (cliente pediu mudança). Arquivo separado: valor novo de enum só pode ser
-- usado depois do commit desta transação.
alter type public.budget_status add value if not exists 'em_ajuste';

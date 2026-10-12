-- Tipo de comissão novo "Valor fixo (R$)" (Bloco 7). Valor novo de enum vai numa migração própria: não pode
-- ser usado na mesma transação em que foi criado.

alter type public.goal_commission_mode add value if not exists 'valor_fixo';

-- Novas categorias de custo para a aba "Custos da empresa".
-- Arquivo separado: um valor novo de enum só pode ser usado depois que a transação que o criou
-- terminar (a migração seguinte já usa 'pessoal').

alter type public.payable_category add value if not exists 'pessoal';
alter type public.payable_category add value if not exists 'estrutura';

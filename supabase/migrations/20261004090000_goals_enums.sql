-- Metas (1/2): categorias novas de pagamento. Valor novo de enum não pode ser usado na mesma
-- transação em que foi criado — por isso fica numa migração separada da lógica das metas.
--
-- comissao: gerado ao aprovar uma meta (ou lançado à mão). pro_labore: retirada dos sócios.
-- Salário continua em "pessoal".

alter type public.payable_category add value if not exists 'comissao';
alter type public.payable_category add value if not exists 'pro_labore';

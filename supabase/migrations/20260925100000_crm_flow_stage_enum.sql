-- Fluxo comercial (1/3): nova etapa do funil.
-- Arquivo separado de propósito: um valor novo de enum só pode ser usado depois que a transação que o
-- criou terminar, então as migrações seguintes (que o referenciam) ficam em arquivos próprios.

alter type public.deal_stage add value if not exists 'tentativas_contato' before 'qualificado';

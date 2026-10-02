-- Status de pauta por squad. O audiovisual continua com planejamento → captação → edição →
-- revisão → aprovado; comercial, financeiro e diretoria ganham etapas próprias. Revisão interna,
-- revisão do cliente, reajuste e aprovado são comuns a todos.
-- Arquivo separado: valores novos de enum só podem ser usados depois do commit desta transação.

alter type public.pauta_status add value if not exists 'em_execucao';
alter type public.pauta_status add value if not exists 'aguardando_retorno';
alter type public.pauta_status add value if not exists 'aguardando_documento';
alter type public.pauta_status add value if not exists 'em_analise';

-- Atividades de pauta por squad. O tipo production_function (responsáveis de pauta,
-- pauta_members.production_function, e o "passar adiante") passa a cobrir também o que comercial,
-- financeiro e diretoria fazem. A "Atuação" das pessoas em Equipe continua oferecendo só as funções
-- de produção (a lista da UI é PRODUCTION_FUNCTIONS, em lib/auth/roles.ts).
-- Arquivo separado: valores novos de enum só podem ser usados depois do commit desta transação.

-- Comercial
alter type public.production_function add value if not exists 'ajuste_crm';
alter type public.production_function add value if not exists 'prospeccao';
alter type public.production_function add value if not exists 'follow_up';
alter type public.production_function add value if not exists 'proposta';
alter type public.production_function add value if not exists 'reuniao_comercial';
alter type public.production_function add value if not exists 'relatorio_comercial';

-- Financeiro
alter type public.production_function add value if not exists 'cobranca';
alter type public.production_function add value if not exists 'conciliacao';
alter type public.production_function add value if not exists 'pagamentos';
alter type public.production_function add value if not exists 'nota_fiscal';
alter type public.production_function add value if not exists 'orcamento';
alter type public.production_function add value if not exists 'relatorio_financeiro';

-- Diretoria
alter type public.production_function add value if not exists 'aprovacao';
alter type public.production_function add value if not exists 'planejamento_estrategico';
alter type public.production_function add value if not exists 'revisao';
alter type public.production_function add value if not exists 'reuniao';
alter type public.production_function add value if not exists 'contratacao';
alter type public.production_function add value if not exists 'relatorio_gerencial';

-- Qualquer squad
alter type public.production_function add value if not exists 'outro';

-- Fluxogramas (2/2): os processos reais da Além, escritos como procedimentos (SOP).
-- Nenhuma credencial aqui: acessos externos citam "o login da empresa, disponível no gerenciador de
-- senhas". Ferramenta 'pasta_drive' = gerador do nome/caminho da pasta do projeto no Drive.

create function pg_temp.proc(
  p_slug text, p_title text, p_squad public.squad, p_summary text, p_trigger text,
  p_frequency public.process_frequency, p_owner text, p_order int
)
returns uuid
language sql
as $$
  insert into public.processes (slug, title, squad, summary, trigger_description, frequency, owner_role, order_index, created_by, updated_by)
  values (p_slug, p_title, p_squad, p_summary, p_trigger, p_frequency, p_owner, p_order, null, null)
  returning id
$$;

create function pg_temp.step(
  p_process uuid, p_order int, p_title text, p_description text, p_role text,
  p_area public.process_system_area, p_link text, p_done text, p_minutes int, p_blocking boolean, p_tool text default null
)
returns void
language sql
as $$
  insert into public.process_steps (process_id, order_index, title, description, responsible_role, system_area, system_link, done_criteria, estimated_minutes, is_blocking, tool)
  values (p_process, p_order, p_title, p_description, p_role, p_area, p_link, p_done, p_minutes, p_blocking, p_tool)
$$;

do $$
declare
  p uuid;
begin
  -- =========================================================================
  -- FINANCEIRO
  -- =========================================================================

  p := pg_temp.proc('financeiro-faturamento-do-mes', 'Faturamento do mês', 'financeiro',
    'Todo dia 1: levantar o que vence no mês, decidir quem faturar, emitir as notas, enviar e registrar no HQ.',
    'Dia 1 de cada mês.', 'mensal', 'Auxiliar financeiro', 1);
  perform pg_temp.step(p, 1, 'Conferir as parcelas a vencer no mês',
    'No **Financeiro → Recebimentos**, filtre o período do mês atual e liste todas as parcelas pendentes (inclusive as atrasadas do mês anterior).',
    'Auxiliar financeiro', 'financeiro', '/financeiro?aba=recebimentos', 'Lista das parcelas do mês conferida, com cliente, projeto e valor.', 20, true);
  perform pg_temp.step(p, 2, 'Identificar os clientes a faturar',
    'Para cada parcela, confirme se a nota sai agora (antes do vencimento) ou na entrega. Projetos recorrentes faturam no dia agendado no card **Nota fiscal** do projeto.',
    'Auxiliar financeiro', 'projetos', '/projetos', 'Cada parcela tem a decisão "faturar agora" ou "aguardar", sem pendência de dúvida.', 20, true);
  perform pg_temp.step(p, 3, 'Emitir as notas',
    'Siga o processo **Emissão e envio de nota fiscal** para cada cliente a faturar.',
    'Auxiliar financeiro', 'externo', null, 'Todas as notas do mês emitidas no portal.', 60, true);
  perform pg_temp.step(p, 4, 'Enviar as notas aos clientes',
    'Envie o PDF de cada nota para o e-mail do contato financeiro do cliente, com o número da parcela e o vencimento no corpo do e-mail.',
    'Auxiliar financeiro', 'externo', null, 'Cada cliente faturado recebeu o e-mail com a nota.', 30, true);
  perform pg_temp.step(p, 5, 'Registrar no HQ',
    'Em cada recebimento: **⋯ → Anexar nota fiscal** (arquivo e número). Avise a diretoria se alguma parcela ficou sem faturar e por quê.',
    'Auxiliar financeiro', 'financeiro', '/financeiro?aba=recebimentos', 'Todos os recebimentos faturados mostram "NF nº" no HQ.', 20, false);

  p := pg_temp.proc('financeiro-emissao-nota-fiscal', 'Emissão e envio de nota fiscal', 'financeiro',
    'Emitir a nota de serviço de uma parcela, enviar ao cliente, arquivar e registrar o número no HQ.',
    'Parcela próxima do vencimento (ou lembrete de nota fiscal do projeto).', 'sob_demanda', 'Auxiliar financeiro', 2);
  perform pg_temp.step(p, 1, 'Copiar os dados do cliente',
    'Abra o cliente em **Clientes** e copie CNPJ, razão social e o e-mail do contato financeiro.',
    'Auxiliar financeiro', 'clientes', '/clientes', 'CNPJ, razão social e e-mail do financeiro em mãos e conferidos.', 5, true);
  perform pg_temp.step(p, 2, 'Conferir o valor da parcela',
    'Na aba **Financeiro** do projeto, confira o valor da parcela e a descrição do serviço contratado.',
    'Auxiliar financeiro', 'projetos', '/projetos', 'Valor e descrição do serviço batem com o contrato.', 5, true);
  perform pg_temp.step(p, 3, 'Acessar o Portal do Contribuinte',
    'Entre no portal de emissão com **o login da empresa, disponível no gerenciador de senhas**. O acesso nunca é escrito em nenhum lugar do sistema — nem aqui, nem em comentários, nem em pautas.',
    'Auxiliar financeiro', 'externo', 'https://www.nfse.gov.br/EmissorNacional', 'Sessão aberta no portal com o acesso da empresa.', 3, true);
  perform pg_temp.step(p, 4, 'Emitir a nota',
    'Emita com o valor da parcela e a descrição do serviço do projeto. Confira tomador (CNPJ e razão social) antes de confirmar.',
    'Auxiliar financeiro', 'externo', 'https://www.nfse.gov.br/EmissorNacional', 'Nota emitida, PDF e número da nota disponíveis.', 10, true);
  perform pg_temp.step(p, 5, 'Enviar o PDF ao cliente',
    'Envie o PDF para o e-mail do contato financeiro, citando o projeto, a parcela e o vencimento.',
    'Auxiliar financeiro', 'externo', null, 'E-mail enviado ao contato financeiro do cliente.', 5, true);
  perform pg_temp.step(p, 6, 'Salvar o PDF no Drive',
    'Salve em **ALÉM.FILMES > ADMINISTRATIVO > ano > trimestre > mês > notas emitidas**, com o nome "NF <número> - <cliente>".',
    'Auxiliar financeiro', 'externo', null, 'PDF salvo na pasta do mês certo.', 3, false);
  perform pg_temp.step(p, 7, 'Registrar o número da nota no HQ',
    'No recebimento: **⋯ → Anexar nota fiscal**, com o número e o arquivo.',
    'Auxiliar financeiro', 'financeiro', '/financeiro?aba=recebimentos', 'O recebimento mostra "NF <número>" e o arquivo abre.', 3, true);

  p := pg_temp.proc('financeiro-baixa-de-recebimento', 'Baixa de recebimento', 'financeiro',
    'Dar baixa num pagamento recebido e conferir o que ainda falta receber do projeto.',
    'Pagamento identificado na conta.', 'sob_demanda', 'Auxiliar financeiro', 3);
  perform pg_temp.step(p, 1, 'Conferir valor e cliente',
    'Confira no extrato quem pagou e quanto. Valor diferente do previsto: confirme com a diretoria antes de dar baixa.',
    'Auxiliar financeiro', 'externo', null, 'Pagador e valor identificados e batendo com uma parcela do HQ.', 5, true);
  perform pg_temp.step(p, 2, 'Marcar como recebido no HQ',
    'No recebimento: **Marcar como recebido**, com a data do crédito, a forma de pagamento e o número da nota.',
    'Auxiliar financeiro', 'financeiro', '/financeiro?aba=recebimentos', 'Recebimento com status "Recebido", data e forma preenchidas.', 3, true);
  perform pg_temp.step(p, 3, 'Verificar parcelas restantes',
    'Na aba Financeiro do projeto, veja se ainda há parcelas. Se foi a última e as pautas estão aprovadas, o sistema oferece finalizar o projeto.',
    'Auxiliar financeiro', 'projetos', '/projetos', 'Saldo do projeto conferido; última parcela sinalizada à diretoria.', 5, false);

  p := pg_temp.proc('financeiro-pagamento-de-freelancer', 'Pagamento de freelancer', 'financeiro',
    'Pagar o freelancer de uma pauta entregue e aprovada, com o custo lançado no projeto certo.',
    'Pauta entregue e aprovada.', 'sob_demanda', 'Auxiliar financeiro', 4);
  perform pg_temp.step(p, 1, 'Conferir a entrega',
    'Confirme na pauta que ela está **Aprovada** e que o link de entrega foi registrado.',
    'Auxiliar financeiro', 'pautas', '/pautas', 'Pauta aprovada com link de entrega.', 5, true);
  perform pg_temp.step(p, 2, 'Lançar o custo no projeto',
    'No **Financeiro → Pagamentos**, crie o pagamento como custo do projeto, categoria **Freelancer**, com o valor combinado e o vencimento.',
    'Auxiliar financeiro', 'financeiro', '/financeiro?aba=pagamentos', 'Pagamento lançado no projeto, categoria Freelancer.', 5, true);
  perform pg_temp.step(p, 3, 'Efetuar o pagamento',
    'O pagamento no banco é feito pela diretoria. Envie à diretoria o lançamento com os dados de pagamento do freelancer.',
    'Diretoria', 'externo', null, 'Comprovante do pagamento recebido.', 10, true);
  perform pg_temp.step(p, 4, 'Marcar como pago',
    'No pagamento: **Marcar como pago**, com a data e a forma.',
    'Auxiliar financeiro', 'financeiro', '/financeiro?aba=pagamentos', 'Pagamento com status "Pago".', 2, true);
  perform pg_temp.step(p, 5, 'Conferir o impacto na margem',
    'Veja a margem do projeto. Abaixo de 50%: sinalize a diretoria (processo **Projeto abaixo da margem**).',
    'Auxiliar financeiro', 'projetos', '/projetos', 'Margem conferida e sinalizada se < 50%.', 3, false);

  p := pg_temp.proc('financeiro-fechamento-mensal', 'Fechamento mensal', 'financeiro',
    'Fechar o mês: recebimentos e pagamentos conferidos, custos fixos lançados e projetos fora da margem sinalizados.',
    'Último dia útil do mês.', 'mensal', 'Auxiliar financeiro', 5);
  perform pg_temp.step(p, 1, 'Conferir recebimentos do mês',
    'Todos os recebimentos do mês estão com baixa ou com a justificativa do atraso?',
    'Auxiliar financeiro', 'financeiro', '/financeiro?aba=recebimentos', 'Nenhum recebimento do mês sem baixa nem justificativa.', 20, true);
  perform pg_temp.step(p, 2, 'Conferir pagamentos do mês',
    'Todos os pagamentos do mês estão pagos ou reprogramados com a diretoria?',
    'Auxiliar financeiro', 'financeiro', '/financeiro?aba=pagamentos', 'Nenhum pagamento do mês em aberto sem decisão.', 20, true);
  perform pg_temp.step(p, 3, 'Lançar os custos fixos',
    'Confirme que os custos fixos recorrentes (software, estrutura, pessoal, pró-labore) do mês estão lançados.',
    'Auxiliar financeiro', 'financeiro', '/financeiro?aba=custos', 'Custos fixos do mês completos.', 15, true);
  perform pg_temp.step(p, 4, 'Revisar a margem por projeto',
    'Na aba de rentabilidade, revise a margem de cada projeto ativo.',
    'Auxiliar financeiro', 'financeiro', '/financeiro', 'Margem de todos os projetos ativos revisada.', 20, true);
  perform pg_temp.step(p, 5, 'Sinalizar projetos abaixo de 50%',
    'Envie à diretoria a lista dos projetos com margem abaixo de 50%, com o motivo provável de cada um.',
    'Auxiliar financeiro', 'avisos', null, 'Diretoria recebeu a lista (ou a confirmação de que não há nenhum).', 10, false);

  -- =========================================================================
  -- COMERCIAL
  -- =========================================================================

  p := pg_temp.proc('comercial-prospeccao-ativa', 'Prospecção ativa', 'comercial',
    'Trazer empresas novas para o funil com origem, primeira abordagem e próxima ação definidas.',
    'Rotina diária do BDR.', 'diaria', 'BDR', 1);
  perform pg_temp.step(p, 1, 'Cadastrar a empresa no CRM',
    'Crie a empresa e o negócio no **CRM**, com a **origem** (indicação, Instagram, prospecção ativa…).',
    'BDR', 'crm', '/crm', 'Negócio criado com empresa, contato e origem.', 5, true);
  perform pg_temp.step(p, 2, 'Registrar a primeira abordagem',
    'No card, registre a interação com o **canal** usado e o **gatilho** da abordagem (o motivo do contato).',
    'BDR', 'crm', '/crm', 'Primeira interação registrada com canal e gatilho.', 5, true);
  perform pg_temp.step(p, 3, 'Definir a próxima ação',
    'Toda empresa sai com a próxima ação e a data. Sem próxima ação, o lead esfria.',
    'BDR', 'crm', '/crm', 'Próxima ação e data preenchidas no card.', 2, true);

  p := pg_temp.proc('comercial-cadencia-de-contato', 'Cadência de contato', 'comercial',
    'Até 7 tentativas por lead, registradas no card, até resposta ou perda por falta de resposta.',
    'Lead novo sem resposta.', 'diaria', 'SDR', 2);
  perform pg_temp.step(p, 1, 'Tentativas 1 e 2 (dias seguidos)',
    'As duas primeiras tentativas podem ser em dias seguidos. Registre cada uma no card com **canal** e **abordagem**.',
    'SDR', 'crm', '/crm', 'Duas tentativas registradas, cada uma com canal e abordagem.', 10, true);
  perform pg_temp.step(p, 2, 'Tentativas 3 a 7 (a cada 2 dias)',
    'Da terceira em diante, o intervalo é de **2 dias**. Varie o canal e a abordagem. Máximo de **7 tentativas** no total.',
    'SDR', 'crm', '/crm', 'Cada tentativa registrada respeitando o intervalo de 2 dias.', 25, true);
  perform pg_temp.step(p, 3, 'Se o cliente responder',
    'Registre a resposta no card e **a qual tentativa ela corresponde** (ex.: "respondeu na 4ª tentativa, WhatsApp"). Siga para **Qualificação**.',
    'SDR', 'crm', '/crm', 'Resposta registrada com o número da tentativa.', 5, false);
  perform pg_temp.step(p, 4, 'Sem resposta após 7 tentativas',
    'Mova o negócio para **Perdido** com o motivo **sem resposta**.',
    'SDR', 'crm', '/crm', 'Negócio em Perdido, motivo "sem resposta".', 2, false);

  p := pg_temp.proc('comercial-qualificacao', 'Qualificação', 'comercial',
    'Só avança quem tem fit: orçamento, tipo de projeto, prazo e quem decide.',
    'Lead respondeu e demonstrou interesse.', 'sob_demanda', 'SDR', 3);
  perform pg_temp.step(p, 1, 'Preencher o checklist de fit',
    'No card, preencha: **orçamento** disponível, **tipo de projeto**, **prazo** e **quem decide**.',
    'SDR', 'crm', '/crm', 'Os quatro itens de fit preenchidos.', 15, true);
  perform pg_temp.step(p, 2, 'Marcar como qualificado',
    'Com o fit completo, marque como qualificado. O card vai **automaticamente** para o Head Comercial.',
    'SDR', 'crm', '/crm', 'Negócio qualificado e com o Head Comercial.', 2, true);

  p := pg_temp.proc('comercial-agendamento-de-reuniao', 'Agendamento de reunião', 'comercial',
    'Marcar a reunião comercial na agenda do CEO, com a qualificação completa e o cliente confirmado.',
    'Negócio qualificado pronto para reunião.', 'sob_demanda', 'SDR', 4);
  perform pg_temp.step(p, 1, 'Conferir a disponibilidade',
    'Veja a agenda do CEO em **Agenda** antes de propor horários ao cliente.',
    'SDR', 'agenda', '/agenda', 'Horários livres confirmados.', 5, true);
  perform pg_temp.step(p, 2, 'Garantir a qualificação completa',
    'Sem os quatro itens de fit preenchidos, não agende.',
    'SDR', 'crm', '/crm', 'Qualificação completa no card.', 2, true);
  perform pg_temp.step(p, 3, 'Agendar pelo card',
    'Agende a reunião pelo card do negócio, na agenda do CEO (entra no Google Agenda).',
    'SDR', 'crm', '/crm', 'Reunião criada no card e visível na agenda do CEO.', 5, true);
  perform pg_temp.step(p, 4, 'Enviar a confirmação ao cliente',
    'Envie ao cliente data, horário e link/local da reunião.',
    'SDR', 'externo', null, 'Cliente confirmou a reunião.', 5, false);

  p := pg_temp.proc('comercial-proposta-e-negociacao', 'Proposta e negociação', 'comercial',
    'Toda proposta e contraproposta registradas no negócio. Nada abaixo do piso sem a diretoria.',
    'Reunião realizada com pedido de proposta.', 'sob_demanda', 'Head Comercial', 5);
  perform pg_temp.step(p, 1, 'Registrar a proposta',
    'No negócio, registre a proposta com **valor**, **canal de envio** e o **PDF** (gerado em Orçamentos).',
    'Head Comercial', 'crm', '/crm', 'Proposta registrada com valor, canal e PDF.', 10, true);
  perform pg_temp.step(p, 2, 'Registrar contrapropostas',
    'Toda contraproposta entra no card: **valor** e **o que foi acordado** (escopo, prazo, condições).',
    'Head Comercial', 'crm', '/crm', 'Cada rodada de negociação registrada.', 5, false);
  perform pg_temp.step(p, 3, 'Respeitar o piso',
    '**Nunca** negocie abaixo do piso sem aprovação da diretoria (processo **Aprovação de proposta e precificação**).',
    'Head Comercial', 'nenhum', null, 'Valor final dentro do piso ou aprovado pela diretoria.', 5, true);

  p := pg_temp.proc('comercial-onboarding-de-cliente', 'Onboarding de cliente novo', 'comercial',
    'Do negócio ganho ao projeto pronto para produzir: cadastro, pasta, kickoff e briefing.',
    'Negócio marcado como Ganho.', 'sob_demanda', 'Atendimento', 6);
  perform pg_temp.step(p, 1, 'Confirmar dados cadastrais',
    'Confirme no cliente CNPJ, razão social e o **contato financeiro** (quem recebe a nota).',
    'Atendimento', 'clientes', '/clientes', 'Cadastro completo, com contato financeiro.', 10, true);
  perform pg_temp.step(p, 2, 'Criar a pasta do projeto no Drive',
    'Crie a pasta no padrão da empresa. Use o gerador abaixo (ou o botão **Copiar nome da pasta** no projeto) — não digite o nome à mão.',
    'Atendimento', 'externo', null, 'Pasta criada com o nome gerado e as 5 subpastas.', 5, true, 'pasta_drive');
  perform pg_temp.step(p, 3, 'Agendar a call de kickoff',
    'Agende a call de kickoff com o cliente e a equipe do projeto.',
    'Atendimento', 'agenda', '/agenda', 'Kickoff na agenda, cliente confirmado.', 5, true);
  perform pg_temp.step(p, 4, 'Registrar o briefing no projeto',
    'Após o kickoff, registre o briefing no projeto (objetivo, público, entregas, prazos, referências).',
    'Atendimento', 'projetos', '/projetos', 'Briefing preenchido no projeto.', 20, true);

  -- =========================================================================
  -- AUDIOVISUAL
  -- =========================================================================

  p := pg_temp.proc('audiovisual-abertura-de-projeto', 'Abertura de projeto', 'audiovisual',
    'Projeto criado no HQ, pasta no padrão, pautas com líder e responsáveis.',
    'Projeto aprovado / onboarding concluído.', 'sob_demanda', 'Head de Audiovisual', 1);
  perform pg_temp.step(p, 1, 'Criar o projeto no HQ',
    'Em **Projetos**, crie o projeto com cliente, data de início, líder e responsáveis.',
    'Head de Audiovisual', 'projetos', '/projetos', 'Projeto criado com cliente, início e líder.', 10, true);
  perform pg_temp.step(p, 2, 'Criar a pasta no Drive',
    'Use o nome gerado pelo sistema (botão **Copiar nome da pasta** no projeto ou o gerador abaixo). Dentro dela: [00] ROTEIRO, [01] BRUTOS, [02] PROJETO, [03] ASSETS, [04] FINALIZADO.',
    'Head de Audiovisual', 'externo', null, 'Pasta no caminho certo, com as 5 subpastas.', 5, true, 'pasta_drive');
  perform pg_temp.step(p, 3, 'Colar o link no projeto',
    'Cole o link da pasta no campo **Pasta do Drive** do projeto.',
    'Head de Audiovisual', 'projetos', '/projetos', 'Link da pasta salvo no projeto.', 2, true);
  perform pg_temp.step(p, 4, 'Criar as pautas',
    'Crie as pautas do projeto e defina **líder** e **responsáveis** de cada uma.',
    'Head de Audiovisual', 'pautas', '/pautas', 'Todas as pautas criadas, com líder e responsáveis.', 20, true);

  p := pg_temp.proc('audiovisual-pre-producao-de-captacao', 'Pré-produção de captação', 'audiovisual',
    'Tudo conferido antes do dia: pauta, local, contato, equipamento.',
    'Pauta de captação atribuída.', 'sob_demanda', 'Videomaker', 2);
  perform pg_temp.step(p, 1, 'Conferir a pauta',
    'Na pauta: **data**, **horário**, **local**, **contato responsável** e **briefing**. Faltou algo? Cobre o atendimento antes da véspera.',
    'Videomaker', 'pautas', '/minhas-pautas', 'Os cinco itens conferidos na pauta.', 10, true);
  perform pg_temp.step(p, 2, 'Conferir as especificações de equipamento',
    'Veja se o atendimento informou algo além do kit padrão (drone, tripé, iluminação etc.).',
    'Videomaker', 'pautas', '/minhas-pautas', 'Lista de equipamento extra definida (ou "nenhum").', 5, true);
  perform pg_temp.step(p, 3, 'Confirmar local e contato na véspera',
    'Na véspera, confirme com o contato do cliente o local e o horário.',
    'Videomaker', 'externo', null, 'Contato confirmou local e horário.', 5, true);
  perform pg_temp.step(p, 4, 'Preparar o equipamento',
    E'Kit padrão (sempre vai):\n- câmera\n- cartões\n- baterias (carregadas)\n- lentes\n- microfones\n- tripé ou gimbal\n\nTudo além disso vem das especificações da pauta.',
    'Videomaker', 'nenhum', null, 'Kit padrão + extras separados, baterias carregadas, cartões vazios.', 30, true);

  p := pg_temp.proc('audiovisual-dia-da-captacao', 'Dia da captação', 'audiovisual',
    'Do kit conferido ao backup feito e a pauta passada para edição.',
    'Dia da captação.', 'sob_demanda', 'Videomaker', 3);
  perform pg_temp.step(p, 1, 'Checar o kit antes de sair',
    'Confira o kit padrão e os extras da pauta antes de sair.',
    'Videomaker', 'nenhum', null, 'Kit completo conferido.', 10, true);
  perform pg_temp.step(p, 2, 'Confirmar a chegada com o contato',
    'Ao chegar, avise o contato do cliente no local.',
    'Videomaker', 'externo', null, 'Contato avisado da chegada.', 2, false);
  perform pg_temp.step(p, 3, 'Gravar',
    'Siga o briefing e o roteiro da pauta.',
    'Videomaker', 'nenhum', null, 'Captação concluída conforme o briefing.', null, true);
  perform pg_temp.step(p, 4, 'Copiar os brutos e confirmar o backup',
    'No fim do dia, copie os brutos para **[01] BRUTOS** do projeto e **confirme o backup antes de formatar qualquer cartão**.',
    'Videomaker', 'externo', null, 'Brutos na pasta [01] BRUTOS e backup confirmado.', 40, true);
  perform pg_temp.step(p, 5, 'Mover a pauta para Edição',
    'Mova a pauta para **Edição** e passe adiante para o editor responsável.',
    'Videomaker', 'pautas', '/minhas-pautas', 'Pauta em Edição com o editor como responsável.', 2, true);

  p := pg_temp.proc('audiovisual-edicao', 'Edição', 'audiovisual',
    'Edição organizada nas pastas do projeto até a revisão interna.',
    'Pauta em Edição atribuída ao editor.', 'sob_demanda', 'Editor', 4);
  perform pg_temp.step(p, 1, 'Localizar os brutos',
    'Os brutos estão em **[01] BRUTOS**.',
    'Editor', 'externo', null, 'Brutos localizados e completos.', 5, true);
  perform pg_temp.step(p, 2, 'Editar no projeto',
    'Trabalhe em **[02] PROJETO**, usando os arquivos de **[03] ASSETS** (trilhas, logos, fontes).',
    'Editor', 'externo', null, 'Corte pronto para exportar.', null, true);
  perform pg_temp.step(p, 3, 'Exportar',
    'Exporte para **[04] FINALIZADO**.',
    'Editor', 'externo', null, 'Arquivo exportado em [04] FINALIZADO.', 20, true);
  perform pg_temp.step(p, 4, 'Anexar o link e passar para revisão',
    'Anexe o link na pauta e **passe adiante** para **Revisão interna**.',
    'Editor', 'pautas', '/minhas-pautas', 'Link na pauta e pauta em Revisão interna.', 3, true);

  p := pg_temp.proc('audiovisual-revisao-e-aprovacao', 'Revisão interna e aprovação do cliente', 'audiovisual',
    'Nada vai ao cliente sem o líder revisar; rodadas de alteração contadas.',
    'Pauta em Revisão interna.', 'sob_demanda', 'Líder da pauta', 5);
  perform pg_temp.step(p, 1, 'Revisão interna do líder',
    'O líder revisa **antes de qualquer envio ao cliente**. Ajustes voltam para o editor.',
    'Líder da pauta', 'pautas', '/minhas-pautas', 'Líder aprovou internamente.', 20, true);
  perform pg_temp.step(p, 2, 'Enviar ao cliente',
    'Aprovado internamente: envie ao cliente e mova a pauta para **Revisão do cliente**.',
    'Líder da pauta', 'pautas', '/minhas-pautas', 'Cliente recebeu; pauta em Revisão do cliente.', 5, true);
  perform pg_temp.step(p, 3, 'Registrar cada rodada de alteração',
    'Cada pedido de alteração do cliente vira um registro na pauta (o que foi pedido).',
    'Líder da pauta', 'pautas', '/minhas-pautas', 'Rodadas registradas na pauta.', 5, false);
  perform pg_temp.step(p, 4, 'Respeitar as rodadas contratadas',
    'Ao atingir o número de rodadas do projeto, **avise a diretoria antes** de executar alterações adicionais.',
    'Líder da pauta', 'projetos', '/projetos', 'Diretoria avisada antes de rodadas extras.', 5, true);

  p := pg_temp.proc('audiovisual-entrega-e-arquivamento', 'Entrega final e arquivamento', 'audiovisual',
    'Entrega registrada, projeto entregue e pasta organizada.',
    'Cliente aprovou a versão final.', 'sob_demanda', 'Líder da pauta', 6);
  perform pg_temp.step(p, 1, 'Enviar o arquivo final',
    'Envie o arquivo final ao cliente (link de download).',
    'Líder da pauta', 'externo', null, 'Cliente recebeu o final.', 5, true);
  perform pg_temp.step(p, 2, 'Registrar o link de entrega',
    'Registre o link de entrega na pauta.',
    'Líder da pauta', 'pautas', '/minhas-pautas', 'Link de entrega na pauta.', 2, true);
  perform pg_temp.step(p, 3, 'Mover o projeto para Entregue',
    'Com todas as pautas aprovadas, mova o projeto para **Entregue**.',
    'Head de Audiovisual', 'projetos', '/projetos', 'Projeto em Entregue.', 2, true);
  perform pg_temp.step(p, 4, 'Organizar a pasta do Drive',
    'Confirme que a pasta segue o padrão: brutos, projeto, assets e finalizado nos lugares certos, sem arquivos soltos.',
    'Líder da pauta', 'externo', null, 'Pasta organizada nas 5 subpastas.', 10, false, 'pasta_drive');

  -- =========================================================================
  -- DIRETORIA
  -- =========================================================================

  p := pg_temp.proc('diretoria-ritual-semanal', 'Ritual semanal de gestão', 'diretoria',
    'Uma revisão por semana dos números que importam: entregas, pessoas, comercial, margem, clientes e caixa.',
    'Toda segunda-feira.', 'semanal', 'Diretoria', 1);
  perform pg_temp.step(p, 1, 'Pautas atrasadas', 'Revise as pautas atrasadas e defina o destravamento de cada uma.', 'Diretoria', 'pautas', '/pautas', 'Cada pauta atrasada com ação e responsável.', 15, true);
  perform pg_temp.step(p, 2, 'Carga por pessoa', 'Veja a carga de pautas e o banco de horas de cada pessoa; redistribua se preciso.', 'Diretoria', 'banco_de_horas', '/banco-de-horas', 'Ninguém sobrecarregado sem plano.', 10, false);
  perform pg_temp.step(p, 3, 'Funil comercial', 'Revise o funil: negócios parados, propostas sem resposta, reuniões da semana.', 'Diretoria', 'crm', '/crm', 'Funil revisado e próximas ações definidas.', 15, true);
  perform pg_temp.step(p, 4, 'Margem dos projetos ativos', 'Revise a margem de cada projeto ativo. Abaixo de 50%: processo **Projeto abaixo da margem**.', 'Diretoria', 'financeiro', '/financeiro', 'Margens revisadas; casos abaixo de 50% encaminhados.', 10, true);
  perform pg_temp.step(p, 5, 'Saúde dos clientes', 'Revise a saúde dos clientes (processo **Saúde do cliente**).', 'Diretoria', 'clientes', '/clientes', 'Saúde de cada cliente ativo atualizada.', 10, false);
  perform pg_temp.step(p, 6, 'Recebimentos em atraso', 'Veja os recebimentos atrasados e defina a cobrança de cada um.', 'Diretoria', 'financeiro', '/financeiro?aba=recebimentos', 'Cada atraso com cobrança definida.', 10, true);

  p := pg_temp.proc('diretoria-aprovacao-de-proposta', 'Aprovação de proposta e precificação', 'diretoria',
    'Nenhuma proposta sai sem escopo, custos e margem conferidos. Piso de margem saudável: 50%.',
    'Orçamento pronto para envio ou pedido de desconto abaixo do piso.', 'sob_demanda', 'Diretoria', 2);
  perform pg_temp.step(p, 1, 'Conferir o escopo', 'Entregas, prazos e rodadas de alteração estão claros no orçamento?', 'Diretoria', 'nenhum', '/orcamentos', 'Escopo fechado e escrito.', 10, true);
  perform pg_temp.step(p, 2, 'Conferir os custos previstos', 'Todos os profissionais e custos de produção estão no orçamento, com valores atuais.', 'Diretoria', 'nenhum', '/orcamentos', 'Custos completos e atualizados.', 10, true);
  perform pg_temp.step(p, 3, 'Conferir a margem', 'Margem de pelo menos **50%**. Abaixo disso, só com decisão explícita da diretoria.', 'Diretoria', 'nenhum', '/orcamentos', 'Margem ≥ 50% ou exceção aprovada.', 5, true);
  perform pg_temp.step(p, 4, 'Autorizar o envio', 'Autorize o comercial a enviar (ou devolva com os ajustes).', 'Diretoria', 'crm', '/crm', 'Comercial autorizado a enviar.', 2, true);

  p := pg_temp.proc('diretoria-projeto-abaixo-da-margem', 'Projeto abaixo da margem', 'diretoria',
    'Margem abaixo de 50%: achar a causa, decidir e registrar.',
    'Margem do projeto abaixo de 50%.', 'sob_demanda', 'Diretoria', 3);
  perform pg_temp.step(p, 1, 'Identificar a causa', 'Custo acima do previsto? Escopo além do contratado? Compare orçamento, pagamentos e pautas do projeto.', 'Diretoria', 'projetos', '/projetos', 'Causa identificada.', 20, true);
  perform pg_temp.step(p, 2, 'Decidir', 'Escolha: **renegociar** com o cliente, **cortar escopo** ou **absorver** o custo.', 'Diretoria', 'nenhum', null, 'Decisão tomada.', 10, true);
  perform pg_temp.step(p, 3, 'Registrar a decisão', 'Registre a decisão e o motivo nas notas de produção do projeto.', 'Diretoria', 'projetos', '/projetos', 'Decisão registrada no projeto.', 5, true);

  p := pg_temp.proc('diretoria-saude-do-cliente', 'Saúde do cliente', 'diretoria',
    'Critérios objetivos para Ativo, Atenção, Tensão e Churn — e a ação esperada em cada mudança.',
    'Ritual semanal ou qualquer sinal do cliente.', 'semanal', 'Diretoria', 4);
  perform pg_temp.step(p, 1, 'Ativo',
    E'Critérios: projetos em dia, pagamentos em dia, cliente responde e aprova sem atrito.\n\nAção: manter o ritmo e buscar novos projetos/indicações.',
    'Diretoria', 'clientes', '/clientes', 'Cliente classificado como Ativo com base nos critérios.', 5, false);
  perform pg_temp.step(p, 2, 'Atenção',
    E'Critérios (qualquer um): 1 pagamento atrasado, aprovação demorando mais de 5 dias, mais rodadas de alteração que o contratado, queda no volume de pedidos.\n\nAção: conversa de alinhamento do atendimento em até 7 dias.',
    'Diretoria', 'clientes', '/clientes', 'Alinhamento agendado.', 5, false);
  perform pg_temp.step(p, 3, 'Tensão',
    E'Critérios (qualquer um): 2+ pagamentos atrasados ou atraso acima de 30 dias, reclamação formal, pedido de desconto/renegociação, ameaça de cancelar.\n\nAção: a diretoria assume a conta e faz uma reunião com o decisor em até 48h.',
    'Diretoria', 'clientes', '/clientes', 'Reunião com o decisor feita e plano registrado.', 10, true);
  perform pg_temp.step(p, 4, 'Churn',
    E'Critérios: contrato encerrado, cancelado ou sem projeto ativo há mais de 90 dias.\n\nAção: registrar o motivo da saída e, após 30 dias, entra na prospecção de reaquecimento.',
    'Diretoria', 'clientes', '/clientes', 'Motivo do churn registrado.', 5, false);
end;
$$;

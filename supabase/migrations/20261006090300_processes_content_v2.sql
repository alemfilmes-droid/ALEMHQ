-- Fluxogramas — correções de conteúdo (atualiza no lugar, pelo slug; nada é duplicado):
-- 1. Nota fiscal: caminho certo do PDF no Drive e o nome do arquivo, com exemplo e gerador.
-- 2. Pagamento de freelancer: autorização no grupo do Financeiro, decisão, agendamento no banco.
-- 3. Margem: saudável 40%; abaixo de 30% avisa a diretoria na hora; 30–40% vai ao relatório mensal.
-- 4. Novo: "Onde encontrar os arquivos no Drive" (audiovisual), referência da Edição e da captação.

create function pg_temp.pid(p_slug text) returns uuid language sql as $$
  select id from public.processes where slug = p_slug
$$;

create function pg_temp.add_step(
  p_process uuid, p_order int, p_title text, p_description text, p_role text, p_area public.process_system_area,
  p_link text, p_done text, p_minutes int, p_blocking boolean, p_type text, p_kind text,
  p_example text default null, p_tool text default null
)
returns uuid
language sql
as $$
  insert into public.process_steps (process_id, order_index, title, description, responsible_role, system_area, system_link,
    done_criteria, estimated_minutes, is_blocking, step_type, action_kind, example_text, tool)
  values (p_process, p_order, p_title, p_description, p_role, p_area, p_link, p_done, p_minutes, p_blocking, p_type, p_kind, p_example, p_tool)
  returning id
$$;

do $$
declare
  p uuid;
  s1 uuid; s2 uuid; s3 uuid; s4 uuid; s5 uuid;
begin
  -- =========================================================================
  -- 1. Emissão e envio de nota fiscal — passo 6 (salvar o PDF)
  -- =========================================================================
  update public.process_steps set
    title = 'Renomear e salvar o PDF no Drive',
    description = E'Antes de salvar, **renomeie** o PDF no formato **<ANO> <MÊS> <NOME DO CLIENTE>** (mês com dois dígitos).\n\nSalve em **ALÉM.FILMES > ADMINISTRATIVO > [02] CONTRATOS E NOTAS FISCAIS > ano > trimestre (Q1 a Q4, o do mês) > MÊS > nome do cliente**.\n\nUse o gerador abaixo para copiar o caminho e o nome — não digite à mão.',
    done_criteria = 'PDF renomeado no formato certo e salvo na pasta do cliente, no mês certo.',
    action_kind = 'salvar',
    tool = 'arquivo_nota_fiscal',
    example_text = E'Caminho: ALÉM.FILMES > ADMINISTRATIVO > [02] CONTRATOS E NOTAS FISCAIS > 2026 > Q4 > OUTUBRO > Colégio Contemporâneo\nNome do arquivo: 2026 10 Colégio Contemporâneo.pdf',
    is_blocking = true
  where process_id = pg_temp.pid('financeiro-emissao-nota-fiscal') and order_index = 6;

  update public.process_steps set action_kind = 'registrar'
  where process_id = pg_temp.pid('financeiro-emissao-nota-fiscal') and order_index = 7;

  -- =========================================================================
  -- 2. Pagamento de freelancer — fluxo com autorização
  -- =========================================================================
  p := pg_temp.pid('financeiro-pagamento-de-freelancer');
  update public.processes set
    summary = 'Ninguém paga sem a autorização registrada: pedir no grupo do Financeiro, agendar no banco, lançar no projeto e conferir a margem.',
    trigger_description = 'Pauta entregue e aprovada com freelancer.'
  where id = p;
  delete from public.process_steps where process_id = p;

  s1 := pg_temp.add_step(p, 1, 'Pedir autorização do pagamento',
    E'No **grupo do Financeiro**, marque o **Anderson** e informe:\n- freelancer\n- projeto\n- pauta entregue (com o link)\n- valor\n\n**Ninguém paga sem essa autorização registrada no grupo.**',
    'Auxiliar financeiro', 'externo', null, 'Pedido enviado no grupo com freelancer, projeto, pauta e valor.', 5, true, 'aprovacao', 'aprovar',
    E'@Anderson autoriza o pagamento?\nFreelancer: João Silva (edição)\nProjeto: Fest Show 2026 · Colégio Contemporâneo\nPauta: Integra do fest show 2026 (aprovada)\nValor: R$ 450,00');
  s2 := pg_temp.add_step(p, 2, 'Pagamento autorizado?',
    'Sim: siga para o agendamento no banco. Não: volte ao passo 1 depois de esclarecer com a diretoria o que falta ou o que precisa de ajuste (valor, entrega, dados do freelancer).',
    'Diretoria', 'nenhum', null, 'Resposta da diretoria registrada no grupo.', null, true, 'decisao', 'decidir');
  s3 := pg_temp.add_step(p, 3, 'Agendar o pagamento no banco',
    E'A auxiliar financeira agenda o pagamento **direto no banco**, com **o login da empresa, disponível no gerenciador de senhas**. A diretoria só autoriza; quem agenda é o financeiro.\n\nUse os **dados para pagamento** do freelancer cadastrados no HQ.',
    'Auxiliar financeiro', 'externo', null, 'Pagamento agendado no banco, com comprovante do agendamento.', 10, true, 'acao', 'acessar');
  s4 := pg_temp.add_step(p, 4, 'Lançar no projeto e marcar como pago',
    'No **Financeiro → Pagamentos**, lance o custo no projeto com categoria **Freelancer** e marque como **pago** na data agendada.',
    'Auxiliar financeiro', 'financeiro', '/financeiro?aba=pagamentos', 'Pagamento no projeto, categoria Freelancer, pago na data agendada.', 5, true, 'acao', 'registrar');
  s5 := pg_temp.add_step(p, 5, 'Conferir o impacto na margem',
    E'Veja a margem do projeto depois do custo:\n- **abaixo de 30%**: a diretoria é avisada na hora pelo sistema — confirme que ela viu;\n- **entre 30% e 40%**: entra no relatório mensal de margem;\n- **40% ou mais**: saudável.',
    'Auxiliar financeiro', 'projetos', '/projetos', 'Margem conferida; abaixo de 30% com a diretoria ciente.', 3, false, 'acao', 'conferir');
  update public.process_steps set branch_yes_step_id = s3, branch_no_step_id = s1 where id = s2;

  -- =========================================================================
  -- 3. Margem: 40% saudável · < 30% imediato · 30–40% relatório mensal
  -- =========================================================================
  update public.process_steps set
    title = 'Relatório de margem abaixo da meta',
    description = E'O Financeiro mostra a seção **Projetos abaixo da meta de margem** (entre 30% e 40%). No fechamento, confira a lista e acrescente o motivo provável de cada projeto. A diretoria recebe o aviso do relatório no dia 1.\n\nProjetos **abaixo de 30%** não esperam o fechamento: o sistema avisa a diretoria na hora.',
    done_criteria = 'Relatório do mês conferido, com o motivo de cada projeto entre 30% e 40%.',
    action_kind = 'enviar',
    system_area = 'financeiro', system_link = '/financeiro#margem-abaixo-da-meta'
  where process_id = pg_temp.pid('financeiro-fechamento-mensal') and order_index = 5;
  update public.processes set summary = 'Fechar o mês: recebimentos e pagamentos conferidos, custos fixos lançados e o relatório de projetos abaixo da meta de margem (30–40%) entregue à diretoria.'
  where slug = 'financeiro-fechamento-mensal';

  update public.process_steps set
    description = 'Revise a margem de cada projeto ativo. Abaixo de 30% o sistema já avisou: siga o processo **Projeto abaixo da margem**. Entre 30% e 40%: veja o relatório mensal.',
    done_criteria = 'Margens revisadas; projetos abaixo de 30% com decisão em andamento.'
  where process_id = pg_temp.pid('diretoria-ritual-semanal') and order_index = 4;

  update public.processes set summary = 'Nenhuma proposta sai sem escopo, custos e margem conferidos. Margem saudável: 40%; abaixo de 30%, só com decisão explícita da diretoria.'
  where slug = 'diretoria-aprovacao-de-proposta';
  update public.process_steps set
    description = E'Meta: margem de **40%** ou mais.\n- **30% a 40%**: aceitável com justificativa (o projeto vai entrar no relatório mensal).\n- **Abaixo de 30%**: só com decisão explícita da diretoria.',
    done_criteria = 'Margem ≥ 40%, ou entre 30% e 40% justificada, ou abaixo de 30% aprovada pela diretoria.'
  where process_id = pg_temp.pid('diretoria-aprovacao-de-proposta') and order_index = 3;

  p := pg_temp.pid('diretoria-projeto-abaixo-da-margem');
  update public.processes set
    summary = 'Margem abaixo de 40%: abaixo de 30% a diretoria age na hora; entre 30% e 40%, o projeto vai ao relatório mensal.',
    trigger_description = 'Alerta do sistema (margem < 30%) ou relatório mensal (30–40%).'
  where id = p;
  delete from public.process_steps where process_id = p;
  s1 := pg_temp.add_step(p, 1, 'A margem está abaixo de 30%?',
    'Sim: o sistema já avisou a diretoria e sinalizou o projeto — aja agora. Não (entre 30% e 40%): sem alerta imediato; o projeto entra no relatório mensal.',
    'Diretoria', 'financeiro', '/financeiro', 'Faixa da margem confirmada.', 2, true, 'decisao', 'decidir');
  s2 := pg_temp.add_step(p, 2, 'Identificar a causa',
    'Custo acima do previsto? Escopo além do contratado? Compare orçamento, pagamentos e pautas do projeto.',
    'Diretoria', 'projetos', '/projetos', 'Causa identificada.', 20, true, 'acao', 'conferir');
  s3 := pg_temp.add_step(p, 3, 'Decidir: renegociar, cortar escopo ou absorver',
    'Escolha: **renegociar** com o cliente, **cortar escopo** ou **absorver** o custo.',
    'Diretoria', 'nenhum', null, 'Decisão tomada.', 10, true, 'acao', 'decidir');
  s4 := pg_temp.add_step(p, 4, 'Registrar a decisão',
    'Registre a decisão e o motivo nas notas de produção do projeto. Se renegociou, ajuste o valor do contrato pelo orçamento (o sistema reconcilia as parcelas).',
    'Diretoria', 'projetos', '/projetos', 'Decisão registrada no projeto.', 5, true, 'acao', 'registrar');
  s5 := pg_temp.add_step(p, 5, 'Entre 30% e 40%: revisar no fechamento',
    'O projeto aparece em **Projetos abaixo da meta de margem**, no Financeiro, e no relatório entregue à diretoria no dia 1. Revise no fechamento do mês.',
    'Diretoria', 'financeiro', '/financeiro#margem-abaixo-da-meta', 'Projeto revisado no relatório do mês.', 10, false, 'espera', 'aguardar');
  update public.process_steps set branch_yes_step_id = s2, branch_no_step_id = s5 where id = s1;

  -- =========================================================================
  -- 4. Audiovisual — Onde encontrar os arquivos no Drive
  -- =========================================================================
  insert into public.processes (slug, title, squad, summary, trigger_description, frequency, owner_role, order_index, created_by, updated_by)
  values ('audiovisual-onde-encontrar-arquivos', 'Onde encontrar os arquivos no Drive', 'audiovisual',
    'O mapa das pastas: onde fica o roteiro, os brutos, o projeto de edição, os assets e o final de cada projeto.',
    'Sempre que precisar achar ou salvar um arquivo de projeto.', 'sob_demanda', 'Toda a equipe de audiovisual', 0, null, null)
  on conflict (slug) do nothing
  returning id into p;
  if p is not null then
    perform pg_temp.add_step(p, 1, 'Chegar na pasta do projeto',
      E'**ALÉM.FILMES > AUDIOVISUAL > ano > trimestre (Q1 a Q4) > MÊS > [dd/mm/aaaa] projeto - cliente [iniciais do responsável pela pauta]**\n\nO nome é gerado pelo sistema: copie no projeto (aba Geral) ou no gerador abaixo.',
      'Toda a equipe', 'projetos', '/projetos', 'Pasta do projeto aberta.', 2, false, 'acao', 'acessar',
      E'ALÉM.FILMES > AUDIOVISUAL > 2026 > Q3 > SETEMBRO > [14/09/2026] Fest Show 2026 - Colégio Contemporâneo [AF]', 'arvore_drive');
    perform pg_temp.add_step(p, 2, '[00] ROTEIRO',
      'Roteiros, decupagens, briefing em documento e textos aprovados. Quem edita começa lendo aqui.',
      'Toda a equipe', 'externo', null, 'Roteiro da pauta localizado.', null, false, 'acao', 'conferir');
    perform pg_temp.add_step(p, 3, '[01] BRUTOS',
      E'Tudo o que foi gravado, **do jeito que saiu da câmera**. O videomaker copia no fim do dia da captação e confirma o backup antes de formatar o cartão.\n\nOrganize por dia/câmera quando houver mais de uma.',
      'Videomaker', 'externo', null, 'Brutos completos e com backup.', null, true, 'acao', 'salvar');
    perform pg_temp.add_step(p, 4, '[02] PROJETO',
      'O arquivo de edição (Premiere/DaVinci/After) e os arquivos de trabalho. O editor salva o projeto aqui — nunca na área de trabalho.',
      'Editor', 'externo', null, 'Projeto de edição salvo nesta pasta.', null, false, 'acao', 'salvar');
    perform pg_temp.add_step(p, 5, '[03] ASSETS',
      'Trilhas, efeitos sonoros, logos do cliente, fontes, cartelas e elementos de motion usados na edição.',
      'Editor', 'externo', null, 'Assets do projeto reunidos aqui.', null, false, 'acao', 'conferir');
    perform pg_temp.add_step(p, 6, '[04] FINALIZADO',
      'Só os exports finais (e as versões enviadas ao cliente, com v1, v2…). O link de entrega da pauta aponta para cá.',
      'Editor', 'externo', null, 'Export final nesta pasta e o link na pauta.', null, false, 'acao', 'emitir',
      'Integra Fest Show 2026 v2.mp4');
  end if;

  update public.process_steps set
    description = 'Os brutos estão em **[01] BRUTOS**. Não sabe onde fica a pasta? Veja **Onde encontrar os arquivos no Drive**.',
    system_area = 'nenhum', system_link = '/fluxogramas/audiovisual-onde-encontrar-arquivos', action_kind = 'copiar'
  where process_id = pg_temp.pid('audiovisual-edicao') and order_index = 1;

  update public.process_steps set
    description = 'No fim do dia, copie os brutos para **[01] BRUTOS** do projeto e **confirme o backup antes de formatar qualquer cartão**. Caminho da pasta: **Onde encontrar os arquivos no Drive**.',
    system_area = 'nenhum', system_link = '/fluxogramas/audiovisual-onde-encontrar-arquivos', action_kind = 'salvar', tool = 'arvore_drive'
  where process_id = pg_temp.pid('audiovisual-dia-da-captacao') and order_index = 4;
end;
$$;

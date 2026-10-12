-- Prospecção (Módulo 4B): processo "Como prospectar" no Fluxograma do squad comercial (spec 7.4),
-- com o texto aprovado pelo Anderson. Idempotente: se o processo já existir (pelo slug), nada é
-- criado nem duplicado — rodar de novo não muda o que já foi editado na tela.
-- O processo antigo "Cadência de contato" (regra das 7 tentativas) sai de publicação.
--
-- Rollback: delete from public.processes where slug = 'comercial-como-prospectar';
-- update public.processes set is_published = true where slug = 'comercial-cadencia-de-contato';

do $$
declare
  p uuid;
begin
  insert into public.processes (slug, title, squad, summary, trigger_description, frequency, owner_role, order_index, created_by, updated_by)
  values (
    'comercial-como-prospectar', 'Como prospectar', 'comercial',
    'Da prospecção por WhatsApp até o orçamento: o HQ monta a mensagem, conta os dias e marca a reunião.',
    'Todo dia útil, ao abrir o CRM.', 'diaria', 'SDR', 0, null, null
  )
  on conflict (slug) do nothing
  returning id into p;

  if p is null then
    return;
  end if;

  insert into public.process_steps (process_id, order_index, title, description, responsible_role, system_area, system_link, done_criteria, estimated_minutes, is_blocking)
  values
    (p, 1, 'Cadastrar o lead',
      'No **CRM**, clique em **+ Novo negócio › Lead de prospecção (rápido)** e preencha **Escola ou empresa**, **Nome do contato** e **WhatsApp**.',
      'SDR', 'crm', '/crm', 'Lead cadastrado com nome, contato e WhatsApp.', 2, true),
    (p, 2, 'Escolher o playbook',
      'No mesmo formulário, escolha o **Playbook**; a **Meta vinculada** vem sugerida. Se o contato não decide, marque **Não** em **O contato atual é quem decide?**.',
      'SDR', 'crm', '/crm', 'Playbook escolhido e meta conferida.', 1, true),
    (p, 3, 'Preencher o gancho',
      'Olhe o Instagram do lead, escreva no campo **Gancho** uma observação real e curta e clique em **Cadastrar lead**.',
      'SDR', 'crm', '/crm', 'Gancho preenchido (ou deixado em branco de propósito).', 1, false),
    (p, 4, 'Abrir o Chamar hoje',
      'Em **CRM › Leads › Chamar hoje** estão os toques do dia, atrasados primeiro, com o contador **toques para hoje**.',
      'SDR', 'crm', '/crm?aba=leads&visao=chamar-hoje', 'Fila do dia aberta.', 1, false),
    (p, 5, 'Enviar e marcar enviado',
      'No card, clique em **Enviar no WhatsApp**, confira o texto e clique em **Abrir WhatsApp**. Envie no WhatsApp, volte ao HQ e clique em **Marcar enviado**; dá para **Desfazer** por 10 segundos.',
      'SDR', 'crm', '/crm?aba=leads&visao=chamar-hoje', 'Toque marcado como enviado no card.', 2, true),
    (p, 6, 'Respondeu',
      'Quando o lead responder, clique em **Respondeu**: a cadência para e o lead vai para **Em conversa**.',
      'SDR', 'crm', '/crm?aba=leads&visao=prospeccao', 'Lead em Em conversa.', 1, false),
    (p, 7, 'Objeções',
      'Clique em **Objeção**, escolha o que o cliente disse e use **Copiar resposta**. Em "Sem verba agora" e "Me chama depois", escolha a data e clique em **Agendar reativação**.',
      'SDR', 'crm', '/crm?aba=leads&visao=prospeccao', 'Objeção registrada no lead.', 2, false),
    (p, 8, 'Marcar reunião',
      'Com o lead qualificado (orçamento, tipo de projeto, prazo e decisor), clique em **Marcar reunião**, escolha um dos horários livres do Anderson, mande a frase por **Enviar no WhatsApp** e clique em **Confirmar horário**.',
      'SDR', 'crm', '/crm?aba=leads&visao=prospeccao', 'Reunião na agenda do Anderson.', 3, true),
    (p, 9, 'Reunião aconteceu?',
      'Depois do horário, responda no card: **Sim**, **Não compareceu** ou **Reagendar**.',
      'SDR', 'crm', '/crm?aba=leads&visao=chamar-hoje', 'Resultado da reunião registrado.', 1, true),
    (p, 10, 'Orçamento',
      'Com **Sim**, o HQ cria o rascunho em **Orçamentos** com cliente, negócio e playbook. Quando o orçamento for aprovado, a meta vinculada soma sozinha.',
      'SDR', 'nenhum', '/orcamentos', 'Rascunho do orçamento criado.', 1, false);

  update public.processes set is_published = false where slug = 'comercial-cadencia-de-contato' and is_published;
end;
$$;

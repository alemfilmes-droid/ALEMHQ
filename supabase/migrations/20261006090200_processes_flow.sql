-- Fluxogramas: fluxo de verdade. Cada passo ganha
--   step_type     ação | decisão | aprovação | espera (decisão tem saídas "Sim" e "Não")
--   branch_yes_step_id / branch_no_step_id  para onde cada saída leva (passos do mesmo processo)
--   action_kind   o tipo de ação, para o ícone (copiar, conferir, acessar, emitir…)
--   image_url     imagem ilustrativa (bucket público "process-assets", até 5 MB)
--   example_text  bloco "Exemplo" (ex.: o nome exato de um arquivo)
-- Ferramentas novas: 'arquivo_nota_fiscal' (caminho + nome do PDF da nota) e 'arvore_drive'
-- (árvore de pastas do projeto).

alter table public.process_steps
  add column step_type text not null default 'acao' check (step_type in ('acao', 'decisao', 'aprovacao', 'espera')),
  add column branch_yes_step_id uuid references public.process_steps (id) on delete set null,
  add column branch_no_step_id uuid references public.process_steps (id) on delete set null,
  add column action_kind text not null default 'executar' check (action_kind in (
    'copiar', 'conferir', 'acessar', 'emitir', 'enviar', 'salvar', 'registrar', 'aprovar', 'aguardar', 'decidir', 'executar'
  )),
  add column image_url text check (image_url is null or (length(image_url) <= 500 and image_url ~ '^https://')),
  add column example_text text check (example_text is null or length(example_text) <= 2000);

alter table public.process_steps drop constraint process_steps_tool_check;
alter table public.process_steps add constraint process_steps_tool_check
  check (tool is null or tool in ('pasta_drive', 'arquivo_nota_fiscal', 'arvore_drive'));

-- Ícone dos passos já existentes, pelo verbo do título.
update public.process_steps set action_kind = case
  when title ~* '^(copiar|localizar)' then 'copiar'
  when title ~* '^(conferir|checar|verificar|revis|identificar|garantir|respeitar)' then 'conferir'
  when title ~* '^acessar' then 'acessar'
  when title ~* '^(emitir|exportar|gravar|editar)' then 'emitir'
  when title ~* '^(enviar|confirmar a chegada|confirmar local)' then 'enviar'
  when title ~* '^(salvar|criar a pasta|organizar|copiar os brutos)' then 'salvar'
  when title ~* '^(registrar|marcar|lançar|cadastrar|definir|mover|anexar|colar|criar o projeto|criar as pautas|preencher|agendar)' then 'registrar'
  when title ~* '^(aprova|autorizar)' then 'aprovar'
  when title ~* '^decidir' then 'decidir'
  else 'executar'
end;

-- Credenciais: o bloco de exemplo também é verificado; saídas só para passos do mesmo processo.
create or replace function public.process_steps_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.text_has_credential(new.title) or public.text_has_credential(new.description)
     or public.text_has_credential(new.done_criteria) or public.text_has_credential(new.system_link)
     or public.text_has_credential(new.responsible_role) or public.text_has_credential(new.example_text) then
    raise exception 'Não guarde senhas, logins ou tokens nos passos. Escreva "o login da empresa, disponível no gerenciador de senhas".'
      using errcode = '22023';
  end if;
  if new.system_link is not null and new.system_link !~ '^(/[A-Za-z0-9/_?=&#%.-]*|https?://\S+)$' then
    raise exception 'Link inválido: use uma rota do sistema (/clientes) ou um endereço https://.' using errcode = '22023';
  end if;
  if (new.branch_yes_step_id is not null and not exists (select 1 from public.process_steps s where s.id = new.branch_yes_step_id and s.process_id = new.process_id))
     or (new.branch_no_step_id is not null and not exists (select 1 from public.process_steps s where s.id = new.branch_no_step_id and s.process_id = new.process_id)) then
    raise exception 'As saídas da decisão precisam ser passos deste mesmo processo.' using errcode = '22023';
  end if;
  if new.step_type <> 'decisao' then
    new.branch_yes_step_id := null;
    new.branch_no_step_id := null;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Imagens dos passos: bucket público; envia quem edita o processo (pasta = id do processo).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('process-assets', 'process-assets', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create function public.can_edit_process_asset(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_process uuid;
begin
  begin
    v_process := split_part(p_object_name, '/', 1)::uuid;
  exception when others then
    return false;
  end;
  return public.can_edit_process_squad(public.process_squad(v_process));
end;
$$;

revoke all on function public.can_edit_process_asset(text) from public, anon;
grant execute on function public.can_edit_process_asset(text) to authenticated;

create policy "process_assets_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'process-assets' and public.can_edit_process_asset(name));
create policy "process_assets_update" on storage.objects for update to authenticated
  using (bucket_id = 'process-assets' and public.can_edit_process_asset(name));
create policy "process_assets_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'process-assets' and public.can_edit_process_asset(name));

-- Corrige a transferência de master.
--
-- O bug: transfer_master() rebaixava o master atual para 'diretoria' e, em seguida, promovia o alvo.
-- Esse segundo UPDATE passava pelo gatilho profiles_guard_update(), que exige
-- can_manage_profile(alvo) — mas can_manage_profile() lê current_org_level(), que A ESSA ALTURA já
-- era 'diretoria' (o chamador tinha acabado de se rebaixar). Diretoria só gerencia head/executor,
-- então promover alguém de nível 'diretoria' sempre caía em "Você não tem permissão para alterar o
-- nível hierárquico desta pessoa" — e a server action trocava essa mensagem por uma genérica.
-- A liberação por GUC (app.allow_master_transfer) só cobria a linha do próprio chamador.
--
-- A correção:
-- - transfer_master() valida tudo ANTES de escrever (com mensagens claras de elegibilidade), trava as
--   duas linhas e grava na GUC exatamente o par autorizado ("<master atual>:<novo master>").
-- - O gatilho libera a mudança de org_level SÓ para essas duas linhas e SÓ para os valores esperados
--   (atual → diretoria, alvo → master). Qualquer outra mudança continua passando pelas regras normais.
-- - A ordem continua rebaixar → promover, dentro da mesma transação: o índice único parcial
--   profiles_master_singleton (não adiável) nunca vê dois masters ao mesmo tempo.

create or replace function public.profiles_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transfer text := coalesce(current_setting('app.master_transfer', true), '');
  v_transfer_ok boolean := false;
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'Alteração não permitida.' using errcode = '42501';
  end if;

  if new.org_level is distinct from old.org_level then
    -- Transferência de master em andamento (só transfer_master() grava esta GUC, por transação).
    if v_transfer <> '' then
      v_transfer_ok :=
        (v_transfer = auth.uid()::text || ':' || split_part(v_transfer, ':', 2))
        and (
          (old.id::text = split_part(v_transfer, ':', 1) and old.org_level = 'master' and new.org_level = 'diretoria')
          or (old.id::text = split_part(v_transfer, ':', 2) and new.org_level = 'master')
        );
    end if;

    if not v_transfer_ok then
      if old.id = auth.uid() then
        raise exception 'Você não pode alterar o seu próprio nível hierárquico.' using errcode = '42501';
      elsif new.org_level = 'master' then
        raise exception 'O master só muda pela transferência de master.' using errcode = '42501';
      elsif not public.can_manage_profile(old.id) then
        raise exception 'Você não tem permissão para alterar o nível hierárquico desta pessoa.' using errcode = '42501';
      end if;
    end if;
  end if;

  if public.is_admin() then
    if old.id = auth.uid() and (new.access_role is distinct from old.access_role
         or new.is_active is distinct from old.is_active) then
      raise exception 'Administradores não podem alterar o próprio papel ou status.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.access_role is distinct from old.access_role
     or new.functions is distinct from old.functions
     or new.is_active is distinct from old.is_active
     or new.email is distinct from old.email then
    raise exception 'Alteração não permitida.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.transfer_master(p_new_master_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_target record;
begin
  if v_caller is null then
    raise exception 'Sessão expirada. Entre novamente.' using errcode = '42501';
  end if;

  -- Trava as duas linhas até o fim da transação (nada muda no meio do caminho).
  perform 1 from public.profiles where id in (v_caller, p_new_master_id) order by id for update;

  if not exists (select 1 from public.profiles where id = v_caller and org_level = 'master' and is_active) then
    raise exception 'Só quem é master pode transferir a função.' using errcode = '42501';
  end if;
  if p_new_master_id = v_caller then
    raise exception 'Selecione outra pessoa para receber o master.' using errcode = '22023';
  end if;

  select id, full_name, is_active, org_level into v_target from public.profiles where id = p_new_master_id;
  if not found then
    raise exception 'Pessoa não encontrada.' using errcode = '22023';
  end if;
  if not v_target.is_active then
    raise exception '% está com a conta desativada. Reative a conta antes de transferir o master.', v_target.full_name using errcode = '22023';
  end if;
  if coalesce(btrim(v_target.full_name), '') = '' then
    raise exception 'Essa pessoa ainda não concluiu o cadastro (convite pendente).' using errcode = '22023';
  end if;
  if v_target.org_level <> 'diretoria' then
    raise exception '% precisa estar no nível Diretoria para receber o master. Altere o nível em Equipe e tente de novo.', v_target.full_name
      using errcode = '22023';
  end if;

  perform set_config('app.master_transfer', v_caller::text || ':' || p_new_master_id::text, true);
  -- Rebaixa antes de promover: o índice único parcial de master nunca vê dois ao mesmo tempo.
  update public.profiles set org_level = 'diretoria' where id = v_caller;
  update public.profiles set org_level = 'master' where id = p_new_master_id;
  perform set_config('app.master_transfer', '', true);

  -- O novo master fica na diretoria (squad), se ainda não estiver.
  insert into public.profile_squads (profile_id, squad)
  values (p_new_master_id, 'diretoria')
  on conflict do nothing;
end;
$$;

revoke all on function public.transfer_master(uuid) from public, anon;
grant execute on function public.transfer_master(uuid) to authenticated;

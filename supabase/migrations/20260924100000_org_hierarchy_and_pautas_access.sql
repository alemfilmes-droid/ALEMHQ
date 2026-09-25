-- Hierarquia organizacional (master/diretoria/head/executor), acesso por nível ao quadro de
-- pautas, tarefas avulsas (pautas pessoais sem projeto) e rastreio de handover.

-- ---------------------------------------------------------------------------
-- Nível hierárquico
-- ---------------------------------------------------------------------------

create type public.org_level as enum ('master', 'diretoria', 'head', 'executor');

alter table public.profiles
  add column org_level public.org_level not null default 'executor';

create index profiles_org_level_idx on public.profiles (org_level);

-- No máximo um master por vez. A troca é feita pela função transfer_master(), nunca por UPDATE direto.
create unique index profiles_master_singleton on public.profiles (org_level) where org_level = 'master';

-- Bootstrap: o primeiro admin existente (dono do sistema) vira master; os demais membros já na
-- diretoria (squad) entram como diretoria no novo nível hierárquico.
update public.profiles set org_level = 'master'
where id = (select id from public.profiles where access_role = 'admin' order by created_at asc limit 1);

update public.profiles p set org_level = 'diretoria'
from public.profile_squads ps
where ps.profile_id = p.id and ps.squad = 'diretoria' and p.org_level is distinct from 'master';

-- ---------------------------------------------------------------------------
-- Helpers de hierarquia (SECURITY DEFINER — mesmo padrão de is_director()/in_squad()).
-- ---------------------------------------------------------------------------

create function public.current_org_level()
returns public.org_level
language sql
stable
security definer
set search_path = ''
as $$
  select p.org_level from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create function public.is_master()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_org_level() = 'master', false)
$$;

create function public.is_head()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_org_level() = 'head', false)
$$;

-- Squads sob gestão da pessoa: todos, para master/diretoria; os próprios, para head; nenhum, para executor.
create function public.managed_squads()
returns public.squad[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.current_org_level() in ('master', 'diretoria') then enum_range(null::public.squad)
    when public.current_org_level() = 'head' then (
      select coalesce(array_agg(ps.squad), '{}'::public.squad[])
      from public.profile_squads ps
      where ps.profile_id = auth.uid()
    )
    else '{}'::public.squad[]
  end
$$;

-- Quem acessa o quadro global /pautas (o escopo do que ela vê dentro do quadro é dado por
-- managed_squads() — heads fora do squad audiovisual acessam a rota mas veem um quadro vazio).
create or replace function public.can_manage_pautas()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_org_level() in ('master', 'diretoria', 'head'), false)
$$;

-- Gestão de verdade sobre pautas (criar, apagar, trocar líder/prioridade, mover entre colunas
-- livremente, adicionar/remover responsáveis à força): can_manage_pautas() já dentro do squad que
-- de fato produz pautas hoje (audiovisual). Um head de comercial/financeiro acessa a rota mas não
-- gerencia nada nela — só master/diretoria/head-de-audiovisual passam por aqui.
create function public.can_fully_manage_pauta()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_manage_pautas() and 'audiovisual' = any(public.managed_squads())
$$;

-- Quem pode alterar o nível hierárquico/cargo de outra pessoa. Nunca a própria conta (nem master).
create function public.can_manage_profile(p_target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_target_id is distinct from auth.uid()
    and case public.current_org_level()
      when 'master' then true
      when 'diretoria' then exists (
        select 1 from public.profiles t where t.id = p_target_id and t.org_level in ('head', 'executor')
      )
      when 'head' then exists (
        select 1
        from public.profiles t
        join public.profile_squads ts on ts.profile_id = t.id
        where t.id = p_target_id and t.org_level = 'executor' and ts.squad = any(public.managed_squads())
      )
      else false
    end
$$;

revoke all on function public.current_org_level() from public, anon;
revoke all on function public.is_master() from public, anon;
revoke all on function public.is_head() from public, anon;
revoke all on function public.managed_squads() from public, anon;
revoke all on function public.can_manage_pautas() from public, anon;
revoke all on function public.can_fully_manage_pauta() from public, anon;
revoke all on function public.can_manage_profile(uuid) from public, anon;
grant execute on function public.current_org_level() to authenticated;
grant execute on function public.is_master() to authenticated;
grant execute on function public.is_head() to authenticated;
grant execute on function public.managed_squads() to authenticated;
grant execute on function public.can_manage_pautas() to authenticated;
grant execute on function public.can_fully_manage_pauta() to authenticated;
grant execute on function public.can_manage_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Guarda de UPDATE em profiles: ninguém altera o próprio nível hierárquico (nem via transferência
-- direta — só a função transfer_master() pode, e sinaliza isso pela GUC de transação abaixo); a
-- troca no nível de outra pessoa exige can_manage_profile().
-- ---------------------------------------------------------------------------

create or replace function public.profiles_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'Alteração não permitida.' using errcode = '42501';
  end if;

  if new.org_level is distinct from old.org_level then
    if old.id = auth.uid() then
      if coalesce(current_setting('app.allow_master_transfer', true), '') is distinct from 'true' then
        raise exception 'Você não pode alterar o seu próprio nível hierárquico.' using errcode = '42501';
      end if;
    elsif not public.can_manage_profile(old.id) then
      raise exception 'Você não tem permissão para alterar o nível hierárquico desta pessoa.' using errcode = '42501';
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

-- Permite que master/diretoria/head atualizem linhas de outras pessoas dentro do seu escopo
-- (a coluna afetada — org_level, e job_title de quebra — ainda é filtrada pelo trigger acima).
create policy "profiles_update_hierarchy"
  on public.profiles for update
  to authenticated
  using (public.can_manage_profile(id))
  with check (public.can_manage_profile(id));

-- Transferência de master: atômica, só o master atual pode chamar, nunca para si mesmo.
create function public.transfer_master(p_new_master_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_master() then
    raise exception 'Só quem é master pode transferir a função.' using errcode = '42501';
  end if;
  if p_new_master_id = auth.uid() then
    raise exception 'Selecione outra pessoa para receber o master.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_new_master_id and is_active) then
    raise exception 'Pessoa não encontrada ou inativa.' using errcode = '22023';
  end if;

  perform set_config('app.allow_master_transfer', 'true', true);
  update public.profiles set org_level = 'diretoria' where id = auth.uid();
  update public.profiles set org_level = 'master' where id = p_new_master_id;
end;
$$;

revoke all on function public.transfer_master(uuid) from public, anon;
grant execute on function public.transfer_master(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Pautas: tarefas avulsas (pessoais, sem projeto/cliente).
-- ---------------------------------------------------------------------------

alter table public.pautas alter column project_id drop not null;

alter table public.pautas
  add column is_standalone boolean not null default false,
  add column created_for uuid references public.profiles (id) on delete cascade,
  add column previous_assignee_id uuid references public.profiles (id) on delete set null,
  add column returned_at timestamptz;

alter table public.pautas
  add constraint pautas_standalone_check check (
    (is_standalone and project_id is null and created_for is not null and lead_id = created_for and current_assignee_id = created_for)
    or (not is_standalone and project_id is not null and created_for is null)
  );

create index pautas_created_for_idx on public.pautas (created_for);
create index pautas_previous_assignee_idx on public.pautas (previous_assignee_id);

-- Rastreia handover: sempre que o responsável atual muda, guarda quem estava antes e quando —
-- alimenta o grupo "Devolvidas" do quadro pessoal (o que a pessoa passou adiante recentemente).
create function public.pautas_track_handover()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.current_assignee_id is distinct from old.current_assignee_id and old.current_assignee_id is not null then
    new.previous_assignee_id := old.current_assignee_id;
    new.returned_at := now();
  end if;
  return new;
end;
$$;

create trigger pautas_track_handover
  before update on public.pautas
  for each row execute function public.pautas_track_handover();

-- Quando uma pauta volta para reajuste, notifica quem agora precisa refazer a etapa (o novo
-- responsável atual) já com a nota do handover — a notificação genérica de troca de responsável
-- (pautas_notify_assignee_change) não leva o texto da nota.
create function public.pautas_notify_reajuste()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text;
begin
  if new.status = 'reajuste' and old.status is distinct from 'reajuste'
     and new.current_assignee_id is not null and new.current_assignee_id is distinct from auth.uid() then
    v_note := nullif(current_setting('app.handover_note', true), '');
    perform public.notify(
      new.current_assignee_id, 'pauta_needs_adjustment', 'Uma pauta voltou para reajuste',
      coalesce(v_note, new.title), 'pauta', new.id, '/pautas?pauta=' || new.id
    );
  end if;
  return new;
end;
$$;

create trigger pautas_notify_reajuste_change
  after update on public.pautas
  for each row execute function public.pautas_notify_reajuste();

-- ---------------------------------------------------------------------------
-- Guarda de UPDATE em pautas: quem não gerencia (não é master/diretoria/head-de-audiovisual) só
-- edita os campos operacionais da própria etapa — nunca título, líder, prioridade, criticidade,
-- contato ou projeto. Dono de tarefa avulsa (is_standalone) edita a própria livremente: é uma
-- tarefa pessoal, não uma pauta de produção.
-- ---------------------------------------------------------------------------

create function public.pautas_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.can_fully_manage_pauta() then
    return new;
  end if;

  if new.is_standalone and new.created_for = auth.uid() then
    return new;
  end if;

  if new.title is distinct from old.title
     or new.lead_id is distinct from old.lead_id
     or new.priority is distinct from old.priority
     or new.is_critical is distinct from old.is_critical
     or new.project_id is distinct from old.project_id
     or new.contact_id is distinct from old.contact_id then
    raise exception 'Você só pode alterar o status e os campos operacionais desta pauta.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger pautas_guard_update
  before update on public.pautas
  for each row execute function public.pautas_guard_update();

-- ---------------------------------------------------------------------------
-- Permissões de pauta: redefine can_view_pauta/can_edit_pauta para a hierarquia (substitui a
-- regra antiga baseada em squad — diretoria/audiovisual viam tudo; agora é can_manage_pautas()
-- dentro do squad gerido, ou vínculo direto com a pauta).
-- ---------------------------------------------------------------------------

create or replace function public.can_view_pauta(p_pauta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (
      public.can_manage_pautas()
      and 'audiovisual' = any(public.managed_squads())
      and exists (select 1 from public.pautas p where p.id = p_pauta_id and not p.is_standalone)
    )
    or exists (
      select 1 from public.pautas p
      where p.id = p_pauta_id
        and (p.lead_id = auth.uid() or p.current_assignee_id = auth.uid() or p.previous_assignee_id = auth.uid())
    )
    or exists (select 1 from public.pauta_members pm where pm.pauta_id = p_pauta_id and pm.profile_id = auth.uid())
    or exists (
      select 1
      from public.pautas p
      join public.project_members prm on prm.project_id = p.project_id
      where p.id = p_pauta_id and prm.profile_id = auth.uid()
    )
$$;

-- Edição operacional: gestão plena, ou líder/responsável atual/membro (a própria pauta). Quem só
-- tem previous_assignee_id (já passou adiante — ver DEVOLVIDAS no quadro pessoal) só visualiza:
-- can_edit_pauta não inclui essa condição de propósito.
create or replace function public.can_edit_pauta(p_pauta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.can_fully_manage_pauta()
    or exists (
      select 1 from public.pautas p
      where p.id = p_pauta_id and (p.lead_id = auth.uid() or p.current_assignee_id = auth.uid())
    )
    or exists (select 1 from public.pauta_members pm where pm.pauta_id = p_pauta_id and pm.profile_id = auth.uid())
$$;

-- Criar pautas de produção: só gestão plena. Tarefa avulsa: qualquer pessoa cria para si mesma.
drop policy "pautas_insert" on public.pautas;
create policy "pautas_insert" on public.pautas for insert to authenticated
  with check (
    (not is_standalone and public.can_fully_manage_pauta())
    or (is_standalone and created_for = auth.uid() and lead_id = auth.uid() and current_assignee_id = auth.uid())
  );

-- Responsáveis (pauta_members): adicionar/remover à força é gestão plena; o handover (RPC
-- SECURITY DEFINER) já grava direto na tabela e não passa por esta policy.
drop policy "pauta_members_write" on public.pauta_members;
create policy "pauta_members_write" on public.pauta_members for all to authenticated
  using (public.can_fully_manage_pauta())
  with check (public.can_fully_manage_pauta());

-- ---------------------------------------------------------------------------
-- View do quadro: agora com LEFT JOIN em projects (tarefa avulsa não tem projeto) e o nome de
-- quem a tarefa avulsa é para. Recriada do zero (não CREATE OR REPLACE) porque os novos campos de
-- public.pautas entram no meio da lista via "pt.*", o que a sintaxe REPLACE não aceita.
-- ---------------------------------------------------------------------------

drop view public.pautas_with_details;

create view public.pautas_with_details
with (security_invoker = true) as
select
  pt.*,
  pr.name as project_name,
  pr.is_internal as project_is_internal,
  pr.company_id,
  c.name as company_name,
  lead.full_name as lead_name,
  lead.avatar_url as lead_avatar_url,
  assignee.full_name as assignee_name,
  assignee.avatar_url as assignee_avatar_url,
  ct.full_name as contact_name,
  coalesce(nullif(btrim(pt.contact_phone_override), ''), ct.phone) as contact_phone,
  (
    select count(*)::int from public.pauta_comments cm where cm.pauta_id = pt.id
  ) as comments_count,
  creator.full_name as created_for_name
from public.pautas pt
left join public.projects pr on pr.id = pt.project_id
left join public.companies c on c.id = pr.company_id
join public.profiles lead on lead.id = pt.lead_id
left join public.profiles assignee on assignee.id = pt.current_assignee_id
left join public.profiles creator on creator.id = pt.created_for
left join public.contacts ct on ct.id = pt.contact_id
where pt.archived_at is null;

revoke all on public.pautas_with_details from anon;

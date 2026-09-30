-- Pautas/tarefas para o time (com ou sem cliente/projeto), campos por dono, "com quem está a bola"
-- no cliente e prazo com hora.
--
-- 1. Pauta sem projeto: a pauta de equipe (não avulsa) pode ter só cliente (ex.: prospect sem
--    projeto) ou nem isso. `direct_company_id` guarda o cliente; com projeto, o banco o preenche com o
--    cliente do projeto, então "cliente da pauta" é sempre direct_company_id.
-- 2. Gestão por squad: quem gerencia pautas (master, diretoria, heads) vê e gerencia as pautas dos
--    squads que gerencia (antes, só o audiovisual). Master/diretoria gerenciam todos os squads.
-- 3. Campos fechados × abertos: título, briefing, cliente/projeto, líder, prioridade, datas de
--    captação/início, local, contato e formato só mudam por quem criou a pauta ou pela gestão do squad.
--    Os demais (status, links do roteiro/Drive/material, equipamentos, freelancer, "com quem está a
--    bola", prazo da etapa no "passar adiante") ficam abertos a quem está na pauta.
-- 4. "Com quem está a bola" no cliente: waiting_on_contact_id aponta para um contato (equipe do
--    cliente) — só sinaliza; líder e responsável continuam os mesmos.
-- 5. Prazo com hora (due_time): entrega "até as 18h".

alter table public.pautas
  add column direct_company_id uuid references public.companies (id) on delete set null,
  add column due_time time,
  add column waiting_on_contact_id uuid references public.contacts (id) on delete set null;

create index pautas_direct_company_idx on public.pautas (direct_company_id) where direct_company_id is not null;

-- Pautas existentes: o cliente é o do projeto.
alter table public.pautas disable trigger user;
update public.pautas pt
set direct_company_id = pr.company_id
from public.projects pr
where pr.id = pt.project_id and pt.direct_company_id is null;
alter table public.pautas enable trigger user;

-- Pauta de equipe não precisa mais de projeto (a avulsa continua sem projeto nem cliente).
alter table public.pautas drop constraint if exists pautas_standalone_check;
alter table public.pautas
  add constraint pautas_standalone_check check (
    (is_standalone and project_id is null and created_for is not null and lead_id = created_for and current_assignee_id = created_for)
    or (not is_standalone and created_for is null)
  );

-- Cliente da pauta = cliente do projeto (quando há projeto). Contato e "com quem está a bola"
-- precisam ser da equipe desse cliente.
create or replace function public.pautas_validate_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.project_id is not null then
    select pr.company_id into new.direct_company_id from public.projects pr where pr.id = new.project_id;
  end if;

  if new.contact_id is not null and not exists (
    select 1 from public.contacts c where c.id = new.contact_id and c.company_id = new.direct_company_id
  ) then
    raise exception 'O contato não pertence ao cliente desta pauta.' using errcode = '23514';
  end if;

  if new.waiting_on_contact_id is not null and not exists (
    select 1 from public.contacts c where c.id = new.waiting_on_contact_id and c.company_id = new.direct_company_id
  ) then
    raise exception 'Essa pessoa não é da equipe do cliente desta pauta.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists pautas_validate_contact on public.pautas;
create trigger pautas_validate_contact
  before insert or update of contact_id, project_id, direct_company_id, waiting_on_contact_id on public.pautas
  for each row execute function public.pautas_validate_contact();

-- ---------------------------------------------------------------------------
-- Gestão por squad
-- ---------------------------------------------------------------------------

create or replace function public.manages_pauta_squad(p_squad public.squad)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_manage_pautas() and p_squad = any (public.managed_squads())
$$;

create or replace function public.is_pauta_squad_manager(p_pauta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pautas p
    where p.id = p_pauta_id and not p.is_standalone and public.manages_pauta_squad(p.squad)
  )
$$;

revoke all on function public.manages_pauta_squad(public.squad) from public, anon;
revoke all on function public.is_pauta_squad_manager(uuid) from public, anon;
grant execute on function public.manages_pauta_squad(public.squad) to authenticated;
grant execute on function public.is_pauta_squad_manager(uuid) to authenticated;

drop policy if exists "pautas_select" on public.pautas;
create policy "pautas_select" on public.pautas for select to authenticated
  using (
    public.is_active_user()
    and (
      (not is_standalone and public.manages_pauta_squad(squad))
      or lead_id = auth.uid()
      or current_assignee_id = auth.uid()
      or previous_assignee_id = auth.uid()
      or created_by = auth.uid()
      or created_for = auth.uid()
      or exists (select 1 from public.pauta_members pm where pm.pauta_id = pautas.id and pm.profile_id = auth.uid())
      or exists (select 1 from public.project_members prm where prm.project_id = pautas.project_id and prm.profile_id = auth.uid())
    )
  );

create or replace function public.can_view_pauta(p_pauta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_pauta_squad_manager(p_pauta_id)
    or exists (
      select 1 from public.pautas p
      where p.id = p_pauta_id
        and (
          p.lead_id = auth.uid()
          or p.current_assignee_id = auth.uid()
          or p.previous_assignee_id = auth.uid()
          or p.created_by = auth.uid()
          or p.created_for = auth.uid()
        )
    )
    or exists (select 1 from public.pauta_members pm where pm.pauta_id = p_pauta_id and pm.profile_id = auth.uid())
    or exists (
      select 1
      from public.pautas p
      join public.project_members prm on prm.project_id = p.project_id
      where p.id = p_pauta_id and prm.profile_id = auth.uid()
    )
$$;

create or replace function public.can_edit_pauta(p_pauta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.can_fully_manage_pauta()
    or public.is_pauta_squad_manager(p_pauta_id)
    or exists (
      select 1 from public.pautas p
      where p.id = p_pauta_id
        and (
          p.lead_id = auth.uid()
          or p.current_assignee_id = auth.uid()
          or (p.created_by = auth.uid() and public.can_manage_pautas())
        )
    )
    or exists (select 1 from public.pauta_members pm where pm.pauta_id = p_pauta_id and pm.profile_id = auth.uid())
$$;

-- Responsáveis: gestão plena, gestão do squad da pauta, ou quem criou (e gerencia pautas).
drop policy if exists "pauta_members_insert" on public.pauta_members;
drop policy if exists "pauta_members_update" on public.pauta_members;
drop policy if exists "pauta_members_delete" on public.pauta_members;

create policy "pauta_members_insert" on public.pauta_members for insert to authenticated
  with check (
    public.can_fully_manage_pauta()
    or public.is_pauta_squad_manager(pauta_id)
    or (public.can_manage_pautas() and public.is_pauta_creator(pauta_id))
  );
create policy "pauta_members_update" on public.pauta_members for update to authenticated
  using (
    public.can_fully_manage_pauta()
    or public.is_pauta_squad_manager(pauta_id)
    or (public.can_manage_pautas() and public.is_pauta_creator(pauta_id))
  )
  with check (
    public.can_fully_manage_pauta()
    or public.is_pauta_squad_manager(pauta_id)
    or (public.can_manage_pautas() and public.is_pauta_creator(pauta_id))
  );
create policy "pauta_members_delete" on public.pauta_members for delete to authenticated
  using (
    public.can_fully_manage_pauta()
    or public.is_pauta_squad_manager(pauta_id)
    or (public.can_manage_pautas() and public.is_pauta_creator(pauta_id))
  );

-- ---------------------------------------------------------------------------
-- Campos fechados (só quem criou ou a gestão do squad) × abertos (quem está na pauta)
-- ---------------------------------------------------------------------------

create or replace function public.pautas_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or public.can_fully_manage_pauta()
     or (not old.is_standalone and public.manages_pauta_squad(old.squad)) then
    return new;
  end if;

  if new.is_standalone and new.created_for = auth.uid() then
    return new;
  end if;

  if old.created_by = auth.uid() and public.can_manage_pautas() then
    return new;
  end if;

  if new.title is distinct from old.title
     or new.briefing is distinct from old.briefing
     or new.lead_id is distinct from old.lead_id
     or new.priority is distinct from old.priority
     or new.is_critical is distinct from old.is_critical
     or new.project_id is distinct from old.project_id
     or new.direct_company_id is distinct from old.direct_company_id
     or new.contact_id is distinct from old.contact_id
     or new.location_address is distinct from old.location_address
     or new.scheduled_at is distinct from old.scheduled_at
     or new.duration_minutes is distinct from old.duration_minutes
     or new.start_date is distinct from old.start_date
     or new.due_time is distinct from old.due_time
     or new.capture_type is distinct from old.capture_type
     or new.format is distinct from old.format then
    raise exception 'Só quem criou a pauta edita esses dados. Você pode atualizar o status, os links e o andamento.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- View do quadro: cliente direto, hora do prazo e "com quem está a bola" no cliente
-- ---------------------------------------------------------------------------

drop view public.pautas_with_details;

create view public.pautas_with_details
with (security_invoker = true) as
select
  pt.*,
  pr.name as project_name,
  pr.is_internal as project_is_internal,
  coalesce(pr.company_id, pt.direct_company_id) as company_id,
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
  creator.full_name as created_for_name,
  c.logo_url as company_logo_url,
  fl.full_name as freelancer_name,
  fl.phone as freelancer_phone,
  waiting.full_name as waiting_on_contact_name,
  waiting.job_title as waiting_on_contact_role,
  author.full_name as created_by_name
from public.pautas pt
left join public.projects pr on pr.id = pt.project_id
left join public.companies c on c.id = coalesce(pr.company_id, pt.direct_company_id)
join public.profiles lead on lead.id = pt.lead_id
left join public.profiles assignee on assignee.id = pt.current_assignee_id
left join public.profiles creator on creator.id = pt.created_for
left join public.profiles author on author.id = pt.created_by
left join public.contacts ct on ct.id = pt.contact_id
left join public.contacts waiting on waiting.id = pt.waiting_on_contact_id
left join public.freelancers fl on fl.id = pt.freelancer_id
where pt.archived_at is null;

revoke all on public.pautas_with_details from anon;
grant select on public.pautas_with_details to authenticated;

-- Notificações de pauta abrem em Minhas Pautas (todo envolvido acessa; /pautas é só da gestão).
create or replace function public.pautas_notify_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deal_id is not null then
    return new;
  end if;

  if new.lead_id is distinct from auth.uid() then
    perform public.notify(new.lead_id, 'pauta_lead_assigned', 'Você é líder de uma pauta',
      new.title, 'pauta', new.id, '/minhas-pautas?pauta=' || new.id);
  end if;

  if new.current_assignee_id is not null
     and new.current_assignee_id is distinct from new.lead_id
     and new.current_assignee_id is distinct from auth.uid() then
    perform public.notify(new.current_assignee_id, 'pauta_assignee_changed', 'Você é responsável por uma pauta',
      new.title, 'pauta', new.id, '/minhas-pautas?pauta=' || new.id);
  end if;

  return new;
end;
$$;

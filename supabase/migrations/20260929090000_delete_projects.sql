-- Apagar projetos: master, diretoria e heads (o mesmo grupo que cria pautas — can_manage_pautas(),
-- mais o squad diretoria). Se o projeto já tem recebimentos ou pagamentos, só quem tem acesso ao
-- financeiro apaga — e esses lançamentos continuam no financeiro, sem projeto (FK on delete set null).
--
-- Ao apagar: pautas (com responsáveis, comentários e histórico), equipe do projeto e contrato
-- (project_financials) saem em cascata; compromissos da agenda ficam, sem projeto.

create or replace function public.can_delete_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_active_user()
    and (public.can_manage_pautas() or public.is_director())
    and (
      public.has_finance_access()
      or not (
        exists (select 1 from public.receivables r where r.project_id = p_project_id)
        or exists (select 1 from public.payables pa where pa.project_id = p_project_id)
      )
    )
$$;

revoke all on function public.can_delete_project(uuid) from public, anon;
grant execute on function public.can_delete_project(uuid) to authenticated;

drop policy if exists "projects_delete_directors" on public.projects;
drop policy if exists "projects_delete_managers" on public.projects;
create policy "projects_delete_managers" on public.projects for delete to authenticated
  using (public.can_delete_project(id));

-- O que some junto (para a confirmação). Contagens de lançamentos só para quem vê o financeiro.
create or replace function public.project_delete_summary(p_project_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not exists (select 1 from public.projects where id = p_project_id) then null else
    jsonb_build_object(
      'pautas', (select count(*) from public.pautas p where p.project_id = p_project_id),
      'members', (select count(*) from public.project_members m where m.project_id = p_project_id),
      'commitments', (select count(*) from public.commitments c where c.project_id = p_project_id and c.status <> 'cancelado'),
      'has_finance_records', (
        exists (select 1 from public.receivables r where r.project_id = p_project_id)
        or exists (select 1 from public.payables pa where pa.project_id = p_project_id)
      ),
      'receivables', case when public.has_finance_access()
        then (select count(*) from public.receivables r where r.project_id = p_project_id) end,
      'payables', case when public.has_finance_access()
        then (select count(*) from public.payables pa where pa.project_id = p_project_id) end,
      'can_delete', public.can_delete_project(p_project_id)
    )
  end
  where public.is_active_user()
$$;

revoke all on function public.project_delete_summary(uuid) from public, anon;
grant execute on function public.project_delete_summary(uuid) to authenticated;

-- Registro no log: quem apagou, nome e cliente do projeto.
create or replace function public.projects_log_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.log_activity(
    'deleted', 'project', old.id,
    jsonb_build_object('name', old.name, 'company_id', old.company_id, 'is_internal', old.is_internal)
  );
  return old;
end;
$$;

drop trigger if exists projects_log_delete on public.projects;
create trigger projects_log_delete
  after delete on public.projects
  for each row execute function public.projects_log_delete();

-- Quadro de Projetos (pedido do Anderson, 13/10/2026): três colunas — Ativos, Encerrados e Churn.
--
-- • Coluna de cada etapa (project_board_column; mesmos casos de lib/projects/board-cases.json):
--   churn → Churn; encerrado e cancelado → Encerrados; o resto → Ativos.
-- • project_board_move(projeto, coluna, motivo): muda a etapa e registra quem/quando/de onde/para onde em
--   project_stage_moves (imutável). Churn exige motivo. Encerrar pede confirmação na tela. Voltar para Ativos
--   devolve a etapa que o projeto tinha antes de sair (stage_before_close; sem ela, Pré-produção).
-- • Quem move: o mesmo de "Finalizar projeto" (responsável, gestão, quem gerencia pautas, financeiro).
-- • O "Encerrar" completo do cliente/projeto (financeiro, pautas, motivo de encerramento) continua o mesmo; o
--   quadro só muda a etapa.
--
-- Só adiciona colunas (nulas), uma tabela e funções. Nenhum dado existente muda.

alter table public.projects
  add column if not exists stage_before_close public.project_stage,
  add column if not exists churned_at timestamptz,
  add column if not exists churned_by uuid references public.profiles (id) on delete set null,
  add column if not exists churn_reason text check (churn_reason is null or length(churn_reason) <= 500);

create table public.project_stage_moves (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  from_stage public.project_stage not null,
  to_stage public.project_stage not null,
  to_column text not null check (to_column in ('ativos', 'encerrados', 'churn')),
  reason text check (reason is null or length(reason) <= 500),
  moved_by uuid references public.profiles (id) on delete set null,
  moved_at timestamptz not null default clock_timestamp()
);

create index project_stage_moves_project_idx on public.project_stage_moves (project_id, moved_at desc);

create function public.project_stage_moves_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Só a exclusão do próprio projeto (on delete cascade) apaga o histórico; alterar, nunca.
  raise exception 'O histórico de movimentos do projeto não pode ser alterado.' using errcode = '42501';
end;
$$;

create trigger project_stage_moves_immutable before update on public.project_stage_moves
  for each row execute function public.project_stage_moves_immutable();

alter table public.project_stage_moves enable row level security;

-- Lê quem enxerga o projeto (a RLS de projects vale dentro do exists).
create policy "project_stage_moves_select" on public.project_stage_moves for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));

revoke insert, update, delete, truncate on public.project_stage_moves from anon, authenticated;

create function public.project_board_column(p_stage public.project_stage)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_stage::text = 'churn' then 'churn'
    when p_stage::text in ('encerrado', 'cancelado') then 'encerrados'
    else 'ativos'
  end
$$;

grant execute on function public.project_board_column(public.project_stage) to authenticated;

create function public.project_board_move(p_project_id uuid, p_to text, p_reason text)
returns public.project_stage
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_from_column text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_to_stage public.project_stage;
begin
  if p_to not in ('ativos', 'encerrados', 'churn') then
    raise exception 'Coluna inválida.' using errcode = '22023';
  end if;
  if not public.can_finalize_project(p_project_id) then
    raise exception 'Só o responsável pelo projeto, a gestão ou o financeiro movem projetos no quadro.' using errcode = '42501';
  end if;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'Projeto não encontrado.' using errcode = 'P0002';
  end if;

  v_from_column := public.project_board_column(v_project.stage);
  if v_from_column = p_to then
    return v_project.stage;
  end if;
  if p_to = 'churn' and (v_reason is null or length(v_reason) < 3) then
    raise exception 'Informe o motivo do churn.' using errcode = '22023';
  end if;

  v_to_stage := case p_to
    when 'churn' then 'churn'::public.project_stage
    when 'encerrados' then 'encerrado'::public.project_stage
    else coalesce(v_project.stage_before_close, 'pre_producao'::public.project_stage)
  end;

  update public.projects
  set stage = v_to_stage,
      -- Sai de Ativos: guarda a etapa para poder voltar; volta para Ativos: limpa.
      stage_before_close = case when p_to = 'ativos' then null when v_from_column = 'ativos' then v_project.stage else stage_before_close end,
      closed_at = case when p_to = 'ativos' then null else coalesce(closed_at, now()) end,
      churned_at = case when p_to = 'churn' then now() else null end,
      churned_by = case when p_to = 'churn' then auth.uid() else null end,
      churn_reason = case when p_to = 'churn' then v_reason else null end
  where id = p_project_id;

  insert into public.project_stage_moves (project_id, from_stage, to_stage, to_column, reason, moved_by)
  values (p_project_id, v_project.stage, v_to_stage, p_to, v_reason, auth.uid());

  perform public.log_activity('board_moved', 'project', p_project_id,
    jsonb_build_object('from', v_project.stage, 'to', v_to_stage, 'reason', v_reason));
  return v_to_stage;
end;
$$;

revoke all on function public.project_board_move(uuid, text, text) from public, anon;
grant execute on function public.project_board_move(uuid, text, text) to authenticated;

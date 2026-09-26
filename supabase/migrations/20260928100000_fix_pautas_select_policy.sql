-- Corrige "Você não tem permissão para criar pautas de projeto" (inclusive para o master).
--
-- A policy de SELECT de pautas chamava can_view_pauta(id), que procura a pauta NA PRÓPRIA TABELA
-- (exists (select … from pautas p where p.id = …)). No INSERT … RETURNING, o Postgres confere a
-- linha nova contra a policy de SELECT — e, dentro do mesmo comando, a função ainda não enxerga a
-- linha recém-inserida. Resultado: a checagem dava falso e o insert era recusado (42501), mesmo com
-- a policy de INSERT satisfeita.
--
-- A policy passa a decidir pelas colunas da própria linha (sem procurá-la de novo); só as relações
-- externas (pauta_members, project_members) continuam em subconsultas. A regra é a mesma de
-- can_view_pauta(), que segue existindo para as tabelas filhas (comentários, histórico, membros).

drop policy if exists "pautas_select" on public.pautas;
create policy "pautas_select" on public.pautas for select to authenticated
  using (
    public.is_active_user()
    and (
      (not is_standalone and public.can_manage_pautas() and 'audiovisual' = any (public.managed_squads()))
      or lead_id = auth.uid()
      or current_assignee_id = auth.uid()
      or previous_assignee_id = auth.uid()
      or created_by = auth.uid()
      or created_for = auth.uid()
      or exists (select 1 from public.pauta_members pm where pm.pauta_id = pautas.id and pm.profile_id = auth.uid())
      or exists (select 1 from public.project_members prm where prm.project_id = pautas.project_id and prm.profile_id = auth.uid())
    )
  );

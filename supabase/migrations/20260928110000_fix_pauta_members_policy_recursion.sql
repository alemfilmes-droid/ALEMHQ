-- Corrige "Não foi possível carregar o quadro" (e listas de pautas vazias) depois da 20260928100000.
--
-- Recursão entre policies: a policy de SELECT de pautas consulta pauta_members, e a policy
-- "pauta_members_write" (FOR ALL — portanto também vale para SELECT) consultava pautas direto na
-- expressão. Uma chama a outra → "infinite recursion detected in policy for relation pautas".
--
-- Correção:
-- - A escrita em pauta_members vira três policies (INSERT, UPDATE, DELETE) — nenhuma se aplica à
--   leitura, que continua só com pauta_members_select (can_view_pauta, SECURITY DEFINER).
-- - "Quem criou a pauta" passa por uma função SECURITY DEFINER, que lê pautas sem passar pela RLS
--   (sem recursão, qualquer que seja a policy de pautas no futuro).

create or replace function public.is_pauta_creator(p_pauta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.pautas p where p.id = p_pauta_id and p.created_by = auth.uid())
$$;

revoke all on function public.is_pauta_creator(uuid) from public, anon;
grant execute on function public.is_pauta_creator(uuid) to authenticated;

drop policy if exists "pauta_members_write" on public.pauta_members;

create policy "pauta_members_insert" on public.pauta_members for insert to authenticated
  with check (public.can_fully_manage_pauta() or (public.can_manage_pautas() and public.is_pauta_creator(pauta_id)));

create policy "pauta_members_update" on public.pauta_members for update to authenticated
  using (public.can_fully_manage_pauta() or (public.can_manage_pautas() and public.is_pauta_creator(pauta_id)))
  with check (public.can_fully_manage_pauta() or (public.can_manage_pautas() and public.is_pauta_creator(pauta_id)));

create policy "pauta_members_delete" on public.pauta_members for delete to authenticated
  using (public.can_fully_manage_pauta() or (public.can_manage_pautas() and public.is_pauta_creator(pauta_id)));

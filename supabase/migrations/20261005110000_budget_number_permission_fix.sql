-- Correção: budgets.number tem como padrão budget_random_number(), e o padrão de coluna roda com a
-- permissão de quem insere. A função estava sem execute para authenticated — criar orçamento dava
-- "permission denied for function budget_random_number" ("Não foi possível criar o orçamento").
-- Ela só sorteia um número livre (security definer); liberar o execute não expõe nada.

grant execute on function public.budget_random_number() to authenticated;

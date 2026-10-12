-- Correção achada na publicação (Bloco 9): a view receivables_with_status foi recriada no Bloco 3B, ANTES da coluna
-- requires_invoice (Bloco 5) e das colunas de cancelamento (Bloco 6). Como `r.*` é expandido na criação, a view não
-- trazia "Nota fiscal: Sim/Não": a marca "Sem nota fiscal" não aparecia e editar um recebimento "Não" abria como
-- "Sim". Recria a view com o mesmo corpo (agora `r.*` inclui as colunas novas). Nenhum dado muda; nenhuma outra
-- view depende desta.

drop view if exists public.receivables_with_status;
create view public.receivables_with_status
with (security_invoker = true) as
select
  r.*,
  c.name as company_name,
  p.name as project_name,
  case
    when r.cancelled_at is not null then 'cancelado'
    when r.received_at is not null then 'recebido'
    when r.due_date < (now() at time zone 'America/Fortaleza')::date then 'atrasado'
    else 'pendente'
  end as status
from public.receivables r
left join public.companies c on c.id = r.company_id
left join public.projects p on p.id = r.project_id;

revoke all on public.receivables_with_status from anon;
grant select on public.receivables_with_status to authenticated;

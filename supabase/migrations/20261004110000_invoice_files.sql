-- Nota fiscal: arquivo anexado (PDF/XML/imagem da NFS-e) no recebimento e na emissão agendada do
-- projeto. Bucket privado "invoices": lê e envia quem tem acesso ao financeiro ou é da diretoria;
-- o download é por link assinado de curta duração (nunca público).
--
-- Caminhos: receivables/<receivable_id>/<arquivo> e issuances/<schedule_id>/<arquivo>.

alter table public.receivables add column invoice_file_path text check (invoice_file_path is null or length(invoice_file_path) <= 300);
alter table public.invoice_issuances add column file_path text check (file_path is null or length(file_path) <= 300);

-- Anexar a nota depois de marcar como emitida (antes só havia insert/delete).
create policy "invoice_issuances_update" on public.invoice_issuances for update to authenticated
  using (exists (
    select 1 from public.project_invoice_schedules s
    where s.id = schedule_id and (public.can_manage_invoices(s.project_id) or s.responsible_id = auth.uid())
  ))
  with check (exists (
    select 1 from public.project_invoice_schedules s
    where s.id = schedule_id and (public.can_manage_invoices(s.project_id) or s.responsible_id = auth.uid())
  ));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoices', 'invoices', false, 10485760,
  array['application/pdf', 'application/xml', 'text/xml', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy "invoices_select_finance" on storage.objects for select to authenticated
  using (bucket_id = 'invoices' and public.is_active_user() and (public.has_finance_access() or public.is_director()));
create policy "invoices_insert_finance" on storage.objects for insert to authenticated
  with check (bucket_id = 'invoices' and public.is_active_user() and (public.has_finance_access() or public.is_director()));
create policy "invoices_update_finance" on storage.objects for update to authenticated
  using (bucket_id = 'invoices' and public.is_active_user() and (public.has_finance_access() or public.is_director()));
create policy "invoices_delete_finance" on storage.objects for delete to authenticated
  using (bucket_id = 'invoices' and public.is_active_user() and (public.has_finance_access() or public.is_director()));

-- receivables_with_status usa "r.*", expandido na criação: recria para incluir invoice_file_path.
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

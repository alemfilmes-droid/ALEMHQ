-- Orçamentos (só o master). Substitui a planilha: catálogo de profissionais e custos, orçamento
-- por cliente com validade de 30 dias, itens com custo real, FEE da empresa e imposto definidos
-- por orçamento, e a apresentação comercial (modelo, cor da IDV, logo do cliente, textos).
--
-- Preço ao cliente de cada item = custo × (1 + FEE%) ÷ (1 − imposto%), salvo quando o item tem
-- preço fixado à mão. Assim o total ao cliente já embute o FEE e o imposto, e o lado interno mostra
-- custo, imposto e o que fica para a empresa em cada linha.

create type public.budget_item_section as enum ('profissional', 'custo');
create type public.budget_status as enum ('rascunho', 'enviado', 'aprovado', 'recusado');

-- Catálogo reaproveitável: a lista de serviços/profissionais e custos com valores padrão.
create table public.budget_catalog_items (
  id uuid primary key default gen_random_uuid(),
  section public.budget_item_section not null,
  name text not null check (length(btrim(name)) between 2 and 120),
  unit text not null default 'diária' check (length(unit) <= 30),
  default_cost numeric(14, 2) not null default 0 check (default_cost >= 0),
  notes text check (notes is null or length(notes) <= 500),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (section, name)
);

create sequence public.budget_number_seq;

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  number int not null unique default nextval('public.budget_number_seq'),
  company_id uuid references public.companies (id) on delete set null,
  client_name text not null check (length(btrim(client_name)) between 2 and 160),
  title text not null check (length(btrim(title)) between 2 and 160),
  issue_date date not null default ((now() at time zone 'America/Fortaleza')::date),
  valid_until date not null default ((now() at time zone 'America/Fortaleza')::date + 30),
  fee_pct numeric(5, 2) not null default 30 check (fee_pct >= 0 and fee_pct < 1000),
  tax_pct numeric(5, 2) not null default 6 check (tax_pct >= 0 and tax_pct < 100),
  status public.budget_status not null default 'rascunho',
  payment_terms text check (payment_terms is null or length(payment_terms) <= 1000),
  notes text check (notes is null or length(notes) <= 2000),
  -- Apresentação comercial: modelo, cor da IDV, logo do cliente e os textos do projeto.
  presentation jsonb not null default '{}'::jsonb check (jsonb_typeof(presentation) = 'object'),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  section public.budget_item_section not null,
  catalog_item_id uuid references public.budget_catalog_items (id) on delete set null,
  description text not null check (length(btrim(description)) between 1 and 160),
  unit text not null default 'diária' check (length(unit) <= 30),
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
  -- Preço unitário ao cliente fixado à mão (senão, calculado pelo FEE e imposto do orçamento).
  unit_price_override numeric(14, 2) check (unit_price_override is null or unit_price_override >= 0),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index budget_items_budget_idx on public.budget_items (budget_id, section, position);

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Perfil comercial da Além (usado nas apresentações): sobre a empresa e a mente por trás dela.
-- ---------------------------------------------------------------------------

alter table public.company_settings add column proposal_profile jsonb not null default '{}'::jsonb
  check (jsonb_typeof(proposal_profile) = 'object');

-- ---------------------------------------------------------------------------
-- RLS: tudo só do master.
-- ---------------------------------------------------------------------------

alter table public.budget_catalog_items enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_items enable row level security;

create policy "budget_catalog_master" on public.budget_catalog_items for all to authenticated
  using (public.is_master() and public.is_active_user()) with check (public.is_master() and public.is_active_user());
create policy "budgets_master" on public.budgets for all to authenticated
  using (public.is_master() and public.is_active_user()) with check (public.is_master() and public.is_active_user());
create policy "budget_items_master" on public.budget_items for all to authenticated
  using (public.is_master() and public.is_active_user()) with check (public.is_master() and public.is_active_user());

-- ---------------------------------------------------------------------------
-- Imagens da apresentação (logo do cliente, referências): leitura pública por URL, envio só master.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('budget-assets', 'budget-assets', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "budget_assets_insert_master" on storage.objects for insert to authenticated
  with check (bucket_id = 'budget-assets' and public.is_master());
create policy "budget_assets_update_master" on storage.objects for update to authenticated
  using (bucket_id = 'budget-assets' and public.is_master());
create policy "budget_assets_delete_master" on storage.objects for delete to authenticated
  using (bucket_id = 'budget-assets' and public.is_master());

-- Catálogo inicial (valores de custo zerados: o master preenche com os da Além).
insert into public.budget_catalog_items (section, name, unit) values
  ('profissional', 'Diretor(a)', 'diária'),
  ('profissional', 'Diretor(a) de fotografia', 'diária'),
  ('profissional', 'Filmmaker', 'diária'),
  ('profissional', 'Fotógrafo(a)', 'diária'),
  ('profissional', 'Assistente de produção', 'diária'),
  ('profissional', 'Produtor(a) executivo(a)', 'projeto'),
  ('profissional', 'Diretor(a) de arte', 'diária'),
  ('profissional', 'Roteirista', 'projeto'),
  ('profissional', 'Editor(a)', 'projeto'),
  ('profissional', 'Editor(a) motion', 'projeto'),
  ('profissional', 'Colorista', 'projeto'),
  ('profissional', 'Técnico(a) de som', 'diária'),
  ('profissional', 'Operador(a) de drone', 'diária'),
  ('custo', 'Refeição', 'unidade'),
  ('custo', 'Translado', 'unidade'),
  ('custo', 'Locação de equipamento', 'diária'),
  ('custo', 'Locação de espaço', 'diária'),
  ('custo', 'Hospedagem', 'diária'),
  ('custo', 'Trilha licenciada', 'unidade'),
  ('custo', 'Elenco / modelo', 'diária')
on conflict do nothing;

-- Prospecção (Módulo 5): pontos facultativos com "Pular na prospecção", feriados de Natal
-- confirmados e o campo de canal (spec 9.3: Instagram e ligação entram depois sem reestruturar).
-- Só acréscimos.
--
-- Rollback: alter table public.prospect_holidays drop column optional, drop column skip_prospecting;
-- alter table public.prospect_touch_logs drop column channel; alter table public.prospect_scripts
-- drop column channel (e recriar prospect_scripts_unique sem channel); drop type public.prospect_channel.

-- ---------------------------------------------------------------------------
-- Feriados
-- ---------------------------------------------------------------------------

alter table public.prospect_holidays
  -- Ponto facultativo (Carnaval, Corpus Christi): não é feriado, mas pode ser pulado.
  add column optional boolean not null default false,
  -- Desligado = o dia conta como útil na cadência (só faz sentido em ponto facultativo).
  add column skip_prospecting boolean not null default true;

update public.prospect_holidays
set optional = true
where not recurring and (name like 'Carnaval%' or name = 'Corpus Christi');

-- Natal confirmados pelo Anderson; o feriado estadual (RN) segue "a confirmar".
update public.prospect_holidays
set needs_confirmation = false
where recurring and scope = 'natal' and name in ('Santos Reis', 'Nossa Senhora da Apresentação');

-- ---------------------------------------------------------------------------
-- Canal do toque e do script (hoje só WhatsApp)
-- ---------------------------------------------------------------------------

create type public.prospect_channel as enum ('whatsapp');

alter table public.prospect_touch_logs add column channel public.prospect_channel not null default 'whatsapp';
alter table public.prospect_scripts add column channel public.prospect_channel not null default 'whatsapp';

-- Um script por posição e canal: o mesmo toque pode ter texto de WhatsApp e, no futuro, de Instagram.
alter table public.prospect_scripts drop constraint prospect_scripts_unique;
alter table public.prospect_scripts add constraint prospect_scripts_unique
  unique nulls not distinct (playbook_id, kind, touch_number, touch_zero_variant, audience, channel);

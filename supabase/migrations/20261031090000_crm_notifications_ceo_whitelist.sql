-- Notificações do CRM (pedido do Anderson, 13/10/2026). Espelho em lib/notifications/routing.ts; os mesmos casos
-- (lib/notifications/routing-cases.json) são conferidos nos dois lados.
--
-- • CEO (master) — lista branca: do CRM, só 'deal_qualification_review' (negócio qualificado, passou para ele
--   fechar) e 'deal_request_reply' (o comercial respondeu um direcionamento dele). Nada de prazo, alerta
--   automático ("Próxima ação vencida", "sem atualização há 24h"), follow-up, reunião marcada (vai para o Google
--   Agenda), "está com a bola" etc.
-- • Demais avisos do CRM: só para o comercial — papel SDR/BDR, squad Comercial ou cargo de Atendimento/Comercial
--   (ex.: Head Comercial). Prazos e alertas continuam só para quem está com a bola.
-- • "Do CRM": tipos deal_/crm_/prospect_, pautas do CRM e compromissos de reunião comercial (ou ligados a um
--   negócio).
-- • Limpeza (aprovada): as notificações do CRM do CEO que a regra nova não deixaria passar saem da lista dele.
--   Nada é apagado de vez: vão para notifications_archive (com o motivo). Notificações de outras pessoas não mudam.
--
-- Recria notification_rule (um parâmetro novo: quem recebe é do comercial) e notification_allowed.

create function public.notification_is_crm(p_type text, p_entity_is_crm boolean)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_type like 'deal\_%' or p_type like 'crm\_%' or p_type like 'prospect\_%'
    or (coalesce(p_entity_is_crm, false) and (p_type like 'pauta\_%' or p_type like 'commitment\_%'))
$$;

-- Regra pura (sem leitura de tabela).
create function public.notification_rule(
  p_recipient_is_ceo boolean,
  p_recipient_is_commercial boolean,
  p_type text,
  p_pauta_squad public.squad,
  p_entity_is_crm boolean,
  p_holds_ball boolean
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when public.notification_is_crm(p_type, p_entity_is_crm) then
      case
        when p_recipient_is_ceo then p_type in ('deal_qualification_review', 'deal_request_reply')
        when not coalesce(p_recipient_is_commercial, false) then false
        when p_type in ('pauta_due_today', 'pauta_overdue', 'pauta_client_followup', 'crm_action_overdue', 'crm_stale_prospection', 'crm_needs_update')
          then coalesce(p_holds_ball, false)
        else true
      end
    when not p_recipient_is_ceo then true
    -- CEO · metas e comissões (Bloco 7).
    when p_type in ('goal_review', 'goal_entry_pending', 'goal_commission_to_schedule') then true
    when p_type like 'goal\_%' then false
    when p_type in ('finance_commission', 'finance_commission_updated') then true
    -- CEO · financeiro: só alertas de atraso.
    when p_type in ('finance_overdue_receivable', 'finance_overdue_payable') then true
    when p_type like 'finance\_%' then false
    -- CEO · pautas (fora do CRM): audiovisual e diretoria; comercial e financeiro não chegam.
    when p_type like 'pauta\_%' then coalesce(p_pauta_squad::text, 'audiovisual') not in ('comercial', 'financeiro')
    else true
  end
$$;

-- Comercial: papel SDR/BDR, squad Comercial ou cargo de Atendimento/Comercial (mesma regra de isCommercialRecipient).
create function public.is_commercial_recipient(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_profile_id
      and (
        p.access_role in ('sdr', 'bdr')
        or exists (select 1 from public.profile_squads ps where ps.profile_id = p.id and ps.squad = 'comercial')
        or coalesce(p.job_title, '') ~* '(atendimento|comercial|\msdr\M|\mbdr\M)'
      )
  )
$$;

revoke all on function public.is_commercial_recipient(uuid) from public, anon, authenticated;

-- A entidade da notificação é do CRM? (pauta de negócio; reunião comercial ou compromisso de um negócio)
create function public.notification_entity_is_crm(p_entity_type text, p_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_entity_id is null then null
    when p_entity_type = 'pauta' then (select pt.source = 'crm' from public.pautas pt where pt.id = p_entity_id)
    when p_entity_type = 'commitment' then (select c.kind = 'reuniao_comercial' or c.deal_id is not null from public.commitments c where c.id = p_entity_id)
  end
$$;

revoke all on function public.notification_entity_is_crm(text, uuid) from public, anon, authenticated;

create or replace function public.notification_allowed(p_recipient uuid, p_type text, p_entity_type text, p_entity_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_is_ceo boolean;
  v_squad public.squad;
  v_holds boolean;
begin
  select coalesce(p.org_level = 'master', false) into v_is_ceo from public.profiles p where p.id = p_recipient;
  if p_entity_type = 'pauta' and p_entity_id is not null then
    select pt.squad, pt.current_assignee_id is not distinct from p_recipient
    into v_squad, v_holds
    from public.pautas pt where pt.id = p_entity_id;
  elsif p_entity_type = 'deal' and p_entity_id is not null then
    select coalesce(d.responsible_id, d.owner_id) is not distinct from p_recipient into v_holds
    from public.deals d where d.id = p_entity_id;
  end if;
  return public.notification_rule(
    coalesce(v_is_ceo, false),
    public.is_commercial_recipient(p_recipient),
    p_type,
    v_squad,
    public.notification_entity_is_crm(p_entity_type, p_entity_id),
    v_holds
  );
end;
$$;

-- A regra antiga (5 parâmetros) só era usada por notification_allowed.
drop function public.notification_rule(boolean, text, public.squad, boolean, boolean);

-- ---------------------------------------------------------------------------
-- Limpeza: CRM do CEO fora da regra nova → arquivo
-- ---------------------------------------------------------------------------

create table public.notifications_archive (
  like public.notifications including defaults,
  archived_at timestamptz not null default now(),
  archive_reason text not null
);

alter table public.notifications_archive add primary key (id);
alter table public.notifications_archive enable row level security;

-- Só leitura, de quem recebeu (para conferência); ninguém escreve pela API.
create policy "notifications_archive_select_own" on public.notifications_archive for select to authenticated
  using (recipient_id = auth.uid());

revoke insert, update, delete, truncate on public.notifications_archive from anon, authenticated;

with moved as (
  delete from public.notifications n
  using public.profiles p
  where p.id = n.recipient_id
    and p.org_level = 'master'
    and public.notification_is_crm(n.type, public.notification_entity_is_crm(n.entity_type, n.entity_id))
    and not public.notification_allowed(n.recipient_id, n.type, n.entity_type, n.entity_id)
  returning n.*
)
insert into public.notifications_archive
select moved.*, now(), 'CRM: CEO recebe só "negócio qualificado" e "resposta no direcionamento" (13/10/2026)'
from moved;

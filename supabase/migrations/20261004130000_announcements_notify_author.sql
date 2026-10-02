-- Avisos: quem publica também recebe a notificação (sino e push), mesmo fora do público escolhido.
-- Antes o autor ficava de fora.

create or replace function public.publish_due_announcements()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_announcement record;
  v_count int := 0;
begin
  if not public.is_active_user() then
    return 0;
  end if;

  perform set_config('app.publishing_announcements', 'on', true);

  for v_announcement in
    select a.*
    from public.announcements a
    where a.notified_at is null
      and a.archived_at is null
      and a.published_at <= now()
      and (a.expires_at is null or now() < a.expires_at)
    for update skip locked
  loop
    insert into public.notifications (recipient_id, type, title, body, entity_type, entity_id, url)
    select
      p.id,
      'announcement_published',
      'Novo aviso: ' || v_announcement.title,
      left(regexp_replace(v_announcement.body, '[*_#>\[\]()`-]', '', 'g'), 180),
      'announcement',
      v_announcement.id,
      '/avisos?aviso=' || v_announcement.id
    from public.profiles p
    where p.is_active
      and (
        -- Quem publicou também recebe (no sino e no celular), para conferir como chegou.
        p.id = v_announcement.author_id
        or (
          (cardinality(v_announcement.audience_squads) = 0 or exists (
            select 1 from public.profile_squads ps where ps.profile_id = p.id and ps.squad = any (v_announcement.audience_squads)
          ))
          and (cardinality(v_announcement.audience_levels) = 0 or p.org_level = any (v_announcement.audience_levels))
        )
      );

    update public.announcements set notified_at = now() where id = v_announcement.id;
    v_count := v_count + 1;
  end loop;

  perform set_config('app.publishing_announcements', 'off', true);

  return v_count;
end;
$$;

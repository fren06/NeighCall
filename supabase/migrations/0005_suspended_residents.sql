-- Suspended residents: read-only instead of locked out.
--
-- A suspended resident can still open the app and read the feed, bulletins,
-- their chats and notifications, so they understand what happened. Every
-- action (posting, offering help, messaging, sharing details, reporting,
-- uploading photos) still goes through require_approved() and is refused,
-- now with a message that says they're suspended. They get a notification
-- when they're suspended and when their access is restored.

-- Approved or suspended: may read their estate, may not act.
create function is_member() returns boolean language sql stable security definer set search_path = public
  as $$ select coalesce((select status in ('approved', 'suspended') from users where id = auth.uid()), false) $$;

-- ─── Reading ──────────────────────────────────────────────────────────────

create or replace view feed_posts as
  select p.id, p.estate_id, p.content, p.media_url, p.category, p.tools_needed,
         p.urgency, p.punchline, p.status, p.created_at,
         p.is_anonymous, p.anon_alias,
         case when p.is_anonymous then null else u.name  end as author_name,
         case when p.is_anonymous then null else u.block end as author_block,
         (p.author_id = auth.uid()) as is_mine,
         (select count(*) from conversations c where c.post_id = p.id) as helper_count
  from posts p join users u on u.id = p.author_id
  where p.estate_id = my_estate() and is_member();

drop policy bulletin_read on bulletins;
create policy bulletin_read on bulletins for select using (estate_id = my_estate() and is_member());

-- ─── Acting: a clear reason when it's refused ─────────────────────────────

create or replace function require_approved() returns users
language plpgsql stable security definer set search_path = public as $$
declare v users;
begin
  select * into v from users where id = auth.uid();
  if v.status = 'suspended' then
    raise exception 'Your account is suspended, so you can''t post, offer help or send messages. Contact your estate management office for help.'
      using errcode = '42501';
  end if;
  if v.id is null or v.status <> 'approved' then
    raise exception 'Your account is not approved yet' using errcode = '42501';
  end if;
  return v;
end $$;

-- ─── Notifications ────────────────────────────────────────────────────────
-- The inbox ping also tells the resident's app to re-check their status,
-- so the "suspended" notice appears (and disappears) without a restart.

create function notify_suspension() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'suspended' then
    perform notify_users(array[new.id], 'account', 'Your account has been suspended',
      coalesce(nullif(trim(new.admin_note), ''),
               'Estate management has suspended your account.')
        || ' You can still read the feed, but you can''t post, offer help or send messages.',
      '/home');
  else  -- suspended → approved
    perform notify_users(array[new.id], 'account', 'Your access has been restored',
      'You can post, offer help and message your neighbours again.', '/home');
  end if;
  return null;
exception when others then
  raise warning 'notify_suspension failed: %', sqlerrm;  -- never block the change itself
  return null;
end $$;

create trigger users_notify_suspension after update of status on users
  for each row when (new.role = 'resident' and old.status is distinct from new.status
                     and (new.status = 'suspended'
                          or (old.status = 'suspended' and new.status = 'approved')))
  execute function notify_suspension();

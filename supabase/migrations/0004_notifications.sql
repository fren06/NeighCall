-- In-app notifications: the bell on the resident home screen.
--
-- Triggers write a row per recipient and send a content-free "changed" ping
-- on "inbox:<user id>" (same approach as the chat and feed), so the unread
-- badge updates live. Residents only ever read their own rows. Nothing
-- leaves Supabase: no push service or device registration involved.

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users on delete cascade,
  kind       text not null check (kind in ('skill_match', 'offer', 'message', 'bulletin', 'account')),
  title      text not null,
  body       text,
  url        text,          -- the screen to open, e.g. /post/<id>
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_recent on notifications (user_id, created_at desc);

alter table notifications enable row level security;
create policy notifications_own on notifications for select using (user_id = auth.uid());
revoke all on notifications from anon, authenticated;
grant select on notifications to authenticated;

-- ─── Helpers ──────────────────────────────────────────────────────────────

create function ping_inbox(p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send('{}'::jsonb, 'changed', 'inbox:' || p_user_id::text, false);
exception when others then
  raise warning 'inbox ping failed: %', sqlerrm;
end $$;

create function notify_users(p_user_ids uuid[], p_kind text, p_title text, p_body text, p_url text)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into notifications (user_id, kind, title, body, url)
  select distinct u, p_kind, p_title, p_body, p_url from unnest(p_user_ids) u where u is not null;
  foreach v_id in array coalesce(p_user_ids, '{}') loop
    perform ping_inbox(v_id);
  end loop;
end $$;

-- Only the triggers below create notifications.
revoke execute on function ping_inbox(uuid) from public, anon, authenticated;
revoke execute on function notify_users(uuid[], text, text, text, text) from public, anon, authenticated;

-- Marks the caller's notifications read: all of them, or only those for one
-- screen (opening a chat clears its message notifications).
create function mark_notifications_read(p_url text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  update notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_url is null or url = p_url);
  if found then perform ping_inbox(auth.uid()); end if;
end $$;

-- ─── 1. New request → neighbours with the matching skill ─────────────────

create function notify_new_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notify_users(
    array(select u.id from users u
          where u.estate_id = new.estate_id and u.id <> new.author_id
            and u.role = 'resident' and u.status = 'approved'
            and new.category = any (u.skills)
            and coalesce((u.notifications->>'skill_matches')::boolean, true)),
    'skill_match',
    case when new.urgency = 'high' then 'Urgent: a neighbour needs help'
         else 'A neighbour needs your skills' end,
    -- The punchline never names an anonymous author.
    coalesce(new.punchline, left(new.content, 120)),
    '/post/' || new.id);
  return null;
exception when others then
  raise warning 'notify_new_post failed: %', sqlerrm;  -- never block the post itself
  return null;
end $$;

create trigger posts_notify after insert on posts
  for each row execute function notify_new_post();

-- ─── 2. Chat → the other person ───────────────────────────────────────────

create function notify_chat_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c       conversations;
  p       posts;
  v_to    uuid;
  v_from  text;
  v_url   text;
  v_body  text;
begin
  select * into c from conversations where id = new.conversation_id;
  select * into p from posts where id = c.post_id;
  v_to  := case when new.sender_id = c.requester_id then c.helper_id else c.requester_id end;
  v_url := '/chat/' || c.id;

  -- Same rule as the chat screen: an anonymous requester is shown by their
  -- alias until they share their details.
  v_from := case
    when new.sender_id = c.requester_id and p.is_anonymous and not c.is_identity_revealed
         and new.type <> 'identity_card'
      then coalesce(p.anon_alias, 'A neighbour')
    else (select name from users where id = new.sender_id) end;

  if new.type = 'system' then
    perform notify_users(array[v_to], 'offer', v_from || ' offered to help',
      coalesce(p.punchline, left(p.content, 120)), v_url);
    return null;
  end if;

  v_body := case when new.type = 'identity_card' then 'Shared their contact details with you'
                 else left(new.text, 150) end;

  -- One unread entry per chat: a new message updates it instead of piling up.
  update notifications set title = v_from, body = v_body, created_at = now()
  where user_id = v_to and kind = 'message' and url = v_url and read_at is null;
  if found then
    perform ping_inbox(v_to);
  else
    perform notify_users(array[v_to], 'message', v_from, v_body, v_url);
  end if;
  return null;
exception when others then
  raise warning 'notify_chat_message failed: %', sqlerrm;
  return null;
end $$;

create trigger messages_notify after insert on messages
  for each row execute function notify_chat_message();

-- ─── 3. Bulletins → residents of the estate ───────────────────────────────

create function notify_bulletin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notify_users(
    array(select u.id from users u
          where u.estate_id = new.estate_id and u.role = 'resident' and u.status = 'approved'),
    'bulletin',
    case when new.is_high_priority then 'Important: ' else 'Notice: ' end || new.title,
    left(new.body, 150),
    '/home');
  return null;
exception when others then
  raise warning 'notify_bulletin failed: %', sqlerrm;
  return null;
end $$;

create trigger bulletins_notify after insert on bulletins
  for each row execute function notify_bulletin();

-- ─── 4. Account approved → a welcome in their inbox ───────────────────────

create function notify_account_approved() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notify_users(array[new.id], 'account', 'Welcome to NeighCall!',
    'Your account has been approved. Say hello to your neighbours.', '/home');
  return null;
exception when others then
  raise warning 'notify_account_approved failed: %', sqlerrm;
  return null;
end $$;

create trigger users_notify_approved after update of status on users
  for each row when (new.status = 'approved' and old.status in ('pending', 'needs_info')
                     and new.role = 'resident')
  execute function notify_account_approved();

-- NeighCall 0002: security fixes + server-side functions, on top of 0001_init.
--
-- 0001 let the app read and write some tables directly in ways that would
-- leak who wrote an anonymous post, or let residents skip verification.
-- This file closes those gaps. Sensitive actions now go through functions
-- (called from the app with `supabase.rpc('name', {...})`) that run with
-- elevated rights, check who is calling, and return only what they may see.
--
-- Run once, after 0001, in the Supabase SQL Editor.

-- ─── 1. Helpers ───────────────────────────────────────────────────────────

create function is_admin() returns boolean language sql stable security definer set search_path = public
  as $$ select coalesce((select role = 'admin' from users where id = auth.uid()), false) $$;

-- The caller's profile, or an error if they can't use the app yet.
create function require_approved() returns users language plpgsql stable security definer set search_path = public as $$
declare v users;
begin
  select * into v from users where id = auth.uid();
  if v.id is null or v.status <> 'approved' then
    raise exception 'Your account is not approved yet' using errcode = '42501';
  end if;
  return v;
end $$;

create function require_staff() returns users language plpgsql stable security definer set search_path = public as $$
declare v users := require_approved();
begin
  if v.role = 'resident' then raise exception 'Staff access only' using errcode = '42501'; end if;
  return v;
end $$;

-- ─── 2. Table privileges ──────────────────────────────────────────────────
-- Start from nothing and grant only what the app uses directly. Everything
-- else goes through the functions below. This works whether or not
-- "Automatically expose new tables" was ticked when the project was created.

revoke all on all tables in schema public from anon, authenticated;

grant select on estates to anon, authenticated;            -- sign-up screen lists estates
grant select on users, posts, bulletins, reports, feed_posts to authenticated;
-- Which of these a given person may change is enforced by the trigger in §3.
grant update (name, phone, block, unit_number, street, skills, notifications,
              push_token, status, admin_note, role) on users to authenticated;
grant update (status) on posts to authenticated;           -- authors move open → resolved
grant delete on posts to authenticated;
grant insert, delete on bulletins to authenticated;
-- conversations and messages: no direct access at all (see §5).

-- ─── 3. Users ─────────────────────────────────────────────────────────────

-- Profiles are created by the sign-up trigger below, never by the app.
drop policy users_self_insert on users;
-- Was "staff can write anyone": management could edit residents or make
-- themselves admin. Now only admins edit others, and never other admins.
drop policy users_staff_write on users;
create policy users_admin_update on users for update
  using (is_admin() and estate_id = my_estate() and role <> 'admin')
  with check (estate_id = my_estate() and role <> 'admin');

-- Who may change which column. Runs as the caller, so the trusted functions
-- in this file and the SQL Editor (which run as the table owner) skip it.
create or replace function lock_user_privileged_columns() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if (new.id, new.estate_id, new.email) is distinct from (old.id, old.estate_id, old.email) then
    raise exception 'Estate and email cannot be changed here';
  end if;
  -- An admin editing someone else (RLS already limits it to their estate).
  if old.id <> auth.uid() then
    return new;
  end if;
  -- Editing your own account.
  if new.role is distinct from old.role then
    raise exception 'You cannot change your own role';
  end if;
  if new.status is distinct from old.status then
    -- Resubmitting after "needs more info" is the only allowed change.
    if not (old.status = 'needs_info' and new.status = 'pending') then
      raise exception 'You cannot change your own status';
    end if;
    new.admin_note := null;
  elsif new.admin_note is distinct from old.admin_note then
    raise exception 'You cannot change the management note';
  end if;
  -- Name and address were verified by management; locked once approved.
  if old.status not in ('pending', 'needs_info')
     and (new.name, new.block, new.unit_number, new.street)
         is distinct from (old.name, old.block, old.unit_number, old.street) then
    raise exception 'Verified name and address can only be changed by management';
  end if;
  return new;
end $$;

-- Creates the profile row from the sign-up form (passed as user metadata),
-- so it works even when email confirmation is on and there is no session yet.
-- Role and status always start as resident / pending.
create function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}');
begin
  -- Only app sign-ups carry estate details. Accounts added in the dashboard
  -- (e.g. the first admin) get their profile row added by hand.
  if m ? 'estate_id' then
    insert into users (id, estate_id, name, email, phone, block, unit_number, street, skills)
    values (
      new.id,
      (m->>'estate_id')::uuid,
      coalesce(m->>'name', ''),
      lower(new.email),
      coalesce(m->>'phone', ''),
      coalesce(m->>'block', ''),
      coalesce(m->>'unit_number', ''),
      coalesce(m->>'street', ''),
      array(select jsonb_array_elements_text(coalesce(m->'skills', '[]')))
    );
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_auth_user();

-- Deleting staff who wrote bulletins or handled reports shouldn't be blocked.
alter table bulletins alter column admin_id drop not null;
alter table bulletins drop constraint bulletins_admin_id_fkey,
  add constraint bulletins_admin_id_fkey foreign key (admin_id) references users on delete set null;
alter table reports drop constraint reports_handled_by_fkey,
  add constraint reports_handled_by_fkey foreign key (handled_by) references users on delete set null;

-- ─── 4. Posts ─────────────────────────────────────────────────────────────

-- Posts are created through create_post() so the server picks the alias.
drop policy posts_insert on posts;
-- Authors may only change status (column grant in §2), never ownership.
drop policy posts_author_update on posts;
create policy posts_author_update on posts for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());

-- Residents can't read other users, so the count happens here.
create function count_skill_matches(p_category text) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from users
  where is_approved()
    and estate_id = my_estate() and id <> auth.uid()
    and role = 'resident' and status = 'approved'
    and p_category = any (skills)
$$;

-- Analysis fields come from the app's (mock) AI for now; an Edge Function
-- will fill them server-side later.
create function create_post(
  p_content      text,
  p_is_anonymous boolean,
  p_media_url    text    default null,
  p_category     text    default null,
  p_tools_needed text[]  default '{}',
  p_urgency      text    default null,
  p_punchline    text    default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me    users := require_approved();
  v_alias text;
  v_id    uuid;
  v_tries int := 0;
begin
  if length(trim(p_content)) < 15 then
    raise exception 'Describe your request in at least 15 characters';
  end if;
  if p_is_anonymous then
    loop
      v_tries := v_tries + 1;
      -- 3-digit aliases first, longer ones if an estate runs out.
      v_alias := 'Neighbor #' || case when v_tries <= 20
        then (100 + floor(random() * 900))::int
        else (1000 + floor(random() * 99000))::int end;
      exit when not exists (
        select 1 from posts where estate_id = v_me.estate_id and anon_alias = v_alias);
    end loop;
  end if;

  insert into posts (estate_id, author_id, is_anonymous, anon_alias, content, media_url,
                     category, tools_needed, urgency, punchline)
  values (v_me.estate_id, v_me.id, p_is_anonymous, v_alias, trim(p_content), p_media_url,
          p_category, coalesce(p_tools_needed, '{}'), p_urgency, p_punchline)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'notified', count_skill_matches(p_category));
end $$;

-- ─── 5. Chat ──────────────────────────────────────────────────────────────
-- Reading conversations/messages directly would show the helper the
-- anonymous requester's user id (and let them link that person's anonymous
-- posts together). So the app gets chats only through these functions, which
-- label senders as me / them / system.

drop policy conv_read on conversations;
drop policy conv_insert on conversations;
drop policy conv_reveal on conversations;
drop policy msg_read on messages;
drop policy msg_insert on messages;
-- Row-change events would carry sender ids too; live updates use a content-free
-- "something changed" ping instead (see ping_chat below).
alter publication supabase_realtime drop table messages, conversations;

create function chat_message(m messages) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', m.id,
    'from', case when m.type = 'system' then 'system'
                 when m.sender_id = auth.uid() then 'me' else 'them' end,
    'type', m.type,
    'text', m.text,
    'identity_card', m.identity_card,
    'created_at', m.created_at))
$$;

-- The other person is shown by name, except an anonymous requester who
-- hasn't shared their details yet (helpers are always shown by name).
create function chat_summary(c conversations) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', c.id,
    'post_id', c.post_id,
    'post_title', coalesce(p.punchline, left(p.content, 60)),
    'my_role', case when c.requester_id = auth.uid() then 'requester' else 'helper' end,
    'peer', case
      when c.requester_id = auth.uid()
        then jsonb_build_object('kind', 'public', 'name', h.name, 'block', h.block)
      when p.is_anonymous and not c.is_identity_revealed
        then jsonb_build_object('kind', 'anonymous', 'alias', p.anon_alias)
      else jsonb_build_object('kind', 'public', 'name', r.name, 'block', r.block) end,
    'is_anonymous_post', p.is_anonymous,
    'is_identity_revealed', c.is_identity_revealed,
    'last_message', (select chat_message(m) from messages m
                     where m.conversation_id = c.id order by m.created_at desc limit 1),
    'updated_at', coalesce((select max(m.created_at) from messages m
                            where m.conversation_id = c.id), c.created_at)))
  from posts p
  join users h on h.id = c.helper_id
  join users r on r.id = c.requester_id
  where p.id = c.post_id
$$;

-- These take whole rows as input, so they must not be callable from the app
-- (a crafted row could reveal an anonymous requester).
revoke execute on function chat_message(messages), chat_summary(conversations)
  from public, anon, authenticated;

create function get_my_conversations() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(s order by s->>'updated_at' desc), '[]')
  from (select chat_summary(c) as s from conversations c
        where auth.uid() in (c.requester_id, c.helper_id)) x
$$;

create function get_conversation(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c conversations;
begin
  select * into c from conversations
  where id = p_id and auth.uid() in (requester_id, helper_id);
  if c.id is null then raise exception 'Conversation not found'; end if;
  return jsonb_build_object(
    'summary', chat_summary(c),
    'messages', coalesce((select jsonb_agg(chat_message(m) order by m.created_at)
                          from messages m where m.conversation_id = c.id), '[]'));
end $$;

-- Opens (or reuses) the helper's chat with the post's author. The helper
-- never needs to know who the author is.
create function offer_help(p_post_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me users := require_approved();
  p    posts;
  v_id uuid;
begin
  select * into p from posts where id = p_post_id and estate_id = v_me.estate_id;
  if p.id is null then raise exception 'Post not found'; end if;
  if p.author_id = v_me.id then raise exception 'You can''t offer help on your own post'; end if;

  select id into v_id from conversations where post_id = p.id and helper_id = v_me.id;
  if v_id is not null then return v_id; end if;
  if p.status = 'resolved' then raise exception 'This request is already resolved'; end if;

  insert into conversations (post_id, requester_id, helper_id)
  values (p.id, p.author_id, v_me.id) returning id into v_id;
  insert into messages (conversation_id, sender_id, type, text)
  values (v_id, v_me.id, 'system', v_me.name || ' offered to help with this request.');
  return v_id;
end $$;

create function send_message(p_conversation_id uuid, p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare v_me users := require_approved();
begin
  if not in_conversation(p_conversation_id) then raise exception 'Conversation not found'; end if;
  if length(trim(coalesce(p_text, ''))) = 0 then raise exception 'Message is empty'; end if;
  if length(p_text) > 2000 then raise exception 'Message is too long'; end if;
  insert into messages (conversation_id, sender_id, type, text)
  values (p_conversation_id, v_me.id, 'text', trim(p_text));
end $$;

-- The card is built from the verified profile, so it can't be faked.
-- Only the requester sharing lifts their anonymity.
create function share_identity(p_conversation_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me users := require_approved();
  c    conversations;
begin
  select * into c from conversations
  where id = p_conversation_id and v_me.id in (requester_id, helper_id);
  if c.id is null then raise exception 'Conversation not found'; end if;
  if exists (select 1 from messages where conversation_id = c.id
             and sender_id = v_me.id and type = 'identity_card') then
    return;  -- already shared
  end if;
  if c.requester_id = v_me.id then
    update conversations set is_identity_revealed = true where id = c.id;
  end if;
  insert into messages (conversation_id, sender_id, type, identity_card)
  values (c.id, v_me.id, 'identity_card', jsonb_build_object(
    'name', v_me.name, 'block', v_me.block,
    'unit_number', v_me.unit_number, 'phone', v_me.phone));
end $$;

-- Live updates: tell open chat screens to refetch. The payload is empty on
-- purpose; the conversation id in the channel name is unguessable.
create function ping_chat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send('{}'::jsonb, 'changed', 'chat:' || new.conversation_id::text, false);
  return null;
exception when others then
  raise warning 'chat ping failed: %', sqlerrm;  -- never block sending a message
  return null;
end $$;

create trigger messages_ping after insert on messages
  for each row execute function ping_chat();

-- ─── 6. Reports & moderation ──────────────────────────────────────────────

drop policy report_insert on reports;
drop policy report_staff on reports;
create policy report_staff_read on reports for select
  using (is_staff() and estate_id = my_estate());

-- Residents may report a post in their estate or a message in their own chat.
create function create_report(p_target_type report_target, p_target_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_me users := require_approved();
begin
  if p_target_type = 'post' and not exists (
       select 1 from posts where id = p_target_id and estate_id = v_me.estate_id)
  or p_target_type = 'message' and not exists (
       select 1 from messages m where m.id = p_target_id and in_conversation(m.conversation_id))
  or p_target_type = 'user' then
    raise exception 'Nothing to report';
  end if;
  insert into reports (estate_id, reporter_id, target_type, target_id, reason)
  values (v_me.estate_id, v_me.id, p_target_type, p_target_id,
          coalesce(nullif(trim(p_reason), ''), 'No reason given'));
end $$;

-- Reports the other person in a chat without the app knowing their user id.
create function report_chat_peer(p_conversation_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me users := require_approved();
  c    conversations;
begin
  select * into c from conversations
  where id = p_conversation_id and v_me.id in (requester_id, helper_id);
  if c.id is null then raise exception 'Conversation not found'; end if;
  insert into reports (estate_id, reporter_id, target_type, target_id, reason)
  values (v_me.estate_id, v_me.id, 'user',
          case when c.requester_id = v_me.id then c.helper_id else c.requester_id end,
          coalesce(nullif(trim(p_reason), ''), 'No reason given'));
end $$;

-- What a report points at. Staff can see through anonymity.
create function report_target_info(r reports)
returns table (excerpt text, offender_id uuid, post_exists boolean)
language sql stable security definer set search_path = public as $$
  select
    case r.target_type
      when 'post' then coalesce((select content from posts where id = r.target_id),
                                'This post has been removed.')
      when 'message' then coalesce((select coalesce(text, 'Shared details card')
                                    from messages where id = r.target_id),
                                   'This message is no longer available.')
      else coalesce((select 'Account: ' || name from users where id = r.target_id),
                    'Unknown account') end,
    case r.target_type
      when 'post' then (select author_id from posts where id = r.target_id)
      when 'message' then (select sender_id from messages where id = r.target_id)
      else (select id from users where id = r.target_id) end,
    r.target_type = 'post' and exists (select 1 from posts where id = r.target_id)
$$;
revoke execute on function report_target_info(reports) from public, anon, authenticated;

-- The report queue with context (shape of ReportDetail in types/models.ts).
create function get_report_details() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_me users := require_staff();
begin
  return coalesce((
    select jsonb_agg(d order by d->'report'->>'created_at' desc)
    from (
      select jsonb_strip_nulls(jsonb_build_object(
        'report', to_jsonb(r) - 'estate_id',
        'reporter_name', coalesce(rep.name, 'Unknown'),
        'target_excerpt', t.excerpt,
        'offender', case when o.id is not null then jsonb_build_object(
          'id', o.id, 'name', o.name, 'block', o.block, 'status', o.status) end,
        'post_exists', t.post_exists)) as d
      from reports r
      cross join lateral report_target_info(r) t
      left join users rep on rep.id = r.reporter_id
      left join users o on o.id = t.offender_id
      where r.estate_id = v_me.estate_id
    ) x), '[]');
end $$;

create function set_report_status(p_report_id uuid, p_status report_status) returns void
language plpgsql security definer set search_path = public as $$
declare v_me users := require_staff();
begin
  update reports set status = p_status, handled_by = v_me.id
  where id = p_report_id and estate_id = v_me.estate_id;
  if not found then raise exception 'Report not found'; end if;
end $$;

-- One-click moderation. Acting on a report also resolves it.
create function moderate(p_report_id uuid, p_action text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_me      users := require_staff();
  r         reports;
  t         record;
  v_name    text;
  v_outcome text;
begin
  select * into r from reports where id = p_report_id and estate_id = v_me.estate_id;
  if r.id is null then raise exception 'Report not found'; end if;
  select * into t from report_target_info(r);

  if p_action = 'delete_post' then
    if not t.post_exists then raise exception 'That post is already gone'; end if;
    delete from posts where id = r.target_id;
    v_outcome := 'Post deleted';
  elsif p_action in ('warn_user', 'suspend_user') then
    select name into v_name from users
    where id = t.offender_id and estate_id = r.estate_id and role = 'resident';
    if v_name is null then raise exception 'No resident account is linked to this report'; end if;
    if p_action = 'warn_user' then
      update users set warning_count = warning_count + 1 where id = t.offender_id;
      v_outcome := 'Warning issued to ' || v_name;
    else
      update users set status = 'suspended', admin_note = 'Suspended after a community report.'
      where id = t.offender_id;
      v_outcome := v_name || ' suspended';
    end if;
  else
    raise exception 'Unknown action: %', p_action;
  end if;

  update reports set status = 'resolved', handled_by = v_me.id, resolution_note = v_outcome
  where id = r.id;
  return v_outcome;
end $$;

-- ─── 7. Bulletins ─────────────────────────────────────────────────────────

drop policy bulletin_staff on bulletins;
create policy bulletin_staff_insert on bulletins for insert
  with check (is_staff() and estate_id = my_estate() and admin_id = auth.uid());
create policy bulletin_staff_delete on bulletins for delete
  using (is_staff() and estate_id = my_estate());

-- ─── 8. Account deletion ──────────────────────────────────────────────────
-- Deleting the login cascades to the profile, their posts, chats and messages.
-- (Creating accounts for others needs the secret key, so adminCreateUser will
-- be an Edge Function, not SQL.)

create function delete_own_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from users where id = auth.uid() and role <> 'resident') then
    raise exception 'Staff accounts are removed by an admin';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

create function admin_delete_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admin access only' using errcode = '42501'; end if;
  if not exists (select 1 from users where id = p_user_id
                 and estate_id = my_estate() and role <> 'admin') then
    raise exception 'User not found';
  end if;
  delete from auth.users where id = p_user_id;
end $$;

-- ─── 9. Photo storage ─────────────────────────────────────────────────────
-- Public read (the feed shows the image by URL). Uploads go under the
-- uploader's estate folder with a random file name — never their user id,
-- which would give away who wrote an anonymous post.

insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true)
on conflict (id) do nothing;

create policy post_media_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = public.my_estate()::text
    and public.is_approved()
  );

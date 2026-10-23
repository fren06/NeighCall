-- Live feed: open feeds reload when something in their estate changes.
--
-- Same approach as the chat (ping_chat in 0002): a "changed" ping with an
-- empty payload on the channel "feed:<estate id>", so nothing about the post
-- or its author travels over Realtime. The app then refetches through the
-- feed_posts view as usual. Anyone who knows an estate id could see *that*
-- something changed, but never what.

create function ping_feed() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  estate uuid;
begin
  if tg_table_name = 'conversations' then
    -- A new offer of help changes the post's helper count.
    select p.estate_id into estate from posts p where p.id = new.post_id;
  elsif tg_op = 'DELETE' then
    estate := old.estate_id;
  else
    estate := new.estate_id;
  end if;

  if estate is not null then
    perform realtime.send('{}'::jsonb, 'changed', 'feed:' || estate::text, false);
  end if;
  return null;
exception when others then
  raise warning 'feed ping failed: %', sqlerrm;  -- never block the change itself
  return null;
end $$;

-- New requests, status changes (e.g. resolved) and deletions.
create trigger posts_ping_feed after insert or update or delete on posts
  for each row execute function ping_feed();

-- Offers of help.
create trigger conversations_ping_feed after insert on conversations
  for each row execute function ping_feed();

-- Bulletins shown in the feed banner.
create trigger bulletins_ping_feed after insert or update or delete on bulletins
  for each row execute function ping_feed();

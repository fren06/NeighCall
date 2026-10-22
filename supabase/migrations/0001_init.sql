-- NeighCall initial schema. Mirrors types/models.ts and lib/mock-data.ts.
-- Anonymity: residents never read `posts` directly. They read the
-- `feed_posts` view, which exposes the alias but never `author_id`.

create extension if not exists vector;

-- ─── Enums ────────────────────────────────────────────────────────────────
create type user_role     as enum ('resident', 'admin', 'management');
create type user_status   as enum ('pending', 'needs_info', 'approved', 'rejected', 'suspended');
create type post_status   as enum ('open', 'in_progress', 'resolved');
create type message_type  as enum ('text', 'identity_card', 'system');
create type report_target as enum ('post', 'user', 'message');
create type report_status as enum ('open', 'investigating', 'resolved');

-- ─── Tables ───────────────────────────────────────────────────────────────
create table estates (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  area text not null
);

create table users (
  id            uuid primary key references auth.users on delete cascade,
  estate_id     uuid not null references estates,
  name          text not null,
  email         text not null unique,
  phone         text not null,
  block         text not null,
  unit_number   text not null,
  street        text not null,
  skills        text[] not null default '{}',
  notifications jsonb not null default
    '{"skill_matches": true, "quiet_hours": {"enabled": false, "start": "22:00", "end": "07:00"}}',
  role          user_role   not null default 'resident',
  status        user_status not null default 'pending',
  admin_note    text,
  warning_count int not null default 0,
  push_token    text,
  created_at    timestamptz not null default now()
);
create index on users (estate_id, status);

create table posts (
  id            uuid primary key default gen_random_uuid(),
  estate_id     uuid not null references estates,
  author_id     uuid not null references users on delete cascade,
  is_anonymous  boolean not null default false,
  anon_alias    text,
  content       text not null,
  media_url     text,
  category      text,
  tools_needed  text[] not null default '{}',
  urgency       text check (urgency in ('low', 'medium', 'high')),
  punchline     text,
  embedding     vector(1536),
  status        post_status not null default 'open',
  created_at    timestamptz not null default now(),
  check (not is_anonymous or anon_alias is not null)
);
create index on posts (estate_id, created_at desc);

create table conversations (
  id                   uuid primary key default gen_random_uuid(),
  post_id              uuid not null references posts on delete cascade,
  requester_id         uuid not null references users on delete cascade,
  helper_id            uuid not null references users on delete cascade,
  is_identity_revealed boolean not null default false,
  created_at           timestamptz not null default now(),
  unique (post_id, helper_id)
);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations on delete cascade,
  sender_id       uuid not null references users on delete cascade,
  type            message_type not null default 'text',
  text            text,
  identity_card   jsonb,
  created_at      timestamptz not null default now()
);
create index on messages (conversation_id, created_at);

create table bulletins (
  id               uuid primary key default gen_random_uuid(),
  estate_id        uuid not null references estates,
  admin_id         uuid not null references users,
  title            text not null,
  body             text not null,
  is_high_priority boolean not null default false,
  pinned_until     timestamptz,
  created_at       timestamptz not null default now()
);

create table reports (
  id              uuid primary key default gen_random_uuid(),
  estate_id       uuid not null references estates,
  reporter_id     uuid not null references users on delete cascade,
  target_type     report_target not null,
  target_id       uuid not null,
  reason          text not null,
  status          report_status not null default 'open',
  resolution_note text,
  handled_by      uuid references users,
  created_at      timestamptz not null default now()
);

-- ─── Helpers (security definer avoids RLS recursion on users) ─────────────
create function my_estate() returns uuid language sql stable security definer set search_path = public
  as $$ select estate_id from users where id = auth.uid() $$;
create function is_approved() returns boolean language sql stable security definer set search_path = public
  as $$ select coalesce((select status = 'approved' from users where id = auth.uid()), false) $$;
create function is_staff() returns boolean language sql stable security definer set search_path = public
  as $$ select coalesce((select role <> 'resident' from users where id = auth.uid()), false) $$;
create function in_conversation(cid uuid) returns boolean language sql stable security definer set search_path = public
  as $$ select exists (select 1 from conversations
         where id = cid and auth.uid() in (requester_id, helper_id)) $$;

-- ─── Row-level security ───────────────────────────────────────────────────
alter table estates       enable row level security;
alter table users         enable row level security;
alter table posts         enable row level security;
alter table conversations enable row level security;
alter table messages      enable row level security;
alter table bulletins     enable row level security;
alter table reports       enable row level security;

create policy estates_read on estates for select using (true);

-- Users: self, or staff in the same estate. Neighbours only see names via views.
create policy users_self_read on users for select using (id = auth.uid());
create policy users_staff_read on users for select using (is_staff() and estate_id = my_estate());
create policy users_self_insert on users for insert
  with check (id = auth.uid() and role = 'resident' and status = 'pending');
create policy users_self_update on users for update using (id = auth.uid()) with check (id = auth.uid());
create policy users_staff_write on users for all
  using (is_staff() and estate_id = my_estate()) with check (is_staff() and estate_id = my_estate());

-- Residents may edit contact details, skills and prefs only.
create function lock_user_privileged_columns() returns trigger language plpgsql security definer as $$
begin
  if not is_staff() and (new.role, new.status, new.estate_id, new.warning_count)
       is distinct from (old.role, old.status, old.estate_id, old.warning_count) then
    -- Resubmitting after needs_info is the one allowed status change.
    if old.status = 'needs_info' and new.status = 'pending'
       and (new.role, new.estate_id, new.warning_count) = (old.role, old.estate_id, old.warning_count) then
      return new;
    end if;
    raise exception 'Not allowed to change role, status, estate or warnings';
  end if;
  return new;
end $$;
create trigger users_lock_columns before update on users
  for each row execute function lock_user_privileged_columns();

-- Posts: authors manage their own; everyone else goes through feed_posts.
create policy posts_author_read on posts for select using (author_id = auth.uid());
create policy posts_staff_read on posts for select using (is_staff() and estate_id = my_estate());
create policy posts_insert on posts for insert
  with check (author_id = auth.uid() and estate_id = my_estate() and is_approved());
create policy posts_author_update on posts for update using (author_id = auth.uid());
create policy posts_author_delete on posts for delete using (author_id = auth.uid());
create policy posts_staff_delete on posts for delete using (is_staff() and estate_id = my_estate());

-- Runs as the view owner so it can read `posts`; scoped to the viewer's estate.
create view feed_posts as
  select p.id, p.estate_id, p.content, p.media_url, p.category, p.tools_needed,
         p.urgency, p.punchline, p.status, p.created_at,
         p.is_anonymous, p.anon_alias,
         case when p.is_anonymous then null else u.name  end as author_name,
         case when p.is_anonymous then null else u.block end as author_block,
         (p.author_id = auth.uid()) as is_mine,
         (select count(*) from conversations c where c.post_id = p.id) as helper_count
  from posts p join users u on u.id = p.author_id
  where p.estate_id = my_estate() and is_approved();

-- Conversations & messages: participants only, plus staff for report review.
create policy conv_read on conversations for select
  using (auth.uid() in (requester_id, helper_id) or (is_staff() and exists
    (select 1 from posts p where p.id = post_id and p.estate_id = my_estate())));
create policy conv_insert on conversations for insert
  with check (helper_id = auth.uid() and is_approved() and requester_id <> auth.uid());
create policy conv_reveal on conversations for update using (requester_id = auth.uid());

create policy msg_read on messages for select
  using (in_conversation(conversation_id) or is_staff());
create policy msg_insert on messages for insert
  with check (sender_id = auth.uid() and in_conversation(conversation_id) and is_approved());

-- Bulletins: estate members read, staff write.
create policy bulletin_read on bulletins for select using (estate_id = my_estate() and is_approved());
create policy bulletin_staff on bulletins for all
  using (is_staff() and estate_id = my_estate()) with check (is_staff() and estate_id = my_estate());

-- Reports: reporters insert, staff triage. Reporter identity stays staff-only.
create policy report_insert on reports for insert
  with check (reporter_id = auth.uid() and estate_id = my_estate() and is_approved());
create policy report_staff on reports for all
  using (is_staff() and estate_id = my_estate()) with check (is_staff() and estate_id = my_estate());

-- ─── Realtime ─────────────────────────────────────────────────────────────
alter publication supabase_realtime add table messages, conversations;

-- ─── Storage ──────────────────────────────────────────────────────────────
-- Create a bucket "post-media" (public read, authenticated write):
-- insert into storage.buckets (id, name, public) values ('post-media', 'post-media', true);

-- push_subscriptions — the missing half of web push.
--
-- The notifications table has always been the source of truth for WHAT to tell
-- someone; this is WHERE to reach them. One row per browser per person: a
-- phone in Chrome, the same phone's installed app, and a laptop are three
-- subscriptions, and someone who reinstalls the app produces a fourth while
-- the old one goes stale (see the pruning note below).
--
-- The endpoint is a URL at the browser vendor's push service, and the two keys
-- are what encrypt the payload so that service cannot read it. Together they
-- are a capability: anyone holding them can make that device buzz. Hence RLS
-- that lets a person see and delete only their own rows, and no select policy
-- for anyone else at all — not even admins.

create table push_subscriptions (
  id uuid primary key default gen_random_uuid (),
  profile_id uuid not null references profiles (id) on delete cascade,
  -- The vendor's URL for this device. Unique because a browser that
  -- re-subscribes returns the same endpoint, and we want that to update the
  -- existing row rather than pile up duplicates and send twice.
  endpoint text not null unique,
  p256dh text not null, -- the device's public key
  auth text not null, -- the shared secret, both from PushSubscription.toJSON()
  -- Just enough to tell "iPhone" from "laptop" in the settings list. Not for
  -- analytics, and deliberately not parsed anywhere.
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  -- Bumped every time the browser confirms the subscription is still live;
  -- a very old value means the app has not been opened on that device.
  last_seen_at timestamptz not null default now()
);

create index push_subscriptions_by_profile on push_subscriptions (profile_id);

alter table push_subscriptions enable row level security;

-- Own rows only, all four verbs. The service role (the notification pipeline)
-- bypasses RLS, which is how the fan-out reads everyone's endpoints.
create policy "push_subscriptions_select_own" on push_subscriptions
  for select to authenticated using (profile_id = (select auth.uid ()));

create policy "push_subscriptions_insert_own" on push_subscriptions
  for insert to authenticated with check (profile_id = (select auth.uid ()));

create policy "push_subscriptions_update_own" on push_subscriptions
  for update to authenticated
  using (profile_id = (select auth.uid ()))
  with check (profile_id = (select auth.uid ()));

create policy "push_subscriptions_delete_own" on push_subscriptions
  for delete to authenticated using (profile_id = (select auth.uid ()));

-- Grants come from the default privileges set in 0103; nothing to do here.

-- ---------------------------------------------------------------------------
-- notifications.deliver_at / pushed_at — quiet hours, made real.
--
-- Quiet hours already worked in memory: the pipeline computed a per-recipient
-- delivery time and handed it to the channels. With only the in-app bell
-- listening, nobody noticed that the value was then thrown away. A push that
-- must wait until 07:00 has to survive the request that created it, so the
-- decision is written down instead.
--
--   deliver_at  when this may be pushed (now, or the end of quiet hours;
--               urgent never defers)
--   pushed_at   when it actually was — null means "still owed", which is what
--               the cron tick looks for. Also what makes re-running the tick
--               harmless.
-- ---------------------------------------------------------------------------
alter table notifications
  add column deliver_at timestamptz not null default now(),
  add column pushed_at timestamptz;

-- The tick's query: everything still owed, oldest first.
create index notifications_push_queue on notifications (deliver_at)
  where pushed_at is null;

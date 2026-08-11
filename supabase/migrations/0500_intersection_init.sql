-- Intersection module: the inter-section competition, ported from the old
-- eendrag-intersection app's JSON blob into relational tables, behaviour
-- unchanged. Format per event: 4 groups of 3 → round robin → top 2 advance →
-- QF → SF → Final. Knockout pairings A1–B2, C1–D2, B1–A2, D1–C2.
--
-- PUBLIC BY DESIGN: every table here is readable by anon — fixture links get
-- pasted into WhatsApp and must open without a login wall. Writes are admin
-- only. The tournament logic itself lives in
-- src/modules/intersection/lib/tournament.ts (ported with tests).

-- Leaderboard points per placement tier. Single row, editable by admins.
create table intersection_settings (
  id smallint primary key default 1 check (id = 1),
  points_champion smallint not null default 15,
  points_runner_up smallint not null default 12,
  points_semis smallint not null default 9, -- each losing semi-finalist
  points_quarters smallint not null default 6, -- each losing quarter-finalist
  points_group smallint not null default 3 -- knocked out in groups
);

insert into intersection_settings (id) values (1);

alter table intersection_settings enable row level security;

create policy "intersection_settings_select" on intersection_settings
  for select to anon, authenticated using (true);

create policy "intersection_settings_admin_update" on intersection_settings
  for update to authenticated using (app_is_admin ()) with check (app_is_admin ());

-- ---------------------------------------------------------------------------
-- intersection_events — one per competition event (Rugby Day, Chess, ...).
-- Events span days; start_date only. status is derived by the tournament
-- logic whenever results change.
-- ---------------------------------------------------------------------------
create table intersection_events (
  id uuid primary key default gen_random_uuid (),
  name text not null check (char_length(name) between 1 and 120),
  start_date date,
  rules text not null default '', -- free-text rules page shown on the event
  status text not null default 'upcoming'
    check (status in ('upcoming', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger intersection_events_updated_at before update on intersection_events
  for each row execute function app_set_updated_at ();

alter table intersection_events enable row level security;

create policy "intersection_events_select" on intersection_events
  for select to anon, authenticated using (true);

create policy "intersection_events_admin_all" on intersection_events
  for all to authenticated using (app_is_admin ()) with check (app_is_admin ());

-- ---------------------------------------------------------------------------
-- Groups A–D and their three teams each. Slot order matters: the round-robin
-- fixture pattern is (0,1), (1,2), (0,2).
-- ---------------------------------------------------------------------------
create table intersection_groups (
  id uuid primary key default gen_random_uuid (),
  event_id uuid not null references intersection_events (id) on delete cascade,
  name text not null check (name in ('A', 'B', 'C', 'D')),
  unique (event_id, name)
);

alter table intersection_groups enable row level security;

create policy "intersection_groups_select" on intersection_groups
  for select to anon, authenticated using (true);

create policy "intersection_groups_admin_all" on intersection_groups
  for all to authenticated using (app_is_admin ()) with check (app_is_admin ());

create table intersection_group_teams (
  group_id uuid not null references intersection_groups (id) on delete cascade,
  section_id uuid not null references sections (id) on delete cascade,
  slot smallint not null check (slot between 0 and 2),
  primary key (group_id, slot),
  unique (group_id, section_id)
);

alter table intersection_group_teams enable row level security;

create policy "intersection_group_teams_select" on intersection_group_teams
  for select to anon, authenticated using (true);

create policy "intersection_group_teams_admin_all" on intersection_group_teams
  for all to authenticated using (app_is_admin ()) with check (app_is_admin ());

-- ---------------------------------------------------------------------------
-- Matches — group and knockout in one table, like the old app.
-- source_a/source_b are labels like 'A1' (Group A winner) or 'QF2' (winner of
-- QF2); team ids are filled in by the tournament logic once determinable.
-- manual = true means an admin overrode the pairing and recalc must not
-- touch it. Scheduled matches are mirrored into the shared events table by
-- src/core/calendar (source_module = 'intersection').
-- ---------------------------------------------------------------------------
create table intersection_matches (
  id uuid primary key default gen_random_uuid (),
  event_id uuid not null references intersection_events (id) on delete cascade,
  stage text not null check (stage in ('group', 'qf', 'sf', 'final')),
  group_id uuid references intersection_groups (id) on delete cascade,
  slot smallint, -- QF1..4, SF1..2 — null for group games and the final
  source_a text, -- 'A1', 'QF2', ... — null for group games
  source_b text,
  team_a_section_id uuid references sections (id) on delete set null,
  team_b_section_id uuid references sections (id) on delete set null,
  winner_section_id uuid references sections (id) on delete set null,
  note text, -- free-text score note ("21–14"); scoring differs per event
  played boolean not null default false,
  manual boolean not null default false,
  scheduled_at timestamptz,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (stage <> 'group' or group_id is not null),
  check (not played or winner_section_id is not null)
);

create index intersection_matches_event on intersection_matches (event_id, sort_order);

create trigger intersection_matches_updated_at before update on intersection_matches
  for each row execute function app_set_updated_at ();

alter table intersection_matches enable row level security;

create policy "intersection_matches_select" on intersection_matches
  for select to anon, authenticated using (true);

create policy "intersection_matches_admin_all" on intersection_matches
  for all to authenticated using (app_is_admin ()) with check (app_is_admin ());

-- ---------------------------------------------------------------------------
-- Players & rosters. A player is ideally a linked account (profile_id), with
-- a free-text name fallback for people who never sign up. Stats: a player
-- participates in an event when rostered; they're credited a game win for
-- every played match their section won in that event.
-- ---------------------------------------------------------------------------
create table intersection_players (
  id uuid primary key default gen_random_uuid (),
  profile_id uuid references profiles (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  section_id uuid not null references sections (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index intersection_players_section on intersection_players (section_id);

alter table intersection_players enable row level security;

create policy "intersection_players_select" on intersection_players
  for select to anon, authenticated using (true);

create policy "intersection_players_admin_all" on intersection_players
  for all to authenticated using (app_is_admin ()) with check (app_is_admin ());

create table intersection_rosters (
  event_id uuid not null references intersection_events (id) on delete cascade,
  player_id uuid not null references intersection_players (id) on delete cascade,
  primary key (event_id, player_id)
);

alter table intersection_rosters enable row level security;

create policy "intersection_rosters_select" on intersection_rosters
  for select to anon, authenticated using (true);

create policy "intersection_rosters_admin_all" on intersection_rosters
  for all to authenticated using (app_is_admin ()) with check (app_is_admin ());

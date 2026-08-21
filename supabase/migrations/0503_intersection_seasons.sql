-- Seasons: how the intersection competition starts a new year without anybody
-- opening the code, and without anybody deleting anything.
--
-- THE PROBLEM. The competition runs for a year and then starts again from
-- zero. Until now the only way to do that was to delete every event by hand,
-- which is destructive, slow, and easy to do to the wrong year — and there are
-- no database backups on the free tier to undo it with.
--
-- THE ANSWER, AND WHY IT IS THIS ONE. A reset does not delete. It archives:
-- "Start new season" stamps archived_at on the season that just ended and
-- creates a fresh one. Every event, fixture and result stays exactly where it
-- was, attached to the season it belonged to, and is still readable under
-- Past seasons. Starting a season by mistake is undone by archiving the new
-- one — nothing is lost, so nothing needs approving by a quorum of admins.
--
-- That is deliberately a weaker rule than "three admins must agree", and it is
-- safer. An approval count protects against one person acting alone; it does
-- nothing about three people agreeing to the wrong thing, and with three admin
-- accounts in total it would mean unanimity, so one person leaving at the end
-- of the year would lock the reset permanently. Making the action harmless
-- beats making it hard.

-- ---------------------------------------------------------------------------
-- intersection_seasons — one row per year of the competition. archived_at is
-- null on exactly one of them: that is the season the app shows by default.
-- ---------------------------------------------------------------------------
create table intersection_seasons (
  id uuid primary key default gen_random_uuid (),
  name text not null check (char_length(name) between 1 and 60), -- "2026"
  started_on date not null default current_date,
  archived_at timestamptz, -- null = the current season
  created_at timestamptz not null default now()
);

-- At most one current season, enforced by the database rather than by hoping
-- the app gets it right. A partial unique index over an expression that is
-- true for every included row allows exactly one such row.
create unique index intersection_seasons_one_current
  on intersection_seasons ((archived_at is null))
  where archived_at is null;

alter table intersection_seasons enable row level security;

-- Public, like the rest of the module: the intersection pages open without a
-- login and the season name is on them.
create policy "intersection_seasons_select" on intersection_seasons
  for select to anon, authenticated using (true);

create policy "intersection_seasons_admin_all" on intersection_seasons
  for all to authenticated using (app_is_admin ()) with check (app_is_admin ());

-- The season everything existing belongs to. Named for the current year, which
-- is right for the database this first runs against and harmless on a fresh
-- one (the seed and the admin can both rename it).
insert into intersection_seasons (name, started_on)
values (to_char(current_date, 'YYYY'), current_date);

-- ---------------------------------------------------------------------------
-- Which season an event belongs to.
-- ---------------------------------------------------------------------------
create function intersection_current_season () returns uuid
language sql stable
set search_path = public as $$
  select id from intersection_seasons where archived_at is null limit 1;
$$;

alter table intersection_events
  add column season_id uuid references intersection_seasons (id) on delete cascade;

-- Every event that already exists belongs to the season we just created.
update intersection_events
  set season_id = (select id from intersection_seasons where archived_at is null);

-- Defaulted, so every existing insert path keeps working and new events land
-- in the current season without the caller having to think about it.
alter table intersection_events
  alter column season_id set default intersection_current_season (),
  alter column season_id set not null;

create index intersection_events_season on intersection_events (season_id);

-- ---------------------------------------------------------------------------
-- intersection_season_carry — points a section starts the season on.
--
-- WHY THIS EXISTS. The competition was already part-played when the old
-- intersection app took over, and only the standing totals survived: no
-- fixtures, no results, just a spreadsheet of scores. Those totals are each
-- section's starting score, and events recorded in the app add to them. The
-- old app calls this "points carried over" and the res leaderboard has been
-- reading that way all season, so this app cannot show a leaderboard starting
-- from zero and claim to be the same competition.
--
-- Per season, not per section: a new season starts everyone on nothing unless
-- an admin says otherwise, which is exactly what a reset should do.
-- ---------------------------------------------------------------------------
create table intersection_season_carry (
  season_id uuid not null references intersection_seasons (id) on delete cascade,
  section_id uuid not null references sections (id) on delete cascade,
  points smallint not null default 0 check (points >= 0),
  primary key (season_id, section_id)
);

alter table intersection_season_carry enable row level security;

create policy "intersection_season_carry_select" on intersection_season_carry
  for select to anon, authenticated using (true);

create policy "intersection_season_carry_admin_all" on intersection_season_carry
  for all to authenticated using (app_is_admin ()) with check (app_is_admin ());

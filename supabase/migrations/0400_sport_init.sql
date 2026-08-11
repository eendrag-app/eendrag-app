-- Sport module: reps, fixtures, results, signups. The sports catalogue itself
-- lives in core (0100) because onboarding and notification targeting use it.

-- One rep per sport. A rep may edit exactly their own sport — enforced here,
-- not in the UI.
alter table sports
  add column rep_id uuid references profiles (id) on delete set null;

create function app_is_rep_of (sport uuid) returns boolean
language sql security definer stable
set search_path = public as $$
  select coalesce(
    (select s.rep_id = (select auth.uid ()) and p.is_active
     from sports s
     join profiles p on p.id = s.rep_id
     where s.id = sport),
    false);
$$;

-- Reps may edit their own sport's row (times, venue, description — the
-- privilege guard below keeps rep assignment itself admin-only).
create policy "sports_update_admin_or_own_rep" on sports
  for update to authenticated
  using (app_is_admin () or app_is_rep_of (id))
  with check (app_is_admin () or app_is_rep_of (id));

create policy "sports_admin_insert" on sports
  for insert to authenticated with check (app_is_admin ());

create policy "sports_admin_delete" on sports
  for delete to authenticated using (app_is_admin ());

-- Only admins may change who the rep is.
create function app_guard_sport_rep () returns trigger
language plpgsql security definer
set search_path = public as $$
begin
  if new.rep_id is distinct from old.rep_id and not app_is_admin () then
    raise exception 'only admins may assign sport reps';
  end if;
  return new;
end;
$$;

create trigger sports_guard_rep before update on sports
  for each row execute function app_guard_sport_rep ();

-- ---------------------------------------------------------------------------
-- sport_fixtures — upcoming matches/games for a sport. Mirrored into the
-- shared events table by src/core/calendar (source_module = 'sport',
-- source_ref = fixture id), so they appear on the calendar automatically.
-- ---------------------------------------------------------------------------
create table sport_fixtures (
  id uuid primary key default gen_random_uuid (),
  sport_id uuid not null references sports (id) on delete cascade,
  opponent text not null default '', -- free text: "Maties 2nds", "Helshoogte"
  location text not null default '',
  starts_at timestamptz not null,
  notes text not null default '',
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sport_fixtures_upcoming on sport_fixtures (sport_id, starts_at);

create trigger sport_fixtures_updated_at before update on sport_fixtures
  for each row execute function app_set_updated_at ();

alter table sport_fixtures enable row level security;

create policy "sport_fixtures_select" on sport_fixtures
  for select to authenticated using (true);

create policy "sport_fixtures_write" on sport_fixtures
  for insert to authenticated
  with check (app_is_admin () or app_is_rep_of (sport_id));

create policy "sport_fixtures_update" on sport_fixtures
  for update to authenticated
  using (app_is_admin () or app_is_rep_of (sport_id))
  with check (app_is_admin () or app_is_rep_of (sport_id));

create policy "sport_fixtures_delete" on sport_fixtures
  for delete to authenticated
  using (app_is_admin () or app_is_rep_of (sport_id));

-- ---------------------------------------------------------------------------
-- sport_results — posted by the rep after a game. Posting one auto-creates a
-- short system announcement (src/modules/sport server action — not a DB
-- trigger, so the announcement copy stays in application code).
-- ---------------------------------------------------------------------------
create table sport_results (
  id uuid primary key default gen_random_uuid (),
  sport_id uuid not null references sports (id) on delete cascade,
  fixture_id uuid references sport_fixtures (id) on delete set null,
  summary text not null check (char_length(summary) between 1 and 300),
  score text not null default '', -- free text: "2–1", "won on bonus points"
  played_at timestamptz not null default now(),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index sport_results_recent on sport_results (sport_id, played_at desc);

alter table sport_results enable row level security;

create policy "sport_results_select" on sport_results
  for select to authenticated using (true);

create policy "sport_results_write" on sport_results
  for insert to authenticated
  with check (app_is_admin () or app_is_rep_of (sport_id));

create policy "sport_results_update" on sport_results
  for update to authenticated
  using (app_is_admin () or app_is_rep_of (sport_id))
  with check (app_is_admin () or app_is_rep_of (sport_id));

create policy "sport_results_delete" on sport_results
  for delete to authenticated
  using (app_is_admin () or app_is_rep_of (sport_id));

-- ---------------------------------------------------------------------------
-- sport_signups — "I want to play": the sign-up button on a sport's page.
-- Distinct from user_sports (what you already play, set at onboarding).
-- ---------------------------------------------------------------------------
create table sport_signups (
  sport_id uuid not null references sports (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  note text not null default '', -- optional "never played before" etc.
  created_at timestamptz not null default now(),
  primary key (sport_id, profile_id)
);

alter table sport_signups enable row level security;

-- Visible to everyone signed in: the rep needs the list, and squad lists are
-- res-public by design.
create policy "sport_signups_select" on sport_signups
  for select to authenticated using (true);

create policy "sport_signups_insert_own" on sport_signups
  for insert to authenticated with check (profile_id = (select auth.uid ()));

create policy "sport_signups_delete_own" on sport_signups
  for delete to authenticated
  using (
    profile_id = (select auth.uid ())
    or app_is_admin ()
    or app_is_rep_of (sport_id)
  );

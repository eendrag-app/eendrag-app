-- Core schema: sections, sports catalogue, profiles, sports-played,
-- notification preferences + notifications, verified_emails, shared helpers.
-- Every table gets RLS with explicit policies — no table is left open.

-- gen_random_uuid() ships with Postgres 13+ via pgcrypto.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at maintenance, shared by every table that has the column.
-- ---------------------------------------------------------------------------
create function app_set_updated_at () returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- sections — the 12 sections of Eendrag. Seeded in seed.sql; effectively
-- static reference data. color is the section's hex accent, used ONLY for
-- section-coded UI elements (see docs/HANDOFF.md → design direction).
-- ---------------------------------------------------------------------------
create table sections (
  id uuid primary key default gen_random_uuid (),
  name text not null unique,
  color text not null check (color ~ '^#[0-9a-f]{6}$'),
  sort_order smallint not null unique
);

alter table sections enable row level security;

-- Anonymous read on purpose: the intersection pages are public and show
-- section names and colours.
create policy "sections_select" on sections
  for select to anon, authenticated using (true);
-- No insert/update/delete policies: sections change via migration/seed only.

-- ---------------------------------------------------------------------------
-- sports — the catalogue of sports at the res. Lives in core (not the sport
-- module) because notification targeting and onboarding both depend on it.
-- The sport module adds rep_id and its own tables in 0400.
-- ---------------------------------------------------------------------------
create table sports (
  id uuid primary key default gen_random_uuid (),
  name text not null unique,
  description text not null default '',
  practice_info text not null default '', -- "Tue & Thu 19:00" — free text, HK-editable
  venue text not null default '',
  coach text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sports_updated_at before update on sports
  for each row execute function app_set_updated_at ();

alter table sports enable row level security;

create policy "sports_select" on sports
  for select to authenticated using (true);
-- Writes: admins and the sport's own rep — policies live in 0400_sport_init.sql
-- where rep_id is added.

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user, created automatically by trigger below.
-- role is the single source of authorisation truth (see app_role()).
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  section_id uuid references sections (id),
  room_number text not null default '',
  role text not null default 'student' check (role in ('student', 'sport_rep', 'admin')),
  -- Deactivated at year end when someone leaves the res (docs/ADMIN-GUIDE.md).
  -- RLS keeps inactive users read-only everywhere it matters.
  is_active boolean not null default true,
  -- Per-user secret for the ICS calendar feed URL (/api/calendar/[token].ics).
  calendar_token uuid not null default gen_random_uuid () unique,
  quiet_hours_start time not null default '23:00',
  quiet_hours_end time not null default '07:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on profiles
  for each row execute function app_set_updated_at ();

-- ---------------------------------------------------------------------------
-- Shared authorisation helpers. SECURITY DEFINER so policies on profiles can
-- use them without recursing into profiles' own RLS.
-- ---------------------------------------------------------------------------
create function app_role () returns text
language sql security definer stable
set search_path = public as $$
  select role from profiles where id = (select auth.uid ());
$$;

create function app_is_admin () returns boolean
language sql security definer stable
set search_path = public as $$
  select coalesce((select role = 'admin' and is_active from profiles
                   where id = (select auth.uid ())), false);
$$;

create function app_section_id () returns uuid
language sql security definer stable
set search_path = public as $$
  select section_id from profiles where id = (select auth.uid ());
$$;

alter table profiles enable row level security;

-- Names, sections, and roles are visible res-wide (rep contact cards, squad
-- lists). Email is in the row too — acceptable inside a 280-person residence;
-- revisit if the app ever opens beyond it.
create policy "profiles_select" on profiles
  for select to authenticated using (true);

create policy "profiles_update_own" on profiles
  for update to authenticated
  using (id = (select auth.uid ()))
  with check (id = (select auth.uid ()));

create policy "profiles_update_admin" on profiles
  for update to authenticated
  using (app_is_admin ())
  with check (app_is_admin ());

-- No insert policy: rows are created by the auth trigger below (definer).
-- No delete policy: deactivate (is_active = false), never delete — history
-- (announcements, results) must keep its authors.

-- Only admins may change role or is_active; anyone may edit their own details.
create function app_guard_profile_privileges () returns trigger
language plpgsql security definer
set search_path = public as $$
begin
  if (new.role is distinct from old.role
      or new.is_active is distinct from old.is_active)
     and not app_is_admin () then
    raise exception 'only admins may change roles or active status';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privileges before update on profiles
  for each row execute function app_guard_profile_privileges ();

-- ---------------------------------------------------------------------------
-- Auto-create a profile (and default notification preferences) on signup.
-- ---------------------------------------------------------------------------
create function app_handle_new_user () returns trigger
language plpgsql security definer
set search_path = public as $$
begin
  insert into profiles (id, email) values (new.id, new.email);
  -- Default toggles: everything on except section-only mode ('section'),
  -- which is an opt-in noise filter (see src/core/notifications/targeting.ts).
  insert into notification_preferences (profile_id, category, enabled)
  select new.id, c.category, c.category <> 'section'
  from (values ('announcement'), ('urgent'), ('calendar'),
               ('intersection'), ('sport'), ('section')) as c (category);
  return new;
end;
$$;

-- auth.users is Supabase-managed; this trigger is the one sanctioned touch.
-- If the app ever moves off Supabase auth, recreate the equivalent hook in
-- whatever replaces it (docs/OPERATIONS.md → leaving managed hosting).
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app_handle_new_user ();

-- ---------------------------------------------------------------------------
-- user_sports — which sports a user plays (onboarding multi-select).
-- Drives "sport" notification targeting.
-- ---------------------------------------------------------------------------
create table user_sports (
  profile_id uuid not null references profiles (id) on delete cascade,
  sport_id uuid not null references sports (id) on delete cascade,
  primary key (profile_id, sport_id)
);

alter table user_sports enable row level security;

create policy "user_sports_select" on user_sports
  for select to authenticated using (true);

create policy "user_sports_insert_own" on user_sports
  for insert to authenticated
  with check (profile_id = (select auth.uid ()));

create policy "user_sports_delete_own" on user_sports
  for delete to authenticated
  using (profile_id = (select auth.uid ()));

-- ---------------------------------------------------------------------------
-- notification_preferences — one row per user per category; the toggles in
-- Profile → Notification settings. Quiet hours live on profiles.
-- ---------------------------------------------------------------------------
create table notification_preferences (
  profile_id uuid not null references profiles (id) on delete cascade,
  category text not null check (
    category in ('announcement', 'urgent', 'calendar', 'intersection', 'sport', 'section')
  ),
  enabled boolean not null default true,
  primary key (profile_id, category)
);

alter table notification_preferences enable row level security;

create policy "notification_preferences_select_own" on notification_preferences
  for select to authenticated using (profile_id = (select auth.uid ()));

create policy "notification_preferences_update_own" on notification_preferences
  for update to authenticated
  using (profile_id = (select auth.uid ()))
  with check (profile_id = (select auth.uid ()));

create policy "notification_preferences_insert_own" on notification_preferences
  for insert to authenticated
  with check (profile_id = (select auth.uid ()));

-- ---------------------------------------------------------------------------
-- notifications — one row per recipient per notification, written by the
-- pipeline in src/core/notifications (service role). The in-app bell reads
-- these; the web-push channel (stubbed) will read the same rows.
-- ---------------------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid (),
  profile_id uuid not null references profiles (id) on delete cascade,
  category text not null check (
    category in ('announcement', 'urgent', 'calendar', 'intersection', 'sport', 'section')
  ),
  title text not null,
  body text not null default '',
  url text not null default '/', -- in-app deep link
  source_module text not null, -- module id that triggered it, e.g. 'sport'
  source_ref text not null default '', -- module-defined reference, e.g. a fixture id
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_inbox on notifications (profile_id, created_at desc);
create index notifications_unread on notifications (profile_id) where read_at is null;

alter table notifications enable row level security;

create policy "notifications_select_own" on notifications
  for select to authenticated using (profile_id = (select auth.uid ()));

-- Marking as read is the only user-side write; the pipeline inserts with the
-- service role, which bypasses RLS. No insert/delete policies on purpose.
create policy "notifications_update_own" on notifications
  for update to authenticated
  using (profile_id = (select auth.uid ()))
  with check (profile_id = (select auth.uid ()));

-- ---------------------------------------------------------------------------
-- verified_emails — deliberately empty for now. When auth switches to
-- @sun.ac.za magic links (AUTH_MODE=sun_email_magic_link), this becomes the
-- whitelist. Creating it now makes that migration trivial
-- (see docs/ARCHITECTURE.md → Auth).
-- ---------------------------------------------------------------------------
create table verified_emails (
  email text primary key check (email = lower(email)),
  note text not null default '', -- e.g. "2026 first-years import"
  created_at timestamptz not null default now()
);

alter table verified_emails enable row level security;

create policy "verified_emails_admin_all" on verified_emails
  for all to authenticated
  using (app_is_admin ())
  with check (app_is_admin ());

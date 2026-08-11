-- The shared calendar. ONE events table is the single source of truth for
-- every date in the app. Modules never keep a parallel calendar — they write
-- here through src/core/calendar, stamping source_module + source_ref so their
-- auto-generated entries can be updated and removed idempotently.

create table events (
  id uuid primary key default gen_random_uuid (),
  title text not null,
  description text not null default '',
  category text not null check (
    category in ('res_wide', 'intersection', 'section', 'social', 'sport')
  ),
  -- null = res-wide; set = visible emphasis + targeting for one section
  section_id uuid references sections (id) on delete set null,
  location text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  -- Auto-generated entries: which module wrote this and for what. Manual
  -- (admin-created) events leave source_module null. The unique index makes
  -- module writes upserts: same source twice = update, not duplicate.
  source_module text,
  source_ref text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at),
  check ((source_module is null) = (source_ref is null))
);

create unique index events_source on events (source_module, source_ref)
  where source_module is not null;
create index events_starts_at on events (starts_at);
create index events_section on events (section_id);

create trigger events_updated_at before update on events
  for each row execute function app_set_updated_at ();

alter table events enable row level security;

create policy "events_select" on events
  for select to authenticated using (true);

-- Admins manage events directly. Module-generated entries (sport fixtures,
-- intersection draws) are written by src/core/calendar with the service role,
-- which bypasses RLS — so no extra policies are needed for those.
create policy "events_admin_insert" on events
  for insert to authenticated with check (app_is_admin ());

create policy "events_admin_update" on events
  for update to authenticated using (app_is_admin ()) with check (app_is_admin ());

create policy "events_admin_delete" on events
  for delete to authenticated using (app_is_admin ());

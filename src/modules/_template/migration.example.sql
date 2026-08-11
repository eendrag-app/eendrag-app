-- Example migration for a new module. NOT applied — this file lives inside the
-- template as documentation. When you build a real module, copy it to
--   supabase/migrations/<seq>_<module>_<name>.sql   e.g. 0800_roompoints_init.sql
-- (numeric prefix first — the Supabase CLI only applies files that start with
-- digits; pick the next free hundred-block for your module, see
-- supabase/migrations/README.md) and run `npm run db:push`.

-- 1. The table. Prefix module tables with the module id.
create table template_greetings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  message text not null check (char_length(message) <= 200),
  created_at timestamptz not null default now()
);

-- 2. RLS. ALWAYS enabled, ALWAYS with explicit policies. A table without
--    policies is invisible to the app — that is the safe default.
alter table template_greetings enable row level security;

-- Everyone signed in may read.
create policy "template_greetings_select" on template_greetings
  for select to authenticated using (true);

-- You may only insert rows as yourself.
create policy "template_greetings_insert" on template_greetings
  for insert to authenticated
  with check (profile_id = (select auth.uid ()));

-- Admins may delete (uses the shared role helper from the core migration).
create policy "template_greetings_delete" on template_greetings
  for delete to authenticated using (app_is_admin ());

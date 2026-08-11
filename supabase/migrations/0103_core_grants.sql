-- Fix: on a FRESH database the app could not read a single row.
--
-- Every query came back "permission denied for table sections" — not an RLS
-- refusal (which returns zero rows), but a missing GRANT. Supabase's three API
-- roles (anon, authenticated, service_role) had no table privileges at all,
-- because the default privileges for objects created by `postgres` in `public`
-- only hand out Dxtm (truncate/references/trigger/maintain), not select,
-- insert, update or delete.
--
-- The hosted project happens to work because its tables were created under
-- more generous defaults. Relying on that was a mistake in two directions:
-- a new maintainer running `npx supabase db reset` got an app that could not
-- read anything, and the university-server path (plain Postgres, no Supabase
-- defaults at all) would have failed the same way. Found in phase two by
-- resetting a local stack from zero.
--
-- Granting table privileges to these roles does NOT weaken anything: RLS is
-- enabled on every table with explicit policies, and a table whose policies do
-- not match denies the row no matter what the grants say. This is exactly the
-- model Supabase's own defaults implement — written down here so it survives
-- leaving Supabase.
--
-- Idempotent, so it is a no-op on the hosted project.

grant usage on schema public to anon, authenticated, service_role;

-- Everything that already exists (migrations 0100–0102).
grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;
grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;
grant execute on all functions in schema public
  to anon, authenticated, service_role;

-- ...and everything later migrations create. `alter default privileges`
-- applies to objects created after this point by the role running migrations,
-- which is how a new module's tables get their grants for free.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;

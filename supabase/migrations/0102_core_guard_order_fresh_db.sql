-- Fix: `supabase db reset` on an EMPTY database failed at 0400.
--
-- 0101 was written after 0400 had already been applied to the hosted project,
-- so on that database it ran last and its `create or replace` correctly
-- replaced 0400's stricter guard. On a fresh database the files run in
-- filename order instead — 0101 before 0400 — so 0101 *creates*
-- app_guard_sport_rep(), and then 0400's plain `create function` for the same
-- name aborts the whole run:
--
--   ERROR: function "app_guard_sport_rep" already exists with same argument
--   types (SQLSTATE 42723)
--
-- Which meant a new maintainer following the README could not start the app,
-- and the university-server path (psql -f each file in order) was broken too.
-- Found in phase two by actually running a reset from zero.
--
-- The rule is never to edit an applied migration, so the fix is two forward
-- ones. THIS file gets 0400 past the name clash by removing the function
-- again — but only when 0400 has not run yet, which is exactly when its
-- trigger does not exist. On the hosted project (and any database where 0400
-- already applied) this does nothing at all.
--
-- Its partner, 0402, puts the FIXED definition back afterwards.

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'sports_guard_rep'
  ) then
    drop function if exists app_guard_sport_rep ();
  end if;
end
$$;

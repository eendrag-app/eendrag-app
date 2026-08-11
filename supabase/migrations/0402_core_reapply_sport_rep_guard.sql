-- The other half of the fix started in 0102 (read that file first).
--
-- On a fresh database the files run in filename order, so 0400 recreates the
-- ORIGINAL, too-strict app_guard_sport_rep() — the one that also blocked the
-- service role and direct SQL, which is what stopped `npm run create-admin`
-- from bootstrapping the first admin. 0101's fix ran earlier and is therefore
-- overwritten.
--
-- This file re-applies the fixed definition, and because it sorts after 0400
-- it wins on every database: fresh ones get the fix back, and the hosted
-- project (where 0101 already ran last) gets an identical replacement, which
-- is a no-op in effect.
--
-- It is deliberately a copy of the body in 0101 rather than a clever
-- indirection. If this guard ever changes again, change it here — this is the
-- definition that ends up in every environment.

create or replace function app_guard_sport_rep () returns trigger
language plpgsql security definer
set search_path = public as $$
begin
  if new.rep_id is distinct from old.rep_id
     and (select auth.uid ()) is not null
     and not app_is_admin () then
    raise exception 'only admins may assign sport reps';
  end if;
  return new;
end;
$$;

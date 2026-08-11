-- Fix: the privilege guards (roles/is_active on profiles, rep_id on sports)
-- blocked EVERY caller that isn't a signed-in admin — including the service
-- role and direct database connections, because triggers fire regardless of
-- RLS. That made bootstrapping the first admin impossible
-- (scripts/create-admin.mjs failed with "only admins may change roles").
--
-- The guards' actual job is to stop a signed-in non-admin changing these
-- columns (RLS lets people update their own profile row). Service-role and
-- direct-SQL contexts have no signed-in user: auth.uid() is null there, and
-- RLS already stops anonymous/authenticated users without a matching policy
-- from updating at all. So: allow when there is no user context.

create or replace function app_guard_profile_privileges () returns trigger
language plpgsql security definer
set search_path = public as $$
begin
  if (new.role is distinct from old.role
      or new.is_active is distinct from old.is_active)
     and (select auth.uid ()) is not null
     and not app_is_admin () then
    raise exception 'only admins may change roles or active status';
  end if;
  return new;
end;
$$;

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

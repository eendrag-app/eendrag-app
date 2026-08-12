-- Reps are appointed by typing their details, not by picking an existing
-- account out of a dropdown.
--
-- The old flow could only appoint someone who had already signed up, which is
-- backwards: the HK knows who runs hockey long before that person opens the
-- app. Now the admin types a name, a phone number and the rep's student
-- email, and the email is what eventually grants the permission.
--
-- rep_id is still the ONLY thing that grants edit rights — app_is_rep_of()
-- is untouched. The email is a claim ticket, not an authorisation.
--
-- Why not authorise on the email directly: profiles.email is editable by its
-- owner (policy "profiles_update_own" in 0100, and the privilege guard covers
-- only role and is_active). A student could set their own email to the
-- hockey rep's address and inherit the sport. Matching happens once, against
-- the address Supabase actually verified in auth.users, and writes rep_id.

alter table sports
  add column rep_name text not null default '',
  add column rep_phone text not null default '',
  add column rep_email text not null default '';

-- Looked up once per signup; partial because most sports have no email set.
create index sports_rep_email on sports (lower(rep_email)) where rep_email <> '';

-- ---------------------------------------------------------------------------
-- Claim on signup: when the rep finally makes an account, the sport is
-- already waiting for them.
--
-- This is a superset of the 0100 version — profile row and default
-- notification toggles, then the claim. Replaced wholesale rather than added
-- alongside because auth.users only gets the one sanctioned trigger.
--
-- Two things make the claim legal from here. The function is SECURITY
-- DEFINER, so RLS does not apply; and during signup auth.uid() is null, which
-- app_guard_sport_rep (as fixed in 0101, re-applied in 0402) explicitly
-- allows — that guard only blocks a signed-in non-admin.
-- ---------------------------------------------------------------------------
create or replace function app_handle_new_user () returns trigger
language plpgsql security definer
set search_path = public as $$
declare
  claimed integer;
begin
  insert into profiles (id, email) values (new.id, new.email);
  -- Default toggles: everything on except section-only mode ('section'),
  -- which is an opt-in noise filter (see src/core/notifications/targeting.ts).
  insert into notification_preferences (profile_id, category, enabled)
  select new.id, c.category, c.category <> 'section'
  from (values ('announcement'), ('urgent'), ('calendar'),
               ('intersection'), ('sport'), ('section')) as c (category);

  -- Any sport the HK appointed this address to, before it had an account.
  update sports
     set rep_id = new.id
   where rep_email <> ''
     and lower(rep_email) = lower(new.email)
     and rep_id is distinct from new.id;

  get diagnostics claimed = row_count;

  -- A rep needs the sport_rep role for the Admin tab to appear. Only lifted
  -- from 'student': an admin who happens to run a sport stays an admin.
  if claimed > 0 then
    update profiles set role = 'sport_rep'
     where id = new.id and role = 'student';
  end if;

  return new;
end;
$$;

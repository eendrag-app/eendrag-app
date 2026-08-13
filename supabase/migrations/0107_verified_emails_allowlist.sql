-- The res list becomes the door.
--
-- Turning "Confirm email" off in Supabase solves the launch-night problem
-- (its built-in mailer will not deliver 280 confirmations in an evening) but
-- it also removes the only proof that somebody owns the address they typed.
-- This puts a better check in its place: an address has to be on the HK's
-- list of residents before an account can be created at all.
--
-- verified_emails has existed and sat empty since 0100 waiting for exactly
-- this. Two things are added here.

-- 1. The name, so a resident does not type it themselves.
--    The HK's list already has it, everyone spells their own name
--    differently at 23:00, and a res app whose member list reads "olisrauss"
--    is worse than one that reads "Oli Strauss".
alter table verified_emails
  add column full_name text not null default '';

-- 2. A yes/no the signup page can ask BEFORE anyone is signed in.
--
--    verified_emails is admin-only under RLS (0100) and must stay that way:
--    it is a list of 280 students' addresses and names. A security definer
--    function that answers one boolean leaks nothing else, and keeps this
--    check out of the service-role client, whose uses are deliberately
--    counted (docs/ARCHITECTURE.md).
create function app_email_is_verified (addr text) returns boolean
language sql security definer stable
set search_path = public as $$
  select exists (select 1 from verified_emails where email = lower(trim(addr)));
$$;

-- Anon on purpose: the question is asked by someone who has no account yet.
grant execute on function app_email_is_verified (text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Signup now also picks the resident's name off the list.
--
-- Replaced wholesale rather than added alongside, for the same reason 0403
-- did it: auth.users gets one sanctioned trigger. This is a superset of the
-- 0403 version — profile row, default notification toggles, sport-rep claim —
-- with the name lookup added to the first step.
-- ---------------------------------------------------------------------------
create or replace function app_handle_new_user () returns trigger
language plpgsql security definer
set search_path = public as $$
declare
  claimed integer;
  listed_name text;
begin
  select full_name into listed_name
    from verified_emails
   where email = lower(new.email);

  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(listed_name, ''));

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

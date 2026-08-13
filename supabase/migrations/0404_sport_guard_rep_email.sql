-- Close a hole opened by 0403: rep_email is authorisation, so guard it like
-- rep_id.
--
-- "sports_update_admin_or_own_rep" (0400) lets a rep edit their own sport's
-- row — practice times, venue, description. app_guard_sport_rep stopped them
-- touching rep_id, which was the whole story until 0403 added rep_email and a
-- trigger that turns a matching signup into rep_id.
--
-- Without this, a rep could set their sport's rep_email to a friend's address
-- and the friend would inherit the sport the moment they signed up: the HK
-- appoints reps, and a rep must not be able to appoint their own successor.
--
-- rep_name and rep_phone are deliberately NOT guarded. They are the contact
-- card and nothing else, and a rep fixing their own phone number without
-- filing a request with the HK is a feature.

create or replace function app_guard_sport_rep () returns trigger
language plpgsql security definer
set search_path = public as $$
begin
  -- As in 0101/0402: a null auth.uid() means the service role, a direct psql
  -- session, or the signup trigger — none of which is a signed-in non-admin,
  -- and all of which RLS has already had its say about.
  if (new.rep_id is distinct from old.rep_id
      or new.rep_email is distinct from old.rep_email)
     and (select auth.uid ()) is not null
     and not app_is_admin () then
    raise exception 'only admins may assign sport reps';
  end if;
  return new;
end;
$$;

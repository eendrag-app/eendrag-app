-- Posting a sport result auto-creates a short announcement so the res sees it
-- on the feed ("Hockey: beat Helshoogte 3–1"). The announcement is written by
-- the rep, from application code, under the rep's own session — which the
-- announcements policies from 0300 did not allow: only admins could insert.
--
-- Rather than reach for the service-role client (which would put a hole in the
-- "RLS is the authorisation layer" rule), this adds a narrow insert policy: a
-- sport rep may create an announcement ONLY if it is a system announcement,
-- authored by themselves, published, res-wide, and not urgent. Everything else
-- about announcements stays admin-only — reps still cannot edit or delete any
-- announcement, including their own (an admin can).

-- "Does this user run any sport?" — the per-sport check (app_is_rep_of) is
-- about a specific sport; this one is about the person.
create function app_is_any_sport_rep () returns boolean
language sql security definer stable
set search_path = public as $$
  select exists (
    select 1
    from sports s
    join profiles p on p.id = s.rep_id
    where s.rep_id = (select auth.uid ())
      and s.is_active
      and p.is_active
  );
$$;

create policy "announcements_rep_system_insert" on announcements
  for insert to authenticated
  with check (
    is_system
    and author_id = (select auth.uid ())
    and status = 'published'
    and target_section_id is null
    and not is_urgent
    and app_is_any_sport_rep ()
  );

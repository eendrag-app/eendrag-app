-- A three-way tie in a group is decided by the HK, not by the app.
--
-- WHY THIS IS NEEDED AT ALL. A group is three sections playing each other
-- once, no draws, three points a win. That leaves exactly two possible
-- outcomes: someone wins both (6/3/0, and the order is obvious), or all three
-- win one each (3/3/3). The second one is a cycle — A beat B, B beat C, C beat
-- A — so head-to-head cannot break it either, and there is no score
-- difference to fall back on because the app has never recorded scores.
--
-- Until now the sort fell through to comparing section NAMES, which quietly
-- sent Arendstraat through ahead of Wineroute for no reason anybody could
-- defend. The HK settles those on the day, by whatever the res does (a
-- play-off, a coin toss), and now types the answer in.
--
-- Two columns rather than a rank on each team row: a group only ever needs to
-- know who is 1st and who is 2nd. Third place is whoever is left, and nothing
-- in the bracket asks about it.
alter table intersection_groups
  add column first_section_id uuid references sections (id) on delete set null,
  add column second_section_id uuid references sections (id) on delete set null,
  -- Both or neither, and never the same section twice. A half-set tie-break
  -- would resolve one quarter-final and leave its partner empty.
  --
  -- Spelled out as two whole cases rather than "is distinct from": null IS
  -- NOT distinct from null, so the tidier version rejected every existing
  -- row, which is exactly the state each of them is in.
  add constraint intersection_groups_tiebreak_pair check (
    (first_section_id is null and second_section_id is null)
    or (
      first_section_id is not null
      and second_section_id is not null
      and first_section_id <> second_section_id
    )
  );

-- No new policies: intersection_groups_select (anon + authenticated) and
-- intersection_groups_admin_all from 0500 already cover these columns.

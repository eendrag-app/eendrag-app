-- Two per-event options, ported from the old intersection app (its commits
-- 78ba91b for draws, 02e1a47..220b2c2 for score difference). Both default to
-- off, so every existing event keeps behaving exactly as before.
--
-- allow_draws: a GROUP game may end level, 1 point each (a win is 3).
--   Knockout games never can — somebody always has to go through.
-- score_diff: every fixture records a score per team, the app works out the
--   result from them, and sections level on points are ranked on score
--   difference, then scores for, before head-to-head and the HK's call.
--
-- The rules live in src/modules/intersection/lib/tournament.ts; this file only
-- stores what they need.
alter table intersection_events
  add column allow_draws boolean not null default false,
  add column score_diff boolean not null default false;

-- a_score / b_score, NOT score_a / score_b: the old app once had fields called
-- scoreA/scoreB and its migrate() still deletes them from every backup, so
-- reusing those names would invite the import to carry a ghost across.
--
-- Scores are nullable on purpose. A result saved before score difference was
-- switched on has none; it shows "Score needed" and counts for nothing in the
-- difference until the admin types them in.
alter table intersection_matches
  add column is_draw boolean not null default false,
  add column a_score integer check (a_score >= 0),
  add column b_score integer check (b_score >= 0);

-- 0500 said a played match always has a winner. A draw does not. That check
-- was unnamed, so it is found by what it says rather than guessed by name —
-- Postgres's generated names depend on the order the checks were written.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'intersection_matches'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%NOT played%winner_section_id IS NOT NULL%'
  loop
    execute format('alter table intersection_matches drop constraint %I', c.conname);
  end loop;
end $$;

alter table intersection_matches
  add constraint intersection_matches_played_has_result
    check (not played or winner_section_id is not null or is_draw),
  -- A draw has no winner, is a group game, and is a result.
  add constraint intersection_matches_draw_shape
    check (not is_draw or (winner_section_id is null and stage = 'group' and played));

-- No new policies: the select and admin policies from 0500 cover new columns.

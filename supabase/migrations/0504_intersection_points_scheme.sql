-- Align the leaderboard points with the competition that is actually being
-- played.
--
-- Three different schemes were live at once, which is one more than any
-- competition can survive:
--
--   12 / 8 / 5 / 3 / 0   the old intersection app (eendrag-intersection,
--                        POINTS in src/store.js, POINTS_VERSION 2) — the app
--                        the res has used all season, so the scoreboard of
--                        record
--   12 / 8 / 6 / 3 / 0   this database, edited by hand in Admin -> Settings
--   15 / 12 / 9 / 6 / 3  this migration block's original default, and what
--                        CLAUDE.md called res law
--
-- The old app wins, because it is the one the res has been reading. CLAUDE.md
-- is corrected in the same change rather than left to contradict this file.
--
-- Not silent, per CLAUDE.md: the numbers only ever mattered once an event's
-- final was played, and no event in either app has one yet, so nothing already
-- scored changes.
--
-- The bracket format (4 groups of 3, A1-B2/C1-D2/B1-A2/D1-C2) is untouched.
-- That part really is res law.

alter table intersection_settings
  alter column points_champion set default 12,
  alter column points_runner_up set default 8,
  alter column points_semis set default 5,
  alter column points_quarters set default 3,
  alter column points_group set default 0;

-- The settings row already exists (0500 inserts it), so the new defaults alone
-- would change nothing on a database that has been running.
update intersection_settings
set points_champion = 12,
    points_runner_up = 8,
    points_semis = 5,
    points_quarters = 3,
    points_group = 0
where id = 1;

-- Intersection is a competition between sections, not between people.
--
-- The roster (who from each section played in an event) and the individual
-- player leaderboard built on top of it are removed. What stays is what the
-- res actually competes over: the events, the draw, the results and the
-- section rankings.
--
-- This DROPS data. It is safe here because everything in these two tables was
-- placeholder from seed.sql — twenty-four invented names, none of them linked
-- to a real account (profile_id was null on every row) — and the res has not
-- been onboarded. If this migration is ever run against a database where that
-- is not true, the names are gone.
--
-- Dropped rather than left in place on purpose: an unused table with live RLS
-- policies is a question a future maintainer has to answer before they can
-- trust anything near it, and answering it costs more than this file does.

-- rosters first: it references intersection_players.
drop table if exists intersection_rosters;
drop table if exists intersection_players;

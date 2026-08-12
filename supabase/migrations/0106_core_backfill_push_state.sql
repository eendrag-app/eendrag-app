-- Backfill for 0105: every notification that existed BEFORE push was built is
-- marked as already delivered.
--
-- Without this, the first cron tick after web push ships would look at every
-- historical row — `pushed_at is null`, `deliver_at` defaulted to the moment
-- 0105 ran, so all of them "due" — and buzz 280 phones with weeks of old
-- announcements at once. Exactly the failure the app exists to prevent.
--
-- `deliver_at` is set to `created_at` as well, so the column tells the truth
-- about when those rows were meant to go out rather than claiming they were
-- all scheduled for the minute the migration ran.
--
-- Safe to re-run: after this, no row matches `pushed_at is null` except ones
-- the running app has created since. (The delivery code also refuses anything
-- older than a few hours, so a tick that has been down overnight cannot
-- produce a backlog storm either — see src/core/notifications/deferred.ts.)

update notifications
set
  deliver_at = created_at,
  pushed_at = created_at
where
  pushed_at is null;

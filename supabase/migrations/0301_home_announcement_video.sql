-- Video on an announcement. Two columns, because there are two honest ways to
-- put a video in a res announcement and they cost wildly different things:
--
--   video_url   a link somebody already uploaded elsewhere (YouTube, Vimeo).
--               Free, unlimited length, and the res's data plan pays the same
--               as it would anyway. The preferred one.
--   video_path  a short clip uploaded straight into our own bucket, like an
--               image. Simplest for the HK, but every view is bandwidth off
--               OUR budget — see the size cap below and docs/DECISIONS.md.
--
-- Only one is ever set; the form offers a choice and the feed renders whichever
-- is there.
alter table announcements
  add column video_path text,
  add column video_url text,
  -- Belt and braces: the UI only ever sets one, and this makes "one or
  -- neither" true of the data as well.
  add constraint announcements_one_video check (video_path is null or video_url is null);

-- A hard ceiling on what can be uploaded, enforced by the storage service
-- rather than by the browser that could be lying about it.
--
-- 25 MB is about 45 seconds of phone video, and it is chosen against EGRESS,
-- not disk: one 25 MB clip watched by 280 people is 7 GB, and the Supabase
-- free tier includes 5 GB a month. Anything longer belongs on YouTube with the
-- link pasted in, which is why the compose form says so next to the button.
update storage.buckets
set
  file_size_limit = 26214400 -- 25 MiB
where
  id = 'announcement-attachments';

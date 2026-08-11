-- Home module: announcements + read tracking + the attachments bucket.

create table announcements (
  id uuid primary key default gen_random_uuid (),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '',
  -- null author = system-generated (e.g. auto-announcement of a sport result)
  -- or an author whose account was later removed.
  author_id uuid references profiles (id) on delete set null,
  is_urgent boolean not null default false,
  is_system boolean not null default false,
  -- null = res-wide, set = one section only
  target_section_id uuid references sections (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  scheduled_for timestamptz, -- required when status = 'scheduled'
  published_at timestamptz, -- set when status becomes 'published'
  -- Paths into the announcement-attachments storage bucket, null = none.
  image_path text,
  pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'scheduled' or scheduled_for is not null),
  check (status <> 'published' or published_at is not null)
);

create index announcements_feed on announcements (status, published_at desc);
create index announcements_section on announcements (target_section_id);

create trigger announcements_updated_at before update on announcements
  for each row execute function app_set_updated_at ();

alter table announcements enable row level security;

-- Students see published announcements that are res-wide or aimed at their
-- own section. Admins additionally see drafts and scheduled posts.
create policy "announcements_select_published" on announcements
  for select to authenticated
  using (
    status = 'published'
    and (target_section_id is null or target_section_id = app_section_id ())
  );

create policy "announcements_select_admin" on announcements
  for select to authenticated using (app_is_admin ());

create policy "announcements_admin_insert" on announcements
  for insert to authenticated with check (app_is_admin ());

create policy "announcements_admin_update" on announcements
  for update to authenticated using (app_is_admin ()) with check (app_is_admin ());

create policy "announcements_admin_delete" on announcements
  for delete to authenticated using (app_is_admin ());

-- ---------------------------------------------------------------------------
-- announcement_reads — who has opened what. PRIVACY RULE: admins see COUNTS,
-- never identities. There is deliberately no admin select policy on this
-- table; counting goes through the definer function below, which returns
-- numbers only. Keep it that way.
-- ---------------------------------------------------------------------------
create table announcement_reads (
  announcement_id uuid not null references announcements (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, profile_id)
);

alter table announcement_reads enable row level security;

create policy "announcement_reads_select_own" on announcement_reads
  for select to authenticated using (profile_id = (select auth.uid ()));

create policy "announcement_reads_insert_own" on announcement_reads
  for insert to authenticated with check (profile_id = (select auth.uid ()));

-- Open counts for the admin compose view: numbers only, admin only.
create function announcement_read_counts (announcement_ids uuid[])
returns table (announcement_id uuid, read_count bigint)
language sql security definer stable
set search_path = public as $$
  select r.announcement_id, count(*)::bigint
  from announcement_reads r
  where r.announcement_id = any (announcement_ids)
    and app_is_admin ()
  group by r.announcement_id;
$$;

-- ---------------------------------------------------------------------------
-- Storage bucket for announcement images and PDFs. Private: reads require a
-- signed-in user, writes require admin. (storage.objects is Supabase-managed;
-- these inserts/policies are the sanctioned way to configure a bucket.)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('announcement-attachments', 'announcement-attachments', false);

create policy "announcement_attachments_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'announcement-attachments');

create policy "announcement_attachments_admin_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'announcement-attachments' and app_is_admin ());

create policy "announcement_attachments_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'announcement-attachments' and app_is_admin ());

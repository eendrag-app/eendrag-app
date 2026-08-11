# Build log

What exists, what's assumed, what's stubbed, what's placeholder. Update this
whenever any of those change — it's the honest inventory the next maintainer
trusts.

## 2026-08-11 — Phase two

Phase two replaces the four placeholder module pages with real UIs. Each
bullet below lands with its own PR; anything still listed under "Deliberately
stubbed" further down has NOT changed.

### The app shell (PR: app shell)

- **Real** — sticky header (wordmark, registry-derived nav on desktop, bell,
  appearance menu) over the phone-width column; on phones the nav is pinned
  to the bottom of the screen. One `<nav aria-label="Main">` element, two
  layouts.
- **Real** — the notification bell: unread badge, bottom sheet listing the
  latest 20, tap to mark read and follow the link, "mark all read". It polls
  a server action every 60 seconds (no realtime subscription — boring wins).
- **Real** — dark mode via `next-themes` (class strategy, defaults to the
  phone's setting) with an appearance menu in the header.
- **Real** — shared module-free UI in `src/core/ui/`: date/time formatting
  (always Africa/Johannesburg, always server-side), calendar category
  colours, section badge/dot, empty state.

### Profile (PR: profile module)

- **Real** — `/profile`: details (name, section, room, sports played),
  notification switches built from the registry, quiet hours, the personal
  ICS link with copy + regenerate, the admin-tools list built from every
  module's `adminPanels`, sign out.
- **Real** — `/profile/members` (admin): search, role changes, and
  activate/deactivate. Saves as you change it.
- **Real** — the ICS feed itself: `/api/calendar/<calendar_token>.ics`,
  hand-rolled VCALENDAR text in `src/core/calendar/ics.ts` (unit-tested) fed
  by `ics-feed.ts`. Verified importing into a calendar client by URL.
- No schema changes: every table and policy this needs already existed.

### Home — feed and announcements admin (PR: home announcements)

- **Real** — `/`: the announcement feed. Urgent posts carry the destructive
  accent and stay pinned above everything for 24 hours after publishing, then
  flow normally. Long bodies clamp with "Read more". Section badge on
  targeted posts, image attachments inline and PDFs as a labelled link (both
  through short-lived signed URLs). Search over the whole archive
  (title + body), paging back through older posts.
- **Real** — read receipts: a post counts as opened once it has been half on
  screen for a second or the reader expands it. HK sees the count only,
  through `announcement_read_counts()`.
- **Real** — `/admin/announcements` (+ `/new`, `/[id]`): compose, target the
  res or one section, urgent toggle, image/PDF upload straight to the private
  bucket from the browser, and save as draft / schedule / publish now.
  Publishing notifies through `notify()` — urgent posts under the `urgent`
  category so they bypass quiet hours.
- **Still missing** — scheduled posts do not go out by themselves yet; the
  compose form says so when no cron secret is configured. The cron tick is
  its own PR (HANDOFF §6).
- Two phase-one defects fixed on the way: `--font-sans` was mapped to itself
  in globals.css, so every page rendered in the browser's default serif
  instead of Geist; and the header's `backdrop-blur` made it the containing
  block for the `fixed` tab bar, which pinned the bar inside the header on
  phones.

## 2026-08-11 — Phase one

### Exists and works (verified)

- Next.js 16 scaffold; `npm run dev`, `check` (typecheck+lint+test), and the
  production build all green. 44 unit tests passing.
- Module system: `AppModule` contract, registry, registry-derived tab bar,
  `_template` module registered and routable at `/template`, four feature
  modules registered as placeholder pages. ESLint boundary rule
  (module→module and core→module imports are errors) verified against
  planted violations.
- All migrations (0100–0500) and `seed.sql` written; RLS with explicit
  policies on every table.
- `src/core` complete: db clients, auth provider (open mode) + middleware
  gating from the registry, permissions helpers, calendar service,
  notification pipeline with targeting + quiet hours, channels.
- Intersection tournament logic ported from the old app with parity tests.
- Minimal login/signup/onboarding pages (functional, unstyled-ish).
- Dockerfile, docker-compose.yml, CI workflow, Playwright smoke tests.
- Docs: CLAUDE.md, README, ARCHITECTURE, ADDING-A-MODULE, ADMIN-GUIDE,
  OPERATIONS, DECISIONS, HANDOFF, this file.

### Verified against live infrastructure (2026-08-11, later the same day)

- Hosted Supabase project (`wznutdfrtfsgelugtznz`) linked; all migrations
  (0100–0500 + 0101 fix) pushed, seed applied (`db push --include-seed`).
- Local stack (`supabase start` + fresh reset) applies migrations + seed
  cleanly from zero.
- `src/core/db/database.types.ts` regenerated from the real schema.
- Dev admin created on the hosted project (`npm run create-admin`).
- `npm run test:rls`: 24/24 passing against the hosted project.
- Playwright smoke: 6/6 passing (mobile + desktop) against the dev server.
- Docker: `docker compose --env-file .env.local build` succeeds; the
  container serves `/intersection` 200 signed-out and 307-redirects `/` to
  login.

Verification found and fixed two real issues, recorded in DECISIONS.md:
the privilege-guard triggers blocked service-role bootstrap (migration
0101), and block-numbered fix migrations need `db push --include-all`
(now baked into `npm run db:push`).

### Deliberately stubbed (by design, not debt)

- **Auth**: open signup, no email confirmation, no domain restriction.
  `AUTH_MODE` / `REQUIRE_SUN_EMAIL` flags + empty `verified_emails` table
  are ready for the magic-link switch (ARCHITECTURE → Auth).
- **Web push**: `webPushChannel` logs instead of sending. Interface final;
  implementation steps documented in the stub (v1.1).
- **Scheduled sends**: `announcements.scheduled_for` and reminder triggers
  have schema + spec but no cron wiring (HANDOFF → Known gaps).
- **Feature module UIs**: placeholder pages only — phase two builds them
  from HANDOFF.

### Placeholder data (all in `supabase/seed.sql`, trivially replaceable)

- Sports list (8), practice times, venues, one placeholder coach name.
- Announcements (4 + 1 scheduled), calendar events (3 manual + 3 mirrored).
- Sport fixtures (3) and results (2).
- Intersection: completed "Touch Rugby Day" with a full played-out bracket
  (Katstraat champion), upcoming "5-a-side Soccer" with no draw, 24
  placeholder players (2 per section) with rosters.
- Real: the 12 section names. Section colours are my choices — HK should
  confirm them (`sections.color`).
- No sport reps assigned (reps must be real signed-up users; assign via
  Profile → Admin or `scripts/create-admin.mjs` pattern).

### Assumptions phase two should know

- Section colours in `sections.color` are invented placeholders.
- `profiles.email` duplicates auth email for convenience; res-internal
  visibility of names/sections/emails is accepted (280 people who live
  together).
- The old Intersection app stays live on Render until the module reaches
  parity; retire it then (its README documents its own ops).

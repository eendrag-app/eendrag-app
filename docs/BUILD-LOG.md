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

### Calendar (PR: calendar)

- **Real** — the shared calendar on `/`, under the feed on a phone and beside
  it from `lg` up: month grid with colour-coded dots, tap a day for its
  events, an agenda toggle, and category filter chips. One query loads a
  window of a month back to a year ahead; paging months costs nothing.
- **Real** — `/admin/calendar` (+ `/new`, `/[id]`): create, edit and delete
  res-wide, section and social events, with a calendar notification on
  creation and on a real change (time or place). Module-mirrored rows (sport
  fixtures, intersection games) are listed but read-only, labelled with the
  module that owns them — editing them here would be undone by the next
  mirror.
- The ICS feed (shipped with Profile) carries all of it into phone calendars.

### Sport (PR: sport module)

- **Real** — `/sport`: every active sport as a row with its practice summary
  and its most recent result. `/sport/[id]`: practice, venue, coach,
  description, the rep's card with an email button, fixtures, results, the
  squad (people who play it plus people who signed up), and a sign-up button
  with undo.
- **Real** — rep editing lives on the sport's own page, not a separate admin
  screen: practice/venue/coach/description, fixture create-edit-delete, and
  result posting. Fixtures mirror onto the shared calendar through
  `upsertModuleEvent`; deleting one removes its calendar entry.
- **Real** — notifications are one per action and only when something moved:
  a practice/venue change sends one (not one per field), a new or moved
  fixture sends one, a result sends one. Verified end to end by driving the
  UI as a real sport rep against the hosted database.
- **Real** — posting a result also writes the one-line announcement to the
  res feed, authored by the rep. That needed a new narrow insert policy —
  migration **0401**, with six RLS tests (see DECISIONS.md).
- **Real** — `/sport/admin`: add a sport, pause one, and appoint reps
  (appointing also grants the sport_rep role). Reps see a link to their own
  sport instead.
- **Migration 0201** fixes a phase-one bug found here: the unique index behind
  `upsertModuleEvent` was partial, which Postgres refuses to use for
  `on conflict`, so every module calendar mirror failed. Nothing had
  exercised it before.
- RLS suite is now 33 tests, all green against the hosted project.

### Intersection (PR: intersection module)

- **Real, and public without a login** — `/intersection` (season leaderboard
  + events with a champion badge or a next-fixture line),
  `/intersection/events/[id]` (group standings, every fixture by stage with
  winners and score notes, rules, rosters), `/intersection/players` (events
  entered and games won).
- **Real** — `/intersection/admin`: events, leaderboard points, and the
  player list. `/intersection/admin/[id]`: generate the draw, move teams
  between groups until the games start, set a time per fixture, enter and
  clear results, override a knockout pairing by hand, pick the roster.
- **The rules are never reimplemented.** Draw generation, standings, knockout
  progression, placements and points all come from `lib/tournament.ts` (the
  phase-one port). The module loads rows, calls it, writes the answer back.
- **The old app's guards are back, and tested** (`lib/guards.ts`, 11 tests):
  a group result locks once any knockout has been played; a knockout result
  locks once the match it feeds has been played; groups freeze when the first
  group game is played; the draw can only be redone while nothing has been
  played. Every guard is evaluated on the server and the reason is shown to
  the admin.
- **App-powers** — a fixture with a time mirrors onto the shared calendar
  (and its title updates as the teams become known); results notify both
  sections involved, including a "Katstraat move to 2nd" line when the
  leaderboard actually shifted.
- Verified against the hosted database: the seeded completed event renders
  with Katstraat as champion and the leaderboard matches, a draw generated
  through the UI produced 4 groups and 19 fixtures (12 group, 4 QF, 2 SF, 1
  final), entering a result moved the event to "in progress" and locked the
  groups. The test draw was removed afterwards.

### Known rough edge in the seed data

`supabase/seed.sql` builds its times from `date_trunc('day', now())`, which
Postgres evaluates in UTC — so seeded events land two hours later than the
wall-clock time the copy implies ("Huisvergadering 19:00" shows as 21:00).
Harmless for placeholder data, worth fixing whenever the real calendar
replaces it.

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

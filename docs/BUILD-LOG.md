# Build log

What exists, what's assumed, what's stubbed, what's placeholder. Update this
whenever any of those change — it's the honest inventory the next maintainer
trusts.

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

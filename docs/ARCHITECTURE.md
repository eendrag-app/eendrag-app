# Architecture

The Eendrag app replaces a 280-person WhatsApp announcement group as the
official channel for res information. Everything about its shape follows four
constraints, in priority order: **handover-first** (a new student maintainer
must ship a change within an hour of cloning), **modular** (a new mini-app =
one folder + one registry line), **portable** (movable from managed hosting
to a university server), **boring** (mainstream tools, no clever
abstractions).

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js (App Router) + TypeScript | The most-documented React stack there is |
| UI | Tailwind v4 + shadcn/ui + lucide-react | Copy-paste components, no design lock-in |
| Data & auth | Supabase (Postgres + Auth + RLS + Storage) | Managed now, self-hostable later; the schema is plain Postgres |
| Validation | Zod on every input | One habit, everywhere |
| Tests | Vitest (unit + RLS) and Playwright (e2e) | |
| Hosting | Vercel now; Docker anywhere later | See docs/DECISIONS.md |

## The big picture

```
Browser ──▶ Next.js (Vercel or Docker)
              │  src/app         thin routes + shell (nav from the registry)
              │  src/modules     the mini-apps (home, calendar, sport,
              │                  intersection, admin, profile)
              │  src/core        shared services (auth, db, calendar, notifications, permissions)
              ▼
            Supabase ── Postgres (+ RLS = the real authorisation layer)
                     ── Auth (email/password today, magic links later)
                     ── Storage (announcement attachments)
```

Three layers, one direction of dependency:

- **`src/app`** — routing only. A route file is a 2-line re-export of a
  module page. The shell (tab bar) derives from the module registry.
- **`src/modules`** — each folder is a self-contained mini-app declaring
  itself via the `AppModule` contract (`src/modules/types.ts`), registered in
  `src/modules/registry.ts`. **A module never imports from another module** —
  ESLint (`boundaries/dependencies` in eslint.config.mjs) makes this an
  error, verified by tests against planted violations.
- **`src/core`** — everything shared: db clients, auth, permissions,
  calendar, notifications. Core never imports modules; it cannot know what
  modules exist. Cross-module effects (a sport result appearing on the
  calendar) happen because both sides talk to core services, never to each
  other.

## Authorisation: RLS is the enforcement point

Roles (`student`, `sport_rep`, `admin`) live on `profiles.role`. Every table
has Row Level Security enabled with explicit policies, written in the same
migration that creates the table. UI checks (`requireRole`, hidden buttons)
are conveniences; the database is the gate. `supabase/tests/rls.test.ts`
proves the interesting cases (student can't post announcements, a rep can
only edit their own sport, nobody can self-promote to admin).

Postgres helper functions (`app_is_admin()`, `app_section_id()`,
`app_is_rep_of(uuid)`) are `security definer` so policies stay one-liners.

The service-role client (`src/core/db/admin.ts`) bypasses RLS and is
restricted to four uses: the notification pipeline fan-out, calendar
mirroring, the ICS calendar feed (a subscribing calendar app has no session,
and the token in the URL is the credential — `ics-feed.ts` applies the
visibility rule by hand), and the cron tick (`/api/cron/tick` runs with no
user; it is protected by `CRON_SECRET`). Anything user-initiated uses the
session-scoped server client.

## Auth (deliberately stubbed — and how to un-stub it)

Current mode: `AUTH_MODE=open` — email + password, no confirmation, anyone
can sign up. This is a deliberate pilot-phase choice.

Everything auth-shaped goes through `src/core/auth/provider.ts`. Switching to
@sun.ac.za magic links against a whitelist is:

1. Populate `verified_emails` (table already exists, empty; admin-only RLS).
   One insert per allowed student email.
2. In `provider.ts`, implement the `sun_email_magic_link` branches of
   `signUp`/`signIn`: check `verified_emails`, then
   `supabase.auth.signInWithOtp({ email })` — no passwords. Add the
   `/auth/confirm` route handler for the email link (Supabase docs: "Email
   OTP / magic link with SSR").
3. In the Supabase dashboard: enable the email OTP template, disable password
   signups.
4. Set `AUTH_MODE=sun_email_magic_link` and `REQUIRE_SUN_EMAIL=true` in the
   environment. `REQUIRE_SUN_EMAIL` also works today, independently: it
   rejects non-@sun.ac.za signups in open mode.

Nothing else changes: sessions, middleware, profiles trigger, and RLS are
identical in both modes.

Route protection: `src/middleware.ts` → `src/core/auth/middleware.ts`
refreshes the session cookie on every request and redirects signed-out users
away from any module whose registry entry says `requiresAuth: true`. The
intersection module sets `requiresAuth: false` — public on purpose (fixture
links get pasted into WhatsApp).

## The calendar: one table, module mirrors

`events` is the single source of truth for every date. Manual entries are
created by admins (RLS-checked). Modules mirror their own rows into it
through `src/core/calendar`:

- `upsertModuleEvent({sourceModule, sourceRef, ...})` — keyed upsert on the
  unique `(source_module, source_ref)` index: writing the same fixture twice
  updates in place.
- `removeModuleEvent(module, ref)` — deleting the source removes the entry.

So sport fixtures and intersection draws appear automatically, follow
changes, and vanish on delete — and no module keeps a parallel calendar.

## Notifications

The reason the app exists. Flow (all in `src/core/notifications`):

```
notify(trigger)                              [pipeline.ts — server only]
  → fetch candidates (profiles + prefs + user_sports, admin client)
  → resolveRecipients(trigger, candidates)   [targeting.ts — pure, tested]
      audience (all | section | sport | role)
      → category toggle (urgent checks only the 'urgent' toggle)
      → section-only mode filter
  → one notifications row per recipient      [always persisted — the bell]
  → channels: inAppChannel (live), webPushChannel (stub)
      quiet hours defer deliverAt per recipient; urgent never defers
```

Semantics worth knowing (all pinned by tests in `targeting.test.ts` and
`quiet-hours.test.ts`):

- **Persist always, defer delivery.** Quiet hours (default 23:00–07:00, per
  user) never suppress the bell row; they push the future push-channel send
  to the morning. Urgent bypasses.
- **Section-only mode** (`section` category, default off): when a user
  enables it, non-urgent notifications not about their section are dropped
  for them. Triggers say what they're "about" via `aboutSectionId`.
- **Missing preference rows** behave like the signup defaults (all on except
  section-only).

Web push is v1.1: `webPushChannel` in `channels.ts` documents exactly what
implementing it needs (VAPID keys, a push_subscriptions table, a service
worker, a cron route for deferred sends). The interface is final.

## The database

Migrations in `supabase/migrations/`, numbered per module block (see the
README there). Applied by `npm run db:push`, or plain `psql -f` in filename
order — no Supabase-only SQL outside clearly-marked `storage`/`auth`
touches. Placeholder seed data lives in ONE file, `supabase/seed.sql`,
flagged in docs/BUILD-LOG.md.

Schema map (details in the migration files, which are commented):

- **core:** `sections` (the 12; no colours — see migration 0104),
  `sports` (catalogue),
  `profiles` (role, section, quiet hours, ICS token), `user_sports`,
  `notification_preferences`, `notifications`, `verified_emails` (empty until
  the auth switch)
- **calendar:** `events` (category, section, starts/ends, source_module +
  source_ref for mirrors)
- **home:** `announcements` (draft/scheduled/published, urgent, section
  targeting, image/pdf paths), `announcement_reads` (admins get counts via
  `announcement_read_counts()`, never identities)
- **sport:** `sports.rep_id`, `sport_fixtures`, `sport_results`,
  `sport_signups`
- **intersection:** `intersection_settings` (leaderboard points),
  `_events`, `_groups`, `_group_teams`, `_matches`, `_players`, `_rosters` —
  relational port of the old app's JSON blob; tournament rules live in
  `src/modules/intersection/lib/tournament.ts` (pure, tested)

## Portability

- `Dockerfile` builds the standalone Next.js server; `docker-compose.yml`
  runs it against any Supabase URL.
- The schema is plain Postgres; Supabase-specific surface is Auth, Storage,
  and the `auth.users` trigger — each called out in comments where touched.
- Moving to a university server = self-hosted Supabase (or Postgres + a small
  auth swap) + this container. Step-by-step in docs/OPERATIONS.md.

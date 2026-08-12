# CLAUDE.md — context for AI sessions on this repo

Read this first. You are working on the **Eendrag App**: the official app of
Eendrag residence, Stellenbosch (~280 students). It replaces the res's
WhatsApp announcement group with announcements, a shared calendar, sport
info, and the inter-section competition ("Intersection", 12 sections). Users
are students on phones; admins are the HK (house committee); the maintainer
after mid-2027 is a student who inherited this repo cold. **No human who
built this is reachable — the repo must answer every question.**

## The four constraints, in priority order

1. **Handover-first.** A new student must clone, run, and ship a change
   within an hour. Prefer the readable option over the clever one, always.
2. **Modular.** A new mini-app = one folder under `src/modules/` + one line
   in `src/modules/registry.ts` (+ thin route re-exports + a migration).
   Recipe: `docs/ADDING-A-MODULE.md`.
3. **Portable.** Vercel + Supabase today; a university server tomorrow.
   Plain Postgres, working Dockerfile, provider-specific code kept thin.
4. **Boring.** Mainstream tools only. If a solution needs a paragraph to
   justify its cleverness, it's wrong.

## Stack

Next.js (App Router) + TypeScript, Tailwind v4 + shadcn/ui + lucide-react,
Supabase (Postgres/Auth/RLS/Storage), Zod on every input, Vitest + Playwright.
Node 24. Windows-friendly (the original dev machine was Windows).

## Folder map

```
src/app/          THIN routing only. Route files are 2-line re-exports of
                  module pages. (app) group = shell with registry-driven nav;
                  (auth) group = login/signup/onboarding.
src/modules/      One folder per mini-app: home, calendar, sport,
                  intersection, admin, profile, _template (copy me). Each
                  declares itself via module.ts (AppModule) and is listed in
                  registry.ts. `admin` owns no screens of its own — it lists
                  every other module's adminPanels.
src/core/         auth/ (provider, session middleware), db/ (browser/server/
                  admin clients + database.types.ts), permissions/, calendar/
                  (+ ics for the feed), notifications/ (targeting, quiet
                  hours, pipeline, channels), ui/ (module-free shared bits:
                  date formatting, category colours, the bell, theme).
supabase/         migrations/ (numbered per module — README there), seed.sql
                  (ALL placeholder data in this one file), tests/ (RLS proofs).
docs/             ARCHITECTURE, ADDING-A-MODULE, ADMIN-GUIDE, OPERATIONS,
                  DECISIONS (why things are the way they are), BUILD-LOG
                  (what's real vs stubbed), HANDOFF (phase-two brief).
```

## The iron rules

- **A module never imports from another module.** ESLint
  (`boundaries/dependencies`) makes it an error. Cross-module effects go
  through `src/core` (calendar mirrors, notifications). Core never imports
  modules.
- **RLS is the authorisation layer.** Every table has explicit policies in
  the migration that creates it. UI/role checks are conveniences. If data
  seems missing, check policies before adding service-role calls — the
  admin client (`src/core/db/admin.ts`) is ONLY for the notification
  fan-out and calendar mirroring.
- **One calendar.** Modules write dates via `@/core/calendar`
  (`upsertModuleEvent` keyed on source_module+source_ref), never their own
  date tables.
- **Never edit an applied migration.** Add a new numbered file; blocks per
  module are allocated in `supabase/migrations/README.md`. After schema
  changes run `npm run db:types`.
- **Server actions:** Zod-parse → work → return `{ ok } | { ok: false,
  error }`. Pattern: `src/modules/_template/actions.ts`.

## Commands

`npm run dev` · `npm run check` (typecheck+lint+test, run before pushing) ·
`npm run test:rls` (needs live db) · `npm run db:push` / `db:types` ·
`npx supabase start` / `db reset` (local stack) · `npm run create-admin`
(dev admin: admin@eendrag.dev / eendrag-dev-admin). `main` is protected —
branch + PR (`gh pr create`), conventional commits.

## What's deliberately stubbed or placeholder (details: docs/BUILD-LOG.md)

- **Auth is open** (email+password, no confirmation, anyone signs up) — on
  purpose for the pilot. The switch to @sun.ac.za magic links is one file +
  one flag; exact steps in docs/ARCHITECTURE.md → Auth. `verified_emails`
  exists, empty, waiting.
- **Web push is real** — `webPushChannel` sends through
  `src/core/notifications/web-push.ts`; deferred (quiet-hours) sends go out
  from the cron tick. It needs `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` +
  `WEB_PUSH_PRIVATE_KEY` set, per-device consent, and on iOS the app added to
  the home screen. Without the keys nothing is sent and nothing breaks
  (docs/OPERATIONS.md → Notifications on a phone).
- **The feature modules are built** (phase two, docs/BUILD-LOG.md).
  `docs/HANDOFF.md` is still the spec they were built to — read it before
  changing behaviour, and don't invent behaviour it already settles.
- **Seed data is placeholder** except the 12 section names. It all lives in
  `supabase/seed.sql`, clearly marked.
- **Scheduled sends are wired**: `/api/cron/tick` (secret-protected,
  idempotent) publishes due announcements and sends day-of reminders;
  `vercel.json` runs it every 5 minutes. It needs `CRON_SECRET` set, and
  refuses to run without it — docs/OPERATIONS.md → Scheduled work.

## Gotchas

- `npm run typecheck` runs `next typegen` first — plain `tsc` alone fails on
  Next's generated `PageProps`/`LayoutProps` types.
- The old Intersection app (repo `OliStrauss/eendrag-intersection`, deployed
  on Render+Neon) is still live until the intersection module reaches
  parity. Its tournament rules are already ported —
  `src/modules/intersection/lib/tournament.ts`, behaviour pinned by tests.
  The bracket format (4 groups of 3, A1–B2/C1–D2/B1–A2/D1–C2, 15/12/9/6/3
  points) is res law — never change it silently.
- The `section` notification category is "section-only mode", an opt-in
  noise filter — NOT "notify me about my section". Semantics pinned in
  `src/core/notifications/targeting.test.ts`.
- Migration filenames MUST start with digits or `supabase db push` silently
  skips them.
- **PostgREST embeds need the foreign key named** whenever two tables are
  joined by more than one path — `profiles!announcements_author_id_fkey(...)`,
  not `profiles(...)`. And a `.select()` string must stay ONE literal:
  supabase-js infers the row type from it, so concatenation types as
  `unknown`. Both bite silently (the query errors, the page renders empty).
- **Times are always Africa/Johannesburg**, formatted through
  `src/core/ui/format.ts`. Anything depending on "now" (relative times) is
  computed on the server and passed to client components as a string.
  `seed.sql` sets the session timezone for the same reason.
- **After a mutation**, actions call `revalidatePath` for other routes plus
  `refresh()` from `next/cache` for the page you are on; client components
  dispatch actions inside `startTransition` so the returned render is
  applied. Awaiting an action outside one still works, just slower.
- `npm run db:types` reads the **linked** (hosted) project;
  `npm run db:types:local` reads a local `supabase start` stack.
- `announcement_reads`: admins get counts via the
  `announcement_read_counts()` function only. Never add an admin SELECT
  policy on that table — it's a privacy guarantee, not an oversight.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

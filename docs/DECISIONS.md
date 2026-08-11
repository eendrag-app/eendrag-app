# Decisions

Every non-obvious choice, dated, with the alternatives that lost and why.
Newest entries at the bottom. If you reverse one of these, add a new entry —
don't edit history.

## 2026-08-11 — Rebuild Intersection as a module, don't extend it in place

**Decision:** The existing `eendrag-intersection` app (repo
`OliStrauss/eendrag-intersection`) is rebuilt as `src/modules/intersection`,
behaviour unchanged. The old app keeps running until the module reaches
parity, then retires.

**Alternatives:** Extend the old app in place; embed it via iframe/links.

**Why:** The old app is ~1 500 lines of vanilla Express + static HTML/JS with
the whole competition stored as ONE json blob (a file locally, a single
Postgres row hosted). No framework, no auth model, no relational schema —
there is nothing to extend that helps announcements, calendar, or
notifications. What *is* valuable — the tournament rules (draw generation,
standings tie-breaks, knockout progression, leaderboard points) — ports
cleanly: see `src/modules/intersection/lib/tournament.ts`, with tests pinning
old behaviour. Linking out to a separate app would break the "one official
channel" mission and double the handover surface.

## 2026-08-11 — Host on Vercel, not Cloudflare

**Decision:** Vercel for managed hosting. Docker path maintained regardless.

**Alternatives:** Cloudflare (Workers + OpenNext adapter), to consolidate
with the old Intersection app.

**Why:** The consolidation argument dissolved on inspection: the old app is
deployed on **Render + Neon** (its README and `render.yaml` confirm it), not
Cloudflare — Cloudflare only fronts DNS at most. So there is no
Cloudflare-native code to preserve, and after the intersection module reaches
parity the old app retires entirely — one platform either way. That leaves
the stack question on merit: Next.js on Vercel is the zero-adapter,
most-documented path (boring wins, §handover), while Next.js on Cloudflare
requires the OpenNext adapter and its edge-runtime caveats. The portability
constraint is covered by the Dockerfile + docker-compose, which run the same
build on any Node host.

## 2026-08-11 — Migration filenames: numeric prefix first, module second

**Decision:** `<seq>_<module>_<name>.sql` (e.g. `0400_sport_init.sql`) with a
hundred-block per module, instead of the spec's `<module>__<seq>_<name>.sql`.

**Alternatives:** Module-name-first as specified; CLI-generated timestamps.

**Why:** The Supabase CLI only applies migration files whose names start with
digits — `sport__0001_init.sql` would be silently skipped by `db push`.
Numeric-first keeps the CLI, plain `psql -f` ordering, and the
module-ownership idea all working. Block allocation lives in
`supabase/migrations/README.md`.

## 2026-08-11 — Sports catalogue lives in core, not the sport module

**Decision:** The `sports` table is created in `0100_core_init.sql`; the
sport module adds `rep_id` and its own tables in `0400_sport_init.sql`.

**Alternatives:** Everything sport-shaped in the sport module's migration.

**Why:** Onboarding ("sports played" multi-select) and notification targeting
(`audience: {kind: 'sport'}`) are core concerns that must not depend on a
module. The module still owns everything about *running* a sport: fixtures,
results, signups, rep permissions.

## 2026-08-11 — Text + check constraints instead of Postgres enums

**Decision:** Status-ish columns (`role`, `status`, `category`, `stage`) are
`text` with `check` constraints.

**Why:** Adding a value is a one-line new migration; altering a Postgres enum
is a multi-step dance a first-time maintainer shouldn't meet. Same
guarantees, plainer Postgres.

## 2026-08-11 — Thin route files instead of registry-driven routing

**Decision:** Each module page gets a 2-line re-export file under
`src/app/(app)/<basePath>/`. Registration in `registry.ts` drives nav,
notification settings, and admin listings — but not the App Router file tree.

**Alternatives:** A catch-all `[[...slug]]` route dispatching off the
registry, making registration literally one line.

**Why:** A registry-dispatched catch-all defeats the App Router: per-route
layouts, streaming, `generateMetadata`, and typed params all assume the file
tree. It is exactly the kind of clever abstraction the constraints ban. The
cost is honest and tiny: one thin file per route, documented in
`docs/ADDING-A-MODULE.md`.

## 2026-08-11 — Notifications always persist; quiet hours defer delivery only

**Decision:** The pipeline persists a `notifications` row for every resolved
recipient, always. Quiet hours (default 23:00–07:00) only *defer the delivery
channel* (web push, when built); the in-app bell shows the row immediately.
Urgent bypasses deferral.

**Alternatives:** Suppress persistence during quiet hours; queue-and-release
rows.

**Why:** A notification you never see because it fired at 23:30 is a missed
announcement — the bell must be complete. Deferral state is computed per
recipient (`deliverAt`) and handed to channels; the stubbed WebPushChannel
documents how the deferred send works.

## 2026-08-11 — Section-only mode is an opt-in preference, default off

**Decision:** The `section` notification category acts as a noise filter:
when a user enables it, non-urgent notifications not about their section are
dropped for them. New accounts default it to off; all other categories
default on.

**Why:** The spec lists "section-only" as a toggle without defining
semantics. Filtering-by-my-section is the reading that reduces noise without
hiding urgent or personally-relevant messages, and defaulting it off means
new users miss nothing. Behaviour is pinned by tests in
`src/core/notifications/targeting.test.ts`.

## 2026-08-11 — Minimal auth pages built in phase one

**Decision:** Spartan but working /login, /signup, /onboarding pages exist
now, calling `src/core/auth`.

**Why:** The §12 stub rule ("route + placeholder page only") is about the
four feature modules. Without a login flow nothing else is demonstrable: RLS
tests need users, middleware needs somewhere to redirect, and the dev loop
needs a way in. Phase two restyles them; the logic stands.

## 2026-08-11 — Privilege guards allow no-user contexts (migration 0101)

**Decision:** The triggers guarding `profiles.role`/`is_active` and
`sports.rep_id` only raise when a *signed-in* non-admin makes the change
(`auth.uid() is not null and not app_is_admin()`).

**Why:** Triggers fire even for the service role (RLS bypass doesn't skip
triggers), so the original stricter guard made bootstrapping the first admin
impossible — `scripts/create-admin.mjs` failed. Service-role and direct-SQL
contexts have no `auth.uid()`; RLS already prevents ordinary users from
updating rows they don't own, so the guard's only real job — stopping
self-promotion — is intact. Caught by running the script against the hosted
project.

## 2026-08-11 — `db:push` passes `--include-all`

**Decision:** `npm run db:push` runs `supabase db push --include-all`.

**Why:** Per-module hundred-blocks mean a later fix to an early block (e.g.
core fix `0101` after `0500` was applied) sorts before already-applied
migrations, which the CLI treats as out-of-order and refuses by default.
`--include-all` applies every pending file; fresh databases still run in
plain filename order. Trade-off documented in supabase/migrations/README.md.

## 2026-08-11 — Announcement read counts go through a definer function

**Decision:** Admins get open counts from the
`announcement_read_counts(uuid[])` SQL function. There is no admin SELECT
policy on `announcement_reads` at all.

**Why:** "Admins see counts only, never identities" enforced in the query
layer, as specified — the function returns numbers and nothing else, and the
absence of a select policy makes the identity leak structurally impossible
rather than a UI courtesy.

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

## 2026-08-11 — `output: "standalone"` is asked for only off Vercel

**Decision:** `next.config.ts` sets `output: process.env.VERCEL ? undefined :
"standalone"`.

**Why:** Phase one set it unconditionally, with a comment saying "Vercel
ignores it". Vercel does not ignore it: the first real deploy failed with
`ENOENT: .next/next-server.js.nft.json`, because Vercel runs its own file
tracing and standalone output collides with it. Standalone is still exactly
what the Dockerfile copies, and the Docker path is the portability guarantee —
so the flag stays, conditioned on `VERCEL`, which Vercel sets in every build.
Both paths verified after the change.

## 2026-08-11 — The repository is public, and that is what pays for the hosting

**Decision:** `eendrag-app/eendrag-app` is a public repository. Vercel's Git
integration deploys `main`, and a GitHub Actions workflow calls the cron tick
every five minutes.

**Alternatives:** Vercel Pro (~$20/month) to connect a private org repo;
deploying from GitHub Actions with a Vercel token and paying an external
scheduler's signup cost.

**Why:** Vercel's Hobby plan cannot connect a private repository owned by an
organisation, and its crons are capped at once a day. Going public fixes both
for nothing and adds no machinery — no tokens to rotate, no extra accounts to
hand over, and GitHub Actions minutes are unlimited on public repositories,
which is what makes a five-minute tick free. Against a residence committee
that turns over every year, "no recurring bill and no extra credentials" beat
a subscription that silently degrades the app when a card expires. Checked
before publishing: `.env*` is gitignored, the whole history was scanned for
key-shaped strings, and no res content is in the repo — it all lives in
Supabase.

**Consequence, accepted:** anyone can open a pull request, so the Preview
environment is deliberately left without environment variables — a preview
build that could read the service-role key is a preview build that could print
it. Previews render, but cannot reach the database.

## 2026-08-11 — The cron runs daily, because the plan says so

**Decision:** `vercel.json` schedules `/api/cron/tick` at `0 6 * * *` rather
than the intended `*/5 * * * *`.

**Alternatives:** upgrade to Vercel Pro; point an external scheduler at the
route.

**Why:** The Hobby plan refuses more than one cron run a day — the deploy
fails outright, it is not silently downgraded. Daily is the schedule that
deploys. The cost is real and worth naming: **a post scheduled for 14:00 goes
out at 06:00 the next morning.** Because the tick is idempotent and
secret-protected rather than Vercel-specific, either alternative restores
five-minute behaviour without touching code — an external scheduler hitting
`?secret=` costs nothing. Both are written up in OPERATIONS.md → Deploy.

## 2026-08-11 — Grants are written down, not inherited (0103)

**Decision:** `0103_core_grants.sql` grants `select, insert, update, delete`
on every table in `public` to `anon`, `authenticated` and `service_role`, and
sets matching default privileges for tables created later.

**Alternatives:** keep relying on the platform's implicit defaults.

**Why:** On a *fresh* database every query failed with "permission denied for
table sections" — not RLS (which returns no rows) but a missing GRANT. The
default privileges for objects created by `postgres` in `public` hand out only
`Dxtm`, so the API roles could not read anything. The hosted project works
only because its tables were created under more generous defaults. That made
`npx supabase db reset` produce an app that could not read a row — the first
thing a new maintainer does — and it would have broken the university-server
path completely, where no Supabase defaults exist at all. Granting table
privileges weakens nothing: RLS is enabled on every table with explicit
policies, and a table whose policies do not match denies the row whatever the
grants say. Found by resetting a local stack from zero in phase two.

## 2026-08-11 — Two forward migrations instead of editing 0101 (0102 + 0402)

**Decision:** `0102` conditionally drops `app_guard_sport_rep()` when 0400 has
not run yet, and `0402` re-applies the fixed definition afterwards. `0101` is
left exactly as it was applied.

**Alternatives:** edit 0101 (forbidden — it has been applied); leave a
database that only works if the migrations happen to run in the order the
hosted project happened to use.

**Why:** 0101 was written after 0400 had already been applied to the hosted
project, so there it ran last and its `create or replace` won. On a fresh
database filename order puts 0101 *before* 0400, so 0400's plain
`create function` for the same name aborted the whole run with SQLSTATE 42723
— and if it had not, 0400's stricter guard would have silently undone the fix,
bringing back the bug that stopped `npm run create-admin` bootstrapping the
first admin. The two migrations make both orderings converge on the same
state, and both are no-ops on the hosted project. Verified by running
`supabase db reset` from zero, then `npm run create-admin` against it.

## 2026-08-11 — A rep may write exactly one shape of announcement (0401)

**Decision:** Migration `0401_sport_result_announcements.sql` adds one insert
policy on `announcements`: a sport rep may create an announcement only if it is
`is_system`, authored by themselves, `published`, res-wide, and not urgent.

**Alternatives:** write the auto-announcement with the service-role client;
make reps admins; drop the auto-announcement.

**Why:** HANDOFF specifies that posting a result also posts a one-line
announcement authored by the rep — and 0300 let only admins insert. Reaching
for the service role would put a hole in "RLS is the authorisation layer" for a
routine user action. The policy is written as a list of things that must all be
true, so the only announcement a rep can produce is the one the app produces
for them; they still cannot edit or delete any announcement, including their
own. Six RLS tests pin each half of that.

## 2026-08-11 — The events source index had to become non-partial (0201)

**Decision:** `0201_core_events_source_unique.sql` drops the partial unique
index on `events (source_module, source_ref)` and recreates it without the
`where source_module is not null` clause.

**Why:** Postgres will not infer a *partial* index for `insert … on conflict
(source_module, source_ref)` unless the statement repeats the index's WHERE
clause, which PostgREST cannot send. So `upsertModuleEvent()` — the whole
mechanism by which sport fixtures and intersection draws reach the calendar —
failed with 42P10 the first time it ran for real. A plain unique index behaves
identically for this schema: UNIQUE treats NULLs as distinct, so admin-created
events (both columns null) are unconstrained, while module mirrors stay one row
per source. Phase one wrote the index; nothing had exercised it until phase two
posted a fixture.

## 2026-08-11 — The ICS feed is the third sanctioned service-role use

**Decision:** `src/core/calendar/ics-feed.ts` reads profiles and events with
the admin client. The allowlist in `src/core/db/admin.ts` grows from two
entries to three.

**Alternatives:** an RLS policy letting `anon` select events (opens the whole
calendar to the internet); a signed-in-only feed (breaks the point — Google
Calendar fetches the URL with no cookies).

**Why:** A calendar client polling `/api/calendar/<token>.ics` has no session,
so RLS has nobody to act as. The token *is* the credential, which is why
Profile can regenerate it and why the route 404s on an unknown token or a
deactivated account. The query applies the visibility rule the policy would
have applied — res-wide events plus the token owner's own section — and it is
the only query in the file. Phase two, not phase one, but recorded here
because it changes a rule phase one wrote down.

## 2026-08-11 — Section-only mode is declared by the profile module

**Decision:** `src/modules/profile/module.ts` declares
`notificationCategories: ["section"]`, even though the profile module emits no
notifications.

**Alternatives:** hardcode the `section` switch into the settings page; add
"section" to every module's list.

**Why:** The settings page is built from `allNotificationCategories()`, and no
feature module *emits* the `section` category — it is a filter over all the
others (docs/DECISIONS.md, "Section-only mode is an opt-in preference"). Its
switch still has to appear. Declaring it on the module that owns the settings
UI keeps the page registry-driven with no special cases, at the cost of
stretching `notificationCategories` from "what I emit" to "what I contribute
to the settings screen". The comment in module.ts says so out loud.

## 2026-08-11 — Announcement read counts go through a definer function

**Decision:** Admins get open counts from the
`announcement_read_counts(uuid[])` SQL function. There is no admin SELECT
policy on `announcement_reads` at all.

**Why:** "Admins see counts only, never identities" enforced in the query
layer, as specified — the function returns numbers and nothing else, and the
absence of a select policy makes the identity leak structurally impossible
rather than a UI courtesy.

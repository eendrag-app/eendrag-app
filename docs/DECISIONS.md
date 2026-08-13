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

## 2026-08-11 — Sections have no colours (0104)

**Decision:** `sections.color` is dropped. Sections are identified by name.
The calendar keeps a colour per *category*, and a section event is amber the
way a social event is pink — that says what kind of event it is, not which
section it belongs to.

**Alternatives:** keep the column and leave the invented values in place;
keep the column empty for a future HK to fill.

**Why:** Phase one invented twelve hex values and flagged them for the HK to
confirm. The answer (2026-08-11) was that the res has no section colours at
all. A NOT NULL column full of made-up values is exactly what reads as
meaningful to whoever inherits this, so it goes rather than lingers.

**Worth recording for the next person:** phase two was briefed that swapping
the colours later would be "a data edit, not a code change". That turned out
to be wrong — the colours had reached fourteen components, three modules and
the shared UI layer, so removing them was a migration plus a sweep. Design
tokens that come from the database are still design decisions; treat "we can
change it later in the data" with suspicion.

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

## 2026-08-12 — The app wears the res colours (maroon/gold light, black/orange dark)

**Decision:** The shadcn "neutral" palette is replaced by a res palette
defined entirely in `src/app/globals.css`. Light mode is the old Intersection
app people already know — a deep maroon bar with a gold hairline over a cream
page, white cards. Dark mode is near-black surfaces with **orange**, the res
colour, doing what maroon does in the light. Two new token pairs carry the
identity: `--header`/`--header-foreground`/`--header-muted` (the bar) and
`--gold`/`--gold-foreground` (the one decorative accent).

**Alternatives:** orange in both modes (one brand colour everywhere); maroon
in both modes; keep neutral and add an accent.

**Why:** The res reads the Intersection app today and will recognise the
maroon-and-gold instantly, which is the whole point of "official res
infrastructure, not a student side project". Orange is the res colour and
belongs somewhere prominent, and it is the one warm accent that survives on a
black background — maroon on black is mud. The HK chose this split
deliberately (2026-08-12); it is not an oversight that the two modes differ.

Consequences worth knowing:

- **`primary` is maroon in the light and orange in the dark.** Anything that
  says `bg-primary` changes hue with the theme, including the `res_wide`
  calendar dot. That is intended.
- **`destructive` is deliberately pushed away from `primary` in both modes** —
  an oranger red in the light so it separates from maroon, a crimson in the
  dark so it separates from orange. Urgent must never read as "more chrome".
  Urgent also always carries the triangle icon and the word, so colour is
  never the only signal.
- **Section events are burnt orange, not amber** (`--event-section`): gold and
  amber were the same colour at a glance.
- Buttons sitting on the header bar use the `.on-header` class (globals.css)
  because ghost colours tuned for page surfaces disappear on maroon.

## 2026-08-12 — Announcement cards carry a coloured left edge

**Decision:** Every card in the feed gets a 4px left border: red for urgent,
gold for pinned, maroon/orange while unread, a plain hairline once read. All
cards app-wide also gained `ring-border` plus a soft shadow in place of
shadcn's `ring-foreground/10`.

**Why:** The HK's complaint was that posts ran together. A hairline at 10%
opacity is invisible on a cream page. The left edge separates one post from
the next *and* carries meaning that already existed but was only shown as a
small "New" label — nothing new to learn, one more way to see it.

## 2026-08-12 — The calendar is its own module and its own tab

**Decision:** The shared calendar leaves the home module. `src/modules/calendar`
now owns the month grid, the admin screens (moved from `/admin/calendar` to
`/calendar/admin`), the `calendar` notification category, and the day-of
reminder half of the cron tick. The home page is the announcement feed and
nothing else.

**Alternatives:** keep it as a sidebar column and add a "see all" link; put a
calendar tab in the home module's own routes.

**Why:** On a phone the calendar sat *under* the feed, so a busy week buried
it — the HK's actual complaint. Once it needs its own screen, the module
boundary follows: a tab is a module here, and half of "the home module" was
already calendar code. It also makes the boundary rule earn its keep — the
calendar module and the home module now share nothing but `@/core/calendar`.

**Consequences:** calendar notifications now link to `/calendar` and carry
`source_module: "calendar"`; already-sent reminders are unaffected because
idempotency keys on `source_ref` (`reminder:<id>`), which did not change. The
old `/admin/calendar` URLs are gone rather than redirected — the app is three
weeks old and every link to them is inside the app.

## 2026-08-12 — Admin is a tab, not a card at the bottom of Profile

**Decision:** A new `admin` module renders `allAdminPanels()` at `/admin` and
appears in the tab bar for admins and sport reps only. Profile keeps a single
signpost row pointing at it. `AppModule.roles` now actually filters the tab
bar, which is what it always claimed to do.

**Alternatives:** leave it on Profile; put the panels straight into the tab bar
as separate tabs.

**Why:** The HK publishes announcements from a phone, several times a day, and
had to open Profile and scroll past their own quiet-hours settings to get
there. The registry already knew who may see what; the nav just wasn't asking.

**Consequences:** the tab bar is five tabs for a student and six for an HK
member, which is why `AppModule.shortName` exists — "Intersection" does not fit
in 60px. The admin module owns the `/admin` subtree, so `/admin/announcements`
(which cannot live under the home module's `/` basePath) is auth-gated by it.
Role filtering in the nav is a convenience: every admin page still calls
`requireRole`, and RLS still refuses the writes.

## 2026-08-12 — A hand-written service worker, not next-pwa

**Decision:** The app is installable through three plain files —
`src/app/manifest.ts`, `public/sw.js` (about 90 lines, mostly comments), and a
"Get app" button. No `next-pwa`, no Workbox, no generated precache manifest.
The worker **caches nothing**: its fetch handler is a passthrough.

**Alternatives:** `next-pwa` / `@ducanh2912/next-pwa` (the usual answer);
Workbox by hand with a precache manifest.

**Why:** Installability needs exactly two things — a manifest and a service
worker with a fetch handler — and both fit on a page. What the plugins add on
top is a caching strategy, and a caching strategy is precisely what an
announcement app must not get wrong: a stale shell means someone reads
yesterday's notice about tonight's meeting, and debugging that at 2am through
a generated Workbox bundle is the opposite of the handover rule. Next already
serves its own static assets with immutable headers, which is the part that
actually makes it fast. If offline reading is ever wanted, add it here, on
purpose, with a version bump — not by installing a plugin that does it
invisibly.

## 2026-08-12 — A dropped connection is not a sign-out

**Decision:** The middleware only redirects to `/login` when it is confident
nobody is signed in. If `getUser()` fails *without* an HTTP status (the shape
of a network failure) and the request still carries a Supabase auth cookie,
the request is let through.

**Alternatives:** redirect on any null user (what it did); retry inside the
middleware; drop the middleware check and rely on pages.

**Why:** "It logs me out" was the HK's complaint, and the cookies were never
the problem — `@supabase/ssr` writes them with a 400-day lifetime. What sends
someone back to the login screen is a *failed check*: on campus wifi one
`getUser()` call times out mid-scroll and the middleware reads that as signed
out. Letting an unverifiable-but-present session through gives away nothing,
because the middleware was never the enforcement point: the page still calls
`requireProfile()` (which redirects) and RLS still returns nothing without a
valid JWT. An expired or revoked session answers with a status (400/401) and
is still bounced immediately, so this is not a way to linger after signing out.

## 2026-08-12 — Quiet hours are written to the row, not held in memory

**Decision:** `notifications` gains `deliver_at` and `pushed_at` (migration
0105). The pipeline computes each recipient's delivery time once and stores
it; the push channel sends what is due now, and the cron tick sends the rest
when their time comes.

**Why:** Quiet hours already "worked" — the pipeline computed a per-recipient
`deliverAt` and handed it to the channels. With only the bell listening,
nobody noticed the value was then thrown away when the request ended. A push
that must wait until 07:00 has to outlive the request that created it, so the
decision is now a column. `pushed_at` is what makes the tick idempotent, and
what makes "did this go out?" answerable in SQL at 2am.

**The trap this created, and how it is closed:** adding `deliver_at` with
`default now()` made every historical row look due and unpushed — the first
tick would have buzzed 280 phones with weeks of old announcements. Migration
**0106** backfills them as delivered, and `deferred.ts` additionally refuses
anything more than six hours late, so an outage cannot produce that storm
either. A migration that adds a queue column has to say what the existing rows
mean.

## 2026-08-12 — Push failures are swallowed, and never retried

**Decision:** `pushToProfiles` never throws: a failed send is logged, a 404/410
deletes the subscription, and the notification is marked `pushed_at` whether
or not every device took it.

**Alternatives:** retry queue; leave `pushed_at` null on failure so the next
tick tries again.

**Why:** The row is already saved before any of this runs, so the worst case is
a missed buzz on one device with the notification still waiting in the bell.
Retrying is worse than it sounds: the tick has no record of WHICH devices
succeeded, so a retry re-sends to the phones that already buzzed. A duplicate
announcement to 280 people is a bigger failure than one silent phone.

## 2026-08-12 — Video: a link first, a small upload second

**Decision:** An announcement can carry EITHER a pasted YouTube/Vimeo link
(`video_url`) OR an uploaded clip capped at 25 MB (`video_path`), never both
(migration 0301, with a check constraint). The compose form offers the link
first. YouTube and Vimeo play inline through an iframe; any other link is
offered as a plain link.

**Alternatives:** uploads only, like images; links only; embed any URL.

**Why — the drawback that decided it is bandwidth, not disk.** Supabase's free
tier includes 5 GB of egress a month. One 25 MB clip watched by 280 students
is **7 GB — more than a month's allowance in a single post.** Storage is 1 GB,
so a handful of clips fills that too. A YouTube link costs the app nothing, has
no length limit, and streams adaptively on a phone in a res room with bad
signal, which our storage does not.

Uploads are kept anyway because the HK will want to post a ten-second clip
from a phone without opening YouTube, and that is a real use. It is capped at
25 MB (both in the form and on the bucket, so a lying client cannot beat it),
which is about 45 seconds of phone video, and the form says why next to the
button.

**The other traps, all deliberate:**

- **MP4 and WebM only.** An iPhone's own `.mov` is usually HEVC, which most
  browsers will not play — the post would render as a black rectangle for half
  the res. The form says so instead.
- **No autoplay, `preload="metadata"`.** This is a feed; a post that starts
  making noise while someone scrolls is how apps get muted, and autoplay on
  mobile data is rude.
- **Arbitrary links are never put in an iframe.** Only YouTube and Vimeo are
  embedded, through `youtube-nocookie.com`. Anything else becomes a link —
  embedding a URL an admin pasted, on a page 280 signed-in students are
  looking at, is a hole with no upside.
- **Nothing deletes the storage object when a post is deleted.** Same as
  images and PDFs today; noted in docs/BUILD-LOG.md rather than pretended away.

## 2026-08-12 — Reps are appointed by typing an email, not by picking an account

**Decision:** the HK types a rep's name, phone number and student email.
`sports.rep_email` is a claim ticket; `rep_id` is still the only thing that
grants permission, and `app_is_rep_of()` is untouched.

**Alternatives:** keep the dropdown of existing accounts; authorise directly
on the email.

**Why not the dropdown.** It could only appoint someone who had already signed
up, which is backwards — the HK knows who runs hockey long before that person
opens the app. Now either order works: if the address already has an account
the server action links it immediately, and if it does not, the
`app_handle_new_user` trigger (0403) claims the sport the moment they sign up.

**Why not authorise on the email directly.** `profiles.email` is editable by
its owner — policy `profiles_update_own` in 0100, and the privilege guard
covers only `role` and `is_active`. A student could set their own email to the
hockey rep's address and inherit the sport. Matching happens once, against the
address Supabase actually verified in `auth.users`, and the result is written
to `rep_id`.

**The hole 0403 opened, closed in 0404.** `sports_update_admin_or_own_rep`
lets a rep edit their own sport's row, and the guard only blocked `rep_id`.
With `rep_email` added, a rep could point it at a friend, who would inherit
the sport on signup — a rep appointing their own successor. `rep_email` is now
guarded exactly like `rep_id`. `rep_name` and `rep_phone` are deliberately
left open: they are the contact card, and a rep fixing their own phone number
without filing a request with the HK is a feature.

Verified against the live project, as the rep: practice info and phone number
still editable, `rep_email` and `rep_id` both refused with *"only admins may
assign sport reps"*.

## 2026-08-12 — "I'm going" says how many

**Decision:** the sport sign-up button reads "I'm going" and carries a count
of everyone who has pressed it.

**Why.** Pressing a button into silence tells you nothing, and whether a
practice is worth walking to depends entirely on whether anyone else is
coming. Button and count move optimistically together and roll back together
— a count that disagrees with the button is worse than a slow one.

**What it counts.** Rows in `sport_signups`, which is also what the squad list
is built from: people interested in the sport, **not** attendance at a
particular fixture. If the res wants per-fixture attendance ("who is coming to
Saturday's game?") that is a different table and a different feature.

## 2026-08-12 — Sign-in is a plain form POST, not a server action

**Decision:** `/login` and `/signup` submit real HTML forms to route handlers
at `src/app/auth/*`, which redirect with a 303. They were server actions.

**Alternatives:** keep the server action and hope password managers catch up;
add "remember me"; go straight to Microsoft SSO.

**Why.** The complaint was "I have to sign in every time". The session was
never the problem — the cookie is written server-side with a 400-day
`Max-Age`, middleware refreshes it on every request, and only one file uses
the browser client, so nothing races the refresh token. What was missing is
that **no password manager had ever offered to save the password.** iOS
Keychain and Chrome both wait for a real form submission followed by a real
navigation before offering; a server action submits over `fetch` and never
navigates, so it is invisible to them. Every visit meant typing the whole
thing again, which feels exactly like being logged out.

A route handler is also the only place `cookies()` from `next/headers` is
writable outside middleware, so the session cookie rides the redirect —
verified, not assumed: a POST to `/auth/login` answers `303` with
`Set-Cookie: sb-…-auth-token; Max-Age=34560000`.

**What that costs, and how it is paid.** Server actions get two things free
that a raw POST handler does not:

- **Origin checking.** `isSameOrigin()` in `src/core/auth/form-post.ts` does
  it explicitly, or any site could POST a browser at `/auth/login` and sign
  someone into an attacker's account.
- **A trustworthy redirect target.** The old action validated `?next=` with
  `startsWith("/")`, which `//evil.com` passes — a protocol-relative URL the
  browser happily follows off-site. That was a live open redirect, not one
  this change introduced. `safeNext()` closes it and the test file pins it.

Failures come back as a `?error=<code>`, never a message: a code is safe in a
URL, and no email or raw Supabase error ends up in an access log.

## 2026-08-12 — Signup reads Supabase's answer instead of guessing

**Decision:** `signUp()` reports whether a session was actually established,
and the signup route sends people to "check your email" when it was not.
The interpretation lives in pure functions in `src/core/auth/interpret.ts`.

**Why.** Creating a brand-new account reported **"Wrong email or password"** —
on an account that had existed for one second. `signupAction` called `signUp`
and then immediately `signInWithPassword`, under a comment saying there is no
email confirmation in open mode. There is: the hosted project reports
`mailer_autoconfirm: false`, so **"Confirm email" is on**. `signUp` therefore
succeeds with no session, the sign-in that followed correctly refused an
unconfirmed user, and that refusal was flattened into the generic wrong-password
message. The second call is now gone entirely — when confirmation is off,
`signUp` already returns a session and there is nothing to do.

Reading that answer is genuinely fiddly, which is why it is pure and tested:
with confirmation on, an address that already exists comes back as a **decoy
user with no error and no session** (so the form cannot be used to discover who
has an account) and is distinguishable from a real new signup only by an empty
`identities` array.

**Two limits worth knowing before the res signs up.** Supabase rejects an
address whose domain has no MX record, so typos like `@gmial.com` are refused
by the API rather than by us — now reported as a bad address instead of "the
service is down". And its built-in mailer is rate-limited to a handful an
hour, which **will not survive 280 students signing up in one evening**. Both
have their own error codes and messages; the fix for the second is real SMTP
or turning confirmation off for the pilot.

## 2026-08-12 — Intersection is sections, not people

**Decision:** the roster (who from each section played in an event) and the
individual player leaderboard built on it are gone. `intersection_players` and
`intersection_rosters` are dropped in migration 0501, along with
`playerStats()` in `tournament.ts`, the `/intersection/players` page, and the
Players and Roster admin cards.

**Why.** Intersection is a competition between the twelve sections. The point
of the tab is the draw, the results and the section rankings — the individual
stats were a layer of admin (type in every name, tick every roster) whose
output nobody was competing over. Removing it takes a job off the HK and makes
the tab about the thing it is named after.

**This dropped data.** Safe here because every row was placeholder from
seed.sql — twenty-four invented names, `profile_id` null on all of them — and
the res has not been onboarded. Checked before dropping, not assumed.

**Dropped rather than left in place.** An unused table with live RLS policies
is a question a future maintainer has to answer before trusting anything near
it, and the answer costs more than the migration does. The bracket rules,
points and section leaderboard in `tournament.ts` are untouched — that is res
law and pinned by tests.

## 2026-08-13 — A three-way tie in a group is the HK's call, not the sort's

**Decision:** when all three teams in a group win one game, the app stops and
asks. `intersection_groups.first_section_id` / `second_section_id` (migration
0502) hold the answer; until it is given, that group's two quarter-final
places stay empty.

**Why.** A group of three with no draws has exactly two possible endings:
someone wins both (6/3/0) or everyone wins one (3/3/3). The second is a cycle
— A beat B, B beat C, C beat A — so head-to-head cannot break it, and there is
no score difference to fall back on because the app has never recorded scores.
The old sort fell through to comparing section *names*, which quietly sent
Arendstraat through ahead of Wineroute for a reason nobody could defend to the
res. The HK settles those on the day and now types the answer in.

**Where the rule lives.** `needsTieBreak` and `qualifiers` in
`lib/tournament.ts`, pure and tested. `standings` is unchanged: its name
comparison is presentation only, so the table does not jump about between
renders, and it no longer decides anything.

**Guarded server-side.** `setGroupTieBreak` re-checks `needsTieBreak` rather
than trusting the form — otherwise it would be a way to hand-pick qualifiers
out of a group somebody actually won.

## 2026-08-13 — Notifications go out after the response, not before it

**Decision:** `setResult` and `setMatchTime` schedule their `notify()` calls
with `after()` from `next/server`.

**Why.** Entering a winner took several seconds to show. `notify()` resolves
recipients, writes a row per person and then pushes to every subscribed device
over the network; two of those in series sat in front of the admin's action
return. Capturing a whole event meant waiting through it once per fixture. The
result is saved and the bracket recalculated before the response goes out —
nothing on screen depends on the push having been sent.

**The other half of it** is `match-admin.tsx`, where the winner dropdown was
controlled purely by the last server render. It now shows the pick
immediately and drops it again if the write is refused.

## 2026-08-13 — The Admin tab is the HK's, and sport reps do not get one

**Decision:** `admin` and the sport admin panel are `roles: ["admin"]`. A rep
edits their sport on the sport's own page, the same page the res reads.

**Why.** The rep's version of the admin screen only ever listed their sport
and linked to that page — a second door to one room, and one more thing to
keep in step. The catalogue behind that tab is appointing reps and deleting
sports, which is HK work. Nothing about a rep's actual permissions changed:
`app_is_rep_of` and the RLS policies are untouched.

**Profile lost its admin signpost too.** It was there for people who
remembered the old layout; a tab and a card pointing at the same place is
just two things to maintain.

## 2026-08-13 — One date-and-time control, built here

**Decision:** `src/core/ui/date-time-picker.tsx` — a month grid for the day
and two snap-scrolling wheels for the time, the way a phone's alarm does it.
It replaces `<input type="datetime-local">` on the intersection fixtures and
the event date.

**Why.** The native control is a different thing in every browser, wants a
keyboard in some of them, and on Android buries the date behind a spinner. The
res sets these on phones, standing next to a field.

**It speaks the same strings the native input did** ("2026-08-20T19:00", res
wall-clock), so `fromLocalInput` / `toLocalInput` remain the only code that
knows about timezones and no server action changed. Minutes go in fives:
this schedules res fixtures, not trains.

## 2026-08-13 — "Get app" is stashed before React starts

**Decision:** an inline script in `src/app/layout.tsx` catches
`beforeinstallprompt` and parks it on `window`; the button reads it through
`useSyncExternalStore`.

**Why.** Chrome fires that event once, as soon as it decides the app
qualifies, and on a mid-range phone that can be *before* hydration finishes. A
listener registered in a `useEffect` missed it, and it cannot be asked for
again — which is why the button appeared on a laptop and never on the phone.
Install state is per device and always was; nothing about it is stored against
an account.

**Also fixed:** iPads have claimed to be Macs since iPadOS 13, so the user
agent alone put them in "cannot install" and hid the only instructions they
can act on.

## 2026-08-13 — A result is a fixture that has been played

**Decision:** `recordFixtureResult(fixtureId, score)` replaces `postResult`.
Entering a score on a played fixture *is* posting the result. The standalone
"post a result" form is gone.

**Why.** They were two records of one game. A rep posted a fixture with the
opponent and the date, then later typed the opponent and the date out again
into a result, with nothing linking the two — `sport_results.fixture_id`
existed and was almost always null. Now the fixture is the record and the
score is the only thing anybody types.

**How "finished" is stored:** having a result is what makes a fixture done.
The fixture row is never deleted or flagged, which keeps its calendar entry
and its history intact, and makes deleting the result a clean undo — the
fixture simply goes back to asking for a score.

**The summary is derived** (`resultSummary`, tested): "v Wilgenhof", or
"Played" when a fixture had no named opponent. And `played_at` is the
fixture's own start time, so a Saturday game captured on Monday is still
dated Saturday.

**A game nobody scheduled** is added as a fixture with a date in the past. It
lands in "waiting for a score" immediately, which is one path instead of two.

## 2026-08-13 — The squad list is gone

**Decision:** the Squad card on a sport's page is removed, along with the
`user_sports` query that fed it.

**Why.** It answered a question nobody was asking. It listed everyone who had
ever ticked the sport at onboarding plus everyone who had pressed "I'm going",
de-duplicated, which is a wider and vaguer set than the one people actually
want: who is coming to this practice. That question is answered by tapping the
going count, which is right next to the button.

`user_sports` itself stays — it is what notification targeting uses to decide
who hears about a sport, and it is still set on the Profile page.

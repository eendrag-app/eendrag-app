# HANDOFF — the phase-two brief

> **Phase two is built** (2026-08-11). This document is kept as the
> specification the four modules were written to — it is still the place to
> look before changing how a screen behaves. What actually exists, and where
> it differs from this brief, is in **docs/BUILD-LOG.md**; why anything
> differs is in **docs/DECISIONS.md**. The "Known gaps" in §6 have been
> closed except web push, which is still v1.1.

You are building the feature UIs of the Eendrag res app on a finished
foundation. You have **no context from phase one and nobody to ask** — this
document plus the repo is everything. Read CLAUDE.md first, then this, and
keep ARCHITECTURE.md open. Where this document specifies behaviour, build
exactly that; don't invent.

## 1. Current state (what you're standing on)

Everything below exists, is merged to `main`, and `npm run check` is green:

- **Module system.** Four modules registered as placeholder pages: home
  (`/`), sport (`/sport`), intersection (`/intersection`, public), profile
  (`/profile`). Your job is to replace the placeholder pages with real UIs
  *inside each module's folder* — routes, registry, nav all already work.
- **Database, complete.** Every table, index, and RLS policy phase two needs
  exists (migrations 0100–0500). You should not need to design a table. If
  you genuinely must alter schema, add a new numbered migration (see
  supabase/migrations/README.md) — never edit existing ones.
- **Core services, complete** — §4 shows how to call them.
- **Auth flow** — login/signup/onboarding pages work (open mode). Restyle if
  you like, don't restructure.
- **Tournament logic** — `src/modules/intersection/lib/tournament.ts`, pure
  + tested. The intersection UI calls it; never reimplement bracket rules.
- **Tests** — 44 unit (targeting, quiet hours, tournament, template), RLS
  suite (`npm run test:rls`, needs live db), Playwright smoke.

Check docs/BUILD-LOG.md → "Written but not yet executed" before starting:
if migrations haven't been pushed to the hosted project yet, do that first
(`npx supabase link`, `npm run db:push`, seed as needed) and regenerate
`src/core/db/database.types.ts` with `npm run db:types`.

## 2. Conventions (follow these everywhere)

- **File layout per module:** `pages/` (server components, one per screen),
  `components/` (client leaves), `actions.ts` (server actions), `lib/`
  (pure logic + tests). Route files under `src/app/(app)/...` stay 2-line
  re-exports.
- **Data access:** server components query via
  `const db = await createClient()` from `@/core/db/server` — RLS applies.
  Never use the admin client in modules.
- **Mutations:** server actions, always shaped:
  ```ts
  const parsed = schema.safeParse(...);          // Zod first
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  // ... do the work ...
  return { ok: true as const };
  ```
  Add `requireRole("admin")` / `requireProfile()` from `@/core/permissions`
  at the top of privileged actions (fail fast; RLS is the real gate).
- **Loading:** every route with data gets a `loading.tsx` rendering
  skeletons (`@/components/ui/skeleton`) that match the real layout — no
  layout shift when content lands.
- **Empty states:** real ones, written for students ("No fixtures yet —
  check back after the rep posts the schedule"), never a bare "No data".
- **Errors:** actions return errors; pages show them inline near the action
  that caused them. No toasts-only errors, no throwing at users.
- **Naming:** kebab-case files, PascalCase components, camelCase functions.
  DB columns snake_case (mapped by hand where it matters).
- **After schema changes:** `npm run db:types`, and update
  supabase/tests/rls.test.ts if you added policies.

## 3. Design direction (and the tokens already chosen)

Mobile-first — assume a phone, make desktop a pleasant bonus. Dark mode
supported. Accessible: real buttons/links, labels on inputs, visible focus,
44px touch targets. The app must read as **official res infrastructure**,
not a student side project: restrained, fast, quiet.

Already in place (don't invent a second design language):

- **Base:** ~~shadcn/ui "neutral" theme~~ — **superseded 2026-08-12.** The
  palette is now the res's own: maroon + gold + cream in the light,
  near-black + orange in the dark, still entirely CSS variables in
  `src/app/globals.css`, still `next-themes` (class strategy, defaults to
  system). Everything below about *discipline* still holds — the palette does
  almost everything and colour is never the only signal. See
  docs/DECISIONS.md, 2026-08-12.
- **Type:** Geist Sans (variable `--font-geist-sans`, set in
  `src/app/layout.tsx`). Page titles `text-2xl font-semibold`; body text
  default; metadata/labels `text-sm text-muted-foreground`.
- **Radius:** the shadcn default (`--radius: 0.625rem`).
- **Spacing rhythm:** page content in the `(app)` layout column
  (`max-w-3xl`, px-4); vertical stacks `space-y-4`.
- **Colour discipline:** the neutral palette does almost everything.
  Reserved meanings:
  - *Urgent* = the `destructive` token (red) — urgent announcements only.
  - *Section colours* — **withdrawn 2026-08-11.** This brief specified a
    colour per section from `sections.color`; the HK confirmed the res has no
    section colours, so the column was dropped (migration 0104) and sections
    are identified by name alone. See docs/DECISIONS.md.
  - *Calendar categories:* colour the dot/badge, not the surface —
    res_wide: `primary`; section: burnt orange (a category colour, not a
    section identity; `amber-500` until the res palette landed, when it
    stopped being distinguishable from gold); intersection: `violet-500`;
    social: `pink-500`; sport: `emerald-500`. They are defined once, in
    `src/core/ui/event-categories.ts`.
- **Components:** shadcn primitives already installed: button, card, badge,
  input, label, select, switch, tabs, dialog, sheet, dropdown-menu,
  skeleton, separator, textarea, avatar. Add more via
  `npx shadcn@latest add <name>` rather than hand-rolling.

## 4. Core services — how a module consumes them

```ts
// Read as the signed-in user (RLS applies) — server components & actions
import { createClient } from "@/core/db/server";
const db = await createClient();
const { data } = await db.from("announcements").select("*").eq("status", "published");

// Who is signed in / gate an action
import { getProfile, requireProfile, requireRole } from "@/core/permissions";
const profile = await requireRole("admin"); // redirects non-admins

// Put/refresh/remove a module's entry on the shared calendar
import { upsertModuleEvent, removeModuleEvent } from "@/core/calendar";
await upsertModuleEvent({
  sourceModule: "sport", sourceRef: fixture.id,
  title: `Hockey vs ${fixture.opponent}`, category: "sport",
  location: fixture.location, startsAt: new Date(fixture.starts_at),
});
await removeModuleEvent("sport", fixture.id); // on delete

// Notify people (server actions only)
import { notify } from "@/core/notifications";
await notify({
  category: "sport",                       // announcement|urgent|calendar|intersection|sport
  title: "Hockey practice moved to 20:00",
  url: "/sport/hockey",                    // where the bell entry links
  sourceModule: "sport", sourceRef: fixture.id,
  audience: { kind: "sport", sportId },    // all | section | sport | role
  aboutSectionId: sectionId,               // set when it's "about" a section
  urgent: false,                           // true ONLY for HK urgent announcements
});
```

The pipeline handles preferences, section-only mode, quiet hours, and
persistence. You never write `notifications` rows directly.

**The module contract, as a consumer:** your `module.ts` declares what you
give the shell — `navPlacement`/`order` (tab bar), `requiresAuth`
(middleware gating), `notificationCategories` (which toggles Profile shows),
`adminPanels` (what Profile → Admin lists), `calendarSource` (documentation
of intent). Declare it and the shell does the rest; you never touch nav or
Profile code from another module.

## 5. The four modules to build

Build order recommendation and risk notes in §7.

### 5.1 Home (`src/modules/home`) — the reason people open the app

**Feed screen (`/`):**
- Reverse-chronological published announcements the user may see (RLS
  already filters: res-wide + their section).
- Urgent posts: visually distinct (destructive accent border/badge) and
  pinned above the rest for 24h after `published_at`, then flow normally.
- Card: title, body (clamped with expand), author name ("Eendrag HK" when
  `author_id` null or `is_system`), relative time, section badge when
  targeted, attachment chips (image inline, PDF as labelled link via a
  Storage signed URL).
- Mark-as-read: on open/expand, upsert into `announcement_reads` (insert
  own row; ignore conflict).
- Search (title+body, simple `ilike` is fine at this scale) over the full
  archive; the feed itself paginates (`published_at` cursor).
- Calendar below the feed on mobile / beside on desktop: month grid +
  agenda list toggle. Colour-coded dots by category (§3), filter chips by
  category. Data via `listEventsBetween` from `@/core/calendar`.

**Admin panel (`/admin/announcements`, `/admin/calendar` — the two
`adminPanels` already declared in `module.ts`):**
- Compose: title, body, urgent toggle, target (res-wide or one section),
  image/PDF upload to the `announcement-attachments` bucket, then draft /
  schedule (`scheduled_for`) / publish now.
- List existing with status, edit drafts/scheduled, and show open counts via
  `db.rpc("announcement_read_counts", { announcement_ids })` — counts only,
  identities are impossible by design.
- On publish (including when a scheduled post goes out):
  `notify({ category: is_urgent ? "urgent" : "announcement", urgent: is_urgent,
  audience: target_section_id ? { kind: "section", sectionId } : { kind: "all" },
  aboutSectionId: target_section_id ?? undefined, url: "/" })`.
- Calendar admin: CRUD manual events (RLS: admins). `notify({ category:
  "calendar", ... })` on create/meaningful change.

**ICS feed** — route handler at
`src/app/api/calendar/[token]/route.ts` (thin; logic in the home module or
core): look up the profile by `calendar_token`, emit VCALENDAR of events
visible to that user (res-wide + their section), correct `Content-Type:
text/calendar`. Hand-rolled ICS text is fine (boring); escape commas/newlines.
Profile shows the personal subscribe URL.

**Done when:** a student sees announcements + calendar on their phone within
2s; urgent looks urgent; an HK member can compose, schedule, target, attach,
and see open counts without help; search finds an old post; the ICS URL
imports into Google Calendar.

### 5.2 Sport (`src/modules/sport`)

**Landing (`/sport`):** every active sport as a scannable card row — name,
practice summary (`practice_info`), most recent result one-liner (join
latest `sport_results`). One screen, no hunting.

**Detail (`/sport/[id]`):** practice days/times + venue; rep card (name,
section badge, contact button — `mailto:` via the rep's profile email);
coach; description (who it's for, beginners welcome, what to bring — the
`description` column); recent results; upcoming fixtures; squad list
(profiles via `sport_signups` + `user_sports`); **Sign up** button →
insert own `sport_signups` row (RLS allows own-row only), with undo.

**Rep editing:** if `profile.id === sport.rep_id` (or admin), show inline
edit on THIS sport's page — practice_info, venue, coach, description;
fixture CRUD; result posting. RLS enforces rep-of-this-sport; the UI just
mirrors it.

- Fixture create/update → `upsertModuleEvent` (category "sport"); delete →
  `removeModuleEvent`. Change of time/venue also →
  `notify({ category: "sport", audience: { kind: "sport", sportId }})`.
- Posting a result: insert `sport_results`, then auto-create a short
  announcement (`is_system: true`, author the rep) — "Hockey: beat
  Helshoogte 3–1" — and `notify` sport players.

**Admin panel (`/sport/admin`):** add/deactivate sports, assign reps
(admin-only per RLS trigger).

**Done when:** the landing answers "what happened this week in res sport" in
one screen; a rep updates practice times with zero admin help and players
get exactly one notification; the RLS tests still pass.

### 5.3 Intersection (`src/modules/intersection`) — parity port, plus app-powers

The old app is the spec for behaviour (`docs/DECISIONS.md` explains the
rebuild; the rules live in `lib/tournament.ts` — call, don't copy). It must
stay **publicly viewable signed-out** (`requiresAuth: false` already set):
fixture links get pasted into WhatsApp. Writes are admin-only via RLS.

**Public screens:**
- `/intersection`: leaderboard (12 sections, points, events won — from
  `leaderboard()` over completed events + `intersection_settings`), events
  list (status, champion badge for completed, "next fixture" line for
  in-progress).
- `/intersection/events/[id]`: groups with standings (`standings()`),
  full fixture list (group rounds then QF/SF/Final as a bracket), each
  match showing teams (or source labels like "Group A winner" via
  `sourceLabel`), winner, score note, time; rules text; roster per section.
- `/intersection/players`: player stats table — most events entered, most
  games won (`playerStats()`); linked accounts show profile names,
  free-text players plain.

**Admin (`/intersection/admin`):** create/edit/delete events; generate draw
(shuffle via `generateDraw`, persist groups + matches); edit groups before
group results exist (the old app's guard); enter/clear results with the
old app's guards (can't clear a group result once knockouts started, can't
clear a knockout result that feeds a played later round); override knockout
pairings ("Edit teams", sets `manual`); set per-fixture times; manage
players + rosters; edit leaderboard points in settings. After every result
write, run `recalc` and persist team/status changes.

**App-powers (new, from §gains):**
- Fixtures with a `scheduled_at` mirror onto the shared calendar
  (`upsertModuleEvent`, category "intersection", `sectionId` null — it's
  res-wide interest; delete/regenerate cleans up via `removeModuleEvent`).
- Notifications: your section's fixture scheduled/changed and a pre-start
  reminder (see Known gaps re: scheduling) → `notify({ category:
  "intersection", audience: { kind: "section", sectionId },
  aboutSectionId: sectionId })` to each of the two sections; results →
  same categories with copy like "Katstraat move to 2nd" (compute standing
  delta from `leaderboard()` before/after).

**Done when:** everything the old app does works here identically (use its
README's flow as an acceptance script), signed-out viewing works from a
WhatsApp-pasted link, fixtures appear on the calendar automatically, and
the two seeded events render correctly (the completed bracket must show
Katstraat as champion).

### 5.4 Profile (`src/modules/profile`)

- **Details:** name, section (select), room, sports played (`user_sports`
  checkboxes) — same fields as onboarding, editable, saved via action.
- **Notification settings:** one switch per category from
  `allNotificationCategories()` in the registry (labels + a one-line
  explanation each; the `section` toggle is "Only notify me about my
  section" — off by default). Persist to `notification_preferences`
  (upsert own rows). Quiet hours: two time inputs (default 23:00–07:00)
  saved on `profiles`, with "urgent ignores this" copy.
- **Calendar feed:** show the personal ICS URL
  (`/api/calendar/<calendar_token>.ics`) with copy button and a
  "regenerate token" action (update `calendar_token`, old links die).
- **The bell:** global in the `(app)` shell header (build it here or in
  `src/core/ui/` — shell-owned, module-agnostic): unread count badge
  (`notifications` where `read_at is null`), dropdown/sheet list, tapping
  marks read (`read_at = now()`) and follows `url`. Poll or Supabase
  Realtime — polling every 60s is acceptable and boring.
- **Admin tools:** section listing `allAdminPanels()` from the registry,
  filtered by the user's role — plus a Members admin page (`adminPanels`
  entry on the profile module: add it) for role changes and year-end
  deactivation (`is_active = false`), per ADMIN-GUIDE.
- **Sign out** button (calls `signOut` from `@/core/auth/provider`).

**Done when:** the spec pair (hockey player in Ingang, squash player in
Route 61) can each open Profile, see their own toggles, and the targeting
tests' behaviour is what they experience; an admin can deactivate a leaver
without SQL.

## 6. Known gaps, stubs, and traps

- **Web push does not send.** In-app bell only until v1.1. Don't promise
  push in UI copy. The stub (`src/core/notifications/channels.ts`)
  documents the implementation when its turn comes.
- **No cron exists.** Two features need a periodic tick: publishing
  `scheduled` announcements at `scheduled_for`, and pre-start/morning-of
  reminders. Build them as idempotent API route handlers (e.g.
  `/api/cron/tick`, secret-protected) that (a) publish due announcements +
  notify, (b) send reminders for events starting soon / today. Wire Vercel
  Cron (vercel.json) at 5-minute granularity. Until wired, scheduled posts
  simply don't auto-publish — say so in the compose UI.
- **database.types.ts is hand-written** until someone runs
  `npm run db:types` against a live schema — do that early; the shapes are
  correct but machine output is the durable form.
- **Storage signed URLs:** the attachments bucket is private;
  `db.storage.from("announcement-attachments").createSignedUrl(path, ttl)`
  for display. Upload from the browser with the user's session (RLS:
  admins write).
- **Trap — `next` param:** login redirects preserve `?next=`; keep that
  working if you touch auth pages.
- **Trap — profiles privilege guard:** users can update their own profile
  row but a DB trigger rejects role/is_active changes by non-admins. Don't
  "fix" a failing self-promotion by loosening the trigger.
- **Trap — read receipts privacy:** counts via the RPC only. Never add an
  admin select policy on `announcement_reads`.
- **Trap — the bracket is law:** group pattern, QF pairing, points are res
  tradition. `tournament.test.ts` failing means you broke the competition,
  not the test.
- **Old app retirement:** once intersection reaches parity, announce the
  new URL, freeze the Render app, export its final JSON backup, and archive
  the repo. Its data does NOT auto-migrate; if HK wants history imported,
  write a one-off script mapping its JSON to the new tables (ids differ).

## 7. Suggested build order (and where the risk is)

1. **Profile** (small, exercises registry-driven settings + the bell —
   which everything else lights up).
2. **Home feed + announcements admin** (highest daily value; moderate risk
   in Storage uploads and the pinned-urgent logic).
3. **Calendar UI + ICS** (medium; the month grid is the fiddliest pure-UI
   piece — keep it boring, consider a simple hand-rolled grid over a
   library).
4. **Sport** (mostly straightforward CRUD + the result→announcement flow).
5. **Intersection** (biggest single module; the admin flows and guards are
   the risk — port behaviour from the old app exactly, lean on
   `tournament.ts`, and test the guards).
6. **Cron route + scheduled publishing** (after Home admin exists).

Keep PRs per module. Run `npm run check` and `npm run test:rls` before each
merge; add RLS tests when you add policies. Update docs/BUILD-LOG.md as
placeholders become real.

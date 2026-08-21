# Eendrag App

The official app of Eendrag residence, Stellenbosch — announcements,
calendar, sport, and the inter-section competition. It replaces the 280-person
WhatsApp announcement group.

**Live: https://eendrag-app.vercel.app** — merging to `main` deploys it.
Operations, backups and the move off managed hosting:
[docs/OPERATIONS.md](docs/OPERATIONS.md).

## Start here if you have forgotten everything

New maintainer, or the person who built it coming back a year later — same
five things, in this order.

1. **Every password is in Bitwarden.** https://vault.bitwarden.com, the
   "Eendrag App" organisation. Supabase, Vercel, the shared Google account,
   the backup passphrase, all of it. Nothing is written down in this repo and
   nothing should be. If you cannot get into Bitwarden, read
   [If you are locked out](#if-you-are-locked-out) before touching anything
   else.
2. **[Handover: where everything lives](#handover-where-everything-lives)** —
   the four places this app is hosted, which account owns each, and how you
   get in.
3. **[What needs doing, and when](#what-needs-doing-and-when)** — the whole
   maintenance calendar. Most of it is automatic; this says which parts are
   not, and what to check after a quiet holiday.
4. **[Running locally](#running-locally-target-under-15-minutes)** — clone to
   working app in under fifteen minutes, against a throwaway database. You do
   not need any production password for this.
5. **[docs/ADMIN-GUIDE.md](docs/ADMIN-GUIDE.md)** if you only want to *run*
   the res (post announcements, add reps, run an intersection event). None of
   that needs a developer or this repo.

Then, when you are actually changing code: [CLAUDE.md](CLAUDE.md) (written for
AI sessions, and the fastest orientation for humans too) and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Why things are the way they are,
including decisions that look odd: [docs/DECISIONS.md](docs/DECISIONS.md).

## Handover: where everything lives

Read this first if you are the incoming HK and nobody has explained the app
to you. It tells you every place the app is hosted, which account owns it,
and where the passwords are. You should need nothing else from the person
before you.

**Everything is on one shared Google account: `eendragapp@gmail.com`.** That
mailbox is the recovery address for every service below, so whoever can read
it can reset everything. Treat it as the master key. GitHub is the one
exception, for now, and "GitHub is the loose end" below says what to do about
that.

**Every password lives in Bitwarden** (https://vault.bitwarden.com), in the
Eendrag App organisation. The outgoing HK invites your address to the
collection, you accept the invite by email, and you then have the lot. No
password is written down in this repo, in the docs, or anywhere else, and it
should stay that way. If a login below is missing from the vault, add it the
day you find out.

### The five places it is hosted

| What | Where | Owned by | You get in with |
| --- | --- | --- | --- |
| **Code** | GitHub org [`eendrag-app`](https://github.com/eendrag-app), repo [`eendrag-app/eendrag-app`](https://github.com/eendrag-app/eendrag-app) (public) | the org itself, billed to `eendragapp@gmail.com`. Its only owner today is one personal account, see below | your own GitHub account, once you are added as an org owner |
| **The website** | Vercel project `eendrag-app`, live at https://eendrag-app.vercel.app | Vercel account `eendragapp-9642`, team `eendrag-app` | Vercel login in Bitwarden (it signs in with the Google account) |
| **The database, logins and files** | Supabase project `wznutdfrtfsgelugtznz` ([dashboard](https://supabase.com/dashboard/project/wznutdfrtfsgelugtznz)) | `eendragapp@gmail.com` | Supabase login in Bitwarden |
| **The email that owns all of it** | Gmail, `eendragapp@gmail.com` | itself | Google password in Bitwarden, plus the 2FA recovery codes |
| **The OLD intersection app** (still live) | Cloudflare Workers + D1, worker `eendrag-intersection`, database `eendrag` | ⚠️ **a personal Cloudflare account, `olistrauss05@gmail.com`** — not the shared address | that person's Cloudflare login. **Not currently in Bitwarden** |

There is no separate server, no custom domain, and no third party holding res
data beyond those. Announcements, the calendar, section membership and the
resident list are all rows in the one Supabase project.

**The fifth row is a loose end, and a bigger one than it looks.** The old
intersection app (repo `OliStrauss/eendrag-intersection`) is still live and is
still the *scoreboard of record* for the competition — this app's leaderboard
is mirrored across from it after each event. Its data lives in a Cloudflare D1
database on one student's personal account. If that account goes away, the
live competition and its history go with it, and the only copy of the season
is whatever was last imported here.

Two things fix it, and neither is urgent enough to do badly:

1. **Today:** take a backup from the old app (Admin → Settings → Download
   backup), put the file somewhere durable, and put its admin password in
   Bitwarden. That alone means nothing is unrecoverable.
2. **When the intersection module reaches parity:** retire the old app
   entirely. Import its final backup (`npm run import-intersection`), freeze
   it, and delete this row. That is the intended end state — see
   docs/HANDOFF.md.

### GitHub is the loose end

A GitHub organisation is not owned by an email address the way the Vercel and
Supabase accounts are. It is its own thing (created 11 August 2026, billed to
`eendragapp@gmail.com`), and it needs at least one human account with the
**Owner** role. Today that is exactly one account, `OliStrauss`, personal, left
over from the original build. The shared Google address has no GitHub login of
its own yet.

Nothing about the running app depends on that person. The repo URL, the Vercel
connection, the `CRON_SECRET` Actions secret and the branch protection all
belong to the org, not to him, and the site would carry on deploying if he
vanished tomorrow. What you would lose is the ability to *change* anything:
nobody could add a maintainer, rotate that secret, or alter branch protection,
and the only way back would be forking the code to a fresh org and re-pointing
Vercel at it.

So do this once, and it stops being a question every year:

1. **Make a GitHub account on the shared address.** Sign up with
   `eendragapp@gmail.com` (the username `eendrag-app` is already taken by the
   org, so something like `eendrag-app-hk`). GitHub allows a shared account
   like this alongside personal ones. Turn on 2FA and put the password and the
   recovery codes in Bitwarden.
2. **Invite it as an Owner.** Org → People → Invite member → role **Owner**,
   then accept the invite from the shared account.
3. **Invite the incoming HK's personal account as an Owner too**, so a real
   person with a name is on the hook during their term.
4. **Check deploys still work before removing anyone.** Vercel → project →
   Settings → Git. The Vercel GitHub App is installed on the org, so it
   survives an owner leaving, but if Vercel says the connecting user lost
   access, reconnect it while signed in as the shared account.
5. **Now the outgoing owner removes their own account** from Org → People. Then
   look at the repo's own Settings → Collaborators, which is a separate list
   from org membership: `Pieter-dK` has admin there today, so decide whether
   that stays.
6. **Prove it.** Merge a one-word change and watch it deploy.

The arrangement that comes out of that is worth keeping: **the shared account
is the permanent owner and lives in Bitwarden, and each HK's personal account
is added as an owner for their term and removed at handover.** Commits still
carry real names, so the history stays honest, and the org never depends on a
student who graduated three years ago.

### What it costs

Nothing today. Vercel is on the free Hobby plan, Supabase on the free tier,
GitHub is free because the repo is public. There is no card on file and no
invoice to pass on. Two consequences worth knowing:

- Vercel Hobby refuses cron jobs more often than daily, which is why the
  five-minute tick runs from GitHub Actions instead (docs/OPERATIONS.md →
  Scheduled work).
- Free-tier Supabase projects pause themselves after a long quiet spell. If
  the app is dead over a December holiday, open the dashboard and resume the
  project before assuming something is broken.
- **The free tier takes no backups.** None — not daily, not point-in-time.
  The only copy of this database is the nightly dump this repo takes itself
  (docs/OPERATIONS.md → Backups). Paying for Supabase Pro would add 7 days of
  managed daily backups; until then, do not delete the workflow.

If the res ever does pay for something, put the card and the plan in this
table so the next person is not surprised.

### Why the repository is public (and what making it private would cost)

This is the question everyone asks eventually, so: **the repo is public
because that is what makes the hosting free.** Two separate things depend on
it.

1. **Vercel would stop deploying.** The Hobby plan cannot deploy a *private*
   repository owned by a GitHub *organisation* — Vercel's own answer is "make
   it public or upgrade to Pro". This repo is owned by the `eendrag-app` org,
   so private means no deploys.
2. **The five-minute cron tick would run out of minutes.** GitHub Actions
   minutes are unlimited on public repositories. On a private one the free
   allowance is 2,000 minutes a month, and `cron-tick.yml` runs every five
   minutes — 288 runs a day, ~8,700 a month, each billed as at least a whole
   minute. It would exhaust the month's allowance in about a week, and
   scheduled announcements would stop going out.

So going private costs, at minimum, **$20/month for Vercel Pro** *plus*
replacing the tick with an external scheduler (a free one hitting
`/api/cron/tick?secret=…` works — see docs/OPERATIONS.md → Scheduled work) or
accepting Vercel's once-a-day cron, which means a post scheduled for 14:00
goes out at 06:00 the next morning.

**What it does not cost you: secrets.** There are none in here. `.env*` is
gitignored, the history was scanned for key-shaped strings before publishing,
and no res content lives in the repo — announcements, the calendar, section
membership and the resident list are all rows in Supabase, which is not
public. The anon key that *is* public is public by design; browsers see it,
and RLS is what actually protects the data.

**Two things the public repo does affect**, both already handled:

- **Workflow artifacts are public too**, which is why the nightly backup is
  encrypted before it is uploaded (docs/OPERATIONS.md → Backups). Never add a
  workflow that uploads database contents unencrypted.
- **Anyone can open a pull request**, so the Vercel Preview environment is
  deliberately left with no environment variables. Previews render but cannot
  reach the database — a preview build that could read the service-role key
  is a preview build that could print it.

If you decide to go private anyway, the checklist is: upgrade Vercel or switch
to token-based deploys, delete or re-home `cron-tick.yml`, and only then flip
the setting. Full reasoning in docs/DECISIONS.md → "The repository is public,
and that is what pays for the hosting".

### The secrets, and which of the four holds each one

You do not need to know these values to run the app locally (see Running
locally below, which uses a throwaway local database). You need them when you
change production.

| Secret | Lives in | What breaks without it |
| --- | --- | --- |
| Supabase URL, anon key, service role key | Vercel → project → Settings → Environment Variables (Production), and Bitwarden | The site cannot reach the database |
| `CRON_SECRET` | Vercel env vars, **and** GitHub → repo → Settings → Secrets → Actions, **and** Bitwarden. All three must match | Scheduled announcements and day-of reminders never go out. The compose screen warns you |
| Web push VAPID keys | Vercel env vars and Bitwarden | Phones do not buzz. The in-app bell keeps working |
| Database password | Supabase dashboard (Settings → General, or reset it there), and Bitwarden | `psql`, the RLS tests and the nightly backup cannot connect |
| `SUPABASE_DB_URL` | GitHub → repo → Settings → Secrets → Actions, and Bitwarden. Get the value from the dashboard's **Connect** button → **Session pooler** (not Direct — it is IPv6-only and GitHub runners are IPv4) | The nightly backup cannot connect and the workflow fails |
| `BACKUP_PASSPHRASE` | GitHub Actions secrets, and Bitwarden | **Every nightly backup becomes permanently unreadable.** Nothing else uses it, and it cannot be recovered |

The anon key is public by design (browsers see it). The service role key
bypasses every security policy in the database, so it belongs in Vercel and
Bitwarden and nowhere else, never in a screenshot, never in a WhatsApp
message.

### Handover checklist

Outgoing HK, do these with the incoming person sitting next to you:

1. **Bitwarden.** Invite their address to the Eendrag App organisation, watch
   them accept, and watch them open one entry. Remove your own access last,
   once everything else below is done.
2. **The Google account.** Change the `eendragapp@gmail.com` password to a new
   one, save it in Bitwarden, and move the 2FA to their phone. Save the new
   recovery codes in Bitwarden too.
3. **GitHub.** Add them as an owner of the `eendrag-app` org, then remove the
   outgoing personal accounts, both from Org → People and from the repo's own
   Settings → Collaborators. The org itself stays, so the repo URL never
   changes. If the shared GitHub account does not exist yet, this is the
   handover to make it on: see "GitHub is the loose end" above.
4. **Vercel.** They sign in with the Google account, so there is nothing to
   transfer. Check they can see the `eendrag-app` project and open a
   deployment log.
5. **Supabase.** Same, they sign in with the Google account. Check they can
   open the project and the Table Editor.
6. **Rotate what the leaver saw**: Supabase service role key and database
   password (docs/OPERATIONS.md → Credential rotation), and update Vercel and
   Bitwarden with the new values. Redeploy afterwards, env var changes only
   take effect on a new deploy.
7. **The backup passphrase.** Confirm `BACKUP_PASSPHRASE` is in Bitwarden and
   that they can open it. Then have them download last night's backup artifact
   and decrypt it in front of you. **If this passphrase is lost, every backup
   is unreadable and there is no other copy of the database** — the free
   Supabase tier takes none of its own.
8. **The old intersection app.** If it is still live, hand over its Cloudflare
   login and admin password too, and take a fresh Download backup on the day
   (see "The five places it is hosted" above). It is the only system here that
   is not on the shared Google account.
9. **Delete `admin@eendrag.dev` from production** if it exists. Its password is
   written in this public repo; it is a local development convenience and
   should never survive on the live project.
10. **Prove it works.** Have them merge a one-word change to `main` and watch
    the deploy land on the live site. If that works, they own it.

### If you are locked out

Everything resets through `eendragapp@gmail.com`, so recovering that mailbox
is the whole problem. If Bitwarden has the Google password and the 2FA
recovery codes, you are fine. If it does not, and nobody can read that
mailbox, then GitHub, Vercel and Supabase are all unreachable and the app
cannot be changed, only viewed. The database would have to be restored from a
backup into a fresh project (docs/OPERATIONS.md → Restore) and everything
rebuilt around it — and that restore only works if the **backup passphrase**
survived, which is a second, independent way to lose everything: the nightly
dumps are encrypted with it, nothing else uses it, and it cannot be recovered
from any provider. This is the one failure the repo cannot answer, which is
why the Google recovery codes *and* that passphrase belong in Bitwarden today,
not next term.

## What needs doing, and when

Most of this app looks after itself. This is the list of what does not, so a
year away does not turn into a surprise.

### Automatic, but worth glancing at

| What | When | How you know it broke |
| --- | --- | --- |
| **Nightly backup** | 02:15 every night | The workflow fails and GitHub emails the repo owners. Actions tab → Nightly backup should have a green run from last night |
| **Cron tick** (publishes scheduled announcements, day-of reminders) | Every 5 minutes | Scheduled posts go out late or not at all. Same Actions tab |
| **Deploys** | Every merge to `main` | Vercel dashboard → Deployments |

> **GitHub disables scheduled workflows after 60 days with no repository
> activity**, and emails the admins when it does. Over a quiet December that
> genuinely happens. **After any long break, open the Actions tab and check
> both scheduled workflows are still enabled and ran last night.** Re-enable
> from that page if not.

> **Free-tier Supabase projects pause themselves after a long quiet spell.**
> If the app is dead after a holiday, open the Supabase dashboard and resume
> the project before assuming something is broken.

### After each intersection event

While the old intersection app is still the scoreboard of record (see
[the five places](#the-five-places-it-is-hosted) above), mirror it across: `npm run import-intersection -- backup.json`. Steps in
docs/OPERATIONS.md → Mirroring the old intersection app.

### Once a year, when the competition restarts

**Intersection admin → Season → Start a new season.** Every section goes back
to zero. Nothing is deleted — the old season keeps its events and results and
stays readable. Note that *deleting the events is not the same thing* and will
not clear the leaderboard; docs/ADMIN-GUIDE.md explains why.

### At HK handover

The full checklist is [below](#handover-checklist). In short: move Bitwarden
access, rotate the credentials, add the incoming maintainer to GitHub and
Vercel, deactivate leavers in the app, and **delete `admin@eendrag.dev` if it
exists on production** — its password is written in this public repo, because
it is only ever meant to exist on a developer's laptop.

### Test the restore once a year

Before you need it. Download a backup artifact, decrypt it, load it into a
throwaway Supabase project, and see the res's data come back. Steps in
docs/OPERATIONS.md → Restore. A backup nobody has ever restored is a guess.

## Prerequisites

- **Node.js 24+** — https://nodejs.org
- **Docker Desktop** — https://docker.com (only for the local database and
  container builds; the app itself runs without it if you point .env.local at
  the hosted Supabase project)
- A terminal. On Windows, PowerShell is fine.

## Running locally (target: under 15 minutes)

```bash
git clone https://github.com/eendrag-app/eendrag-app.git
cd eendrag-app
npm install
```

**Option A — local database (recommended for development):**

```bash
npx supabase start        # first run downloads images; takes a few minutes
```

When it finishes it prints an `API URL`, `anon key`, `service_role key`, and
`DB URL`. Copy `.env.example` to `.env.local` and paste them in:

```
NEXT_PUBLIC_SUPABASE_URL=<API URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
SUPABASE_DB_URL=<DB URL>
```

Then load the schema + placeholder data, create the dev admin, and run:

```bash
npx supabase db reset     # applies migrations + seed.sql
npm run create-admin      # admin@eendrag.dev / eendrag-dev-admin
npm run dev
```

Open http://localhost:3000 — sign in as the dev admin, or create your own
account (you'll get the onboarding form: name, section, room, sports).

**Option B — hosted database:** get the values for `.env.local` from the
Supabase dashboard — keys from Settings → API Keys, and the database URL from
the **Connect** button in the header — or from Bitwarden, and skip
`supabase start`. (Supabase moved these; there is no Settings → Database page
any more.)

## Commands

| Command | What |
| --- | --- |
| `npm run dev` | Dev server on :3000 |
| `npm run check` | Typecheck + lint + unit tests — run before pushing |
| `npm run test` | Unit tests only (fast, no database) |
| `npm run test:rls` | RLS policy proofs — needs a live database and `.env.local` |
| `npm run test:e2e` | Playwright smoke tests (starts the dev server itself) |
| `npm run db:push` | Apply new migrations to the linked/local database |
| `npm run db:types` | Regenerate `src/core/db/database.types.ts` from the linked (hosted) project |
| `npm run db:types:local` | Same, from a local `supabase start` stack |
| `npm run create-admin` | Create/promote the dev admin (see below) |
| `npm run import-residents` | Load the HK's resident list into the signup allowlist |
| `npm run import-intersection` | Mirror the old intersection app's competition across (docs/OPERATIONS.md) |
| `npx supabase db reset` | Wipe + migrations + seed — local db only |

## The dev admin

`npm run create-admin` creates **admin@eendrag.dev / eendrag-dev-admin** with
the `admin` role (custom: `npm run create-admin -- email password`). Dev
convenience only — never create it on the production project.

## Environment variables

All of them are listed with explanations in [.env.example](.env.example).
`.env.local` is gitignored; real production values live in Bitwarden and the
Vercel project settings, never in the repo (see Handover above).

One worth knowing about: **`CRON_SECRET`**. It protects `/api/cron/tick`,
which publishes scheduled announcements and sends day-of reminders. Without
it that route refuses to run, and the compose screen warns that scheduling is
not wired up. Any random string will do locally
(`node -e "console.log(crypto.randomUUID())"`).

## Tests before you push

```bash
npm run check
```

CI (GitHub Actions) runs the same on every PR. `main` is protected — work on
a branch, open a PR.

## Where things are

```
src/app/        thin routes only — pages re-export from modules
src/modules/    the mini-apps: home, sport, intersection, profile
                _template/ is the copy-paste starting point for new ones
                registry.ts is THE registration point (one line per module)
src/core/       shared services: auth, db, permissions, calendar, notifications
supabase/       migrations (numbered per module), seed.sql, RLS tests
docs/           architecture, adding a module, admin guide, operations,
                decisions, build log, and the phase-two handoff brief
```

Adding a whole new mini-app is one folder + one registry line:
[docs/ADDING-A-MODULE.md](docs/ADDING-A-MODULE.md).

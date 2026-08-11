# Eendrag App

The official app of Eendrag residence, Stellenbosch — announcements,
calendar, sport, and the inter-section competition. It replaces the 280-person
WhatsApp announcement group.

**Live: https://eendrag-app.vercel.app** — deploys are manual for now
(`npx vercel --prod`); why, and how to make them automatic, is in
[docs/OPERATIONS.md](docs/OPERATIONS.md).

New maintainer? Read this file, then [CLAUDE.md](CLAUDE.md) (context for AI
sessions, useful for humans too), then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Routine admin tasks (posting announcements, adding reps) need no developer at
all: [docs/ADMIN-GUIDE.md](docs/ADMIN-GUIDE.md).

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
Supabase dashboard (Project Settings → API, and Connect → Direct connection)
or the password manager, and skip `supabase start`.

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
| `npx supabase db reset` | Wipe + migrations + seed — local db only |

## The dev admin

`npm run create-admin` creates **admin@eendrag.dev / eendrag-dev-admin** with
the `admin` role (custom: `npm run create-admin -- email password`). Dev
convenience only — never create it on the production project.

## Environment variables

All of them are listed with explanations in [.env.example](.env.example).
`.env.local` is gitignored; real production values live in the password
manager and the Vercel project settings, never in the repo.

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

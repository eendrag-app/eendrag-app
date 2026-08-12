# Operations

Deploying, backing up, restoring, rotating credentials, and — one day —
moving off managed hosting. Written for a maintainer who has never operated
this app before.

Accounts and secrets live in the res password manager (ask the current prim /
HK IT portfolio): GitHub org, Supabase project, Vercel team, and this
document's credentials. **Nothing secret is in the repo.**

## Deploy

**Live at https://eendrag-app.vercel.app** (Vercel project `eendrag-app`,
account `eendragapp-9642`, first deployed 2026-08-11).

### How a deploy happens

**Merge to `main` → production deploy, automatically.** Vercel's GitHub
integration is connected, and it works on the free Hobby plan because **the
repository is public**. That was a deliberate choice (2026-08-11): Hobby
cannot connect a private repository owned by an organisation, and going public
was cheaper and simpler than the alternatives. Nothing secret is in the repo —
`.env*` is gitignored and the history was scanned before publishing — and no
res *content* is either: announcements, the calendar and section membership
all live in Supabase.

**If the repo ever goes private again**, that integration stops working. Then
either upgrade to Vercel Pro, or deploy from a GitHub Actions workflow with a
Vercel token in repository secrets (`vercel deploy --prod --token=…`), and
replace the cron workflow with an external scheduler (see Scheduled work).

To deploy by hand — from a clone, when you need to ship without a merge:

```bash
npx vercel login          # once per machine
npx vercel link           # once per machine — pick the eendrag-app project
npx vercel --prod
```

> **That uploads your working directory, not `main`.** Check out `main` and
> pull first, or you will publish whatever you were mid-way through.

`npx vercel ls` lists recent deployments; `npx vercel rollback` and the
dashboard's "Promote to Production" both undo one.

### Preview deploys are deliberately not wired to the database

Vercel builds a preview for every PR, but **no environment variables are set
for the Preview environment**, so a preview cannot reach Supabase. That is on
purpose: the repository is public, so anyone can open a pull request, and a
build that could read `SUPABASE_SERVICE_ROLE_KEY` is a build that could print
it. Previews are useful for looking at markup; test against a database
locally (`npm run dev`) instead.

If you ever do want working previews, point them at a *separate* Supabase
project — never the pilot one.

### Environment variables

Vercel → Project → Settings → Environment Variables, mirroring
`.env.example`. Currently set for **production**:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `AUTH_MODE`, `REQUIRE_SUN_EMAIL`,
`NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`. Changing one needs a redeploy.

Add them from the CLI without pasting secrets into a shell history:

```bash
printf '%s' "$VALUE" | npx vercel env add NAME production
```

`printf` rather than `echo`: a trailing newline in `CRON_SECRET` makes the
deploy fail, because Vercel sends it as an HTTP header.

### One Next.js gotcha

`next.config.ts` only asks for `output: "standalone"` when **not** building on
Vercel. Standalone output is what the Dockerfile copies, but Vercel runs its
own file tracing and the build dies with
`ENOENT: .next/next-server.js.nft.json` if standalone is on. Both paths are
verified; don't "simplify" that conditional away.

### Database migrations on production

Deploys do NOT run migrations. After merging a PR that adds files under
`supabase/migrations/`:

```bash
npx supabase login          # once per machine
npx supabase link           # once per machine — pick the project
npm run db:push             # applies pending migrations
```

Do this BEFORE merging app code that depends on the new schema (or merge and
push immediately after — the window where code and schema disagree is
downtime).

## Rollback

- **App:** Vercel dashboard → Deployments → previous good deployment →
  "Promote to Production". Takes seconds.
- **Schema:** there is no automatic down-migration. Write a new forward
  migration that undoes the change (rename back, drop the new table), test
  it locally against `supabase start`, then `npm run db:push`. For data
  damage, restore from backup (below).

## Backups

Two independent layers:

1. **Supabase automatic backups** — the hosted project takes daily backups
   (retention depends on plan; check Dashboard → Database → Backups).
   Point-in-time recovery if the plan includes it.
2. **Our own nightly dump** — belt and braces, and the thing that makes us
   portable. A scheduled GitHub Action (`.github/workflows/backup.yml`, if
   present) or any machine with cron runs:

   ```bash
   npx supabase db dump --db-url "$SUPABASE_DB_URL" -f "backup-$(date +%F).sql"
   ```

   Store dumps somewhere that is not the same Supabase project (the HK
   Google Drive, an S3 bucket — anywhere durable). Keep at least 30 days.

Storage files (announcement attachments) matter less than the database, but
`npx supabase storage cp -r ss:///announcement-attachments ./attachments-backup`
copies them out.

## Restore (test this once a year, before you need it)

Into a fresh or wiped database:

```bash
psql "$TARGET_DB_URL" -f backup-2027-03-01.sql
```

That single command is the whole restore — the dump contains schema and
data. Then point the app's env vars at the target and redeploy. To restore
into the same Supabase project, Dashboard → Database → Backups → Restore is
usually simpler.

## Data export (someone asks for "all the data")

```bash
npx supabase db dump --db-url "$SUPABASE_DB_URL" --data-only -f export.sql
```

or per-table CSV from the Dashboard's Table Editor.

## Credential rotation (yearly, at HK handover)

1. **Supabase keys** — Dashboard → Project Settings → API → rotate
   service_role (and anon if needed). Update Vercel env vars + the password
   manager. The anon key is public by design; service_role is the crown
   jewels.
2. **Database password** — Dashboard → Project Settings → Database → reset.
   Update `SUPABASE_DB_URL` wherever stored.
3. **GitHub** — transfer org ownership to the incoming maintainer's account;
   remove leavers from the org.
4. **Vercel** — same: team membership follows the HK.
5. **Dev admin** — if `admin@eendrag.dev` exists anywhere hosted, delete it.

## Moving off managed hosting (the university-server path)

The app is a container + plain Postgres, so the move is mechanical. On the
university server you need: Docker, and either self-hosted Supabase or a
plain Postgres plus small substitutions.

**Recommended: self-hosted Supabase** (keeps auth + storage + RLS identical):

1. On the server, install Supabase self-hosted (their official
   `docker compose` bundle — see supabase.com/docs/guides/self-hosting).
2. Apply our schema: `psql "$NEW_DB_URL" -f` each file in
   `supabase/migrations/` in filename order (or `supabase db push` pointed
   at the new instance).
3. Restore the latest data dump (Restore section above).
4. Build and run the app container next to it:

   ```bash
   docker compose --env-file .env.local up --build -d
   ```

   with `.env.local` pointing at the self-hosted Supabase URL + keys.
5. Point DNS at the server, put its reverse proxy (Caddy/nginx) in front for
   TLS.
6. Update `docs/` and the password manager to reflect the new home.

What is Supabase-specific and would need attention in a bare-Postgres world
(only if you abandon Supabase entirely): Auth (swap
`src/core/auth/provider.ts` for another provider), Storage (attachment
uploads), and the `auth.users` trigger in `0100_core_init.sql`. Everything
else is plain Postgres.

## Installing the app ("Get app")

Eendrag is a **progressive web app**: the same site, installable to a home
screen. Three files do all of it and there is no build plugin involved —

| File | What it is |
| --- | --- |
| `src/app/manifest.ts` | name, icons, colours, `display: standalone` |
| `public/sw.js` | the service worker: a fetch passthrough, plus the push handlers |
| `src/core/pwa/install.tsx` | the "Get app" button and the iOS instructions |
| `scripts/generate-icons.mjs` | regenerates `public/icons/*` — run and commit if the mark or colours change |

**Android, Chrome, Edge, desktop Chrome:** the browser fires
`beforeinstallprompt` once it decides the app qualifies (manifest + a service
worker with a fetch handler + https). The button replays that event, so people
get the browser's own install dialog.

**iPhone:** Apple provides no install API at all. The button opens a sheet
explaining Share → Add to Home Screen. This is not cosmetic — **an iPhone will
not deliver web push until the app has been added to the home screen**, so on
iOS "install the app" and "turn on notifications" are the same instruction.

Both surfaces disappear once the app is installed (`display-mode: standalone`).

**The service worker caches nothing, deliberately.** A stale cache in an
announcement app means someone reads yesterday's notice about tonight's
meeting. It exists because installability requires a fetch handler and because
push is only delivered to a service worker. If you ever add caching there, do
not cache HTML documents or anything under `/api`, and bump `CACHE_VERSION`.

**If installing stops being offered**, check in this order: the site is on
https (localhost counts), `/manifest.webmanifest` returns 200, `/sw.js`
returns 200 with a JavaScript content type, and the icons in the manifest all
resolve. Chrome's DevTools → Application → Manifest lists whatever it is
unhappy about.

## Scheduled work

One endpoint does all of it: **`GET /api/cron/tick`**. Every tick

1. publishes announcements whose scheduled time has passed, and notifies as
   if the HK had pressed Publish;
2. sends a day-of reminder for calendar events starting in the next 24 hours,
   and for intersection fixtures to the two sections playing.

Everything it does is idempotent — running it twice, late, or by hand sends
nothing twice — so a missed hour simply catches up on the next tick.

**It is protected by `CRON_SECRET`, and refuses to run (503) if that variable
is not set.** That is deliberate: an open endpoint that notifies 280 people is
not something to leave lying around. The announcement compose screen reads the
same variable and warns when scheduling is not wired up, so a missing secret
shows up as a visible warning rather than posts that silently never go out.

**Two things call it, on purpose:**

1. **GitHub Actions, every five minutes** —
   `.github/workflows/cron-tick.yml`, using the `CRON_SECRET` repository
   secret. This is what actually gives scheduled posts their intended
   behaviour. It is free because Actions minutes are unlimited on public
   repositories; if this repo ever goes private again, delete the workflow and
   use an external scheduler (below) instead.
2. **Vercel, once a day at 06:00** — `vercel.json`, sending
   `Authorization: Bearer $CRON_SECRET` automatically. A backstop, kept
   because the tick is idempotent so two callers cost nothing.

> Vercel's schedule is daily rather than `*/5` because **the Hobby plan
> refuses anything more frequent** — the deploy fails outright with "Hobby
> accounts are limited to daily cron jobs". On its own that would mean a post
> scheduled for 14:00 going out at 06:00 the next morning, which is why the
> Actions workflow exists. On Pro you could drop the workflow and set
> `*/5 * * * *` here instead.

**If you ever need a third option** (repo went private, Actions disabled, app
moved): any scheduler that can make an HTTPS request will do — cron-job.org,
an UptimeRobot monitor, or a machine's crontab. See the curl below.

**Two gotchas with the Actions workflow:** GitHub runs scheduled workflows
late by a few minutes fairly often (fine for announcements), and **disables
them after 60 days of repository inactivity** — over a quiet December that can
happen. It emails the admins; re-enable from the Actions tab.

**Anywhere else** (university server, a laptop, cron-job.org):

```bash
*/5 * * * * curl -fsS "https://<host>/api/cron/tick?secret=$CRON_SECRET" > /dev/null
```

**To check it is alive:** run that curl by hand. It answers with what it did:

```json
{ "ok": true, "at": "2026-08-11T18:05:00.000Z", "published": 0, "reminders": 2 }
```

A 401 means the secret does not match; a 503 means it is not configured.
Failures are logged with `[cron]`, which is what to grep for in Vercel logs.

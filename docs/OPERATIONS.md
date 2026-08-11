# Operations

Deploying, backing up, restoring, rotating credentials, and — one day —
moving off managed hosting. Written for a maintainer who has never operated
this app before.

Accounts and secrets live in the res password manager (ask the current prim /
HK IT portfolio): GitHub org, Supabase project, Vercel team, and this
document's credentials. **Nothing secret is in the repo.**

## Deploy

Hosting is **Vercel** connected to this GitHub repo:

- Merge to `main` → production deploy, automatically.
- Every PR → preview deploy with its own URL, automatically.
- Environment variables live in Vercel → Project → Settings → Environment
  Variables. They mirror `.env.example`. Changing one requires a redeploy
  (Vercel prompts you).

First-time Vercel setup (only if the project link ever breaks): import the
GitHub repo in the Vercel dashboard, framework preset "Next.js", add the
env vars from `.env.example` with production values, done.

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

**On Vercel** (already configured): `vercel.json` runs it every five minutes,
and Vercel sends `Authorization: Bearer $CRON_SECRET` automatically. Set
`CRON_SECRET` in Project → Settings → Environment Variables. Note that the
Hobby plan limits crons to once a day — on Hobby, change the schedule to
`0 6 * * *` and accept that scheduled posts go out in that morning batch.

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

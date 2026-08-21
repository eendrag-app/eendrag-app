# Operations

Deploying, backing up, restoring, rotating credentials, and — one day —
moving off managed hosting. Written for a maintainer who has never operated
this app before.

Accounts and secrets live in Bitwarden, in the Eendrag App organisation (the
outgoing HK invites you to it): GitHub org, Supabase project, Vercel team, and
the shared eendragapp@gmail.com Google account that owns all three. Who owns
what, and the handover checklist, is in **README.md, "Handover: where
everything lives"**. **Nothing secret is in the repo.**

## Who may create an account

Two settings, and they only make sense together.

**In Supabase: "Confirm email" is OFF.** Its built-in mailer is rate limited
to a handful of messages an hour, so with confirmation on, a res-wide signup
evening simply fails for most people. Dashboard → Authentication →
Sign In / Providers → Email → turn **Confirm email** off → Save.

**In the app: `REQUIRE_VERIFIED_EMAIL=true`.** With confirmation off, nothing
else proves the person typing an address should be in the app at all, so the
HK's list of residents becomes the door. An address that is not in
`verified_emails` cannot create an account, and is told to ask the HK.

Set them in that order. Turning confirmation off while the list is empty
means anybody can sign up; filling the list first and flipping the flag first
means nobody can.

### Loading the list

Export the res list to CSV with a header row. Any column order; an email
column is required and a name column is used to pre-fill profiles:

```
email,name
24681357@sun.ac.za,Jan de Villiers
```

```bash
npm run import-residents -- residents.csv --dry-run
```

That reports what it would change and writes nothing. Drop `--dry-run` to
apply. Re-running is safe: it adds and updates, and never removes.

**At the end of the year**, when a whole intake leaves:

```bash
npm run import-residents -- residents-2028.csv --replace
```

`--replace` removes addresses that are no longer on the list. It does NOT
delete anyone's account — they simply cannot create a new one. Deactivating
the people who left is a separate job (Admin → Members).

### When somebody cannot sign up

Almost always one of two things: they are using a different address from the
one on the list (a personal Gmail instead of their student address), or the
HK has not added them yet. Add them and they can sign up immediately:

```bash
npm run import-residents -- one-person.csv
```

The check itself is `app_email_is_verified()`, a security definer function
that answers a single yes/no. The table stays admin-only under RLS — it holds
280 students' names and addresses, and the person asking has no account yet.

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

**The Supabase free tier takes no backups at all.** Not daily ones, not
point-in-time recovery, nothing — their own docs tell free projects to dump
their own data and keep it off-site. Daily backups with 7-day retention start
on Pro ($25/month) and PITR is a further paid add-on. Until somebody decides
to pay, the nightly dump below is the ONLY copy of this database that exists.

Nothing in the app soft-deletes either. Deleting an announcement, a fixture or
an intersection event runs a real `DELETE` and the row is gone. Restoring last
night's dump is the only undo there is.

**The nightly dump** — `.github/workflows/backup.yml` runs at 02:15 SAST every
night, dumps roles + schema + data, encrypts the result and keeps it as a
workflow artifact for 30 days. Download one from the Actions tab → Nightly
backup → any run → Artifacts.

It needs two repository secrets (Settings → Secrets and variables → Actions):

| Secret | What it is |
| --- | --- |
| `SUPABASE_DB_URL` | Connection string from Supabase → Project Settings → Database |
| `BACKUP_PASSPHRASE` | A long random passphrase you generate. **Store it in Bitwarden.** |

> **The passphrase is not optional and it is not recoverable.** This
> repository is public, and so is every artifact uploaded to it — an
> unencrypted dump would publish every resident's name, email and push
> subscription. Lose the passphrase and all 30 backups are unreadable.

To take one by hand before a risky migration: Actions → Nightly backup → Run
workflow.

Storage files (announcement attachments) are not in the dump. They matter less
than the database, but `npx supabase storage cp -r ss:///announcement-attachments
./attachments-backup` copies them out.

**What the dump does not cover:** the `auth` schema is managed by Supabase and
is not included, so a restore into a *fresh* project brings back all the data
but not the logins — people sign up again, and you re-run `npm run
create-admin`. Restoring into the *same* project keeps the logins, which is
the case that actually matters when someone deletes a few rows.

## Restore (test this once a year, before you need it)

Download the artifact from the Actions tab and unzip it, then:

```bash
gpg --decrypt --output backup.sql backup-2027-03-01.sql.gpg
psql "$TARGET_DB_URL" -f backup.sql
```

`gpg` asks for `BACKUP_PASSPHRASE` (it is in Bitwarden). The dump contains
roles, schema and data in that order, so this restores into an EMPTY database
— a fresh Supabase project, or one you have just reset. It will not merge into
a database that already has these tables.

To recover a handful of rows somebody deleted rather than the whole thing,
restore into a throwaway project first and copy out just what you need. That
is almost always what you actually want, and it never risks the live data.

Then point the app's env vars at the target and redeploy.

## Data export (someone asks for "all the data")

```bash
npx supabase db dump --db-url "$SUPABASE_DB_URL" --data-only -f export.sql
```

or per-table CSV from the Dashboard's Table Editor.

## Credential rotation (yearly, at HK handover)

1. **Supabase keys** — Dashboard → Project Settings → API → rotate
   service_role (and anon if needed). Update Vercel env vars + Bitwarden. The
   anon key is public by design; service_role is the crown jewels.
2. **Database password** — Dashboard → Project Settings → Database → reset.
   Update `SUPABASE_DB_URL` wherever stored.
3. **GitHub** — the `eendrag-app` org is its own entity, so nothing is
   transferred: add the incoming maintainer as an org owner, then remove the
   leavers from Org → People and from the repo's Settings → Collaborators.
   Keeping a shared account as permanent owner is README.md, "GitHub is the
   loose end".
4. **Vercel** — nothing to transfer either, the account signs in with the same
   Google login. Just check the incoming maintainer can open the project.
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
6. Update `docs/` and Bitwarden to reflect the new home.

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

## Notifications on a phone (web push)

Every notification is a row in `notifications` — that is what the bell shows,
and it has always worked. **Push** is the extra step that makes a phone buzz
while the app is closed. Three things have to be true, and if any one of them
is missing the bell carries on working and nothing else does:

**1. The server has VAPID keys.** `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`,
`WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_CONTACT` — see `.env.example`. Generate a
pair with `npx web-push generate-vapid-keys`, put them in `.env.local` and in
**Vercel → Settings → Environment Variables (Production)**, then redeploy.
Without them Profile says push is not switched on for this deployment and
`webPushChannel` logs instead of sending.

> **Changing the public key invalidates every existing subscription.**
> Everyone has to turn notifications on again, with no way to tell them
> except an announcement. Generate once, keep them.

**2. The person has turned it on, on that device.** Profile → Notifications →
"Notifications on this device". It asks the browser for permission, registers
with the push service, and stores the result in `push_subscriptions`. A phone,
a laptop and the installed app are three separate subscriptions.

**3. On an iPhone, the app is on the home screen.** Apple delivers web push
only to an installed web app — in Safari the switch is replaced by a line
saying so. This is not something the app can work around, so for iPhone users
"install the app" and "turn on notifications" are one instruction, in that
order.

### What then happens

- **Urgent announcements** go out immediately, ignoring quiet hours.
- **Everything else** respects quiet hours (default 23:00–07:00, per person).
  The row is saved straight away with a `deliver_at` on it, and the cron tick
  pushes it when that time arrives — so a 02:00 fixture change reaches a phone
  at 07:00, not at 02:00.
- **A tick that has been down** does not flush the whole queue into everyone's
  lock screen when it comes back: anything more than six hours late is marked
  delivered and left in the bell (`src/core/notifications/deferred.ts`).
- **Dead subscriptions prune themselves.** A push service answering 404 or 410
  means the browser threw the subscription away; the row is deleted.

### Checking it works (needs a real phone — no test suite can do this)

1. Open the deployed app on a phone, install it (iPhone: Share → Add to Home
   Screen), and open it from the home-screen icon.
2. Profile → Notifications → turn on "Notifications on this device". Accept the
   browser's permission prompt.
3. `select user_agent, created_at from push_subscriptions;` — your device
   should be there.
4. Post an announcement marked **urgent** to a section only you are in, from a
   different device. The phone should buzz within a few seconds.
5. For the quiet-hours path: set your quiet hours to cover now, post a
   NON-urgent announcement, and check the row has a future `deliver_at` and a
   null `pushed_at`. It goes out on the first tick after that time.

If nothing arrives: check the browser has notification permission for the
site, that the row in `push_subscriptions` still exists (it is deleted when a
push service reports the subscription is gone), and the Vercel function logs
for `[web-push]` lines — every failure is logged with the status the push
service returned.

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

# Migrations

Applied in filename order by `npm run db:push` (Supabase CLI) — or by plain
`psql -f` in the same order if the app ever moves off Supabase.

## Naming

`<seq>_<module>_<name>.sql` — e.g. `0400_sport_init.sql`.

The numeric prefix comes first because the Supabase CLI only applies files that
start with digits. Each module owns a hundred-block so its migrations sort
together and new modules never collide:

| Block | Owner |
| --- | --- |
| 0100–0199 | core — 0100 init, 0101 privilege-guard fix, 0102 guard order on fresh databases, 0103 grants, 0104 drop section colours, 0105 push subscriptions + notification delivery columns |
| 0200–0299 | core calendar (0200 events, 0201 upsertable source index) |
| 0300–0399 | home (announcements) |
| 0400–0499 | sport — 0400 init, 0401 rep system announcements, 0402 re-applies the guard from 0101 (see 0102), 0403 rep contact details + claim-on-signup, 0404 guards rep_email |
| 0500–0599 | intersection — 0500 init, 0501 drops players and rosters, 0502 group tie-break chosen by the HK |
| 0600–0699 | profile |
| 0700+ | next module — claim the next free block in this table |

Because blocks are per-module, a *fix* to an early block (say a core fix in
0101) sorts before migrations that already ran (0200+). The Supabase CLI
flags that as out-of-order, so `npm run db:push` passes `--include-all`:
every not-yet-applied file runs, whatever its position. On a fresh database
files still apply in plain filename order.

## Rules

- **Never edit an applied migration.** Add a new file. The CLI tracks what has
  run; editing history breaks every environment except yours.
- **RLS on every table, in the same file that creates it.** Enable RLS and
  write explicit policies immediately — a table without policies is invisible
  to the app, which is the safe failure mode.
- **Plain Postgres only.** No extensions beyond pgcrypto (gen_random_uuid),
  no Supabase-only SQL outside the `storage`/`auth` schema touches that are
  clearly marked. This keeps the university-server escape route open
  (docs/OPERATIONS.md).
- Status fields are `text` + `check` constraints, not Postgres enums — adding
  a value is a one-line migration instead of an enum alter dance.
- **Test on an empty database, not just on yours.** `npx supabase start` then
  `npx supabase db reset` applies every file in filename order from zero. Two
  bugs hid for a whole phase because nobody did: a `create function` that
  clashed with a later fix (0102/0402), and missing table grants that made a
  fresh database unreadable (0103). A migration that only works in the order
  your project happened to apply things is not a migration.
- New tables get their grants automatically from the default privileges set
  in 0103 — but RLS still has to be enabled with explicit policies in the same
  file that creates the table.

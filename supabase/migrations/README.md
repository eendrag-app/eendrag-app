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
| 0100–0199 | core (profiles, sections, sports catalogue, notifications) |
| 0200–0299 | core calendar (events) |
| 0300–0399 | home (announcements) |
| 0400–0499 | sport |
| 0500–0599 | intersection |
| 0600–0699 | profile |
| 0700+ | next module — claim the next free block in this table |

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

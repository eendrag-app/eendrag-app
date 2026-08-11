# _template — the starting point for every new module

Copy this folder, rename it, register it, ship it. The full walkthrough with a
worked example (a "Roompoints" module) is in `docs/ADDING-A-MODULE.md` — read
that first. This README is the quick reference.

## What's in here

| File | Role |
| --- | --- |
| `module.ts` | The module's self-declaration (`AppModule`). Registered in `src/modules/registry.ts`. |
| `pages/template-page.tsx` | A server-component page. The route file under `src/app/(app)/template/` just re-exports it. |
| `components/greeting-form.tsx` | A small client component at the leaf. |
| `actions.ts` | Server action: Zod-validate → do work → return `{ ok }` / `{ ok: false, error }`. |
| `greeting.ts` | Plain logic, unit-testable without a server. |
| `template.test.ts` | Vitest tests, colocated with the module. |
| `migration.example.sql` | What a module migration looks like (table + RLS). Not applied. |

## The rules

- **Never import from another module.** `@/modules/sport/...` inside this
  folder is an ESLint error. Shared behaviour lives in `@/core/...`; shared UI
  in `@/components/ui`.
- **Everything the module owns stays in its folder** — pages, components,
  actions, tests. The only footprint outside it: one line in `registry.ts`,
  thin route re-exports under `src/app/(app)/`, and migrations in
  `supabase/migrations/`.
- **This original stays registered** (hidden from the tab bar) as a living
  smoke test — visit `/template` on a dev server to prove the module system
  works. Don't edit it into a real module; copy it.

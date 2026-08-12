# Adding a module

The promise of this codebase: a whole new mini-app is **one folder + one
registry line** (plus thin route files and a migration if it has data). This
walkthrough builds a hypothetical **Roompoints** module — a points ladder for
room inspections — end to end. Substitute your own nouns.

Time budget: a first-timer should have the skeleton routed and visible in
about fifteen minutes.

## 0. What you get for free

By registering, a module automatically appears in: the tab bar (if
`navPlacement: "tab"`), the notification-settings UI (its
`notificationCategories`), the Admin tab (its `adminPanels`), and auth
gating (`requiresAuth`). You never edit the nav, the settings page, or the
admin list.

## 1. Copy the template

```bash
cp -r src/modules/_template src/modules/roompoints
rm src/modules/roompoints/migration.example.sql   # you'll write a real one
```

Rename the inner files as you go (`template-page.tsx` → `roompoints-page.tsx`
etc.). Delete what you don't need — the template is a starting point, not a
framework.

## 2. Declare the module — `src/modules/roompoints/module.ts`

```ts
import { ClipboardCheck } from "lucide-react";
import type { AppModule } from "@/modules/types";

const roompointsModule: AppModule = {
  id: "roompoints",
  name: "Roompoints",
  icon: ClipboardCheck,
  navPlacement: "tab",
  order: 35, // between Intersection (30) and Profile (40)
  basePath: "/roompoints",
  requiresAuth: true,
  notificationCategories: ["announcement"], // reuse, or add a category (see §7)
  adminPanels: [
    {
      id: "roompoints-scores",
      title: "Room inspection scores",
      description: "Enter weekly scores per section",
      href: "/roompoints/admin",
      roles: ["admin"],
    },
  ],
  calendarSource: false, // true only if you mirror dates into the calendar
};

export default roompointsModule;
```

## 3. Register it — ONE line in `src/modules/registry.ts`

```ts
import roompoints from "@/modules/roompoints/module";

export const modules: AppModule[] = [home, calendar, sport, intersection, admin, profile, roompoints, template];
```

(Two physical lines with the import — the array entry is the registration.)

## 4. Route it — thin files under `src/app/(app)/roompoints/`

```ts
// src/app/(app)/roompoints/page.tsx
export { default } from "@/modules/roompoints/pages/roompoints-page";
```

That is the whole file. Nested pages (e.g. `/roompoints/history`) repeat the
pattern: a folder and a 2-line re-export each. Route files never contain
logic — if you're writing an `if` in one, the code belongs in the module.

## 5. Migration — `supabase/migrations/0700_roompoints_init.sql`

Claim the next free hundred-block in `supabase/migrations/README.md` (0700 in
this example) and add the block to its table. Follow
`src/modules/_template/migration.example.sql`: create the table(s), **enable
RLS immediately, with explicit policies in the same file**. Prefix table
names with the module id (`roompoints_scores`). Then:

```bash
npm run db:push     # apply
npm run db:types    # regenerate src/core/db/database.types.ts
```

## 6. Build pages, actions, components — inside the folder

- Pages are server components in `src/modules/roompoints/pages/`.
- Data access: `const db = await createClient()` from `@/core/db/server` —
  queries run as the signed-in user, RLS applies.
- Mutations: server actions in `actions.ts` — Zod-parse first, return
  `{ ok } | { ok: false, error }` (pattern in `_template/actions.ts`).
- Role checks in actions: `requireRole("admin")` from `@/core/permissions` —
  remembering RLS is the real gate; this just fails fast and politely.
- Client components stay small and at the leaf (`components/`).
- Tests sit next to the code (`roompoints.test.ts`), run by `npm run test`.

## 7. Optional: cross-module effects — always via core

- **Calendar entry per inspection day:**

  ```ts
  import { upsertModuleEvent, removeModuleEvent } from "@/core/calendar";

  await upsertModuleEvent({
    sourceModule: "roompoints",
    sourceRef: inspection.id,
    title: "Room inspection",
    category: "res_wide",
    startsAt: inspection.date,
  });
  ```

- **Notification when scores post:**

  ```ts
  import { notify } from "@/core/notifications";

  await notify({
    category: "announcement",
    title: "Room inspection scores are up",
    url: "/roompoints",
    sourceModule: "roompoints",
    audience: { kind: "all" },
  });
  ```

- **New notification category** (only if users genuinely need a separate
  toggle): add it to `NOTIFICATION_CATEGORIES` in
  `src/core/notifications/categories.ts` AND to the two `check` constraints
  in a new migration AND to the trigger default in `app_handle_new_user` —
  grep for `'section'` in `supabase/migrations/0100_core_init.sql` to find
  all three spots.

**Never** import from another module's folder. `@/modules/home/...` inside
roompoints is an ESLint error, and the ESLint rule is the architecture.

## 8. The checklist

- [ ] Folder copied, files renamed, `module.ts` filled in
- [ ] One line in `registry.ts`
- [ ] Thin route file(s) under `src/app/(app)/<basePath>/`
- [ ] Migration with RLS on every new table, block claimed in the README,
      `npm run db:push` + `npm run db:types` run
- [ ] `npm run check` green (typecheck, lint incl. boundaries, tests)
- [ ] If it has admin surfaces: entry appears on the Admin tab (free,
      via `adminPanels`)
- [ ] docs/BUILD-LOG.md updated with what's real vs. placeholder

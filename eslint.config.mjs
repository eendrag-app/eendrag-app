import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // ---- Module boundaries ----------------------------------------------------
  // The structural rule of this codebase: a module never imports from another
  // module. Cross-module traffic goes through src/core. This block makes that
  // an error instead of a convention. See docs/ARCHITECTURE.md.
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "import/resolver": {
        typescript: { alwaysTryTypes: true },
      },
      "boundaries/elements": [
        // First match wins: module folders match first, then the files that
        // sit directly in src/modules (registry.ts, types.ts) fall through to
        // the "registry" element.
        { type: "module", pattern: "src/modules/*", capture: ["moduleId"] },
        { type: "registry", pattern: "src/modules" },
        { type: "core", pattern: "src/core" },
        { type: "ui", pattern: "src/components" },
        { type: "lib", pattern: "src/lib" },
        { type: "app", pattern: "src/app" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message:
            "{{ from.element.type }} code may not import from {{ to.element.type }} — cross-module traffic goes through src/core (see docs/ARCHITECTURE.md)",
          policies: [
            // A module may use core, shared UI, lib, the registry types —
            // and its own files, but never another module.
            {
              from: { element: { type: "module" } },
              allow: {
                to: [
                  { element: { type: ["core", "ui", "lib", "registry"] } },
                  {
                    element: {
                      type: "module",
                      captured: { moduleId: "{{ from.element.captured.moduleId }}" },
                    },
                  },
                ],
              },
            },
            // registry.ts / types.ts import every module's module.ts — that
            // is the registration point, so it's allowed.
            {
              from: { element: { type: "registry" } },
              allow: { to: { element: { type: ["registry", "module", "core", "ui", "lib"] } } },
            },
            // Core never imports modules: it must not know what modules exist.
            {
              from: { element: { type: "core" } },
              allow: { to: { element: { type: ["core", "ui", "lib"] } } },
            },
            { from: { element: { type: "ui" } }, allow: { to: { element: { type: ["ui", "lib"] } } } },
            { from: { element: { type: "lib" } }, allow: { to: { element: { type: "lib" } } } },
            // The app layer is thin routing: re-exports module pages, renders
            // the registry-driven shell.
            {
              from: { element: { type: "app" } },
              allow: {
                to: { element: { type: ["app", "module", "registry", "core", "ui", "lib"] } },
              },
            },
          ],
        },
      ],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local Supabase stack scratch space (gitignored, not our code).
    "supabase/.temp/**",
  ]),
]);

export default eslintConfig;

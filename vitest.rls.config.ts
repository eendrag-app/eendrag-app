import path from "node:path";
import { defineConfig } from "vitest/config";

// Row Level Security tests. These talk to a real Supabase project (the values
// in .env.local) and prove the policies in supabase/migrations actually hold:
// a student cannot post an announcement, a rep cannot edit another sport, etc.
// Run with `npm run test:rls`.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["supabase/tests/**/*.test.ts"],
    // One worker: tests share seeded fixtures in one database.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});

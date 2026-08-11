// Load .env.local so the RLS tests know which database to talk to.
// (Vitest does not load env files by itself; Node 24 can.)
import fs from "node:fs";

if (fs.existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

// Create (or promote) the dev admin account. Documented in README.md.
//
//   npm run create-admin                        → admin@eendrag.dev / eendrag-dev-admin
//   npm run create-admin -- me@x.com mypass     → custom credentials
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from
// .env.local via node --env-file, see the npm script). Safe to re-run: if the
// user already exists it just ensures the admin role.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — fill in .env.local first (see README).",
  );
  process.exit(1);
}

const email = process.argv[2] ?? "admin@eendrag.dev";
const password = process.argv[3] ?? "eendrag-dev-admin";

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

let userId;
const created = await db.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (created.error) {
  // Already exists? Find it and continue.
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const existing = data.users.find((u) => u.email === email);
  if (!existing) throw created.error;
  userId = existing.id;
  console.log(`User ${email} already exists — ensuring admin role.`);
} else {
  userId = created.data.user.id;
  console.log(`Created user ${email}.`);
}

const { error: updateError } = await db
  .from("profiles")
  .update({ role: "admin", full_name: "Dev Admin" })
  .eq("id", userId);
if (updateError) throw updateError;

console.log(`${email} is an admin. Password: ${password}`);
console.log("Dev-only credentials — never create this account in production.");

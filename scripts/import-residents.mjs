// Load the HK's list of residents into verified_emails — the allowlist that
// decides who may create an account. Documented in docs/ADMIN-GUIDE.md.
//
//   npm run import-residents -- residents.csv
//   npm run import-residents -- residents.csv --replace
//   npm run import-residents -- residents.csv --dry-run
//
// The file is CSV with a header row, in any column order, needing at least an
// email column. A name column is used to pre-fill people's profiles so nobody
// types their own name at 23:00 on signup night:
//
//   email,name
//   24681357@sun.ac.za,Jan de Villiers
//
// --replace removes addresses that are no longer on the list (end of year,
// when a whole intake leaves). Without it this only ever adds and updates,
// which is what you want mid-year.
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from
// .env.local via node --env-file, see the npm script). Safe to re-run.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — fill in .env.local first (see README).",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const replace = args.includes("--replace");
const dryRun = args.includes("--dry-run");

if (!file) {
  console.error("Usage: npm run import-residents -- residents.csv [--replace] [--dry-run]");
  process.exit(1);
}

// A deliberately small CSV reader: quoted fields with commas inside them
// (["de Villiers, Jan"]) and nothing else. A dependency for this would be a
// dependency to explain to whoever inherits the repo.
function parseCsvLine(line) {
  const out = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out.map((f) => f.trim());
}

const text = readFileSync(file, "utf8").replace(/^﻿/, "");
const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
if (lines.length < 2) {
  console.error("That file has a header but no people in it.");
  process.exit(1);
}

const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
const emailAt = header.findIndex((h) => h.includes("email") || h.includes("e-mail"));
const nameAt = header.findIndex((h) => h.includes("name") || h.includes("naam"));
if (emailAt === -1) {
  console.error(`No email column found. The header row reads: ${header.join(", ")}`);
  process.exit(1);
}

const seen = new Map();
const problems = [];
lines.slice(1).forEach((line, i) => {
  const cells = parseCsvLine(line);
  const email = (cells[emailAt] ?? "").toLowerCase();
  const fullName = nameAt === -1 ? "" : (cells[nameAt] ?? "");
  const row = i + 2; // 1-indexed, plus the header
  if (email === "") {
    problems.push(`row ${row}: no email`);
    return;
  }
  // Not a validator, just a typo catch: "24681357@sun.ac,za" should not
  // silently become somebody who can never sign up.
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
    problems.push(`row ${row}: "${email}" does not look like an email address`);
    return;
  }
  if (seen.has(email)) {
    problems.push(`row ${row}: ${email} appears more than once`);
    return;
  }
  seen.set(email, { email, full_name: fullName, note: `imported ${new Date().toISOString().slice(0, 10)}` });
});

const rows = [...seen.values()];
console.log(`${rows.length} residents read from ${file}.`);
if (problems.length > 0) {
  console.log(`\n${problems.length} row(s) skipped:`);
  for (const p of problems) console.log(`  ${p}`);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const { data: existing, error: readError } = await db.from("verified_emails").select("email");
if (readError) {
  console.error("Could not read verified_emails:", readError.message);
  process.exit(1);
}
const existingEmails = new Set((existing ?? []).map((r) => r.email));
const added = rows.filter((r) => !existingEmails.has(r.email));
const stale = [...existingEmails].filter((e) => !seen.has(e));

console.log(
  `\nOn the list now: ${existingEmails.size}. New: ${added.length}. ` +
    `Not in this file: ${stale.length}${replace ? " (will be removed)" : " (left alone)"}.`,
);

if (dryRun) {
  console.log("\n--dry-run, so nothing was written.");
  process.exit(0);
}

// Upsert in batches: one 280-row insert is fine, but a whole res is not the
// upper bound on what someone might paste in here one day.
for (let i = 0; i < rows.length; i += 100) {
  const batch = rows.slice(i, i + 100);
  const { error } = await db.from("verified_emails").upsert(batch, { onConflict: "email" });
  if (error) {
    console.error("Import failed partway:", error.message);
    process.exit(1);
  }
}

if (replace && stale.length > 0) {
  const { error } = await db.from("verified_emails").delete().in("email", stale);
  if (error) {
    console.error("Could not remove the addresses no longer on the list:", error.message);
    process.exit(1);
  }
  console.log(`Removed ${stale.length} address(es) no longer on the list.`);
  console.log("Note: this does NOT delete their accounts — they simply cannot make a new one.");
}

console.log(`\nDone. ${rows.length} residents may create an account.`);

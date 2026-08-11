"use server";

import { greetingInput, buildGreeting } from "./greeting";

// Server action pattern every module follows:
//   1. Parse input with Zod — never trust the client.
//   2. Do the work (here: pure logic; real modules call src/core services
//      and the database — see docs/ADDING-A-MODULE.md for those examples).
//   3. Return { ok } or { ok: false, error } — pages render the error,
//      they don't throw it at the user.
export async function greet(formData: FormData) {
  const parsed = greetingInput.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }
  return { ok: true as const, message: buildGreeting(parsed.data.name) };
}

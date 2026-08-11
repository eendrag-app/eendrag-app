import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/core/db/server";
import type { Role } from "./roles";

// Server-side permission helpers. These are CONVENIENCE checks for pages and
// actions — the database's RLS policies are the actual enforcement. A page
// that forgets to call these leaks nothing; it just renders empty.

/** The signed-in user's profile row, or null when signed out. */
export async function getProfile() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data } = await db.from("profiles").select("*").eq("id", user.id).single();
  return data;
}

/** Redirects to /login when signed out; returns the profile otherwise. */
export async function requireProfile() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** Redirects to / unless the signed-in user has one of `roles`. */
export async function requireRole(...roles: Role[]) {
  const profile = await requireProfile();
  if (!roles.includes(profile.role as Role)) redirect("/");
  return profile;
}

export { ROLES, type Role } from "./roles";

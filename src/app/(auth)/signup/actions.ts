"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signUp, signIn } from "@/core/auth/provider";

const input = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function signupAction(formData: FormData) {
  const parsed = input.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }

  const result = await signUp(parsed.data.email, parsed.data.password);
  if (!result.ok) return result;

  // No email confirmation in "open" mode — sign straight in and onboard.
  const signedIn = await signIn(parsed.data.email, parsed.data.password);
  if (!signedIn.ok) return signedIn;
  redirect("/onboarding");
}

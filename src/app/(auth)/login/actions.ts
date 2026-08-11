"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn } from "@/core/auth/provider";

const input = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  next: z.string().startsWith("/").catch("/"),
});

export async function loginAction(formData: FormData) {
  const parsed = input.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? "/",
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }

  const result = await signIn(parsed.data.email, parsed.data.password);
  if (!result.ok) return result;
  redirect(parsed.data.next);
}

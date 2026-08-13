"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// A plain HTML form that POSTs to /auth/signup — see login-form.tsx for why
// this is not a server action.
//
// `autoComplete="new-password"` plus a real submit is what makes iOS offer to
// generate and save a strong password here. Getting that right at signup is
// worth more than anything on the sign-in screen: a password the student
// never typed is one they can never forget.
export function SignupForm() {
  const [busy, setBusy] = useState(false);

  return (
    <form method="post" action="/auth/signup" onSubmit={() => setBusy(true)} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}

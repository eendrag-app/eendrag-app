"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// A plain HTML form that POSTs to /auth/login and lets the browser navigate.
//
// It matters that nothing here calls preventDefault. A real submit followed by
// a real navigation is the signal iOS Keychain and Chrome's password manager
// wait for before offering "Save password?" — a server action submits over
// fetch, never navigates, and is invisible to them. That is why signing in
// felt like it had to be done from scratch every time.
//
// The only client state is the busy flag, which stops a double submit. Errors
// come from the page (via ?error=), not from React state, because the failure
// arrives as a fresh page load.
export function LoginForm({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);

  return (
    <form method="post" action="/auth/login" onSubmit={() => setBusy(true)} className="space-y-3">
      <input type="hidden" name="next" value={next} />
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
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

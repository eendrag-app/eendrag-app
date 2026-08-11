"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleSignup } from "../actions";

// "I want to play." One row per person per sport, own-row only under RLS, and
// pressing the button again takes you off the list.
export function SignupButton({
  sportId,
  signedUp,
}: {
  sportId: string;
  signedUp: boolean;
}) {
  const [on, setOn] = useState(signedUp);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function toggle() {
    setBusy(true);
    setError(null);
    const wasOn = on;
    setOn(!wasOn);
    const result = await toggleSignup(sportId, wasOn);
    setBusy(false);
    if (!result.ok) {
      setOn(wasOn);
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="space-y-1">
      <Button
        size="lg"
        variant={on ? "outline" : "default"}
        className="h-11 w-full sm:w-auto"
        disabled={busy}
        onClick={toggle}
      >
        {on ? <Check aria-hidden /> : <UserPlus aria-hidden />}
        {on ? "You are on the list — tap to leave" : "Sign me up"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

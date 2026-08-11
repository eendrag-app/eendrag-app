"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { greet } from "../actions";

// Client component pattern: local state for the result, the server action
// does the validation and work. Keep client components small and at the leaf.
export function GreetingForm() {
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    const res = await greet(formData);
    if (res.ok) {
      setResult(res.message);
      setError(null);
    } else {
      setError(res.error);
      setResult(null);
    }
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <div className="flex gap-2">
        <Input name="name" placeholder="Your name" aria-label="Your name" />
        <Button type="submit">Greet</Button>
      </div>
      {result && <p className="text-sm">{result}</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </form>
  );
}

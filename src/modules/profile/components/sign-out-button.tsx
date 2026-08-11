"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "../actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="outline" size="lg" className="h-11 w-full sm:w-auto">
        <LogOut aria-hidden />
        Sign out
      </Button>
    </form>
  );
}

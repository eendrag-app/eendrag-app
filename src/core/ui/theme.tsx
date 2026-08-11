"use client";

import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useMounted } from "./use-mounted";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Dark mode. The palettes already exist in globals.css under `.dark`;
// next-themes is only responsible for putting that class on <html> and
// remembering the choice. Default is "system", so the app matches the phone.

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Which theme is active is only known on the client, so the trigger icon is
  // switched by CSS (the `.dark` class next-themes puts on <html>) rather than
  // by JavaScript — no hydration mismatch, no flash of the wrong icon.
  const mounted = useMounted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-lg" />}
        aria-label="Appearance"
      >
        <Sun className="size-5 dark:hidden" aria-hidden />
        <Moon className="hidden size-5 dark:block" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setTheme(option.value)}
            className="h-9"
          >
            <option.icon aria-hidden />
            {option.label}
            {mounted && theme === option.value && <Check className="ml-auto" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

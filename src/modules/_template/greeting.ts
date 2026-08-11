import { z } from "zod";

// Plain logic lives in plain files like this one, imported by the server
// action and unit-tested directly — no server needed.
export const greetingInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tell us your name first")
    .max(60, "That name is too long"),
});

export function buildGreeting(name: string): string {
  return `Hello, ${name} — the module system works.`;
}

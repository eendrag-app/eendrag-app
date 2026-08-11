import { describe, expect, it } from "vitest";
import { modules } from "@/modules/registry";
import templateModule from "./module";
import { buildGreeting, greetingInput } from "./greeting";

describe("template module", () => {
  it("is registered in the module registry", () => {
    expect(modules.map((m) => m.id)).toContain(templateModule.id);
  });

  it("declares a base path that matches its route", () => {
    expect(templateModule.basePath).toBe("/template");
  });

  it("rejects an empty name", () => {
    const parsed = greetingInput.safeParse({ name: "  " });
    expect(parsed.success).toBe(false);
  });

  it("greets a valid name", () => {
    const parsed = greetingInput.safeParse({ name: "Eendrag" });
    expect(parsed.success).toBe(true);
    expect(buildGreeting("Eendrag")).toContain("Eendrag");
  });
});

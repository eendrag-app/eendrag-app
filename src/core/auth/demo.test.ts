import { describe, expect, it } from "vitest";
import { demoAccount } from "./config";

// Demo mode signs every visitor in as one shared account. It must be OFF
// unless both values are set, so a half-configured deploy stays locked.

describe("demoAccount", () => {
  it("is off when nothing is set", () => {
    expect(demoAccount({})).toBeNull();
  });

  it("is off when only one of the two values is set", () => {
    expect(demoAccount({ DEMO_LOGIN_EMAIL: "admin@eendrag.dev" })).toBeNull();
    expect(demoAccount({ DEMO_LOGIN_PASSWORD: "secret" })).toBeNull();
  });

  it("is off when a value is blank", () => {
    expect(demoAccount({ DEMO_LOGIN_EMAIL: " ", DEMO_LOGIN_PASSWORD: "secret" })).toBeNull();
  });

  it("returns the account when both are set", () => {
    expect(
      demoAccount({ DEMO_LOGIN_EMAIL: " admin@eendrag.dev ", DEMO_LOGIN_PASSWORD: "secret" }),
    ).toEqual({ email: "admin@eendrag.dev", password: "secret" });
  });
});

import { describe, expect, it } from "vitest";
import { isSameOrigin, safeNext } from "./form-post";

// These two functions are the whole security story of the auth route
// handlers, so they are pinned harder than their size suggests.

describe("safeNext", () => {
  it("keeps an ordinary path", () => {
    expect(safeNext("/calendar")).toBe("/calendar");
    expect(safeNext("/sport/123?tab=results")).toBe("/sport/123?tab=results");
  });

  it("falls back to / for anything missing or not a string", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext("")).toBe("/");
    expect(safeNext(["/calendar"])).toBe("/");
  });

  it("refuses absolute URLs", () => {
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("http://evil.com")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
  });

  // The bug this function exists for: the old server action validated with
  // startsWith("/"), which these three all pass while still leaving the site.
  it("refuses protocol-relative URLs", () => {
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("//evil.com/login")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
  });

  it("refuses control characters that could split the Location header", () => {
    expect(safeNext("/calendar\nSet-Cookie: x=1")).toBe("/");
    expect(safeNext("/calendar\r\nLocation: https://evil.com")).toBe("/");
  });
});

describe("isSameOrigin", () => {
  const headers = (values: Record<string, string>) => new Headers(values);

  it("accepts a post from our own origin", () => {
    expect(
      isSameOrigin(headers({ origin: "https://eendrag-app.vercel.app", host: "eendrag-app.vercel.app" })),
    ).toBe(true);
  });

  it("prefers the forwarded host, which is what Vercel rewrites", () => {
    expect(
      isSameOrigin(
        headers({
          origin: "https://eendrag-app.vercel.app",
          host: "internal-vercel-host",
          "x-forwarded-host": "eendrag-app.vercel.app",
        }),
      ),
    ).toBe(true);
  });

  it("rejects a cross-site post", () => {
    expect(
      isSameOrigin(headers({ origin: "https://evil.com", host: "eendrag-app.vercel.app" })),
    ).toBe(false);
  });

  it("rejects a request with no Origin at all", () => {
    expect(isSameOrigin(headers({ host: "eendrag-app.vercel.app" }))).toBe(false);
  });

  it("rejects an unparseable Origin", () => {
    expect(isSameOrigin(headers({ origin: "not a url", host: "eendrag-app.vercel.app" }))).toBe(
      false,
    );
  });
});

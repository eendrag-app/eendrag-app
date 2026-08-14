import { describe, expect, it } from "vitest";
import {
  WHATSAPP_CAPTION_MAX,
  attachmentName,
  needsSeparatePhoto,
  shareText,
} from "./share";

const APP_URL = "https://eendrag-app.vercel.app";

describe("shareText", () => {
  it("is the title in WhatsApp bold, the post, then the link", () => {
    const text = shareText({
      title: "Huisvergadering moved to Thursday",
      body: "Same time, same place.",
      appUrl: APP_URL,
    });
    expect(text).toBe(
      "*Huisvergadering moved to Thursday*\n\n" +
        "Same time, same place.\n\n" +
        `Read it in the Eendrag app: ${APP_URL}`,
    );
  });

  it("sends a long post whole, without cutting it", () => {
    const body = "woord ".repeat(2000).trim(); // ~12 000 characters
    const text = shareText({ title: "Long one", body, appUrl: APP_URL });
    expect(text).toContain(body);
    expect(text).not.toContain("…");
  });

  it("keeps the writer's own line breaks and spacing", () => {
    const body = "First line.\n\n  Indented second line.\nThird.";
    const text = shareText({ title: "Braai", body, appUrl: APP_URL });
    expect(text).toContain(body);
  });

  it("still links back when the post is a title and nothing else", () => {
    const text = shareText({ title: "Water is off until 14:00", body: "   ", appUrl: APP_URL });
    expect(text).toBe(`*Water is off until 14:00*\n\nRead it in the Eendrag app: ${APP_URL}`);
  });

  it("ends with the link, which is what makes anyone open the app", () => {
    const text = shareText({ title: "Poster", body: "x".repeat(5000), appUrl: APP_URL });
    expect(text.endsWith(`Read it in the Eendrag app: ${APP_URL}`)).toBe(true);
  });
});

describe("needsSeparatePhoto", () => {
  it("splits a long post, so the caption limit never gets to cut it", () => {
    expect(needsSeparatePhoto("x".repeat(WHATSAPP_CAPTION_MAX + 1), true)).toBe(true);
  });

  it("keeps a short post and its photo in one message", () => {
    expect(needsSeparatePhoto("x".repeat(WHATSAPP_CAPTION_MAX), true)).toBe(false);
  });

  it("never splits when there is no photo — a plain message holds far more", () => {
    expect(needsSeparatePhoto("x".repeat(WHATSAPP_CAPTION_MAX * 10), false)).toBe(false);
  });
});

describe("attachmentName", () => {
  it("uses the last segment of the storage path", () => {
    expect(attachmentName("3f2a/poster.jpg", "attachment")).toBe("poster.jpg");
  });

  it("falls back when the path has no usable name", () => {
    expect(attachmentName("", "attachment")).toBe("attachment");
    expect(attachmentName("/", "attachment")).toBe("attachment");
  });
});

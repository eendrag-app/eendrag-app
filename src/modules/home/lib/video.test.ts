import { describe, expect, it } from "vitest";
import { parseVideoUrl } from "./video";

describe("parseVideoUrl", () => {
  it("reads every shape of YouTube link people actually paste", () => {
    const shapes = [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ?t=42",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "  https://www.youtube.com/watch?v=dQw4w9WgXcQ  ",
    ];
    for (const shape of shapes) {
      const parsed = parseVideoUrl(shape);
      expect(parsed, shape).toMatchObject({ kind: "youtube", id: "dQw4w9WgXcQ" });
    }
  });

  it("embeds YouTube through the no-cookie host", () => {
    const parsed = parseVideoUrl("https://youtu.be/dQw4w9WgXcQ");
    expect(parsed).toMatchObject({
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      watchUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  });

  it("reads Vimeo links", () => {
    expect(parseVideoUrl("https://vimeo.com/123456789")).toMatchObject({
      kind: "vimeo",
      id: "123456789",
      embedUrl: "https://player.vimeo.com/video/123456789",
    });
  });

  it("offers anything else as a plain link, never an iframe", () => {
    // We will not put an arbitrary site in an iframe on a page 280 students
    // are signed into.
    expect(parseVideoUrl("https://drive.google.com/file/d/abc/view")).toEqual({
      kind: "link",
      watchUrl: "https://drive.google.com/file/d/abc/view",
    });
  });

  it("refuses anything that is not an https URL", () => {
    for (const bad of [
      "",
      "   ",
      "not a link",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "http://www.youtube.com/watch?v=dQw4w9WgXcQ", // mixed content
    ]) {
      expect(parseVideoUrl(bad), bad).toBeNull();
    }
  });

  it("refuses YouTube and Vimeo links with no usable id", () => {
    expect(parseVideoUrl("https://www.youtube.com/watch?v=tooshort")).toBeNull();
    expect(parseVideoUrl("https://www.youtube.com/")).toBeNull();
    expect(parseVideoUrl("https://vimeo.com/channels/staffpicks")).toBeNull();
  });
});

// Working out what a pasted video link actually is. Pure, so it is tested
// (video.test.ts) rather than discovered in production by an HK member whose
// link rendered as nothing.
//
// Three answers, in order of how well we can show them:
//   youtube / vimeo — embeddable, so the post plays inline
//   link           — a URL we will not put in an iframe (anything could be
//                    behind it), offered as a plain link instead
//   null           — not a usable link at all; the form refuses it

export type ParsedVideo =
  | { kind: "youtube"; id: string; embedUrl: string; watchUrl: string }
  | { kind: "vimeo"; id: string; embedUrl: string; watchUrl: string }
  | { kind: "link"; watchUrl: string };

const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"];
const VIMEO_HOSTS = ["vimeo.com", "www.vimeo.com", "player.vimeo.com"];

/** YouTube ids are 11 characters of base64url; anything else is not one. */
const YOUTUBE_ID = /^[\w-]{11}$/;
const VIMEO_ID = /^\d+$/;

export function parseVideoUrl(raw: string): ParsedVideo | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  // http:// links would be blocked as mixed content on the deployed app, and
  // there is no reason to accept anything else (javascript:, data:, …).
  if (url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.includes(host)) {
    // Three shapes in the wild: youtu.be/<id>, /watch?v=<id>, and
    // /shorts|/embed|/live/<id>.
    const fromPath = url.pathname.split("/").filter(Boolean);
    const id =
      host.endsWith("youtu.be")
        ? fromPath[0]
        : (url.searchParams.get("v") ??
          (["shorts", "embed", "live", "v"].includes(fromPath[0]) ? fromPath[1] : undefined));
    if (!id || !YOUTUBE_ID.test(id)) return null;
    return {
      kind: "youtube",
      id,
      // nocookie: YouTube's own privacy-friendlier host. Still Google, but it
      // does not write tracking cookies until someone presses play.
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      watchUrl: `https://www.youtube.com/watch?v=${id}`,
    };
  }

  if (VIMEO_HOSTS.includes(host)) {
    const id = url.pathname.split("/").filter(Boolean).pop();
    if (!id || !VIMEO_ID.test(id)) return null;
    return {
      kind: "vimeo",
      id,
      embedUrl: `https://player.vimeo.com/video/${id}`,
      watchUrl: `https://vimeo.com/${id}`,
    };
  }

  return { kind: "link", watchUrl: url.toString() };
}

// Turning an announcement into a message that reads properly once it is in a
// WhatsApp group. Pure, so it is tested (share.test.ts) rather than found out
// about by an HK member whose post landed in the group as an untitled wall of
// text with no way back to the app.
//
// The whole post goes out, exactly as it was written. Nothing here shortens
// it: an announcement that has been cut off is the reason somebody has to open
// two apps to find out what was actually said.
//
// The catch is WhatsApp's, not ours. A photo shared WITH text puts the text in
// the photo's caption, and a caption stops at 1024 characters. An ordinary
// text message holds ~65 000. So a long post with a photo goes as two
// messages — the post, then the photo — which is the only way to have both the
// picture and the whole announcement. needsSeparatePhoto() below is where that
// is decided; the button acts on it.
//
// Because a long post never becomes a caption, the link is safe at the bottom,
// which is where it reads best.

export interface ShareableAnnouncement {
  title: string;
  body: string;
  /** Absolute link back into the app, e.g. "https://eendrag-app.vercel.app". */
  appUrl: string;
}

/** How much of a message WhatsApp keeps when it is a photo's caption. */
export const WHATSAPP_CAPTION_MAX = 1024;

/** The message: title, the post in full exactly as written, then the link. */
export function shareText(announcement: ShareableAnnouncement): string {
  const parts = [`*${announcement.title.trim()}*`];
  const body = announcement.body.trim();
  if (body !== "") parts.push(body);
  parts.push(`Read it in the Eendrag app: ${announcement.appUrl}`);
  return parts.join("\n\n");
}

/**
 * Does the photo have to travel on its own? Only when attaching it would turn
 * this message into a caption that WhatsApp would cut. Short posts still go as
 * one message with the photo and the text together, which is what everybody
 * wants when it fits.
 */
export function needsSeparatePhoto(text: string, hasPhoto: boolean): boolean {
  return hasPhoto && text.length > WHATSAPP_CAPTION_MAX;
}

/**
 * What an attachment should be called once it is out of our storage bucket and
 * sitting in somebody's chat. Storage paths look like
 * "<uuid>/poster.jpg" — the last segment is the only part a person would
 * recognise, and a signed URL's query string is not part of the name.
 */
export function attachmentName(storagePath: string, fallback: string): string {
  const last = storagePath.split("/").filter(Boolean).pop() ?? "";
  const clean = last.split("?")[0].trim();
  return clean === "" ? fallback : clean;
}

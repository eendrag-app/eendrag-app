"use client";

import { useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { needsSeparatePhoto, shareText, type ShareableAnnouncement } from "../lib/share";

// "Share" on a published announcement: the same post, with its photo or PDF,
// handed to WhatsApp (or anything else on the phone) without anybody typing it
// out a second time.
//
// Why the app does not post to the group itself: every route into an EXISTING
// WhatsApp group is an unofficial linked-device bot, which means a second
// number, a session that has to stay alive somewhere, and WhatsApp's terms.
// Meta's official Groups API only messages groups it created itself and caps
// them at eight people, so it cannot see the res group at all. One tap on the
// phone already in the HK member's hand costs nothing to run and nothing to
// inherit. See docs/DECISIONS.md.

export interface ShareAttachment {
  /** Signed, expiring URL from the announcement-attachments bucket. */
  url: string;
  /** What the file is called once it is in the chat. */
  name: string;
  /**
   * A photo is what turns the message into a caption, and a caption is the
   * one place WhatsApp imposes a length of its own. A PDF does not: it goes
   * as a document with the text as an ordinary message beside it.
   */
  kind: "photo" | "document";
}

/** Download the attachments so they can be handed to the share sheet as files. */
async function downloadAll(attachments: ShareAttachment[]): Promise<File[]> {
  const files: File[] = [];
  for (const attachment of attachments) {
    try {
      const response = await fetch(attachment.url);
      if (!response.ok) continue;
      const blob = await response.blob();
      files.push(new File([blob], attachment.name, { type: blob.type }));
    } catch {
      // A signed URL that has expired must cost the attachment, never the
      // message: the text below still goes out, with the link in it.
    }
  }
  return files;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ShareAnnouncementButton({
  announcement,
  attachments,
}: {
  announcement: ShareableAnnouncement;
  attachments: ShareAttachment[];
}) {
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState<"copied" | "failed" | "photo-failed" | null>(null);
  // "photo" means the post has gone and only the picture is still owed. One
  // share sheet sends one message, so a split post takes two taps — and the
  // second tap is its own fresh gesture, which is what iOS wants anyway.
  const [step, setStep] = useState<"ready" | "photo">("ready");
  // The download, started once and kept — see startDownload.
  const downloadRef = useRef<Promise<File[]> | null>(null);

  const text = shareText(announcement);
  const hasPhoto = attachments.some((a) => a.kind === "photo");
  // Approximate at render time — the tap below settles it, once it knows
  // whether this browser takes files at all — but enough to warn first.
  const willSplit = needsSeparatePhoto(text, hasPhoto);

  // iOS only lets navigator.share() run while the tap that triggered it is
  // still fresh, and pulling a 3 MB poster off res wifi first can outlast
  // that. pointerdown fires before click, so the download gets a head start
  // and the click usually finds it already finished. It also means the photo
  // is long since in hand by the time a split post reaches its second tap.
  function startDownload() {
    downloadRef.current ??= downloadAll(attachments);
  }

  async function share() {
    setBusy(true);
    setFallback(null);
    // Which half of a split post this tap is, so a failure says the right
    // thing: the text is already in the group by the time the photo goes.
    const sendingPhotoNow = step === "photo";

    try {
      startDownload();
      const files = await downloadRef.current!;
      // canShare tells us whether THIS browser will take files; without it,
      // passing them is how a share silently sends nothing.
      const canSendFiles = files.length > 0 && (navigator.canShare?.({ files }) ?? false);

      if (step === "photo") {
        // Second half of a split post: the picture, no text, so WhatsApp has
        // no caption to cut.
        await navigator.share({ files });
        setStep("ready");
      } else if (canSendFiles && needsSeparatePhoto(text, hasPhoto)) {
        // The post on its own, as an ordinary message — no caption, no 1024
        // characters, nothing lost. The photo follows on the next tap.
        await navigator.share({ text });
        setStep("photo");
      } else {
        await navigator.share(canSendFiles ? { text, files } : { text });
      }
    } catch (error) {
      // Backing out of the share sheet is a choice, not a failure. The step is
      // left alone so a half-sent post can be finished on the next tap.
      if (error instanceof Error && error.name === "AbortError") {
        setBusy(false);
        return;
      }
      // Everything else — a browser with no share sheet, a tap that went
      // stale, a refused file — falls back to the clipboard, which works
      // everywhere. Paste it into the group and the attachment is one more tap
      // from the post itself. Copying the text again would be no use when the
      // text is the half that already went, so a failed photo just says so.
      if (sendingPhotoNow) {
        setStep("ready");
        setFallback("photo-failed");
      } else {
        setFallback((await copyToClipboard(text)) ? "copied" : "failed");
      }
    }
    setBusy(false);
  }

  const sendingPhoto = step === "photo";
  const photoLabel = attachments.length > 1 ? "Send the files" : "Send the photo";

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex gap-2">
        <Button
          // The second tap is the one that finishes the job, so it stops
          // looking optional.
          variant={sendingPhoto ? "default" : "outline"}
          size="sm"
          className="h-11 sm:h-8"
          disabled={busy}
          onPointerDown={startDownload}
          onClick={share}
        >
          <Share2 aria-hidden />
          {busy ? "Sharing…" : sendingPhoto ? photoLabel : "Share"}
        </Button>
        {sendingPhoto && !busy && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-11 sm:h-8"
            onClick={() => setStep("ready")}
          >
            Skip
          </Button>
        )}
      </span>

      {sendingPhoto && (
        <span className="text-muted-foreground text-xs" role="status">
          Post sent whole. Send the photo to the same chat to finish.
        </span>
      )}
      {!sendingPhoto && willSplit && !fallback && (
        <span className="text-muted-foreground text-xs">
          Long post: it goes as two messages, the post then the photo, so none of it is cut.
        </span>
      )}
      {fallback && (
        <span className="text-muted-foreground text-xs" role="status">
          {fallback === "copied"
            ? "Copied — paste it into the group."
            : fallback === "photo-failed"
              ? "The post went, but the photo did not. Try Share again."
              : "Could not share it. Copy the post by hand."}
        </span>
      )}
    </span>
  );
}

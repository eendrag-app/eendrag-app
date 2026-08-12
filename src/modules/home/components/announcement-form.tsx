"use client";

import { useRef, useState } from "react";
import { FileText, ImageIcon, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/core/db/browser";
import { saveAnnouncement } from "../actions";

const BUCKET = "announcement-attachments";
const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// Video is capped far tighter than it looks, and the reason is BANDWIDTH, not
// disk: one 25 MB clip watched by 280 people is 7 GB, and the whole free tier
// is 5 GB a month. The storage bucket enforces the same number server-side
// (migration 0301); this check exists so the person finds out before the
// upload rather than after it.
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
// mp4 and webm only. An iPhone's own .mov is usually HEVC, which most browsers
// refuse to play — better to say so than to post a video half the res sees a
// black rectangle for.
const VIDEO_TYPES = ["video/mp4", "video/webm"];

export interface AnnouncementFormValues {
  id?: string;
  title: string;
  body: string;
  isUrgent: boolean;
  targetSectionId: string;
  imagePath: string | null;
  pdfPath: string | null;
  videoPath: string | null;
  videoUrl: string;
  scheduledFor: string; // datetime-local value, "" when not scheduled
  status: string;
}

// Compose / edit. Attachments upload straight from the browser with the
// admin's own session, so the RLS policy on storage.objects (admins write) is
// what allows it — the server action only ever sees the resulting path.
export function AnnouncementForm({
  values,
  sections,
  cronWired,
}: {
  values: AnnouncementFormValues;
  sections: Array<{ id: string; name: string }>;
  cronWired: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [imagePath, setImagePath] = useState(values.imagePath);
  const [pdfPath, setPdfPath] = useState(values.pdfPath);
  const [videoPath, setVideoPath] = useState(values.videoPath);
  const [videoUrl, setVideoUrl] = useState(values.videoUrl);
  const [urgent, setUrgent] = useState(values.isUrgent);
  const [scheduled, setScheduled] = useState(values.scheduledFor);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sectionItems = [
    { value: "", label: "The whole res" },
    ...sections.map((s) => ({ value: s.id, label: `${s.name} only` })),
  ];

  async function upload(file: File, kind: "image" | "pdf" | "video") {
    setError(null);
    const limit = kind === "video" ? MAX_VIDEO_BYTES : MAX_BYTES;
    if (file.size > limit) {
      setError(
        kind === "video"
          ? "That video is bigger than 25 MB. Put it on YouTube and paste the link instead — no limit, and it does not eat the app's data."
          : "That file is bigger than 10 MB — please shrink it first.",
      );
      return;
    }
    const okType =
      kind === "image"
        ? IMAGE_TYPES.includes(file.type)
        : kind === "video"
          ? VIDEO_TYPES.includes(file.type)
          : file.type === "application/pdf";
    if (!okType) {
      setError(
        kind === "image"
          ? "Images only: PNG, JPG, WebP or GIF."
          : kind === "video"
            ? "MP4 or WebM only. An iPhone .mov is usually HEVC, which most browsers will not play — export it as MP4, or use a YouTube link."
            : "PDFs only.",
      );
      return;
    }

    setUploading(true);
    const db = createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await db.storage.from(BUCKET).upload(path, file);
    setUploading(false);
    if (uploadError) {
      setError("Upload failed. Check your connection and try again.");
      return;
    }

    const previous = kind === "image" ? imagePath : kind === "video" ? videoPath : pdfPath;
    if (previous) await db.storage.from(BUCKET).remove([previous]);
    if (kind === "image") setImagePath(path);
    else if (kind === "video") {
      setVideoPath(path);
      // One video per post: an uploaded clip replaces a pasted link.
      setVideoUrl("");
    } else setPdfPath(path);
  }

  async function removeAttachment(kind: "image" | "pdf" | "video") {
    const path = kind === "image" ? imagePath : kind === "video" ? videoPath : pdfPath;
    if (!path) return;
    const db = createClient();
    await db.storage.from(BUCKET).remove([path]);
    if (kind === "image") setImagePath(null);
    else if (kind === "video") setVideoPath(null);
    else setPdfPath(null);
  }

  async function submit(intent: "draft" | "schedule" | "publish") {
    if (!formRef.current) return;
    setBusy(true);
    setError(null);
    const formData = new FormData(formRef.current);
    formData.set("intent", intent);
    formData.set("isUrgent", urgent ? "true" : "false");
    formData.set("imagePath", imagePath ?? "");
    formData.set("pdfPath", pdfPath ?? "");
    formData.set("videoPath", videoPath ?? "");
    formData.set("videoUrl", videoPath ? "" : videoUrl.trim());
    // On success the action redirects to the list and this never resolves.
    const result = await saveAnnouncement(formData);
    setBusy(false);
    if (result && !result.ok) setError(result.error);
  }

  return (
    <form ref={formRef} className="space-y-5" onSubmit={(e) => e.preventDefault()}>
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <div className="space-y-1">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={values.title}
          placeholder="Water off on Thursday morning"
          className="h-11"
          required
        />
        <p className="text-muted-foreground text-sm">
          This is what people see in their notification — make it say the thing.
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="body">Body</Label>
        <Textarea id="body" name="body" defaultValue={values.body} rows={8} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="targetSectionId">Who is it for</Label>
        <Select
          name="targetSectionId"
          defaultValue={values.targetSectionId}
          items={sectionItems}
        >
          <SelectTrigger id="targetSectionId" className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sectionItems.map((item) => (
              <SelectItem key={item.value} value={item.value} className="h-9">
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-sm">
          Target a section when only that section cares — res-wide noise is why people
          muted the WhatsApp group.
        </p>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="isUrgent">Urgent</Label>
          <p className="text-muted-foreground text-sm">
            Pinned to the top for 24 hours and delivered even during quiet hours. Safety
            and same-day deadlines only — if everything is urgent, nothing is.
          </p>
        </div>
        <Switch id="isUrgent" checked={urgent} onCheckedChange={setUrgent} className="mt-1" />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Attachments</legend>

        <div className="flex flex-wrap items-center gap-2">
          <Label
            htmlFor="image"
            className="hover:bg-muted inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium"
          >
            <ImageIcon className="size-4" aria-hidden />
            {imagePath ? "Replace image" : "Add an image"}
          </Label>
          <input
            id="image"
            type="file"
            accept={IMAGE_TYPES.join(",")}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file, "image");
              e.target.value = "";
            }}
          />
          {imagePath && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeAttachment("image")}
            >
              <X aria-hidden />
              Remove image
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Label
            htmlFor="pdf"
            className="hover:bg-muted inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium"
          >
            <FileText className="size-4" aria-hidden />
            {pdfPath ? "Replace PDF" : "Add a PDF"}
          </Label>
          <input
            id="pdf"
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file, "pdf");
              e.target.value = "";
            }}
          />
          {pdfPath && (
            <Button type="button" variant="ghost" size="sm" onClick={() => removeAttachment("pdf")}>
              <X aria-hidden />
              Remove PDF
            </Button>
          )}
        </div>

        {/* Video, two ways round. The link comes first on purpose: it is free,
            has no length limit, and costs the app no bandwidth. */}
        <div className="space-y-2 rounded-lg border p-3">
          <Label htmlFor="videoUrl">Video</Label>
          <Input
            id="videoUrl"
            value={videoUrl}
            disabled={Boolean(videoPath)}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Paste a YouTube or Vimeo link"
            className="h-11"
            inputMode="url"
          />
          <p className="text-muted-foreground text-sm">
            Best for anything longer than a few seconds: no size limit, and it plays
            inside the post.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Label
              htmlFor="video"
              className="hover:bg-muted inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium"
            >
              <Video className="size-4" aria-hidden />
              {videoPath ? "Replace the clip" : "…or upload a short clip"}
            </Label>
            <input
              id="video"
              type="file"
              accept={VIDEO_TYPES.join(",")}
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file, "video");
                e.target.value = "";
              }}
            />
            {videoPath && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeAttachment("video")}
              >
                <X aria-hidden />
                Remove the clip
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            MP4 or WebM, up to 25 MB — about 45 seconds of phone video. Uploads are
            served from the app&rsquo;s own storage, and one clip watched by the whole
            res is a lot of data, so keep them short.
          </p>
        </div>

        {uploading && <p className="text-muted-foreground text-sm">Uploading…</p>}
      </fieldset>

      <div className="space-y-1">
        <Label htmlFor="scheduledFor">Send later (optional)</Label>
        <Input
          id="scheduledFor"
          name="scheduledFor"
          type="datetime-local"
          value={scheduled}
          onChange={(e) => setScheduled(e.target.value)}
          className="h-11 w-full sm:w-64"
        />
        {!cronWired && scheduled !== "" && (
          <p className="text-destructive text-sm">
            Scheduled sending is not switched on for this deployment yet, so this post will
            wait as &ldquo;scheduled&rdquo; until someone publishes it by hand. Ask the
            maintainer about the cron job (docs/OPERATIONS.md).
          </p>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="lg"
          className="h-11"
          disabled={busy || uploading}
          onClick={() => submit("publish")}
        >
          {values.status === "published" ? "Save changes" : "Publish now"}
        </Button>
        {scheduled !== "" && values.status !== "published" && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11"
            disabled={busy || uploading}
            onClick={() => submit("schedule")}
          >
            Schedule it
          </Button>
        )}
        {values.status !== "published" && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="h-11"
            disabled={busy || uploading}
            onClick={() => submit("draft")}
          >
            Save as draft
          </Button>
        )}
      </div>
    </form>
  );
}

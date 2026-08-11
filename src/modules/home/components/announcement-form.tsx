"use client";

import { useRef, useState } from "react";
import { FileText, ImageIcon, X } from "lucide-react";
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

export interface AnnouncementFormValues {
  id?: string;
  title: string;
  body: string;
  isUrgent: boolean;
  targetSectionId: string;
  imagePath: string | null;
  pdfPath: string | null;
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
  const [urgent, setUrgent] = useState(values.isUrgent);
  const [scheduled, setScheduled] = useState(values.scheduledFor);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sectionItems = [
    { value: "", label: "The whole res" },
    ...sections.map((s) => ({ value: s.id, label: `${s.name} only` })),
  ];

  async function upload(file: File, kind: "image" | "pdf") {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("That file is bigger than 10 MB — please shrink it first.");
      return;
    }
    const okType = kind === "image" ? IMAGE_TYPES.includes(file.type) : file.type === "application/pdf";
    if (!okType) {
      setError(kind === "image" ? "Images only: PNG, JPG, WebP or GIF." : "PDFs only.");
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

    const previous = kind === "image" ? imagePath : pdfPath;
    if (previous) await db.storage.from(BUCKET).remove([previous]);
    if (kind === "image") setImagePath(path);
    else setPdfPath(path);
  }

  async function removeAttachment(kind: "image" | "pdf") {
    const path = kind === "image" ? imagePath : pdfPath;
    if (!path) return;
    const db = createClient();
    await db.storage.from(BUCKET).remove([path]);
    if (kind === "image") setImagePath(null);
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

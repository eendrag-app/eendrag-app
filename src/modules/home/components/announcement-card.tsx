"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionBadge } from "@/core/ui/section-badge";
import { cn } from "@/lib/utils";
import { markAnnouncementRead } from "../actions";

export interface AnnouncementCardProps {
  id: string;
  title: string;
  body: string;
  timeLabel: string;
  author: string;
  isUrgent: boolean;
  pinned: boolean;
  sectionName?: string | null;
  imageUrl?: string | null;
  pdfUrl?: string | null;
  read: boolean;
}

// How much body text shows before "Read more" appears. Roughly six lines on
// a phone; long enough that most posts never clamp at all.
const CLAMP_AT = 320;

// Marking as read: a card counts as opened once it has been at least half on
// screen for a second, or the moment someone expands it. Expanding alone
// would undercount — most announcements are short enough to read whole in the
// feed — and counting a render would overcount. HK only ever sees the total
// (announcement_read_counts), never who.
const SEEN_MS = 1000;

export function AnnouncementCard(props: AnnouncementCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [read, setRead] = useState(props.read);
  const cardRef = useRef<HTMLDivElement>(null);
  const long = props.body.length > CLAMP_AT;

  useEffect(() => {
    if (read) return;
    const element = cardRef.current;
    if (!element) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = setTimeout(() => {
            setRead(true);
            void markAnnouncementRead(props.id);
          }, SEEN_MS);
        } else {
          clearTimeout(timer);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [props.id, read]);

  function expand() {
    setExpanded(true);
    if (!read) {
      setRead(true);
      void markAnnouncementRead(props.id);
    }
  }

  return (
    <Card
      ref={cardRef}
      // A coloured left edge on every post: it separates one card from the
      // next in a long feed, and it carries meaning rather than decoration —
      // red for urgent, gold for pinned, the res maroon while a post is still
      // unread, and a plain hairline once it has been read.
      className={cn(
        "border-l-4",
        props.isUrgent
          ? "border-l-destructive ring-destructive/40 ring-2"
          : props.pinned
            ? "border-l-gold"
            : read
              ? "border-l-border"
              : "border-l-primary",
      )}
    >
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {props.isUrgent && (
            <Badge variant="destructive">
              <TriangleAlert aria-hidden />
              Urgent
            </Badge>
          )}
          {props.pinned && !props.isUrgent && <Badge variant="secondary">Pinned</Badge>}
          {props.sectionName && (
            <SectionBadge name={props.sectionName} />
          )}
          {!read && (
            <span className="text-muted-foreground ml-auto text-xs font-medium">New</span>
          )}
        </div>

        <div className="space-y-1">
          <h3 className="font-heading text-base leading-snug font-medium">{props.title}</h3>
          <p className="text-muted-foreground text-sm">
            {props.author} · {props.timeLabel}
          </p>
        </div>

        {props.body && (
          <div className="space-y-2">
            <p
              className={cn(
                "text-sm leading-relaxed whitespace-pre-line",
                long && !expanded && "line-clamp-6",
              )}
            >
              {props.body}
            </p>
            {long && !expanded && (
              <Button variant="link" size="sm" className="h-auto px-0" onClick={expand}>
                Read more
              </Button>
            )}
          </div>
        )}

        {props.imageUrl && (
          // The file lives in Supabase Storage behind a signed, expiring URL on
          // whatever host the deployment uses; next/image would need that host
          // allow-listed at build time, and a poster does not need optimising.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={props.imageUrl}
            alt={`Attachment for ${props.title}`}
            className="max-h-96 w-full rounded-lg object-cover"
            loading="lazy"
          />
        )}

        {props.pdfUrl && (
          <a
            href={props.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="hover:bg-muted inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium"
          >
            <FileText className="size-4" aria-hidden />
            Open the PDF
          </a>
        )}
      </CardContent>
    </Card>
  );
}

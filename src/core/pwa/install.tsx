"use client";

import { useEffect, useState } from "react";
import { Download, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMounted } from "@/core/ui/use-mounted";
import { cn } from "@/lib/utils";

// "Get app" — installs Eendrag to a home screen or a desktop.
//
// There are two completely different mechanisms behind one button:
//
//   Android / Chrome / Edge — the browser fires `beforeinstallprompt` when it
//     decides the app qualifies (manifest + service worker + https). We keep
//     the event and replay it on click, which shows the real install dialog.
//   iOS / Safari — Apple fires no such event and offers no API. The only way
//     in is Share → Add to Home Screen, so the button opens a sheet that says
//     exactly that. This is not a nicety on iOS: an iPhone will not deliver
//     web push at all until the app has been added to the home screen
//     (docs/OPERATIONS.md → Notifications).
//
// Both surfaces render NOTHING when the app is already installed, or in a
// browser that cannot install it (desktop Firefox, for one) — better silence
// than a button that does nothing.

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** "prompt" = the browser will install it for us; "ios" = we can only explain how. */
type Offer = "none" | "prompt" | "ios";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's own flag, which predates the standard media query.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function useInstall() {
  // The server cannot know any of this, and neither can the first client
  // render without producing different HTML — see useMounted.
  const mounted = useMounted();
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosHelpOpen, setIosHelpOpen] = useState(false);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      // Stop Chrome's own mini-infobar; the button is the invitation.
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const offer: Offer =
    !mounted || installed || isStandalone()
      ? "none"
      : prompt
        ? "prompt"
        : /iphone|ipad|ipod/i.test(window.navigator.userAgent)
          ? "ios"
          : "none";

  async function install() {
    if (!prompt) {
      setIosHelpOpen(true);
      return;
    }
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    // The event is single-use: once shown it cannot be replayed, and the
    // browser fires a fresh one if the person changes their mind later.
    setPrompt(null);
    if (outcome === "accepted") setInstalled(true);
  }

  return { offer, install, iosHelpOpen, setIosHelpOpen };
}

function IosHelpSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add Eendrag to your home screen</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-6 text-sm">
          <p className="text-muted-foreground">
            iPhones do not let an app install itself, so this takes three taps in Safari:
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Tap the share button{" "}
              <Share className="inline size-4 align-text-bottom" aria-hidden /> at the bottom
              of Safari.
            </li>
            <li>
              Scroll down and tap <strong>Add to Home Screen</strong>.
            </li>
            <li>
              Tap <strong>Add</strong>.
            </li>
          </ol>
          <p className="text-muted-foreground">
            Open Eendrag from that icon afterwards. It is also the only way an iPhone will
            let the app send you notifications.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** The compact button that lives on the header bar. */
export function InstallButton({ className }: { className?: string }) {
  const { offer, install, iosHelpOpen, setIosHelpOpen } = useInstall();
  if (offer === "none") return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={install}
        className={cn(
          // Reads as part of the bar rather than as a page control.
          "border-gold/60 text-header-foreground hover:bg-white/15 hover:text-header-foreground bg-transparent",
          className,
        )}
      >
        <Download aria-hidden />
        Get app
      </Button>
      <IosHelpSheet open={iosHelpOpen} onOpenChange={setIosHelpOpen} />
    </>
  );
}

/** The fuller version on the profile page, for anyone who missed the button. */
export function InstallCard() {
  const { offer, install, iosHelpOpen, setIosHelpOpen } = useInstall();
  if (offer === "none") return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="size-4" aria-hidden />
            Get the app
          </CardTitle>
          <CardDescription>
            Put Eendrag on your home screen: it opens without the browser around it, and
            it is what lets notifications reach your phone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="lg" className="h-11 w-full sm:w-auto" onClick={install}>
            <Download aria-hidden />
            {offer === "ios" ? "How to add it" : "Install Eendrag"}
          </Button>
        </CardContent>
      </Card>
      <IosHelpSheet open={iosHelpOpen} onOpenChange={setIosHelpOpen} />
    </>
  );
}

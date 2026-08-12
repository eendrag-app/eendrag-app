"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMounted } from "@/core/ui/use-mounted";
import { removePushSubscription, savePushSubscription } from "./push-actions";

// "Send them to this phone." One switch per device — a phone, a laptop and the
// installed app are three separate subscriptions, and this only ever knows
// about the one it is running in.
//
// The rules this has to live with, none of which are ours:
//   - Permission can only be asked for from a real click. No asking on load.
//   - Permission can be denied permanently, and no API can re-ask; the only
//     way back is the browser's own site settings, so we say so.
//   - iOS delivers push ONLY to an app added to the home screen. In Safari the
//     switch would fail silently, so it is replaced by the reason.

/**
 * VAPID public keys travel as base64url; PushManager wants raw bytes.
 * Returns the ArrayBuffer rather than the view: `applicationServerKey` is
 * typed as BufferSource, which a generic Uint8Array no longer satisfies.
 */
function urlBase64ToBytes(base64: string): ArrayBuffer {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = window.atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

type Status =
  | "loading"
  | "unsupported" // no service worker / PushManager at all
  | "needs-install" // iPhone, not added to the home screen yet
  | "blocked" // permission denied in the browser's settings
  | "off"
  | "on";

export function PushToggle({ publicKey }: { publicKey: string }) {
  const mounted = useMounted();
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function look() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        // On an iPhone this is what "you are in Safari, not the installed app"
        // looks like: PushManager simply is not there.
        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
        if (!cancelled) setStatus(ios ? "needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("blocked");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (!cancelled) setStatus(existing ? "on" : "off");
    }

    void look().catch(() => {
      if (!cancelled) setStatus("unsupported");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        // Required by every browser: a push may not be silent. Every one of
        // ours shows a notification, so this costs nothing.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(publicKey),
      });
      const json = subscription.toJSON();
      const result = await savePushSubscription({
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent.slice(0, 300),
      });
      if (!result.ok) {
        // Do not leave a live subscription the server does not know about —
        // it would look on, and nothing would ever arrive.
        await subscription.unsubscribe();
        setError(result.error);
        setStatus("off");
        return;
      }
      setStatus("on");
    } catch (err) {
      console.error("could not turn on push", err);
      setError("Could not turn them on. Try again, or reopen the app.");
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("off");
    } catch (err) {
      console.error("could not turn off push", err);
      setError("Could not turn them off here. The browser's site settings will.");
    } finally {
      setBusy(false);
    }
  }

  // Nothing renders until the browser has been asked, so the server HTML and
  // the first client render agree.
  if (!mounted || status === "loading") return null;

  if (status !== "on" && status !== "off") {
    const reason =
      status === "needs-install"
        ? "Add Eendrag to your home screen first — an iPhone only lets an installed app send notifications. The button is under Get the app."
        : status === "blocked"
          ? "Your browser is blocking notifications for this site. Turn them back on in its site settings, then come back here."
          : "This browser cannot send notifications. The bell above still works.";
    return (
      <div className="space-y-1 border-t pt-4">
        <h2 className="text-sm font-medium">On this device</h2>
        <p className="text-muted-foreground text-sm">{reason}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t pt-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor="push">Notifications on this device</Label>
          <p className="text-muted-foreground text-sm">
            Announcements and results reach you while the app is closed. Quiet hours
            still apply — urgent posts still come through.
          </p>
        </div>
        <Switch
          id="push"
          checked={status === "on"}
          disabled={busy}
          onCheckedChange={(next) => void (next ? turnOn() : turnOff())}
          className="mt-1"
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

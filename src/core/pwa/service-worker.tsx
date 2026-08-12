"use client";

import { useEffect } from "react";

// Registers public/sw.js. One effect, no state, renders nothing — it sits in
// the app layout so every page has the worker available.
//
// Registration is deliberately quiet: if it fails (an old browser, a private
// window, http on a phone), the app carries on working exactly as it did
// before. Nothing in the app depends on the worker except installability and
// push notifications.
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Dev reloads register this on every refresh; the browser deduplicates by
    // scope, so this is cheap.
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.info("service worker not registered:", error);
    });
  }, []);

  return null;
}

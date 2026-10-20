"use client";

import { useEffect } from "react";

/** Registers the offline service worker (public/sw.js) in production builds. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Offline support is an enhancement; the site works without it.
    });
  }, []);
  return null;
}

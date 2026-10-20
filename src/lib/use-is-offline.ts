"use client";

import { useOffline } from "next/offline";
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Offline per Next.js (failed requests, connectivity polling) or per the
 * browser. The browser flag covers opening the installed app while already
 * offline, before Next.js has had a request fail.
 */
export function useIsOffline(): boolean {
  const nextOffline = useOffline();
  const browserOffline = useSyncExternalStore(subscribe, () => !navigator.onLine, () => false);
  return nextOffline || browserOffline;
}

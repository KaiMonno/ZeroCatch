"use client";

import { WifiOff } from "lucide-react";
import { useIsOffline } from "@/lib/use-is-offline";
import { useEffect, useState } from "react";

/**
 * Shown while the connection is down. Says how old the saved deals are (the
 * service worker stamps each saved page) and that taps will finish later:
 * Next.js retries navigations and Server Actions once it's back online.
 */
export function OfflineBanner() {
  const offline = useIsOffline();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!offline || !("caches" in window)) return;
    let cancelled = false;
    caches
      .match(location.href, { ignoreVary: true })
      .then((saved) => Number(saved?.headers.get("x-zc-saved-at")) || null)
      .then((at) => !cancelled && setSavedAt(at))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [offline]);

  if (!offline) return null;
  const time = savedAt
    ? new Date(savedAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })
    : null;
  return (
    <div role="status" className="border-b border-amber-400/30 bg-amber-950/95 px-4 py-2 text-sm text-amber-100">
      <p className="mx-auto flex max-w-5xl items-start gap-2">
        <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          You&apos;re offline{time ? `, showing deals saved ${time}` : ""}. Anything you tap will finish when you&apos;re back
          online; deal links need a connection.
        </span>
      </p>
    </div>
  );
}

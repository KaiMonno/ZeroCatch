"use client";

import { Clock } from "lucide-react";
import { useSyncExternalStore } from "react";
import { formatExpiry } from "@/lib/format";

// One shared clock for every label on the page, ticking every 30 seconds.
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) timer = (clearInterval(timer), undefined);
  };
}

/**
 * "Ends in 3 hours", kept current in the browser. Hydrates with the server's
 * render time (so the markup matches), then switches to the real clock: a page
 * opened offline from the saved copy hours later shows true countdowns, and
 * "Expired" for deals that have ended since.
 */
export function LiveExpiry({ expiresAt, renderedAt }: { expiresAt: string | null; renderedAt: number }) {
  const at = useSyncExternalStore(subscribe, () => now, () => renderedAt);
  const { label, urgent } = formatExpiry(expiresAt, at);
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider ${urgent ? "text-orange-300" : "text-muted"}`}
    >
      <Clock aria-hidden className="size-3.5" />
      {expiresAt ? (
        <time dateTime={expiresAt} title={new Date(expiresAt).toUTCString()}>
          {label}
        </time>
      ) : (
        label
      )}
    </span>
  );
}

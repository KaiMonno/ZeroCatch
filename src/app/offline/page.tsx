import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { OfflineAwareLink } from "@/components/offline-aware-link";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Offline · ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

/**
 * What the installed app shows offline for a view it hasn't saved yet
 * (public/sw.js saves both tabs on install). Offline, its links do a full
 * page load so the service worker can answer from its saved copies.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
        <WifiOff aria-hidden className="size-8 text-muted" />
        <h1 className="text-lg font-semibold text-fg">This view isn&apos;t saved offline</h1>
        <p className="text-sm text-muted">
          You&apos;re offline, and this page hasn&apos;t been opened on this device yet. The deals you&apos;ve already
          seen are still here.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2 text-sm">
          <OfflineAwareLink href="/" className="rounded-lg bg-fg px-3 py-1.5 font-medium text-bg hover:opacity-90">
            Pure Freebies
          </OfflineAwareLink>
          <OfflineAwareLink href="/?tab=trials" className="rounded-lg border border-line px-3 py-1.5 text-fg hover:bg-white/5">
            Instant-Cancel Trials
          </OfflineAwareLink>
        </div>
      </div>
    </main>
  );
}

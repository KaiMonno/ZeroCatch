import { ChevronDown, Folder } from "lucide-react";
import type { Deal } from "@/lib/types";
import { DealCard } from "./deal-card";
import { ExpiryLabel } from "./expiry-label";

/**
 * Collapses a batch of similar deals (e.g. many small itch.io giveaways) into
 * one card so they don't crowd out everything else. A native <details>
 * element: works without JavaScript and is keyboard/screen-reader friendly.
 */
export function DealFolder({ title, blurb, deals }: { title: string; blurb: string; deals: Deal[] }) {
  const soonest = deals.reduce<string | null>(
    (min, d) => (d.expires_at && (!min || d.expires_at < min) ? d.expires_at : min),
    null,
  );
  return (
    <details className="group/folder rounded-2xl border border-line bg-surface open:border-line-strong">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl p-4 hover:bg-white/[0.03] sm:gap-4 [&::-webkit-details-marker]:hidden">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/5 text-muted">
          <Folder aria-hidden className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-semibold text-fg">
            {title}
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-xs tabular-nums">{deals.length}</span>
          </span>
          <span className="mt-0.5 block truncate text-sm text-muted">
            {blurb} · {deals.slice(0, 3).map((d) => d.title.replace(/: Free on itch\.io$/, "")).join(", ")}
            {deals.length > 3 && "…"}
          </span>
          {/* On phones the end date sits under the text instead of competing for the row. */}
          {soonest && (
            <span className="mt-1.5 block sm:hidden">
              <ExpiryLabel expiresAt={soonest} />
            </span>
          )}
        </span>
        {soonest && (
          <span className="hidden shrink-0 sm:block">
            <ExpiryLabel expiresAt={soonest} />
          </span>
        )}
        <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted group-open/folder:text-fg">
          <span className="hidden sm:inline group-open/folder:hidden">Show all</span>
          <span className="hidden sm:group-open/folder:inline">Hide</span>
          <ChevronDown aria-hidden className="size-4 transition-transform group-open/folder:rotate-180" />
        </span>
      </summary>
      <ul className="grid grid-cols-1 gap-3 border-t border-line p-3 sm:grid-cols-2 lg:grid-cols-3">
        {deals.map((deal) => (
          <li key={deal.id} className="flex">
            <DealCard deal={deal} />
          </li>
        ))}
      </ul>
    </details>
  );
}

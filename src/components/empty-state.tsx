import Link from "next/link";
import { Hourglass, SearchX } from "lucide-react";
import { TABS, buildHref, type FilterSlug, type Tab } from "@/lib/tabs";

/**
 * Two different situations: the visitor's search/filters hid everything, or
 * nothing in this tab currently meets the bar. The second isn't an error, it's
 * the site doing its job, so say so.
 */
export function EmptyState({ tab, q, filters }: { tab: Tab; q?: string; filters: FilterSlug[] }) {
  const narrowed = Boolean(q) || filters.length > 0;
  const otherTab = TABS.find((t) => t.slug !== tab.slug)!;

  if (narrowed) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
        <SearchX aria-hidden className="size-8 text-muted" />
        <div>
          <p className="font-medium text-fg">{q ? <>Nothing matches &ldquo;{q}&rdquo;</> : "No deals match these filters"}</p>
          <p className="mt-1 text-sm text-muted">Try a broader search, or check the other tab.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 text-sm">
          <Link href={buildHref({ tab: tab.slug })} className="rounded-lg bg-fg px-3 py-1.5 font-medium text-bg hover:opacity-90">
            Clear search &amp; filters
          </Link>
          <Link
            href={buildHref({ tab: otherTab.slug, q, filters })}
            className="rounded-lg border border-line px-3 py-1.5 text-fg hover:bg-white/5"
          >
            Search {otherTab.label}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <Hourglass aria-hidden className="size-8 text-muted" />
      <div>
        <p className="font-medium text-fg">Nothing qualifies right now</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          We only list deals that pass every rule: no purchase, no paid membership, no hidden catch. That means some
          days are quiet. New deals are checked every night.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 text-sm">
        <Link href={buildHref({ tab: otherTab.slug })} className="rounded-lg bg-fg px-3 py-1.5 font-medium text-bg hover:opacity-90">
          See {otherTab.label}
        </Link>
        <Link href="/what-qualifies" className="rounded-lg border border-line px-3 py-1.5 text-fg hover:bg-white/5">
          What qualifies?
        </Link>
      </div>
    </div>
  );
}

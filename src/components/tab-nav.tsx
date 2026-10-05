import Link from "next/link";
import { Gift, Timer } from "lucide-react";
import { TABS, buildHref, type FilterSlug, type TabSlug } from "@/lib/tabs";

const ICONS = { freebies: Gift, trials: Timer } as const;

export function TabNav({
  active,
  q,
  filters,
}: {
  active: TabSlug;
  q?: string;
  filters: FilterSlug[];
}) {
  return (
    <nav aria-label="Deal categories" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 rounded-2xl border border-line bg-surface p-1">
        {TABS.map((tab) => {
          const Icon = ICONS[tab.slug];
          const isActive = tab.slug === active;
          return (
            <li key={tab.slug} className="flex-1">
              <Link
                href={buildHref({ tab: tab.slug, q, filters })}
                aria-current={isActive ? "page" : undefined}
                scroll={false}
                className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-fg text-bg" : "text-muted hover:bg-white/5 hover:text-fg"
                }`}
              >
                <Icon aria-hidden className="size-4" />
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

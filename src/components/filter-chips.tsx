import Link from "next/link";
import { Check } from "lucide-react";
import { FILTERS, buildHref, type FilterSlug, type TabSlug } from "@/lib/tabs";

export function FilterChips({
  tab,
  q,
  active,
}: {
  tab: TabSlug;
  q?: string;
  active: FilterSlug[];
}) {
  return (
    <ul aria-label="Filters" className="flex flex-wrap gap-2">
      {FILTERS.map((f) => {
        const on = active.includes(f.slug);
        const next = on ? active.filter((s) => s !== f.slug) : [...active, f.slug];
        return (
          <li key={f.slug}>
            <Link
              href={buildHref({ tab, q, filters: next })}
              scroll={false}
              aria-current={on ? "true" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                on
                  ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-200"
                  : "border-line text-muted hover:border-line-strong hover:text-fg"
              }`}
            >
              {on && <Check aria-hidden className="size-3.5" />}
              {f.label}
            </Link>
          </li>
        );
      })}
      {active.length > 0 && (
        <li>
          <Link
            href={buildHref({ tab, q })}
            scroll={false}
            className="inline-flex px-2 py-1.5 text-xs text-muted underline-offset-4 hover:text-fg hover:underline"
          >
            Clear
          </Link>
        </li>
      )}
    </ul>
  );
}

import type { DealCategory } from "./types";

export const TABS = [
  {
    slug: "freebies",
    category: "pure_freebie",
    label: "Pure Freebies",
    shortLabel: "Freebies",
    blurb: "100% free. No payment method, ever.",
  },
  {
    slug: "trials",
    category: "free_trial",
    label: "Instant-Cancel Trials",
    shortLabel: "Trials",
    blurb: "Cancel on day one, keep the full trial. Longest first.",
  },
] as const satisfies readonly {
  slug: string;
  category: DealCategory;
  label: string;
  shortLabel: string;
  blurb: string;
}[];

export type Tab = (typeof TABS)[number];
export type TabSlug = Tab["slug"];

export function resolveTab(slug: string | undefined): Tab {
  return TABS.find((t) => t.slug === slug) ?? TABS[0];
}

export const FILTERS = [
  { slug: "no-card", label: "No card" },
  { slug: "no-account", label: "No account" },
  { slug: "ending-soon", label: "Ending soon" },
] as const;

export type FilterSlug = (typeof FILTERS)[number]["slug"];

export function parseFilters(raw: string | string[] | undefined): FilterSlug[] {
  const values = (Array.isArray(raw) ? raw.join(",") : (raw ?? "")).split(",");
  return FILTERS.map((f) => f.slug).filter((s) => values.includes(s));
}

/** Build a home URL, dropping empty params so links stay clean. */
export function buildHref(params: {
  tab: TabSlug;
  q?: string;
  filters?: FilterSlug[];
}): string {
  const sp = new URLSearchParams();
  if (params.tab !== TABS[0].slug) sp.set("tab", params.tab);
  if (params.q) sp.set("q", params.q);
  if (params.filters?.length) sp.set("f", params.filters.join(","));
  const qs = sp.toString();
  return qs ? `/?${qs}` : "/";
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchX } from "lucide-react";
import { BadgeLegend } from "@/components/badge-legend";
import { DealCard } from "@/components/deal-card";
import { FilterChips } from "@/components/filter-chips";
import { HeroCard } from "@/components/hero-card";
import { SearchBar } from "@/components/search-bar";
import { TabNav } from "@/components/tab-nav";
import { getDeals } from "@/lib/deals";
import { SITE_NAME } from "@/lib/site";
import { isSupabaseConfigured } from "@/lib/supabase";
import { TABS, buildHref, parseFilters, resolveTab } from "@/lib/tabs";

export async function generateMetadata({ searchParams }: PageProps<"/">): Promise<Metadata> {
  const { tab: slug } = await searchParams;
  const tab = resolveTab(typeof slug === "string" ? slug : undefined);
  const canonical = { alternates: { canonical: buildHref({ tab: tab.slug }) } };
  // The home feed keeps the layout's default title and description. The layout's
  // title template doesn't apply to a page in its own segment, so build it here.
  if (tab.slug === TABS[0].slug) return canonical;
  return { ...canonical, title: `${tab.label} · ${SITE_NAME}`, description: tab.blurb };
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const tab = resolveTab(typeof sp.tab === "string" ? sp.tab : undefined);
  const q = typeof sp.q === "string" ? sp.q.trim() : undefined;
  const filters = parseFilters(sp.f);

  const deals = await getDeals({ category: tab.category, q, filters });

  // The hero spotlight only exists on the home feed.
  const heroes = tab.category === "pure_freebie" ? deals.filter((d) => d.is_hero_featured) : [];
  const rest = heroes.length ? deals.filter((d) => !d.is_hero_featured) : deals;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 pb-16 pt-4 sm:pt-8">
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 bg-bg/85 px-4 pb-3 pt-2 backdrop-blur-md">
        <TabNav active={tab.slug} q={q} filters={filters} />
        <Suspense fallback={<div className="h-[42px] rounded-xl border border-line bg-surface" />}>
          <SearchBar placeholder={`Search ${tab.label.toLowerCase()}…`} />
        </Suspense>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-xl font-bold text-fg sm:text-2xl">{tab.label}</h1>
          <p className="text-sm text-muted">{tab.blurb}</p>
        </div>
        <FilterChips tab={tab.slug} q={q} active={filters} />
      </div>

      {heroes.map((deal) => (
        <HeroCard key={deal.id} deal={deal} />
      ))}

      {rest.length > 0 ? (
        <section aria-label={`${tab.label} list`}>
          <p className="mb-3 text-xs text-muted" aria-live="polite">
            {deals.length} active deal{deals.length === 1 ? "" : "s"}
            {tab.category === "free_trial" && " · sorted longest to shortest"}
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((deal) => (
              <li key={deal.id} className="flex">
                <DealCard deal={deal} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        heroes.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
            <SearchX aria-hidden className="size-8 text-muted" />
            <p className="font-medium text-fg">No deals match right now</p>
            <p className="text-sm text-muted">Try clearing filters or a different search.</p>
          </div>
        )
      )}

      <BadgeLegend />

      {!isSupabaseConfigured && (
        <p className="text-center text-xs text-muted">
          Showing local sample data. Set Supabase env vars to load live deals.
        </p>
      )}
    </main>
  );
}

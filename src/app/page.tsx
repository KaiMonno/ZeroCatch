import type { Metadata } from "next";
import { Suspense } from "react";
import { BadgeLegend } from "@/components/badge-legend";
import { DealCard } from "@/components/deal-card";
import { DealFolder } from "@/components/deal-folder";
import { EmptyState } from "@/components/empty-state";
import { FilterChips } from "@/components/filter-chips";
import { HeroCard } from "@/components/hero-card";
import { SearchBar } from "@/components/search-bar";
import { TabNav } from "@/components/tab-nav";
import { ITCH_MERCHANT, getDeals } from "@/lib/deals";
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

const ITCH_FOLDER_MIN = 3;

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const tab = resolveTab(typeof sp.tab === "string" ? sp.tab : undefined);
  const q = typeof sp.q === "string" ? sp.q.trim() : undefined;
  const filters = parseFilters(sp.f);

  const deals = await getDeals({ category: tab.category, q, filters });

  // The hero spotlight only exists on the home feed.
  const heroes = tab.category === "pure_freebie" ? deals.filter((d) => d.is_hero_featured) : [];
  const listed = heroes.length ? deals.filter((d) => !d.is_hero_featured) : deals;
  // Several itch.io giveaways collapse into one folder so they can't crowd the feed.
  const itch = listed.filter((d) => d.merchant === ITCH_MERCHANT);
  const folded = itch.length >= ITCH_FOLDER_MIN;
  const rest = folded ? listed.filter((d) => d.merchant !== ITCH_MERCHANT) : listed;

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

      {heroes.length > 0 && (
        // Epic often gives away two games at once: pair them on wider screens.
        <div className={`grid gap-3 ${heroes.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {heroes.map((deal) => (
            <HeroCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}

      {rest.length > 0 || folded ? (
        <section aria-label={`${tab.label} list`}>
          <p className="mb-3 text-xs text-muted" aria-live="polite">
            {deals.length} active deal{deals.length === 1 ? "" : "s"}
            {tab.category === "free_trial" && " · sorted longest to shortest"}
          </p>
          {/* grid-cols-1 = minmax(0, 1fr): long one-line text can't widen the column past the screen */}
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((deal) => (
              <li key={deal.id} className="flex">
                <DealCard deal={deal} />
              </li>
            ))}
            {folded && (
              <li className="min-w-0 sm:col-span-2 lg:col-span-3">
                <DealFolder title="Free itch.io games" blurb="Indie games, free to keep" deals={itch} />
              </li>
            )}
          </ul>
        </section>
      ) : (
        heroes.length === 0 && <EmptyState tab={tab} q={q} filters={filters} />
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

import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { buildSeedDeals } from "@/data/seed-deals";
import { getSupabase } from "./supabase";
import type { FilterSlug } from "./tabs";
import type { Deal, DealCategory } from "./types";

const ENDING_SOON_MS = 3 * 86_400_000;

export interface DealQuery {
  category: DealCategory;
  q?: string;
  filters?: FilterSlug[];
}

/**
 * Every active deal, cached for about a minute and shared by all visitors. The
 * feed is small (hundreds of rows at most), so one cached read plus in-memory
 * filtering keeps Supabase usage flat no matter how many searches people run.
 * Scrapers can call revalidateTag("deals") to publish immediately.
 */
export async function getActiveDeals(): Promise<Deal[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("deals");

  const supabase = getSupabase();
  if (!supabase) return seedFallback();

  const { data, error } = await supabase.from("active_deals").select("*");
  if (error) throw new Error(`Failed to load deals: ${error.message}`);
  return data as Deal[];
}

/** Deals for one tab, filtered and sorted at request time. */
export async function getDeals(query: DealQuery): Promise<Deal[]> {
  return sortDeals(filterDeals(await getActiveDeals(), query));
}

function seedFallback(): Deal[] {
  const now = new Date().toISOString();
  return buildSeedDeals().map((d, i) => ({
    ...d,
    id: d.id ?? `seed-${i}`,
    created_at: d.created_at ?? now,
  }));
}

function filterDeals(deals: Deal[], { category, q, filters = [] }: DealQuery): Deal[] {
  // Re-check the time window: the cached list can be up to a minute old.
  const now = Date.now();
  const term = (q ?? "").trim().toLowerCase().slice(0, 80);
  return deals.filter((d) => {
    const expires = d.expires_at ? Date.parse(d.expires_at) : null;
    if (d.category !== category) return false;
    if (Date.parse(d.starts_at) > now || (expires !== null && expires <= now)) return false;
    // Tab 2 only lists trials that keep the full period after cancelling.
    if (category === "free_trial" && !d.instant_cancel_safe) return false;
    if (filters.includes("no-card") && d.requires_credit_card) return false;
    if (filters.includes("no-account") && d.requires_account) return false;
    if (filters.includes("ending-soon") && (expires === null || expires > now + ENDING_SOON_MS))
      return false;
    if (term && !`${d.title} ${d.merchant} ${d.description}`.toLowerCase().includes(term))
      return false;
    return true;
  });
}

/** itch.io games are plentiful but small: they always sort after everything else. */
export const ITCH_MERCHANT = "itch.io";
const sourceRank = (d: Deal) => (d.merchant === ITCH_MERCHANT ? 1 : 0);

/** Longest trial first, then featured, then non-itch, then soonest-expiring, then newest. */
function sortDeals(deals: Deal[]): Deal[] {
  const exp = (d: Deal) => (d.expires_at ? Date.parse(d.expires_at) : Infinity);
  return [...deals].sort(
    (a, b) =>
      (b.trial_duration_days ?? -1) - (a.trial_duration_days ?? -1) ||
      Number(b.is_hero_featured) - Number(a.is_hero_featured) ||
      sourceRank(a) - sourceRank(b) ||
      exp(a) - exp(b) ||
      Date.parse(b.created_at) - Date.parse(a.created_at),
  );
}

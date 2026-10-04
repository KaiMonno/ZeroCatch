import "server-only";

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
 * Fetch active deals for one tab. Reads from the `active_deals` view, which
 * is also the read contract for the future Expo app. Falls back to seed data
 * when Supabase isn't configured, so the UI runs with zero setup.
 */
export async function getDeals({
  category,
  q,
  filters = [],
}: DealQuery): Promise<Deal[]> {
  const supabase = getSupabase();
  if (!supabase) return sortDeals(filterLocal(seedFallback(), { category, q, filters }));

  let query = supabase.from("active_deals").select("*").eq("category", category);

  const term = sanitizeSearch(q);
  if (term) {
    query = query.or(
      `title.ilike.%${term}%,merchant.ilike.%${term}%,description.ilike.%${term}%`,
    );
  }
  if (filters.includes("no-card")) query = query.eq("requires_credit_card", false);
  if (filters.includes("no-account")) query = query.eq("requires_account", false);
  if (filters.includes("ending-soon")) {
    query = query.lte("expires_at", new Date(Date.now() + ENDING_SOON_MS).toISOString());
  }
  // Tab 2 only lists trials that keep the full period after cancelling.
  if (category === "free_trial") query = query.eq("instant_cancel_safe", true);

  if (category === "free_trial") {
    query = query.order("trial_duration_days", { ascending: false, nullsFirst: false });
  } else {
    query = query.order("is_hero_featured", { ascending: false });
  }
  query = query
    .order("expires_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load deals: ${error.message}`);
  return data as Deal[];
}

/** Strip characters that would break PostgREST's `or=(…)` filter syntax. */
function sanitizeSearch(q: string | undefined): string {
  return (q ?? "").replace(/[,()%*\\:"]/g, " ").trim().slice(0, 80);
}

function seedFallback(): Deal[] {
  const now = new Date().toISOString();
  return buildSeedDeals().map((d, i) => ({
    ...d,
    id: d.id ?? `seed-${i}`,
    created_at: d.created_at ?? now,
  }));
}

function filterLocal(deals: Deal[], { category, q, filters = [] }: DealQuery): Deal[] {
  const now = Date.now();
  const term = sanitizeSearch(q).toLowerCase();
  return deals.filter((d) => {
    const expires = d.expires_at ? Date.parse(d.expires_at) : null;
    if (d.category !== category) return false;
    if (Date.parse(d.starts_at) > now || (expires !== null && expires <= now)) return false;
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

function sortDeals(deals: Deal[]): Deal[] {
  const exp = (d: Deal) => (d.expires_at ? Date.parse(d.expires_at) : Infinity);
  return [...deals].sort(
    (a, b) =>
      (b.trial_duration_days ?? -1) - (a.trial_duration_days ?? -1) ||
      Number(b.is_hero_featured) - Number(a.is_hero_featured) ||
      exp(a) - exp(b),
  );
}

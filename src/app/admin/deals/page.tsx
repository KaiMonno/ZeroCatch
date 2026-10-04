import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Deal } from "@/lib/types";
import { AdminNav } from "../admin-nav";
import { PublishedDealRow } from "./published-deal-row";

export default function DealsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading deals…</p>}>
      <PublishedDeals />
    </Suspense>
  );
}

/** Live and scheduled deals, plus the last week of expired ones for quick fixes. */
async function loadDealGroups() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const now = Date.now();
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .or(`expires_at.is.null,expires_at.gt.${new Date(now - 7 * 86_400_000).toISOString()}`)
    .order("starts_at", { ascending: false });
  if (error) throw new Error(error.message);

  const deals = data as Deal[];
  const started = (d: Deal) => Date.parse(d.starts_at) <= now;
  const ended = (d: Deal) => d.expires_at !== null && Date.parse(d.expires_at) <= now;
  return [
    { label: "Live", deals: deals.filter((d) => started(d) && !ended(d)) },
    { label: "Scheduled", deals: deals.filter((d) => !started(d)) },
    { label: "Recently expired", deals: deals.filter(ended) },
  ];
}

async function PublishedDeals() {
  await requireAdmin();
  const groups = await loadDealGroups();
  if (!groups) return <p className="text-sm text-muted">Connect Supabase to manage deals.</p>;

  return (
    <>
      <AdminNav active="deals" />
      <div>
        <h1 className="text-xl font-bold text-fg">Published deals</h1>
        <p className="text-sm text-muted">Edits and removals go live immediately.</p>
      </div>
      {groups.map((group) => (
        <section key={group.label} aria-labelledby={`group-${group.label}`} className="flex flex-col gap-2">
          <h2 id={`group-${group.label}`} className="text-sm font-semibold uppercase tracking-wide text-muted">
            {group.label} <span className="tabular-nums opacity-70">{group.deals.length}</span>
          </h2>
          {group.deals.length === 0 ? (
            <p className="text-sm text-muted">None.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {group.deals.map((deal) => (
                <li key={deal.id}>
                  <PublishedDealRow deal={deal} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}

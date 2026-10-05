import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Deal, ReportReason } from "@/lib/types";
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

  // Reports cascade-delete with their deal, so this table stays small.
  const reports = new Map<string, DealReport[]>();
  const { data: reportRows } = await supabase
    .from("deal_reports")
    .select("deal_id, reason, note, created_at")
    .order("created_at", { ascending: false });
  for (const row of (reportRows ?? []) as (DealReport & { deal_id: string })[]) {
    reports.set(row.deal_id, [...(reports.get(row.deal_id) ?? []), row]);
  }

  const hidden = (d: Deal) => Boolean(d.hidden_at);
  const started = (d: Deal) => Date.parse(d.starts_at) <= now;
  const ended = (d: Deal) => d.expires_at !== null && Date.parse(d.expires_at) <= now;
  const visible = deals.filter((d) => !hidden(d));
  return {
    reports,
    groups: [
      { label: "Hidden by reports", deals: deals.filter(hidden) },
      { label: "Reported", deals: visible.filter((d) => reports.has(d.id) && !ended(d)) },
      { label: "Live", deals: visible.filter((d) => started(d) && !ended(d) && !reports.has(d.id)) },
      { label: "Scheduled", deals: visible.filter((d) => !started(d) && !reports.has(d.id)) },
      { label: "Recently expired", deals: visible.filter(ended) },
    ].filter((g) => g.deals.length > 0 || ["Live", "Scheduled"].includes(g.label)),
  };
}

export interface DealReport {
  reason: ReportReason;
  note: string | null;
  created_at: string;
}

async function PublishedDeals() {
  await requireAdmin();
  const loaded = await loadDealGroups();
  if (!loaded) return <p className="text-sm text-muted">Connect Supabase to manage deals.</p>;
  const { groups, reports } = loaded;

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
                  <PublishedDealRow deal={deal} reports={reports.get(deal.id) ?? []} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}

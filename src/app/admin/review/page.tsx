import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { DealCandidate } from "@/lib/types";
import { AdminNav } from "../admin-nav";
import { CandidateCard } from "./candidate-card";
import { ManualLeadForm } from "./manual-lead-form";

const VIEWS = [
  { key: "food", label: "Food", food: true },
  { key: "other", label: "Games & other", food: false },
  { key: "all", label: "All", food: null },
] as const;

export default function ReviewPage({ searchParams }: PageProps<"/admin/review">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading queue…</p>}>
      <ReviewQueue searchParams={searchParams} />
    </Suspense>
  );
}

async function ReviewQueue({ searchParams }: Pick<PageProps<"/admin/review">, "searchParams">) {
  await requireAdmin();
  const { show } = await searchParams;
  const view = VIEWS.find((v) => v.key === show) ?? VIEWS[0];

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return <p className="text-sm text-muted">Connect Supabase (URL + service role key) to use the review queue.</p>;
  }

  let query = supabase
    .from("deal_candidates")
    .select("*")
    .eq("status", "pending")
    .order("published_at", { ascending: false, nullsFirst: true })
    .limit(100);
  if (view.food !== null) query = query.eq("is_food", view.food);

  const pendingCount = (food: boolean) =>
    supabase
      .from("deal_candidates")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("is_food", food);

  const [{ data, error }, foodCount, otherCount] = await Promise.all([query, pendingCount(true), pendingCount(false)]);
  if (error) throw new Error(error.message);
  const candidates = data as DealCandidate[];
  const counts = { food: foodCount.count ?? 0, other: otherCount.count ?? 0 };

  return (
    <>
      <AdminNav active="review" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-fg">Review queue</h1>
          <p className="text-sm text-muted">Verify the terms yourself, then link the brand&apos;s own page.</p>
        </div>
        <nav aria-label="Queue filter" className="flex rounded-xl border border-line bg-surface p-1 text-sm">
          {VIEWS.map((v) => {
            const count = v.key === "all" ? counts.food + counts.other : counts[v.key];
            return (
              <Link
                key={v.key}
                href={v.key === "food" ? "/admin/review" : `/admin/review?show=${v.key}`}
                aria-current={v.key === view.key ? "page" : undefined}
                className={`rounded-lg px-3 py-1 ${v.key === view.key ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}
              >
                {v.label} <span className="tabular-nums opacity-70">{count}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <ManualLeadForm />

      {candidates.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-6 py-12 text-center text-sm text-muted">
          Nothing to review here. Scrapers run nightly at 12:05am Pacific.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {candidates.map((candidate) => (
            <li key={candidate.id}>
              <CandidateCard candidate={candidate} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

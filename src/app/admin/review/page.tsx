import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { DealCandidate } from "@/lib/types";
import { logout } from "../actions";
import { CandidateCard } from "./candidate-card";
import { ManualLeadForm } from "./manual-lead-form";

export default function ReviewPage({ searchParams }: PageProps<"/admin/review">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading queue…</p>}>
      <ReviewQueue searchParams={searchParams} />
    </Suspense>
  );
}

async function ReviewQueue({ searchParams }: Pick<PageProps<"/admin/review">, "searchParams">) {
  await requireAdmin();
  const showAll = (await searchParams).show === "all";

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return <p className="text-sm text-muted">Connect Supabase (URL + service role key) to use the review queue.</p>;
  }

  let query = supabase
    .from("deal_candidates")
    .select("*")
    .eq("status", "pending")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (!showAll) query = query.eq("is_food", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const candidates = data as DealCandidate[];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-fg">Review queue</h1>
          <p className="text-sm text-muted">
            {candidates.length} pending {showAll ? "leads" : "food leads"}. Verify the terms yourself, then link the
            brand&apos;s own page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <nav aria-label="Queue filter" className="flex rounded-xl border border-line bg-surface p-1 text-sm">
            {[
              { href: "/admin/review", label: "Food", active: !showAll },
              { href: "/admin/review?show=all", label: "All", active: showAll },
            ].map((tab) => (
              <Link
                key={tab.label}
                href={tab.href}
                aria-current={tab.active ? "page" : undefined}
                className={`rounded-lg px-3 py-1 ${tab.active ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <form action={logout}>
            <button className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-white/5 hover:text-fg">Sign out</button>
          </form>
        </div>
      </div>

      <ManualLeadForm />

      {candidates.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-6 py-12 text-center text-sm text-muted">
          Queue is empty. The scraper runs nightly at 12:05am Pacific.
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

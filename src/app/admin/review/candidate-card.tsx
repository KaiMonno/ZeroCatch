import { ExternalLink } from "lucide-react";
import type { DealCandidate } from "@/lib/types";
import { approveCandidate, rejectCandidate } from "../actions";
import { DealForm } from "../deal-form";

function timeAgo(iso: string | null): string {
  if (!iso) return "unknown date";
  const hours = Math.round((Date.now() - Date.parse(iso)) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function CandidateCard({ candidate }: { candidate: DealCandidate }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="rounded-md bg-white/5 px-1.5 py-0.5 font-medium uppercase tracking-wide">{candidate.source}</span>
        <span>{timeAgo(candidate.published_at)}</span>
        {candidate.is_food && <span aria-label="Food">🍔</span>}
        {candidate.suggested_merchant && <span>· {candidate.suggested_merchant}</span>}
      </div>

      <h2 className="font-semibold leading-snug text-fg">
        <a
          href={candidate.source_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-start gap-1.5 hover:underline"
        >
          {candidate.title}
          <ExternalLink aria-label="(opens source post)" className="mt-1 size-3.5 shrink-0 text-muted" />
        </a>
      </h2>
      {candidate.summary && <p className="text-sm leading-relaxed text-muted">{candidate.summary}</p>}

      <div className="flex flex-wrap items-start gap-2">
        <details className="group w-full rounded-xl border border-line open:bg-bg/40">
          <summary className="cursor-pointer list-none rounded-xl px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-white/5 [&::-webkit-details-marker]:hidden">
            Verify &amp; publish…
          </summary>
          <div className="border-t border-line p-3">
            <DealForm
              action={approveCandidate}
              hidden={{ candidate_id: candidate.id }}
              idPrefix={candidate.id}
              submitLabel="Publish deal"
              defaults={{
                title: candidate.title,
                merchant: candidate.suggested_merchant ?? "",
                category: candidate.suggested_category ?? "pure_freebie",
              }}
            />
          </div>
        </details>

        <form action={rejectCandidate} className="flex w-full gap-2">
          <input type="hidden" name="candidate_id" value={candidate.id} />
          <label htmlFor={`note-${candidate.id}`} className="sr-only">
            Rejection note
          </label>
          <input
            id={`note-${candidate.id}`}
            name="note"
            placeholder="Why reject? (optional)"
            className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-fg placeholder:text-muted"
          />
          <button className="rounded-lg border border-line px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-500/10">
            Reject
          </button>
        </form>
      </div>
    </article>
  );
}

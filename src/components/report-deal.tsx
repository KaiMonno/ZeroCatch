"use client";

import { Flag } from "lucide-react";
import { useActionState } from "react";
import { reportDeal, type ReportState } from "@/app/actions";
import { REPORT_REASONS } from "@/lib/types";

/**
 * "Report a problem" safety net for auto-published deals. Sits above the
 * card's full-size link overlay (relative z-10) so it stays clickable.
 */
export function ReportDeal({ dealId, dealTitle }: { dealId: string; dealTitle: string }) {
  const [state, action, pending] = useActionState<ReportState, FormData>(reportDeal, {});

  if (state.ok) {
    return (
      <p role="status" className="relative z-10 text-xs text-muted">
        Thanks, we&apos;ll check it.
      </p>
    );
  }

  return (
    <details className="group/report relative z-10 text-xs">
      <summary
        aria-label={`Report a problem with ${dealTitle}`}
        className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
        <Flag aria-hidden className="size-3" />
        Report a problem
      </summary>
      <form action={action} className="mt-2 flex flex-col gap-2 rounded-xl border border-line bg-bg p-3">
        <input type="hidden" name="deal_id" value={dealId} />
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-fg">What&apos;s wrong with this deal?</legend>
          {Object.entries(REPORT_REASONS).map(([value, label]) => (
            <label key={value} className="inline-flex items-center gap-2 text-fg">
              <input type="radio" name="reason" value={value} required /> {label}
            </label>
          ))}
        </fieldset>
        <label className="sr-only" htmlFor={`report-note-${dealId}`}>
          Details (optional)
        </label>
        <input
          id={`report-note-${dealId}`}
          name="note"
          maxLength={500}
          placeholder="Details (optional)"
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-fg placeholder:text-muted"
        />
        {state.error && (
          <p role="alert" className="text-rose-300">
            {state.error}
          </p>
        )}
        <button
          disabled={pending}
          className="self-start rounded-lg border border-line px-3 py-1.5 font-medium text-fg hover:bg-white/5 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send report"}
        </button>
      </form>
    </details>
  );
}

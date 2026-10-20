"use client";

import { Check, CheckCircle2, Undo2 } from "lucide-react";
import { useTransition } from "react";
import { setClaimed } from "@/app/claim-actions";

/**
 * "Mark claimed" for a deal. Claimed deals drop out of the feed (and reappear
 * with "Show claimed"). Sits above the card's full-size link overlay. The deal
 * title is screen-reader-only text *after* the visible label, so the accessible
 * name starts with what's on screen (voice control: "click Mark claimed").
 */
export function ClaimButton({ dealId, dealTitle, claimed }: { dealId: string; dealTitle: string; claimed: boolean }) {
  const [pending, startTransition] = useTransition();
  const submit = (form: FormData) => startTransition(() => setClaimed(form));

  return (
    <form action={submit} className="relative z-10">
      <input type="hidden" name="deal_id" value={dealId} />
      <input type="hidden" name="claimed" value={claimed ? "false" : "true"} />
      {claimed ? (
        <button
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-60"
        >
          <CheckCircle2 aria-hidden className="size-3.5" />
          Claimed
          <span className="sr-only">: {dealTitle}. Undo</span>
          <Undo2 aria-hidden className="ml-1 size-3" />
        </button>
      ) : (
        <button
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs text-muted hover:border-line-strong hover:text-fg disabled:opacity-60"
        >
          <Check aria-hidden className="size-3.5" />
          {pending ? "Saving…" : "Mark claimed"}
          <span className="sr-only">: {dealTitle}</span>
        </button>
      )}
    </form>
  );
}

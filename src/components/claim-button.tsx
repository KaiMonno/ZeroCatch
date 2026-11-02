"use client";

import { Check, CheckCircle2, Undo2 } from "lucide-react";
import { useRef, useTransition } from "react";
import { setClaimed } from "@/app/claim-actions";

/**
 * "Mark claimed" for a deal. Claimed deals drop out of the feed (and reappear
 * with "Show claimed"). Sits above the card's full-size link overlay. The deal
 * title is screen-reader-only text *after* the visible label, so the accessible
 * name starts with what's on screen (voice control: "click Mark claimed").
 */
export function ClaimButton({ dealId, dealTitle, claimed }: { dealId: string; dealTitle: string; claimed: boolean }) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const submit = (form: FormData) =>
    startTransition(async () => {
      // Claiming drops the deal from the feed (unless claimed deals are shown): fold the card away while it saves.
      const leaves = !claimed && new URLSearchParams(location.search).get("claimed") !== "show";
      const card = leaves ? formRef.current?.closest<HTMLElement>("article, section") : null;
      card?.setAttribute("data-leaving", "");
      try {
        await setClaimed(form);
      } finally {
        // Normally the card is gone by now; if it's still here ("Show claimed", or the save failed), bring it back.
        setTimeout(() => card?.removeAttribute("data-leaving"), 400);
      }
    });

  return (
    <form ref={formRef} action={submit} className="relative z-10">
      <input type="hidden" name="deal_id" value={dealId} />
      <input type="hidden" name="claimed" value={claimed ? "false" : "true"} />
      {claimed ? (
        <button
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/25 active:scale-95 disabled:opacity-60"
        >
          <CheckCircle2 aria-hidden className="size-3.5 animate-pop" />
          Claimed
          <span className="sr-only">: {dealTitle}. Undo</span>
          <Undo2 aria-hidden className="ml-1 size-3" />
        </button>
      ) : (
        <button
          disabled={pending}
          className="group/mark inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs text-muted transition hover:border-line-strong hover:text-fg active:scale-95 disabled:opacity-60"
        >
          <Check aria-hidden className="size-3.5 transition-transform group-hover/mark:-rotate-12 group-hover/mark:scale-125" />
          {pending ? "Saving…" : "Mark claimed"}
          <span className="sr-only">: {dealTitle}</span>
        </button>
      )}
    </form>
  );
}

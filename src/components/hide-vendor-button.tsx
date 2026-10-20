"use client";

import { EyeOff } from "lucide-react";
import { useState, useTransition } from "react";
import { setVendorHidden } from "@/app/claim-actions";

/**
 * "Hide <vendor>" for a deal: asks once, then hides every deal from that
 * merchant. Undo from the "Hidden" chips above the feed or on /account. Sits
 * above the card's full-size link overlay (relative z-10).
 */
export function HideVendorButton({ merchant }: { merchant: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="relative z-10 inline-flex items-center gap-1 rounded text-xs text-muted hover:text-fg"
      >
        <EyeOff aria-hidden className="size-3" />
        Hide {merchant}
      </button>
    );
  }

  const hide = (form: FormData) => startTransition(() => setVendorHidden(form));
  return (
    <form action={hide} className="relative z-10 inline-flex flex-wrap items-center gap-2 text-xs">
      <input type="hidden" name="merchant" value={merchant} />
      <input type="hidden" name="hidden" value="true" />
      <span className="text-fg">Hide all {merchant} deals?</span>
      <button
        disabled={pending}
        autoFocus
        className="rounded-lg bg-white/10 px-2 py-1 font-medium text-fg hover:bg-white/15 disabled:opacity-60"
      >
        {pending ? "Hiding…" : "Hide"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="rounded-lg px-2 py-1 text-muted hover:text-fg">
        Cancel
      </button>
    </form>
  );
}

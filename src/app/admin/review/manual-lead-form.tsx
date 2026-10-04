"use client";

import { useActionState } from "react";
import { addManualLead, type ActionState } from "../actions";

const field =
  "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-emerald-400/60 focus:outline-none";

/** For deals spotted by hand (a brand's Instagram story, a friend's tip…). */
export function ManualLeadForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(addManualLead, {});
  return (
    <details className="rounded-2xl border border-line bg-surface/60">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
        + Add a lead by hand
      </summary>
      <form action={action} className="flex flex-col gap-2 border-t border-line p-4">
        <input name="title" required placeholder="What's the deal?" aria-label="Lead title" className={field} />
        <input name="source_url" type="url" required placeholder="Where did you see it?" aria-label="Source link" className={field} />
        <textarea name="summary" rows={2} placeholder="Notes (optional)" aria-label="Notes" className={field} />
        <label className="inline-flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" name="is_food" defaultChecked /> Food deal
        </label>
        {state.error && <p role="alert" className="text-sm text-rose-300">{state.error}</p>}
        {state.ok && <p className="text-sm text-emerald-300">Added to the queue.</p>}
        <button
          disabled={pending}
          className="self-start rounded-lg border border-line px-3 py-1.5 text-sm text-fg hover:bg-white/5 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add lead"}
        </button>
      </form>
    </details>
  );
}

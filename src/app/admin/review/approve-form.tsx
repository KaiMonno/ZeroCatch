"use client";

import { useActionState, useState } from "react";
import type { DealCandidate, DealCategory } from "@/lib/types";
import { approveCandidate, type ActionState } from "../actions";

const field =
  "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/30";

export function ApproveForm({ candidate }: { candidate: DealCandidate }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(approveCandidate, {});
  const [category, setCategory] = useState<DealCategory>(candidate.suggested_category ?? "pure_freebie");
  // datetime-local has no timezone; convert in the browser so the server gets
  // the instant the reviewer actually meant.
  const [expiresIso, setExpiresIso] = useState("");
  const id = (name: string) => `${name}-${candidate.id}`;

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="candidate_id" value={candidate.id} />
      <input type="hidden" name="expires_at" value={expiresIso} />

      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={id("title")} className="text-xs text-muted">Title</label>
        <input id={id("title")} name="title" defaultValue={candidate.title} required maxLength={200} className={field} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id("merchant")} className="text-xs text-muted">Merchant</label>
        <input id={id("merchant")} name="merchant" defaultValue={candidate.suggested_merchant ?? ""} required className={field} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id("category")} className="text-xs text-muted">Category</label>
        <select
          id={id("category")}
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as DealCategory)}
          className={field}
        >
          <option value="pure_freebie">Pure Freebie</option>
          <option value="free_trial">Instant-Cancel Trial</option>
          <option value="free_with_purchase">Free With Purchase</option>
        </select>
      </div>

      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={id("url")} className="text-xs text-muted">
          Brand&apos;s own link (not the blog post)
        </label>
        <input id={id("url")} name="url" type="url" required placeholder="https://www.brand.com/offer" className={field} />
      </div>

      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={id("description")} className="text-xs text-muted">Description (your words, with the exact terms)</label>
        <textarea id={id("description")} name="description" rows={2} className={field} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id("expires")} className="text-xs text-muted">Expires (your local time)</label>
        <input
          id={id("expires")}
          type="datetime-local"
          onChange={(e) => setExpiresIso(e.target.value ? new Date(e.target.value).toISOString() : "")}
          className={field}
        />
      </div>

      {category === "free_trial" && (
        <div className="flex flex-col gap-1">
          <label htmlFor={id("trial")} className="text-xs text-muted">Trial length (days)</label>
          <input id={id("trial")} name="trial_duration_days" type="number" min={1} required className={field} />
        </div>
      )}

      <fieldset className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-fg sm:col-span-2">
        <legend className="sr-only">Requirements</legend>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" name="requires_account" defaultChecked /> Account required
        </label>
        {category !== "pure_freebie" && (
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="requires_credit_card" /> Card required
          </label>
        )}
        {category === "free_trial" && (
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="instant_cancel_safe" /> Verified instant-cancel safe
          </label>
        )}
        {category === "pure_freebie" && (
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="is_hero_featured" /> Feature as hero
          </label>
        )}
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm text-rose-300 sm:col-span-2">
          {state.error}
        </p>
      )}

      <button
        disabled={pending}
        className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-300 disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
      >
        {pending ? "Publishing…" : "Publish deal"}
      </button>
    </form>
  );
}

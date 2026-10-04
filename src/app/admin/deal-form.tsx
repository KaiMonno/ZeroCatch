"use client";

import { useActionState, useState } from "react";
import type { DealCategory } from "@/lib/types";
import type { ActionState } from "./actions";

const field =
  "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/30";

export interface DealFormDefaults {
  title?: string;
  description?: string;
  merchant?: string;
  url?: string;
  category?: DealCategory;
  requires_account?: boolean;
  requires_credit_card?: boolean;
  instant_cancel_safe?: boolean;
  trial_duration_days?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  is_hero_featured?: boolean;
}

/** ISO instant → "YYYY-MM-DDTHH:mm" in the viewer's own timezone. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * datetime-local has no timezone. A hidden field carries the real instant, and
 * the visible input is filled client-side (ref callback) so server and browser
 * timezones can't cause a hydration mismatch.
 */
function LocalDateTimeField({ name, label, id, initialIso }: { name: string; label: string; id: string; initialIso?: string | null }) {
  const [iso, setIso] = useState(initialIso ?? "");
  return (
    <div className="flex flex-col gap-1">
      <input type="hidden" name={name} value={iso} />
      <label htmlFor={id} className="text-xs text-muted">{label}</label>
      <input
        id={id}
        type="datetime-local"
        ref={(el) => {
          if (el && !el.dataset.ready) {
            el.dataset.ready = "1";
            if (initialIso) el.value = toLocalInput(initialIso);
          }
        }}
        onChange={(e) => setIso(e.target.value ? new Date(e.target.value).toISOString() : "")}
        className={field}
      />
    </div>
  );
}

export function DealForm({
  action: serverAction,
  hidden,
  defaults = {},
  submitLabel,
  idPrefix,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  hidden: Record<string, string>;
  defaults?: DealFormDefaults;
  submitLabel: string;
  idPrefix: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(serverAction, {});
  const [category, setCategory] = useState<DealCategory>(defaults.category ?? "pure_freebie");
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={id("title")} className="text-xs text-muted">Title</label>
        <input id={id("title")} name="title" defaultValue={defaults.title} required maxLength={200} className={field} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id("merchant")} className="text-xs text-muted">Merchant</label>
        <input id={id("merchant")} name="merchant" defaultValue={defaults.merchant ?? ""} required className={field} />
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
          Brand&apos;s own link (not a blog post)
        </label>
        <input
          id={id("url")}
          name="url"
          type="url"
          required
          defaultValue={defaults.url}
          placeholder="https://www.brand.com/offer"
          className={field}
        />
      </div>

      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={id("description")} className="text-xs text-muted">Description (your words, with the exact terms)</label>
        <textarea id={id("description")} name="description" rows={2} defaultValue={defaults.description} className={field} />
      </div>

      <LocalDateTimeField name="starts_at" id={id("starts")} label="Starts (your local time, blank = now)" initialIso={defaults.starts_at} />
      <LocalDateTimeField name="expires_at" id={id("expires")} label="Expires (your local time, blank = no end)" initialIso={defaults.expires_at} />

      {category === "free_trial" && (
        <div className="flex flex-col gap-1">
          <label htmlFor={id("trial")} className="text-xs text-muted">Trial length (days)</label>
          <input
            id={id("trial")}
            name="trial_duration_days"
            type="number"
            min={1}
            required
            defaultValue={defaults.trial_duration_days ?? undefined}
            className={field}
          />
        </div>
      )}

      <fieldset className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-fg sm:col-span-2">
        <legend className="sr-only">Requirements</legend>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" name="requires_account" defaultChecked={defaults.requires_account ?? true} /> Account
          required
        </label>
        {category !== "pure_freebie" && (
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="requires_credit_card" defaultChecked={defaults.requires_credit_card} /> Card
            required
          </label>
        )}
        {category === "free_trial" && (
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="instant_cancel_safe" defaultChecked={defaults.instant_cancel_safe} /> Verified
            instant-cancel safe
          </label>
        )}
        {category === "pure_freebie" && (
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="is_hero_featured" defaultChecked={defaults.is_hero_featured} /> Feature as hero
          </label>
        )}
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm text-rose-300 sm:col-span-2">
          {state.error}
        </p>
      )}
      {state.ok && <p className="text-sm text-emerald-300 sm:col-span-2">Saved. It&apos;s live on the site.</p>}

      <button
        disabled={pending}
        className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-300 disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

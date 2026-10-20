"use client";

import { Bell } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { saveAlertSettings, type AlertFormState } from "@/app/alert-actions";

const TOPICS: Record<string, string> = {
  games: "Games (Epic, Steam, GOG, itch.io)",
  food: "Food & drink",
  trials: "Instant-cancel trials",
  other: "Other freebies",
};

export function AlertSettingsForm({
  email,
  initial,
}: {
  email: string;
  initial: { active: boolean; topics: string[]; frequency: "daily" | "weekly" } | null;
}) {
  const [state, action, pending] = useActionState<AlertFormState, FormData>(saveAlertSettings, {});
  // Submitted via onSubmit (not the form's `action` prop) so React 19 doesn't
  // auto-reset the form afterwards. A reset would desync these controlled
  // inputs and wipe the user's choices whenever a save returned an error.
  const start = initial ?? { active: false, topics: Object.keys(TOPICS), frequency: "daily" as const };
  const [active, setActive] = useState(start.active);
  const [topics, setTopics] = useState<string[]>(start.topics);
  const [frequency, setFrequency] = useState(start.frequency);
  const toggleTopic = (topic: string, on: boolean) =>
    setTopics((current) => (on ? [...current, topic] : current.filter((t) => t !== topic)));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5"
    >
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="active"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="mt-1 size-4 accent-emerald-400"
        />
        <span>
          <span className="flex items-center gap-1.5 font-medium text-fg">
            <Bell aria-hidden className="size-4" /> Email me new deals
          </span>
          <span className="text-sm text-muted">Sent to {email}. Only deals that pass every rule, never ones you&apos;ve claimed or from vendors you&apos;ve hidden.</span>
        </span>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-fg">Topics</legend>
        {Object.entries(TOPICS).map(([value, label]) => (
          <label key={value} className="inline-flex items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              name="topics"
              value={value}
              checked={topics.includes(value)}
              onChange={(e) => toggleTopic(value, e.target.checked)}
              className="accent-emerald-400"
            />
            {label}
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
        <legend className="mb-1 text-sm font-medium text-fg">How often</legend>
        <label className="inline-flex items-center gap-2 text-sm text-fg">
          <input
            type="radio"
            name="frequency"
            value="daily"
            checked={frequency === "daily"}
            onChange={() => setFrequency("daily")}
            className="accent-emerald-400"
          />
          Daily, only when something new matches
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-fg">
          <input
            type="radio"
            name="frequency"
            value="weekly"
            checked={frequency === "weekly"}
            onChange={() => setFrequency("weekly")}
            className="accent-emerald-400"
          />
          Weekly, on Mondays
        </label>
      </fieldset>

      {state.error && <p role="alert" className="text-sm text-rose-300">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-emerald-300">Saved.</p>}
      <button
        disabled={pending}
        className="self-start rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-300 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save alert settings"}
      </button>
    </form>
  );
}

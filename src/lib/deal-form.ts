import "server-only";

import type { DealCategory } from "./types";

const CATEGORIES: DealCategory[] = ["pure_freebie", "free_trial", "free_with_purchase"];

// Postgres constraint name → reviewer-friendly message.
const CONSTRAINT_MESSAGES: Record<string, string> = {
  pure_freebie_no_card: "Pure Freebies can't require a credit card. Uncheck it or change the category.",
  trial_has_duration: "Free trials need a duration in days.",
  expires_after_start: "The expiry date must be after the start date.",
  deals_url_check: "The deal link must start with https://",
};

export function friendlyDbError(message: string): string {
  return Object.entries(CONSTRAINT_MESSAGES).find(([name]) => message.includes(name))?.[1] ?? message;
}

export interface DealFields {
  title: string;
  description: string;
  category: DealCategory;
  merchant: string;
  url: string;
  requires_account: boolean;
  requires_credit_card: boolean;
  instant_cancel_safe: boolean;
  trial_duration_days: number | null;
  expires_at: string | null;
  is_hero_featured: boolean;
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** Validate the shared deal form used by approve and edit. */
export function parseDealForm(form: FormData): { deal: DealFields } | { error: string } {
  const category = text(form, "category") as DealCategory;
  const url = text(form, "url");
  const trialDays = Number(text(form, "trial_duration_days"));
  const expiresAt = text(form, "expires_at");

  if (!text(form, "title")) return { error: "Title is required." };
  if (!text(form, "merchant")) return { error: "Merchant is required." };
  if (!CATEGORIES.includes(category)) return { error: "Pick a category." };
  if (!URL.canParse(url) || !url.startsWith("https://"))
    return { error: "Link to the brand's own page, starting with https://" };
  if (category === "free_trial" && !(Number.isInteger(trialDays) && trialDays > 0))
    return { error: "Free trials need a whole number of days." };
  if (expiresAt && Number.isNaN(Date.parse(expiresAt))) return { error: "Invalid expiry date." };

  return {
    deal: {
      title: text(form, "title").slice(0, 200),
      description: text(form, "description"),
      category,
      merchant: text(form, "merchant"),
      url,
      requires_account: form.has("requires_account"),
      // The form hides these for categories where they don't apply.
      requires_credit_card: category !== "pure_freebie" && form.has("requires_credit_card"),
      instant_cancel_safe: category === "free_trial" && form.has("instant_cancel_safe"),
      trial_duration_days: category === "free_trial" ? trialDays : null,
      expires_at: expiresAt || null,
      is_hero_featured: category === "pure_freebie" && form.has("is_hero_featured"),
    },
  };
}

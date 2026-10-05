// "free_with_purchase" still exists in the database enum but is retired: the
// site only lists true freebies and instant-cancel trials.
export type DealCategory = "pure_freebie" | "free_trial";

/** Mirrors a row in `public.deals` / `public.active_deals`. */
export interface Deal {
  id: string;
  title: string;
  description: string;
  category: DealCategory;
  merchant: string;
  url: string;
  requires_account: boolean;
  requires_credit_card: boolean;
  instant_cancel_safe: boolean;
  trial_duration_days: number | null;
  starts_at: string;
  expires_at: string | null;
  is_hero_featured: boolean;
  created_at: string;
  source_key: string | null;
  hidden_at?: string | null;
}

/** Shape accepted when inserting/upserting (DB fills the defaults). */
export type DealInsert = Omit<Deal, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

/** Mirrors a row in `public.deal_candidates` (the review queue). */
export interface DealCandidate {
  id: string;
  source: string;
  source_key: string;
  title: string;
  summary: string;
  source_url: string;
  source_categories: string[];
  published_at: string | null;
  is_food: boolean;
  suggested_category: DealCategory | null;
  suggested_merchant: string | null;
  suggested_url: string | null;
  suggested_starts_at: string | null;
  suggested_expires_at: string | null;
  ai_verdict: AiVerdict | null;
  ai_judged_at: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

/** The AI judge's structured verdict on a lead (see scrapers/judge.py). */
export interface AiVerdict {
  qualifies: boolean;
  rejection_reason: string;
  confidence: "high" | "medium" | "low";
  category: DealCategory;
  merchant: string;
  title: string;
  description: string;
  requires_account: boolean;
  requires_credit_card: boolean;
  brand_url: string | null;
  /** "publish", or the reason it was not published (e.g. "ai: contest"). */
  decision: string;
}

export const REPORT_REASONS = {
  expired: "Deal has ended",
  broken_link: "Link is broken",
  has_catch: "There's a catch (card, purchase, membership…)",
  other: "Something else",
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;

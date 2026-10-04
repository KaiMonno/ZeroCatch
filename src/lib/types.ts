export type DealCategory = "pure_freebie" | "free_trial" | "free_with_purchase";

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
}

/** Shape accepted when inserting/upserting (DB fills the defaults). */
export type DealInsert = Omit<Deal, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

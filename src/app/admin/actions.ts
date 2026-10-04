"use server";

import { randomUUID } from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { endSession, passwordMatches, requireAdmin, startSession } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { DealCategory } from "@/lib/types";

export interface ActionState {
  error?: string;
  ok?: boolean;
}

const CATEGORIES: DealCategory[] = ["pure_freebie", "free_trial", "free_with_purchase"];

// Postgres constraint name → reviewer-friendly message.
const CONSTRAINT_MESSAGES: Record<string, string> = {
  pure_freebie_no_card: "Pure Freebies can't require a credit card. Uncheck it or change the category.",
  trial_has_duration: "Free trials need a duration in days.",
  expires_after_start: "The expiry date must be in the future.",
  deals_url_check: "The deal link must start with https://",
};

function admin() {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase service role is not configured");
  return supabase;
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

// ── Auth ────────────────────────────────────────────────────────────────

export async function login(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!passwordMatches(text(form, "password"))) {
    // Slow down guessing. Real rate limiting arrives with Phase 3 auth.
    await new Promise((resolve) => setTimeout(resolve, 750));
    return { error: "Wrong password." };
  }
  await startSession();
  redirect("/admin/review");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/admin/login");
}

// ── Review queue ────────────────────────────────────────────────────────

export async function approveCandidate(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();

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

  const deal = {
    title: text(form, "title").slice(0, 200),
    description: text(form, "description"),
    category,
    merchant: text(form, "merchant"),
    url,
    requires_account: form.has("requires_account"),
    requires_credit_card: form.has("requires_credit_card"),
    instant_cancel_safe: form.has("instant_cancel_safe"),
    trial_duration_days: category === "free_trial" ? trialDays : null,
    expires_at: expiresAt || null,
    is_hero_featured: form.has("is_hero_featured"),
  };

  const { error } = await admin().rpc("approve_candidate", {
    p_candidate_id: text(form, "candidate_id"),
    p_deal: deal,
  });
  if (error) {
    const known = Object.entries(CONSTRAINT_MESSAGES).find(([name]) => error.message.includes(name));
    return { error: known?.[1] ?? error.message };
  }

  updateTag("deals"); // publish immediately instead of waiting out the cache
  refresh();
  return { ok: true };
}

export async function rejectCandidate(form: FormData): Promise<void> {
  await requireAdmin();
  const { error } = await admin()
    .from("deal_candidates")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), review_note: text(form, "note") || null })
    .eq("id", text(form, "candidate_id"))
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  refresh();
}

export async function addManualLead(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const sourceUrl = text(form, "source_url");
  const title = text(form, "title");
  if (!title) return { error: "Give the lead a title." };
  if (!URL.canParse(sourceUrl)) return { error: "Enter a valid link." };

  const { error } = await admin().from("deal_candidates").insert({
    source: "manual",
    source_key: `manual:${randomUUID()}`,
    title: title.slice(0, 200),
    summary: text(form, "summary"),
    source_url: sourceUrl,
    published_at: new Date().toISOString(),
    is_food: form.has("is_food"),
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

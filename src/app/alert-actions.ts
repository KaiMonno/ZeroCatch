"use server";

import { refresh } from "next/cache";
import { verifyUnsubscribeToken } from "@/lib/alert-token";
import { ALERT_TOPICS, deactivateAlerts, type AlertTopic } from "@/lib/alerts";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export interface AlertFormState {
  ok?: boolean;
  error?: string;
}

/** Save the signed-in user's alert settings. Email comes from their account (DB trigger). */
export async function saveAlertSettings(_prev: AlertFormState, form: FormData): Promise<AlertFormState> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Please sign in again." };

  const active = form.get("active") === "on";
  const topics = form.getAll("topics").map(String).filter((t): t is AlertTopic => t in ALERT_TOPICS);
  const frequency = form.get("frequency") === "weekly" ? "weekly" : "daily";
  if (active && topics.length === 0) return { error: "Pick at least one topic, or turn alerts off." };
  const settings = { topics: topics.length ? topics : (Object.keys(ALERT_TOPICS) as AlertTopic[]), frequency, active };

  // Not an upsert: users may only write these three columns (see the migration).
  const { data: existing } = await supabase.from("alert_subscriptions").select("user_id").maybeSingle();
  const { error } = existing
    ? await supabase.from("alert_subscriptions").update(settings).eq("user_id", userId)
    : await supabase.from("alert_subscriptions").insert({ user_id: userId, ...settings });
  if (error) return { error: "Couldn't save your alert settings. Please try again." };
  refresh();
  return { ok: true };
}

/** Confirmed unsubscribe from the /unsubscribe page (no sign-in needed). */
export async function unsubscribeWithToken(_prev: AlertFormState, form: FormData): Promise<AlertFormState> {
  const userId = verifyUnsubscribeToken(String(form.get("token") ?? ""));
  if (!userId) return { error: "This unsubscribe link is invalid or incomplete." };
  return (await deactivateAlerts(userId)) ? { ok: true } : { error: "Something went wrong. Please try again." };
}

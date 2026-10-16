import "server-only";

import { getSupabaseAdmin } from "./supabase-admin";
import { createSupabaseServerClient } from "./supabase-server";

export const ALERT_TOPICS = {
  games: "Games (Epic, Steam, GOG, itch.io)",
  food: "Food & drink",
  trials: "Instant-cancel trials",
  other: "Other freebies",
} as const;
export type AlertTopic = keyof typeof ALERT_TOPICS;

export interface AlertSettings {
  active: boolean;
  topics: AlertTopic[];
  frequency: "daily" | "weekly";
  email: string;
}

/** The signed-in user's alert settings, or null if they never subscribed. */
export async function getAlertSettings(): Promise<AlertSettings | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("alert_subscriptions").select("active, topics, frequency, email").maybeSingle();
  return (data as AlertSettings | null) ?? null;
}

/** Token-based unsubscribe (no session): service role, active = false. */
export async function deactivateAlerts(userId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin) return false;
  const { error } = await admin.from("alert_subscriptions").update({ active: false }).eq("user_id", userId);
  return !error;
}

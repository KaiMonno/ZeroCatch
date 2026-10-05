"use server";

import { createHash } from "node:crypto";
import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { REPORT_REASONS, type ReportReason } from "@/lib/types";

export interface ReportState {
  ok?: boolean;
  error?: string;
}

const MAX_REPORTS_PER_HOUR = 5;
/** Distinct reporters within a week that hide a deal until an admin reviews it. */
const HIDE_THRESHOLD = 3;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Salted hash: lets us rate-limit and count distinct reporters without storing IPs. */
async function reporterHash(): Promise<string> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const salt = process.env.REPORT_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export async function reportDeal(_prev: ReportState, form: FormData): Promise<ReportState> {
  const dealId = String(form.get("deal_id") ?? "");
  const reason = String(form.get("reason") ?? "") as ReportReason;
  const note = String(form.get("note") ?? "").trim().slice(0, 500);
  if (!(reason in REPORT_REASONS)) return { error: "Pick what's wrong." };

  const supabase = getSupabaseAdmin();
  // Sample-data mode (no database) has nothing to report against.
  if (!supabase || !UUID_RE.test(dealId)) return { ok: true };

  const hash = await reporterHash();
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await supabase
    .from("deal_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_hash", hash)
    .gte("created_at", hourAgo);
  if ((count ?? 0) >= MAX_REPORTS_PER_HOUR) return { error: "Thanks! You've sent several reports already; we'll take a look." };

  const { error } = await supabase
    .from("deal_reports")
    .insert({ deal_id: dealId, reason, note: note || null, reporter_hash: hash });
  if (error) return { error: "Couldn't send that report. Please try again." };

  // Enough independent reports hide the deal until an admin reviews it.
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: recent } = await supabase
    .from("deal_reports")
    .select("reporter_hash")
    .eq("deal_id", dealId)
    .gte("created_at", weekAgo);
  if (new Set((recent ?? []).map((r) => r.reporter_hash)).size >= HIDE_THRESHOLD) {
    await supabase.from("deals").update({ hidden_at: new Date().toISOString() }).eq("id", dealId).is("hidden_at", null);
    updateTag("deals");
  }
  return { ok: true };
}

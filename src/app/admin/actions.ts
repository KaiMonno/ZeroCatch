"use server";

import { randomUUID } from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { endSession, passwordMatches, requireAdmin, startSession } from "@/lib/admin-session";
import { friendlyDbError, parseDealForm } from "@/lib/deal-form";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export interface ActionState {
  error?: string;
  ok?: boolean;
}

const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60_000;

function admin() {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase service role is not configured");
  return supabase;
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** Publish changes to the public feed now instead of waiting out the cache. */
function publish() {
  updateTag("deals");
  refresh();
}

// ── Auth ────────────────────────────────────────────────────────────────

async function clientIp(): Promise<string> {
  // Vercel overwrites x-forwarded-for with the real client IP, so it can't be spoofed there.
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function login(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ip = await clientIp();
  const supabase = getSupabaseAdmin();

  // Fail open if the limiter table is unreachable: the password still guards the door.
  if (supabase) {
    const { count, error } = await supabase
      .from("admin_login_failures")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("attempted_at", new Date(Date.now() - LOCKOUT_MS).toISOString());
    if (error) console.error("login limiter unavailable:", error.message);
    else if ((count ?? 0) >= MAX_FAILURES)
      return { error: "Too many failed attempts. Try again in 15 minutes." };
  }

  if (!passwordMatches(text(form, "password"))) {
    const { error } = (await supabase?.from("admin_login_failures").insert({ ip })) ?? {};
    if (error) console.error("login limiter write failed:", error.message);
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
  const parsed = parseDealForm(form);
  if ("error" in parsed) return parsed;

  const { error } = await admin().rpc("approve_candidate", {
    p_candidate_id: text(form, "candidate_id"),
    p_deal: parsed.deal,
  });
  if (error) return { error: friendlyDbError(error.message) };
  publish();
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

// ── Published deals ─────────────────────────────────────────────────────

export async function updateDeal(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseDealForm(form);
  if ("error" in parsed) return parsed;

  const { error } = await admin().from("deals").update(parsed.deal).eq("id", text(form, "deal_id"));
  if (error) return { error: friendlyDbError(error.message) };
  publish();
  return { ok: true };
}

export async function deleteDeal(form: FormData): Promise<void> {
  await requireAdmin();
  const { error } = await admin().from("deals").delete().eq("id", text(form, "deal_id"));
  if (error) throw new Error(error.message);
  publish();
}

export async function unhideDeal(form: FormData): Promise<void> {
  await requireAdmin();
  const dealId = text(form, "deal_id");
  // Clearing the reports too means it takes fresh reports to hide it again.
  const supabase = admin();
  const { error } = await supabase.from("deals").update({ hidden_at: null }).eq("id", dealId);
  if (error) throw new Error(error.message);
  await supabase.from("deal_reports").delete().eq("deal_id", dealId);
  publish();
}

export async function dismissReports(form: FormData): Promise<void> {
  await requireAdmin();
  const { error } = await admin().from("deal_reports").delete().eq("deal_id", text(form, "deal_id"));
  if (error) throw new Error(error.message);
  refresh();
}

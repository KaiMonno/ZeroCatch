"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { mergeGuestData } from "@/lib/guest-merge";
import { safeNextPath } from "@/lib/safe-next";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { saltedHash, visitorHash } from "@/lib/visitor-hash";

/** Server Actions are POSTs, so the browser always sends Origin. */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

export async function signInWithGoogle(form: FormData): Promise<void> {
  const next = safeNextPath(String(form.get("next") ?? "/"));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await requestOrigin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=provider");
  redirect(data.url);
}

// ── Email sign-in: one email carries both a link and a 6-digit code ─────────

export interface EmailSignInState {
  sentTo?: string;
  /** The address typed, kept on errors so the form doesn't make you retype it. */
  email?: string;
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/**
 * Resend's free tier (100 emails/day) is shared with the nightly deal alerts,
 * so sign-in emails are capped per visitor, per address and site-wide.
 */
const LIMITS = { perVisitorPerHour: 5, perAddressPerHour: 3, sitePerDay: 40 };

/** Records the request and returns an error message if it's over a limit. */
async function overSignInLimit(email: string): Promise<string | null> {
  const db = getSupabaseAdmin();
  if (!db) return null; // no service key (local sample mode): nothing to count against
  const ipHash = await visitorHash();
  const emailHash = saltedHash(`sign-in:${email}`);
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const count = async (column: string | null, value: string, since: string) => {
    let query = db.from("sign_in_email_requests").select("id", { count: "exact", head: true }).gte("requested_at", since);
    if (column) query = query.eq(column, value);
    const { count: n, error } = await query;
    if (error) throw new Error(`sign-in limits: ${error.message}`);
    return n ?? 0;
  };
  const [visitor, address, site] = await Promise.all([
    count("ip_hash", ipHash, hourAgo),
    count("email_hash", emailHash, hourAgo),
    count(null, "", dayAgo),
  ]);
  if (site >= LIMITS.sitePerDay) return "Email sign-in is busy right now. Please use Google, or try again tomorrow.";
  if (visitor >= LIMITS.perVisitorPerHour || address >= LIMITS.perAddressPerHour)
    return "That's a lot of sign-in emails. Check your inbox (and spam), or try again in an hour.";
  await db.from("sign_in_email_requests").insert({ ip_hash: ipHash, email_hash: emailHash });
  return null;
}

export async function requestEmailSignIn(_prev: EmailSignInState, form: FormData): Promise<EmailSignInState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const next = safeNextPath(String(form.get("next") ?? "/"));
  if (email.length > 254 || !EMAIL_RE.test(email)) return { email, error: "Enter a valid email address." };

  const limited = await overSignInLimit(email);
  if (limited) return { email, error: limited };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    // The email template builds its link from this (see supabase/templates/).
    options: { shouldCreateUser: true, emailRedirectTo: `${await requestOrigin()}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    if (error.status === 429) return { email, error: "Please wait a minute before asking for another email." };
    console.error("signInWithOtp:", error.message);
    return { email, error: "Couldn't send the email. Please try again, or use Google." };
  }
  // Same answer for new and existing addresses, so the form can't reveal who has an account.
  return { sentTo: email };
}

/** After any successful sign-in: bring guest data along, then go where the visitor was headed. */
async function finishSignIn(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, next: string) {
  const store = await cookies();
  const merged = await mergeGuestData(supabase, userId, (name) => store.get(name)?.value);
  for (const name of merged) store.delete(name);
  redirect(next);
}

export interface CodeState {
  error?: string;
}

export async function verifyEmailCode(_prev: CodeState, form: FormData): Promise<CodeState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  const next = safeNextPath(String(form.get("next") ?? "/"));
  if (!/^\d{6,10}$/.test(code)) return { error: "Enter the code from the email (numbers only)." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error || !data.user) return { error: "That code is wrong or has expired. Check the latest email, or send a new one." };
  await finishSignIn(supabase, data.user.id, next);
  return {};
}

const LINK_TYPES: EmailOtpType[] = ["email", "magiclink", "signup"];

/** The "Continue" button on /auth/confirm. A POST, so link scanners can't use up the link. */
export async function confirmEmailLink(form: FormData): Promise<void> {
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = String(form.get("type") ?? "email") as EmailOtpType;
  const next = safeNextPath(String(form.get("next") ?? "/"));
  if (!tokenHash || !LINK_TYPES.includes(type)) redirect("/login?error=link");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error || !data.user) redirect("/login?error=link");
  await finishSignIn(supabase, data.user.id, next);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

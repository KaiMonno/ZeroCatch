"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import {
  GUEST_CLAIMS_COOKIE,
  GUEST_CLAIMS_MAX,
  GUEST_HIDDEN_COOKIE,
  HIDDEN_VENDORS_MAX,
  VENDOR_MAX_LENGTH,
  parseGuestClaims,
  parseHiddenVendors,
  serializeHiddenVendors,
} from "@/lib/claims";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/supabase-server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GUEST_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
} as const;

async function signedInUser() {
  if (!isAuthConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  return userId ? { supabase, userId } : null;
}

/** Mark a deal claimed (or unclaimed). Signed in: saved to the account. Guest: saved in a cookie. */
export async function setClaimed(form: FormData): Promise<void> {
  const dealId = String(form.get("deal_id") ?? "");
  const claimed = form.get("claimed") === "true";
  if (!UUID_RE.test(dealId)) return; // sample-data ids and junk

  const session = await signedInUser();
  if (session) {
    const { supabase, userId } = session;
    const table = supabase.from("deal_claims");
    const { error } = claimed
      ? await table.upsert({ user_id: userId, deal_id: dealId }, { onConflict: "user_id,deal_id", ignoreDuplicates: true })
      : await table.delete().eq("user_id", userId).eq("deal_id", dealId);
    if (error) throw new Error(error.message);
    refresh();
    return;
  }

  const store = await cookies();
  const current = parseGuestClaims(store.get(GUEST_CLAIMS_COOKIE)?.value).filter((id) => id !== dealId);
  const next = (claimed ? [...current, dealId] : current).slice(-GUEST_CLAIMS_MAX);
  store.set(GUEST_CLAIMS_COOKIE, next.join(","), GUEST_COOKIE_OPTIONS);
  refresh();
}

/** Hide (or unhide) every deal from one vendor. Signed in: saved to the account. Guest: saved in a cookie. */
export async function setVendorHidden(form: FormData): Promise<void> {
  const merchant = String(form.get("merchant") ?? "").trim();
  const hidden = form.get("hidden") === "true";
  if (!merchant || merchant.length > VENDOR_MAX_LENGTH) return;

  const session = await signedInUser();
  if (session) {
    const { supabase, userId } = session;
    const table = supabase.from("hidden_vendors");
    if (hidden) {
      const { count } = await table.select("merchant", { count: "exact", head: true });
      if ((count ?? 0) >= HIDDEN_VENDORS_MAX) return; // same cap as guests; unhide one first
    }
    const { error } = hidden
      ? await table.upsert({ user_id: userId, merchant }, { onConflict: "user_id,merchant", ignoreDuplicates: true })
      : await table.delete().eq("user_id", userId).eq("merchant", merchant);
    if (error) throw new Error(error.message);
    refresh();
    return;
  }

  const store = await cookies();
  const current = parseHiddenVendors(store.get(GUEST_HIDDEN_COOKIE)?.value).filter((m) => m !== merchant);
  if (hidden && current.length >= HIDDEN_VENDORS_MAX) return;
  const next = hidden ? [...current, merchant] : current;
  store.set(GUEST_HIDDEN_COOKIE, serializeHiddenVendors(next), GUEST_COOKIE_OPTIONS);
  refresh();
}

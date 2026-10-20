import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GUEST_CLAIMS_COOKIE,
  GUEST_HIDDEN_COOKIE,
  HIDDEN_VENDORS_MAX,
  parseGuestClaims,
  parseHiddenVendors,
} from "./claims";

/**
 * Folds what a visitor did as a guest (claims and hidden vendors, kept in
 * cookies) into the account they just signed in to. Used by every sign-in
 * path. Returns the guest cookies the caller should now clear.
 */
export async function mergeGuestData(
  supabase: SupabaseClient,
  userId: string,
  readCookie: (name: string) => string | undefined,
): Promise<string[]> {
  const merged: string[] = [];

  const guestClaims = parseGuestClaims(readCookie(GUEST_CLAIMS_COOKIE));
  if (guestClaims.length) {
    // Keep only deals that still exist (long-expired ones get deleted), so one
    // stale id can't fail the whole merge on the foreign key.
    const { data: existing } = await supabase.from("deals").select("id").in("id", guestClaims);
    const rows = (existing ?? []).map(({ id }) => ({ user_id: userId, deal_id: id as string }));
    if (rows.length) {
      const { error } = await supabase
        .from("deal_claims")
        .upsert(rows, { onConflict: "user_id,deal_id", ignoreDuplicates: true });
      if (error) console.error("guest claim merge:", error.message);
    }
    merged.push(GUEST_CLAIMS_COOKIE);
  }

  const guestHidden = parseHiddenVendors(readCookie(GUEST_HIDDEN_COOKIE));
  if (guestHidden.length) {
    const { data: existing } = await supabase.from("hidden_vendors").select("merchant");
    const have = new Set((existing ?? []).map((r) => r.merchant as string));
    const rows = guestHidden
      .filter((m) => !have.has(m))
      .slice(0, Math.max(0, HIDDEN_VENDORS_MAX - have.size))
      .map((merchant) => ({ user_id: userId, merchant }));
    if (rows.length) {
      const { error } = await supabase
        .from("hidden_vendors")
        .upsert(rows, { onConflict: "user_id,merchant", ignoreDuplicates: true });
      if (error) console.error("guest hidden-vendor merge:", error.message);
    }
    merged.push(GUEST_HIDDEN_COOKIE);
  }

  return merged;
}

import { NextResponse, type NextRequest } from "next/server";
import {
  GUEST_CLAIMS_COOKIE,
  GUEST_HIDDEN_COOKIE,
  HIDDEN_VENDORS_MAX,
  parseGuestClaims,
  parseHiddenVendors,
} from "@/lib/claims";
import { safeNextPath } from "@/lib/safe-next";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Google sends the visitor back here with a one-time code. Exchange it for a
 * session, then fold any claims and hidden vendors from guest browsing into the account.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code) return NextResponse.redirect(new URL("/login?error=cancelled", origin));

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/login?error=exchange", origin));

  const guestClaims = parseGuestClaims(request.cookies.get(GUEST_CLAIMS_COOKIE)?.value);
  const response = NextResponse.redirect(new URL(next, origin));
  if (guestClaims.length) {
    // Keep only deals that still exist (long-expired ones get deleted), so one
    // stale id can't fail the whole merge on the foreign key.
    const { data: existing } = await supabase.from("deals").select("id").in("id", guestClaims);
    const rows = (existing ?? []).map(({ id }) => ({ user_id: data.user.id, deal_id: id as string }));
    if (rows.length) {
      const { error: mergeError } = await supabase
        .from("deal_claims")
        .upsert(rows, { onConflict: "user_id,deal_id", ignoreDuplicates: true });
      if (mergeError) console.error("guest claim merge:", mergeError.message);
    }
    response.cookies.delete(GUEST_CLAIMS_COOKIE);
  }

  const guestHidden = parseHiddenVendors(request.cookies.get(GUEST_HIDDEN_COOKIE)?.value);
  if (guestHidden.length) {
    const { data: existing } = await supabase.from("hidden_vendors").select("merchant");
    const have = new Set((existing ?? []).map((r) => r.merchant as string));
    const rows = guestHidden
      .filter((m) => !have.has(m))
      .slice(0, Math.max(0, HIDDEN_VENDORS_MAX - have.size))
      .map((merchant) => ({ user_id: data.user.id, merchant }));
    if (rows.length) {
      const { error: mergeError } = await supabase
        .from("hidden_vendors")
        .upsert(rows, { onConflict: "user_id,merchant", ignoreDuplicates: true });
      if (mergeError) console.error("guest hidden-vendor merge:", mergeError.message);
    }
    response.cookies.delete(GUEST_HIDDEN_COOKIE);
  }
  return response;
}

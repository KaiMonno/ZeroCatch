"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { GUEST_CLAIMS_COOKIE, GUEST_CLAIMS_MAX, parseGuestClaims } from "@/lib/claims";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/supabase-server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mark a deal claimed (or unclaimed). Signed in: saved to the account. Guest: saved in a cookie. */
export async function setClaimed(form: FormData): Promise<void> {
  const dealId = String(form.get("deal_id") ?? "");
  const claimed = form.get("claimed") === "true";
  if (!UUID_RE.test(dealId)) return; // sample-data ids and junk

  if (isAuthConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (userId) {
      const table = supabase.from("deal_claims");
      const { error } = claimed
        ? await table.upsert({ user_id: userId, deal_id: dealId }, { onConflict: "user_id,deal_id", ignoreDuplicates: true })
        : await table.delete().eq("user_id", userId).eq("deal_id", dealId);
      if (error) throw new Error(error.message);
      refresh();
      return;
    }
  }

  const store = await cookies();
  const current = parseGuestClaims(store.get(GUEST_CLAIMS_COOKIE)?.value).filter((id) => id !== dealId);
  const next = (claimed ? [...current, dealId] : current).slice(-GUEST_CLAIMS_MAX);
  store.set(GUEST_CLAIMS_COOKIE, next.join(","), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  refresh();
}

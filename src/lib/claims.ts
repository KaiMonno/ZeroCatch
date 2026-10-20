import "server-only";

import { cookies } from "next/headers";
import { createSupabaseServerClient, isAuthConfigured } from "./supabase-server";

/** Guests' claims live in this cookie until they sign in (then they're merged). */
export const GUEST_CLAIMS_COOKIE = "zc_claims";
export const GUEST_CLAIMS_MAX = 80; // 80 UUIDs ≈ 3 KB, under the 4 KB cookie limit
/** Same idea for vendors a visitor never wants to see (a deal's merchant). */
export const GUEST_HIDDEN_COOKIE = "zc_hidden_vendors";
export const HIDDEN_VENDORS_MAX = 25; // 25 names ≈ 2 KB worst case
export const VENDOR_MAX_LENGTH = 80; // matches the hidden_vendors check constraint
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Viewer {
  user: { id: string; email: string | null; name: string | null; avatarUrl: string | null } | null;
  claimed: Set<string>;
  hiddenVendors: Set<string>;
}

export function parseGuestClaims(raw: string | undefined): string[] {
  return (raw ?? "").split(",").filter((id) => UUID_RE.test(id)).slice(-GUEST_CLAIMS_MAX);
}

export async function readGuestClaims(): Promise<string[]> {
  return parseGuestClaims((await cookies()).get(GUEST_CLAIMS_COOKIE)?.value);
}

/** Vendor names can contain commas, so each one is URI-encoded in the list. */
export function parseHiddenVendors(raw: string | undefined): string[] {
  const names = (raw ?? "").split(",").flatMap((part) => {
    try {
      const name = decodeURIComponent(part).trim();
      return name && name.length <= VENDOR_MAX_LENGTH ? [name] : [];
    } catch {
      return []; // malformed escape
    }
  });
  return [...new Set(names)].slice(-HIDDEN_VENDORS_MAX);
}

export function serializeHiddenVendors(names: string[]): string {
  return names.map(encodeURIComponent).join(",");
}

async function guestViewer(): Promise<Viewer> {
  const store = await cookies();
  return {
    user: null,
    claimed: new Set(parseGuestClaims(store.get(GUEST_CLAIMS_COOKIE)?.value)),
    hiddenVendors: new Set(parseHiddenVendors(store.get(GUEST_HIDDEN_COOKIE)?.value)),
  };
}

/** Who's looking, which deals they've claimed and which vendors they've hidden (account or guest cookies). */
export async function getViewer(): Promise<Viewer> {
  if (!isAuthConfigured) return guestViewer();

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return guestViewer();

  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const [{ data: rows }, { data: hidden }] = await Promise.all([
    supabase.from("deal_claims").select("deal_id"),
    supabase.from("hidden_vendors").select("merchant"),
  ]);
  return {
    user: {
      id: claims.sub,
      email: (claims.email as string | undefined) ?? null,
      name: (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? null,
      avatarUrl: (meta.avatar_url as string | undefined) ?? null,
    },
    claimed: new Set((rows ?? []).map((r) => r.deal_id as string)),
    hiddenVendors: new Set((hidden ?? []).map((r) => r.merchant as string)),
  };
}

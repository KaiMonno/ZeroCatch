import "server-only";

import { cookies } from "next/headers";
import { createSupabaseServerClient, isAuthConfigured } from "./supabase-server";

/** Guests' claims live in this cookie until they sign in (then they're merged). */
export const GUEST_CLAIMS_COOKIE = "zc_claims";
export const GUEST_CLAIMS_MAX = 80; // 80 UUIDs ≈ 3 KB, under the 4 KB cookie limit
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Viewer {
  user: { id: string; email: string | null; name: string | null; avatarUrl: string | null } | null;
  claimed: Set<string>;
}

export function parseGuestClaims(raw: string | undefined): string[] {
  return (raw ?? "").split(",").filter((id) => UUID_RE.test(id)).slice(-GUEST_CLAIMS_MAX);
}

export async function readGuestClaims(): Promise<string[]> {
  return parseGuestClaims((await cookies()).get(GUEST_CLAIMS_COOKIE)?.value);
}

/** Who's looking, and which deals they've claimed (account or guest cookie). */
export async function getViewer(): Promise<Viewer> {
  if (!isAuthConfigured) return { user: null, claimed: new Set(await readGuestClaims()) };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { user: null, claimed: new Set(await readGuestClaims()) };

  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const { data: rows } = await supabase.from("deal_claims").select("deal_id");
  return {
    user: {
      id: claims.sub,
      email: (claims.email as string | undefined) ?? null,
      name: (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? null,
      avatarUrl: (meta.avatar_url as string | undefined) ?? null,
    },
    claimed: new Set((rows ?? []).map((r) => r.deal_id as string)),
  };
}

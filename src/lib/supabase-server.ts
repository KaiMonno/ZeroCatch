import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isAuthConfigured = Boolean(url && key);

/**
 * Per-request Supabase client that acts as the signed-in visitor (cookie
 * session), so RLS applies. Follows Supabase's official Next.js pattern.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(url!, key!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. Safe to
          // ignore: src/proxy.ts refreshes the session on every request.
        }
      },
    },
  });
}

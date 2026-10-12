"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-next";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function signInWithGoogle(form: FormData): Promise<void> {
  const next = safeNextPath(String(form.get("next") ?? "/"));
  const h = await headers();
  // Server Actions are POSTs, so the browser always sends Origin.
  const origin = h.get("origin") ?? `https://${h.get("host")}`;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=provider");
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

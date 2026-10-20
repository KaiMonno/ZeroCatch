import { NextResponse, type NextRequest } from "next/server";
import { mergeGuestData } from "@/lib/guest-merge";
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

  const response = NextResponse.redirect(new URL(next, origin));
  const merged = await mergeGuestData(supabase, data.user.id, (name) => request.cookies.get(name)?.value);
  for (const name of merged) response.cookies.delete(name);
  return response;
}

import type { NextRequest } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/alert-token";
import { deactivateAlerts } from "@/lib/alerts";

/**
 * One-click unsubscribe (RFC 8058): mail apps POST here from the
 * List-Unsubscribe header. People clicking the link in the email land on
 * /unsubscribe instead, which asks before acting (link scanners only GET).
 */
export async function POST(request: NextRequest) {
  const userId = verifyUnsubscribeToken(request.nextUrl.searchParams.get("token"));
  if (!userId) return new Response("Invalid unsubscribe link", { status: 400 });
  const ok = await deactivateAlerts(userId);
  return ok ? new Response("Unsubscribed", { status: 200 }) : new Response("Try again later", { status: 500 });
}

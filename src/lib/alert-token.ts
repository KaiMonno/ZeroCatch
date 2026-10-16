import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Unsubscribe links carry `<user id>.<HMAC>`, signed by the nightly sender
 * (scrapers/alerts.py) with ALERTS_SIGNING_SECRET, so a link only ever
 * unsubscribes the person it was sent to.
 */
export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  const secret = process.env.ALERTS_SIGNING_SECRET;
  if (!secret || !token) return null;
  const [userId, signature] = token.split(".");
  if (!userId || !signature || !/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const expected = createHmac("sha256", secret).update(`unsubscribe:${userId}`).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? userId : null;
}

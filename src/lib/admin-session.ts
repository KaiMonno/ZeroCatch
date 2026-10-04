import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Single-admin auth until Phase 3 brings real accounts. The session cookie is
 * an HMAC over its expiry, keyed by ADMIN_PASSWORD, so changing the password
 * signs everyone out. No database table needed.
 */
const COOKIE = "zc_admin";
const MAX_AGE_S = 7 * 86_400;

export const isAdminConfigured = () => Boolean(process.env.ADMIN_PASSWORD);

function sign(payload: string): string {
  return createHmac("sha256", process.env.ADMIN_PASSWORD!).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  // Hash first so lengths always match and timing reveals nothing.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function passwordMatches(candidate: string): boolean {
  return isAdminConfigured() && safeEqual(candidate, process.env.ADMIN_PASSWORD!);
}

export async function startSession(): Promise<void> {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  (await cookies()).set(COOKIE, `${expires}.${sign(String(expires))}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  if (!isAdminConfigured()) return false;
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature || Number(expires) * 1000 < Date.now()) return false;
  return safeEqual(signature, sign(expires));
}

/** Call at the top of every admin page AND every admin server action. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

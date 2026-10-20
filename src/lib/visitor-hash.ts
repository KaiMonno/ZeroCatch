import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

/** Salted SHA-256: enough to rate-limit and count distinct people without storing what was hashed. */
export function saltedHash(value: string): string {
  const salt = process.env.REPORT_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

/** The visitor's IP, hashed (Vercel sets x-forwarded-for). */
export async function visitorHash(): Promise<string> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return saltedHash(ip);
}

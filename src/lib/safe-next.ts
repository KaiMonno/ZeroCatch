/**
 * Only same-site paths may be used as a post-sign-in redirect. Rejects
 * absolute URLs and protocol-relative ones like "//evil.com" (an open
 * redirect that a plain startsWith("/") check lets through).
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

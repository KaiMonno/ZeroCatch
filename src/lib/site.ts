/**
 * Canonical origin for metadata, sitemap, and robots. Set NEXT_PUBLIC_SITE_URL
 * once there's a custom domain; until then Vercel's production URL is used.
 */
export const SITE_URL = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
);

export const SITE_NAME = "ZeroCatch";
export const SITE_TAGLINE = "Good-Faith Freebies";
export const SITE_DESCRIPTION =
  "Verified, no-strings-attached freebies and instant-cancel free trials. No purchase, no affiliate junk, no hidden card traps.";

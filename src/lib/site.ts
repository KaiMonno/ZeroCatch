/** The canonical public address. Vercel also serves the site at zero-catch.vercel.app, which 301-redirects here. */
export const PRODUCTION_URL = "https://zerocatch.dev";

/**
 * Canonical origin for metadata, sitemap, robots and link previews.
 * NEXT_PUBLIC_SITE_URL overrides it; production builds use the custom domain,
 * Vercel preview builds their own URL, and local dev localhost.
 */
export const SITE_URL = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_ENV === "production"
      ? PRODUCTION_URL
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"),
);

export const SITE_NAME = "ZeroCatch";
export const SITE_TAGLINE = "Good-Faith Freebies";
export const SITE_DESCRIPTION =
  "Verified, no-strings-attached freebies and instant-cancel free trials. No purchase, no affiliate junk, no hidden card traps.";

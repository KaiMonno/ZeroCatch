import type { DealInsert } from "@/lib/types";

/**
 * Sample deals for local development and `npm run seed`.
 * These are illustrative only. Verify terms before treating any as live.
 * Dates are relative to `now` so the feed never goes stale in dev.
 */
export function buildSeedDeals(now = new Date()): DealInsert[] {
  const inDays = (d: number) =>
    new Date(now.getTime() + d * 86_400_000).toISOString();
  const daysAgo = (d: number) => inDays(-d);

  // Epic's weekly giveaway rotates Thursdays at 15:00 UTC.
  const nextThursday = new Date(now);
  nextThursday.setUTCHours(15, 0, 0, 0);
  const delta = (4 - nextThursday.getUTCDay() + 7) % 7 || 7;
  nextThursday.setUTCDate(nextThursday.getUTCDate() + delta);

  const base = {
    requires_account: false,
    requires_credit_card: false,
    instant_cancel_safe: false,
    trial_duration_days: null,
    is_hero_featured: false,
  };

  return [
    // ── Tab 1: Pure Freebies ────────────────────────────────────────────
    {
      ...base,
      source_key: "seed:epic-weekly",
      title: "Weekly Free Game: claim and keep forever",
      description:
        "This week's Epic Games Store giveaway. Claim it to your library and it's yours permanently. No purchase or payment method needed.",
      category: "pure_freebie",
      merchant: "Epic Games",
      url: "https://store.epicgames.com/en-US/free-games",
      requires_account: true,
      starts_at: daysAgo(3),
      expires_at: nextThursday.toISOString(),
      is_hero_featured: true,
    },
    {
      ...base,
      source_key: "seed:steam-ftk",
      title: "Free-to-Keep Indie Title",
      description:
        "Limited-time Steam promotion: add the game to your account before the deadline and keep it after the promo ends.",
      category: "pure_freebie",
      merchant: "Steam",
      url: "https://store.steampowered.com/search/?maxprice=free&specials=1",
      requires_account: true,
      starts_at: daysAgo(1),
      expires_at: inDays(4),
    },
    {
      ...base,
      source_key: "seed:dunkin-coffee",
      title: "Free Medium Hot or Iced Coffee",
      description:
        "Coffee Day reward for Dunkin' Rewards members. Redeem in the app at checkout. Nothing to buy.",
      category: "pure_freebie",
      merchant: "Dunkin'",
      url: "https://www.dunkindonuts.com/en/dunkin-rewards",
      requires_account: true,
      starts_at: daysAgo(2),
      expires_at: inDays(2),
    },
    {
      ...base,
      source_key: "seed:gog-giveaway",
      title: "DRM-Free Classic Giveaway",
      description:
        "GOG's rotating giveaway. Click the banner on the homepage while logged in to add it to your library.",
      category: "pure_freebie",
      merchant: "GOG",
      url: "https://www.gog.com/en/",
      requires_account: true,
      starts_at: daysAgo(1),
      expires_at: inDays(6),
    },

    // ── Tab 2: Instant-Cancel Free Trials ───────────────────────────────
    {
      ...base,
      source_key: "seed:apple-music-3mo",
      title: "Apple Music: 3 Months Free",
      description:
        "Extended trial for eligible new subscribers. Cancel in Settings right after signing up and access continues through the trial.",
      category: "free_trial",
      merchant: "Apple Music",
      url: "https://www.apple.com/apple-music/",
      requires_account: true,
      requires_credit_card: true,
      instant_cancel_safe: true,
      trial_duration_days: 90,
      starts_at: daysAgo(10),
      expires_at: inDays(45),
    },
    {
      ...base,
      source_key: "seed:youtube-premium-1mo",
      title: "YouTube Premium: 1 Month Free",
      description:
        "Ad-free YouTube and YouTube Music. Cancel anytime and keep benefits until the trial period ends.",
      category: "free_trial",
      merchant: "YouTube",
      url: "https://www.youtube.com/premium",
      requires_account: true,
      requires_credit_card: true,
      instant_cancel_safe: true,
      trial_duration_days: 30,
      starts_at: daysAgo(30),
      expires_at: null,
    },
    {
      ...base,
      source_key: "seed:jetbrains-30d",
      title: "JetBrains IDEs: 30-Day Trial",
      description:
        "Full-featured evaluation of any JetBrains IDE. No payment details, and it simply stops at the end. Nothing to cancel.",
      category: "free_trial",
      merchant: "JetBrains",
      url: "https://www.jetbrains.com/all/",
      requires_account: true,
      instant_cancel_safe: true,
      trial_duration_days: 30,
      starts_at: daysAgo(60),
      expires_at: null,
    },
    {
      ...base,
      source_key: "seed:duolingo-super-14d",
      title: "Duolingo Super: 14 Days Free",
      description:
        "Unlimited hearts and no ads. Cancel via your app store subscription settings and keep Super until day 14.",
      category: "free_trial",
      merchant: "Duolingo",
      url: "https://www.duolingo.com/super",
      requires_account: true,
      requires_credit_card: true,
      instant_cancel_safe: true,
      trial_duration_days: 14,
      starts_at: daysAgo(5),
      expires_at: null,
    },

  ];
}

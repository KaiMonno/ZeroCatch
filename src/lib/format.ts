const DAY_MS = 86_400_000;

export interface ExpiryInfo {
  label: string;
  urgent: boolean;
}

/** "Ends in 5 hours" / "Expires in 2 days" / "Ends Oct 31" / "No end date". */
export function formatExpiry(expiresAt: string | null, now = Date.now()): ExpiryInfo {
  if (!expiresAt) return { label: "No end date", urgent: false };

  const ms = Date.parse(expiresAt) - now;
  if (ms <= 0) return { label: "Expired", urgent: true };

  const hours = Math.round(ms / 3_600_000);
  if (hours < 24) {
    return { label: `Ends in ${hours <= 1 ? "1 hour" : `${hours} hours`}`, urgent: true };
  }
  const days = Math.round(ms / DAY_MS);
  if (days <= 7) {
    return { label: `Expires in ${days} day${days === 1 ? "" : "s"}`, urgent: days <= 2 };
  }
  const date = new Date(expiresAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return { label: `Ends ${date}`, urgent: false };
}

/** 90 → "3 months", 30 → "1 month", 14 → "2 weeks", 10 → "10 days". */
export function formatDuration(days: number): string {
  if (days >= 28 && days % 30 <= 2) {
    const months = Math.round(days / 30);
    return `${months} month${months === 1 ? "" : "s"}`;
  }
  if (days % 7 === 0) {
    const weeks = days / 7;
    return `${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  return `${days} days`;
}

import { describe, expect, it } from "vitest";
import { formatDuration, formatExpiry } from "./format";

const NOW = Date.parse("2026-10-20T12:00:00Z");
const inHours = (h: number) => new Date(NOW + h * 3_600_000).toISOString();

describe("formatExpiry", () => {
  it("handles no end date and already-expired deals", () => {
    expect(formatExpiry(null, NOW)).toEqual({ label: "No end date", urgent: false });
    expect(formatExpiry(inHours(-1), NOW)).toEqual({ label: "Expired", urgent: true });
  });

  it("counts hours under a day, always urgent", () => {
    expect(formatExpiry(inHours(0.4), NOW)).toEqual({ label: "Ends in 1 hour", urgent: true });
    expect(formatExpiry(inHours(5), NOW)).toEqual({ label: "Ends in 5 hours", urgent: true });
  });

  it("counts days up to a week; urgent only within two days", () => {
    expect(formatExpiry(inHours(48), NOW)).toEqual({ label: "Expires in 2 days", urgent: true });
    expect(formatExpiry(inHours(24 * 5), NOW)).toEqual({ label: "Expires in 5 days", urgent: false });
  });

  it("shows a date beyond a week", () => {
    expect(formatExpiry("2026-11-03T07:00:00Z", NOW)).toEqual({ label: "Ends Nov 3", urgent: false });
  });
});

describe("formatDuration", () => {
  it.each([
    [30, "1 month"],
    [31, "1 month"],
    [90, "3 months"],
    [7, "1 week"],
    [14, "2 weeks"],
    [10, "10 days"],
  ])("%i days → %s", (days, label) => {
    expect(formatDuration(days)).toBe(label);
  });
});

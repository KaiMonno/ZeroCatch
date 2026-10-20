import { describe, expect, it } from "vitest";
import {
  GUEST_CLAIMS_MAX,
  HIDDEN_VENDORS_MAX,
  VENDOR_MAX_LENGTH,
  parseGuestClaims,
  parseHiddenVendors,
  serializeHiddenVendors,
} from "./claims";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("parseGuestClaims", () => {
  it("keeps only UUIDs", () => {
    expect(parseGuestClaims(`${uuid(1)},seed-3,,${uuid(2)},<script>`)).toEqual([uuid(1), uuid(2)]);
    expect(parseGuestClaims(undefined)).toEqual([]);
  });

  it("keeps the most recent claims when over the cap", () => {
    const ids = Array.from({ length: GUEST_CLAIMS_MAX + 5 }, (_, i) => uuid(i));
    const parsed = parseGuestClaims(ids.join(","));
    expect(parsed).toHaveLength(GUEST_CLAIMS_MAX);
    expect(parsed.at(-1)).toBe(uuid(GUEST_CLAIMS_MAX + 4));
  });
});

describe("hidden vendor cookie", () => {
  it("round-trips names containing commas and other punctuation", () => {
    const names = ["Brand, Inc.", "Love's", "itch.io", "Café & Co"];
    expect(parseHiddenVendors(serializeHiddenVendors(names))).toEqual(names);
  });

  it("drops malformed escapes, blanks, duplicates and over-long names", () => {
    const raw = ["%E0%A4%A", "ok", "", "%20", "ok", encodeURIComponent("x".repeat(VENDOR_MAX_LENGTH + 1))].join(",");
    expect(parseHiddenVendors(raw)).toEqual(["ok"]);
  });

  it("caps the list", () => {
    const names = Array.from({ length: HIDDEN_VENDORS_MAX + 3 }, (_, i) => `Vendor ${i}`);
    expect(parseHiddenVendors(serializeHiddenVendors(names))).toHaveLength(HIDDEN_VENDORS_MAX);
  });
});

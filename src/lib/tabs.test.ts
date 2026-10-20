import { describe, expect, it } from "vitest";
import { buildHref, parseFilters, resolveTab } from "./tabs";

describe("resolveTab", () => {
  it("finds a tab by slug and falls back to the first tab", () => {
    expect(resolveTab("trials").category).toBe("free_trial");
    expect(resolveTab("freebies").category).toBe("pure_freebie");
    expect(resolveTab(undefined).slug).toBe("freebies");
    expect(resolveTab("free-with-purchase").slug).toBe("freebies"); // retired tab
  });
});

describe("parseFilters", () => {
  it("keeps only known filters, in canonical order", () => {
    expect(parseFilters("ending-soon,no-card")).toEqual(["no-card", "ending-soon"]);
    expect(parseFilters("no-card,bogus,,no-card")).toEqual(["no-card"]);
    expect(parseFilters(undefined)).toEqual([]);
  });

  it("accepts a repeated query param", () => {
    expect(parseFilters(["no-account", "no-card"])).toEqual(["no-card", "no-account"]);
  });
});

describe("buildHref", () => {
  it("drops defaults so links stay clean", () => {
    expect(buildHref({ tab: "freebies" })).toBe("/");
    expect(buildHref({ tab: "freebies", q: "", filters: [] })).toBe("/");
  });

  it("encodes tab, search, filters and the claimed toggle", () => {
    expect(buildHref({ tab: "trials", q: "free pizza", filters: ["no-card", "ending-soon"], showClaimed: true })).toBe(
      "/?tab=trials&q=free+pizza&f=no-card%2Cending-soon&claimed=show",
    );
  });

  it("round-trips through parseFilters", () => {
    const href = buildHref({ tab: "freebies", filters: ["no-account", "no-card"] });
    expect(parseFilters(new URL(href, "https://x.test").searchParams.get("f") ?? "")).toEqual([
      "no-card",
      "no-account",
    ]);
  });
});

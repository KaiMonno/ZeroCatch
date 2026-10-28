import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { filterDeals, pickHeroes, sortDeals } from "./deals";
import type { Deal } from "./types";

const NOW = Date.parse("2026-10-20T12:00:00Z");
const at = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString();

let n = 0;
function deal(overrides: Partial<Deal>): Deal {
  n += 1;
  return {
    id: `d${n}`,
    title: `Deal ${n}`,
    description: "",
    category: "pure_freebie",
    merchant: "Brand",
    url: "https://brand.example",
    requires_account: false,
    requires_credit_card: false,
    instant_cancel_safe: true,
    trial_duration_days: null,
    starts_at: at(-48),
    expires_at: null,
    is_hero_featured: false,
    created_at: at(-48),
    source_key: null,
    ...overrides,
  };
}
const titles = (deals: Deal[]) => deals.map((d) => d.title);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("filterDeals", () => {
  it("keeps only the tab's category and deals live right now", () => {
    const deals = [
      deal({ title: "live" }),
      deal({ title: "trial", category: "free_trial", trial_duration_days: 30 }),
      deal({ title: "not started", starts_at: at(1) }),
      deal({ title: "expired", expires_at: at(-1) }),
    ];
    expect(titles(filterDeals(deals, { category: "pure_freebie" }))).toEqual(["live"]);
  });

  it("only lists trials that are instant-cancel safe", () => {
    const deals = [
      deal({ title: "safe", category: "free_trial", trial_duration_days: 30 }),
      deal({ title: "unsafe", category: "free_trial", trial_duration_days: 30, instant_cancel_safe: false }),
    ];
    expect(titles(filterDeals(deals, { category: "free_trial" }))).toEqual(["safe"]);
  });

  it("applies the no-card, no-account and ending-soon filters", () => {
    const deals = [
      deal({ title: "card", requires_credit_card: true }),
      deal({ title: "account", requires_account: true }),
      deal({ title: "soon", expires_at: at(24) }),
      deal({ title: "later", expires_at: at(24 * 10) }),
    ];
    const run = (filters: Parameters<typeof filterDeals>[1]["filters"]) =>
      titles(filterDeals(deals, { category: "pure_freebie", filters }));
    expect(run(["no-card"])).toEqual(["account", "soon", "later"]);
    expect(run(["no-account"])).toEqual(["card", "soon", "later"]);
    expect(run(["ending-soon"])).toEqual(["soon"]);
  });

  it("searches title, merchant and description, case-insensitively", () => {
    const deals = [
      deal({ title: "Free Uptime Energy Drink", merchant: "Love's" }),
      deal({ title: "Free coffee", description: "At participating stores" }),
    ];
    const search = (q: string) => titles(filterDeals(deals, { category: "pure_freebie", q }));
    expect(search("  LOVE'S ")).toEqual(["Free Uptime Energy Drink"]);
    expect(search("participating")).toEqual(["Free coffee"]);
    expect(search("energy drink")).toEqual(["Free Uptime Energy Drink"]);
    expect(search("pizza")).toEqual([]);
  });
});

describe("sortDeals", () => {
  it("puts the longest trial first", () => {
    const deals = [7, 90, 30].map((days) => deal({ title: `${days}d`, category: "free_trial", trial_duration_days: days }));
    expect(titles(sortDeals(deals))).toEqual(["90d", "30d", "7d"]);
  });

  it("orders featured, then non-itch.io, then soonest ending, then newest", () => {
    const deals = [
      deal({ title: "itch soon", merchant: "itch.io", expires_at: at(2) }),
      deal({ title: "no end, old", created_at: at(-100) }),
      deal({ title: "no end, new", created_at: at(-1) }),
      deal({ title: "ends soon", expires_at: at(5) }),
      deal({ title: "hero", is_hero_featured: true, expires_at: at(24 * 6) }),
    ];
    expect(titles(sortDeals(deals))).toEqual(["hero", "ends soon", "no end, new", "no end, old", "itch soon"]);
  });

  it("doesn't mutate its input", () => {
    const deals = [deal({ expires_at: at(9) }), deal({ expires_at: at(1) })];
    const before = titles(deals);
    sortDeals(deals);
    expect(titles(deals)).toEqual(before);
  });
});

describe("pickHeroes", () => {
  const epic = (title: string) => deal({ title, merchant: "Epic Games", source_key: `epic:${title}`, is_hero_featured: true, expires_at: at(72) });
  const itch = deal({ title: "itch game", merchant: "itch.io", source_key: "itch:x", expires_at: at(2) });

  it("keeps Epic's games as the hero when there's nothing else", () => {
    expect(titles(pickHeroes(sortDeals([epic("Game A"), epic("Game B"), itch])))).toEqual(["Game A", "Game B"]);
  });

  it("features another freebie instead, the one ending soonest", () => {
    const deals = sortDeals([
      epic("Game A"),
      itch,
      deal({ title: "Burger, ends in a month", expires_at: at(24 * 30) }),
      deal({ title: "Park day, ends tonight", expires_at: at(6) }),
    ]);
    expect(titles(pickHeroes(deals))).toEqual(["Park day, ends tonight"]);
  });

  it("prefers a deal featured by hand in the admin", () => {
    const deals = sortDeals([epic("Game A"), deal({ title: "ends soon", expires_at: at(1) }), deal({ title: "Hand-picked", is_hero_featured: true })]);
    expect(titles(pickHeroes(deals))).toEqual(["Hand-picked"]);
  });

  it("features nothing when the feed is empty", () => {
    expect(pickHeroes([])).toEqual([]);
  });
});

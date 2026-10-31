import unittest
from datetime import datetime, timezone

from scrapers.steam import build_deal, parse_free_until

NOW = datetime(2026, 10, 31, 20, 0, tzinfo=timezone.utc)
PAGE = '<p class="game_purchase_discount_quantity ">Free to keep when you get it before Nov 2 @ 10:00am. Some limitations apply.'


def details(discount: int | None = 100, kind: str = "game") -> dict:
    price = {"initial": 999, "final": 0 if discount == 100 else 999, "discount_percent": discount}
    return {"type": kind, "price_overview": price if discount is not None else None}


class ParseFreeUntilTest(unittest.TestCase):
    def test_reads_the_pacific_time_notice(self):
        # Daylight saving ends Nov 1, so Nov 2 is Pacific Standard Time (UTC-8).
        self.assertEqual(parse_free_until(PAGE, NOW), datetime(2026, 11, 2, 18, 0, tzinfo=timezone.utc))

    def test_afternoon_in_daylight_time(self):
        page = "Free to keep when you get it before Oct 31 @ 1:30pm."
        self.assertEqual(parse_free_until(page, NOW), datetime(2026, 10, 31, 20, 30, tzinfo=timezone.utc))

    def test_rolls_into_next_year(self):
        page = "Free to keep when you get it before Jan 2 @ 10:00am."
        december = datetime(2026, 12, 30, tzinfo=timezone.utc)
        self.assertEqual(parse_free_until(page, december).year, 2027)

    def test_no_notice_means_no_end_date(self):
        self.assertIsNone(parse_free_until("<p>Buy Hexologic $4.99</p>", NOW))


class BuildDealTest(unittest.TestCase):
    def test_free_game_with_end_date(self):
        ends = parse_free_until(PAGE, NOW)
        deal = build_deal("1583850", "Asleep: Act 1", "https://store.steampowered.com/app/1583850/", details(), ends)
        self.assertEqual(deal["source_key"], "steam:1583850")
        self.assertEqual(deal["expires_at"], "2026-11-02T18:00:00+00:00")
        self.assertTrue(deal["description"].startswith("Free on Steam until Nov 2:"))

    def test_without_end_date(self):
        deal = build_deal("1", "Game", "https://store.steampowered.com/app/1/", details())
        self.assertIsNone(deal["expires_at"])
        self.assertIn("for a limited time", deal["description"])

    def test_rejects_ended_promos_dlc_and_unpriced_items(self):
        # Hexologic: still in the search for a while after its giveaway ended, back at full price.
        self.assertIsNone(build_deal("785890", "Hexologic", "u", details(discount=0)))
        self.assertIsNone(build_deal("2", "Soundtrack", "u", details(kind="dlc")))
        self.assertIsNone(build_deal("3", "Free to play", "u", details(discount=None)))
        self.assertIsNone(build_deal("4", "Missing", "u", None))


if __name__ == "__main__":
    unittest.main()

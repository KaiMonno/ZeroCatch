import unittest
from datetime import date

from scrapers.calendar import load_events, resolve_date, upcoming_leads

EVENT = {
    "key": "test-day", "merchant": "Test Co", "title": "Free Thing", "description": "Desc.",
    "url": "https://test.example/", "verified": "2026",
}


class ResolveDateTest(unittest.TestCase):
    def test_fixed(self):
        self.assertEqual(resolve_date("07-11", 2026), (date(2026, 7, 11), False))

    def test_approximate(self):
        self.assertEqual(resolve_date("~03-19", 2027), (date(2027, 3, 19), True))

    def test_nth_weekday(self):
        self.assertEqual(resolve_date("first friday of june", 2026), (date(2026, 6, 5), False))
        self.assertEqual(resolve_date("first friday of june", 2027), (date(2027, 6, 4), False))
        self.assertEqual(resolve_date("last monday of may", 2026), (date(2026, 5, 25), False))

    def test_bad_rule(self):
        with self.assertRaises(ValueError):
            resolve_date("sometime in spring", 2026)


class UpcomingLeadsTest(unittest.TestCase):
    def test_lead_appears_inside_window_only(self):
        event = {**EVENT, "date": "10-31"}
        self.assertEqual(upcoming_leads([event], date(2026, 10, 9)), [])
        [lead] = upcoming_leads([event], date(2026, 10, 10))
        self.assertEqual(lead["source_key"], "calendar:test-day:2026")
        self.assertEqual(lead["title"], "Free Thing (Oct 31)")
        self.assertEqual(lead["suggested_starts_at"], "2026-10-31T04:00:00+00:00")
        self.assertTrue(lead["is_food"])

    def test_year_rollover(self):
        [lead] = upcoming_leads([{**EVENT, "date": "01-05"}], date(2026, 12, 28))
        self.assertEqual(lead["source_key"], "calendar:test-day:2027")

    def test_approximate_dates_ask_for_confirmation(self):
        [lead] = upcoming_leads([{**EVENT, "date": "~03-19"}], date(2027, 3, 1))
        self.assertIn("DATE VARIES BY YEAR", lead["summary"])

    def test_shipped_calendar_is_valid(self):
        events = load_events()
        self.assertGreater(len(events), 0)
        for event in events:
            resolve_date(event["date"], 2026)  # raises on a bad rule
            self.assertTrue(event["url"].startswith("https://"), event["key"])
        self.assertEqual(len({e["key"] for e in events}), len(events), "duplicate keys")


if __name__ == "__main__":
    unittest.main()


class ExtendedRulesTest(unittest.TestCase):
    def test_approximate_weekday_rule(self):
        self.assertEqual(resolve_date("~third monday of february", 2027), (date(2027, 2, 15), True))

    def test_multi_day_event_spans_all_days(self):
        event = {**EVENT, "date": "~07-03", "days": 3, "food": False}
        [lead] = upcoming_leads([event], date(2026, 6, 20))
        self.assertEqual(lead["suggested_starts_at"], "2026-07-03T04:00:00+00:00")
        self.assertEqual(lead["suggested_expires_at"], "2026-07-06T06:59:00+00:00")  # end of Jul 5, Pacific
        self.assertFalse(lead["is_food"])

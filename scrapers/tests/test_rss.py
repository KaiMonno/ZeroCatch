import unittest
from pathlib import Path

from scrapers.rss import clean_text, parse_rss

FIXTURE = (Path(__file__).parent / "fixtures" / "sample_feed.xml").read_bytes()


class ParseRssTest(unittest.TestCase):
    def setUp(self):
        self.items = parse_rss(FIXTURE)

    def test_parses_every_item(self):
        self.assertEqual(len(self.items), 3)

    def test_unescapes_titles_and_strips_html(self):
        first = self.items[0]
        self.assertEqual(first.title, "FREE Medium Coffee at Dunkin’ for Rewards Members | Today Only")
        self.assertEqual(first.summary, "Open the app and redeem. No purchase needed.")
        self.assertEqual(first.categories, ["Legit Freebies & Samples"])

    def test_uses_wordpress_post_id_as_stable_id(self):
        self.assertEqual(self.items[0].stable_id, "1001")

    def test_falls_back_to_hash_without_post_id(self):
        item = self.items[2]
        self.assertEqual(len(item.stable_id), 16)
        self.assertEqual(item.stable_id, parse_rss(FIXTURE)[2].stable_id)  # deterministic

    def test_bad_date_becomes_none(self):
        self.assertIsNone(self.items[2].published_at)
        self.assertEqual(self.items[0].published_at.isoformat(), "2026-10-03T14:00:00+00:00")


class CleanTextTest(unittest.TestCase):
    def test_truncates_with_ellipsis(self):
        self.assertEqual(clean_text("abcdefghij", limit=5), "abcd…")


if __name__ == "__main__":
    unittest.main()

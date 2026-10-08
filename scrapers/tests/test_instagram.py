import contextlib
import io
import os
import unittest
from datetime import datetime, timezone
from unittest import mock

from scrapers import instagram

NOW = datetime(2026, 10, 5, 12, 0, tzinfo=timezone.utc)
BRAND = {"handle": "dunkin", "merchant": "Dunkin'", "url": "https://www.dunkindonuts.com/en/dunkin-rewards"}


def post(caption, ts="2026-10-04T15:00:00+0000", pid="1"):
    return {"id": pid, "caption": caption, "permalink": f"https://www.instagram.com/p/{pid}/", "timestamp": ts}


class PostToLeadTest(unittest.TestCase):
    def test_freebie_post_becomes_lead_linking_brand_site(self):
        lead, reason = instagram.post_to_lead(
            post("FREE medium coffee for Dunkin' Rewards members on October 6th ☕\nJust open the app."), BRAND, NOW, 7
        )
        self.assertEqual(reason, "")
        self.assertEqual(lead["suggested_url"], BRAND["url"])  # captions can't carry links
        self.assertEqual(lead["source_url"], "https://www.instagram.com/p/1/")
        self.assertEqual(lead["suggested_starts_at"], "2026-10-06T04:00:00+00:00")
        self.assertTrue(lead["title"].startswith("Dunkin': FREE medium coffee"))

    def test_hook_first_line_still_checks_whole_caption(self):
        caption = "You asked, we listened 👀\nFREE donut today, no purchase."
        lead, _ = instagram.post_to_lead(post(caption, ts="2026-10-05T10:00:00+0000"), BRAND, NOW, 7)
        self.assertIsNotNone(lead)
        # The same "today" post from yesterday has already ended.
        self.assertEqual(instagram.post_to_lead(post(caption), BRAND, NOW, 7)[1], "past_date")

    def test_rules_apply(self):
        cases = {
            "BOGO lattes all weekend!": "requires_purchase",
            "FREE double points on every order": "points_or_credit",
            "New fall menu just dropped 🍂": "not_free",
        }
        for caption, reason in cases.items():
            self.assertEqual(instagram.post_to_lead(post(caption), BRAND, NOW, 7), (None, reason), caption)

    def test_old_and_past_posts(self):
        self.assertEqual(instagram.post_to_lead(post("FREE coffee!", ts="2026-09-01T15:00:00+0000"), BRAND, NOW, 7)[1], "old_post")
        self.assertEqual(instagram.post_to_lead(post("FREE coffee on October 1st"), BRAND, NOW, 7)[1], "past_date")


class FetchTest(unittest.TestCase):
    def test_not_configured_is_skipped(self):
        with mock.patch.dict(os.environ, {}, clear=True), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(instagram.fetch_instagram_leads(), [])

    def test_bad_handles_reported_and_others_continue(self):
        def fake(handle):
            if handle == "dunkin":
                raise instagram.InstagramError("400 Invalid user id")
            return []
        env = {"INSTAGRAM_ACCESS_TOKEN": "t", "INSTAGRAM_USER_ID": "1"}
        report: list = []
        with (
            mock.patch.dict(os.environ, env),
            mock.patch.object(instagram, "fetch_brand_posts", side_effect=fake),
            contextlib.redirect_stdout(io.StringIO()),  # the simulated failure would look like a real one in logs
        ):
            self.assertEqual(instagram.fetch_instagram_leads(report=report), [])
        self.assertTrue(any(h == "dunkin" and s.startswith("ERROR") for h, s, _ in report))

    def test_shipped_brand_file_is_valid(self):
        brands = instagram.load_brands()
        self.assertEqual(len({b["handle"] for b in brands}), len(brands))
        self.assertTrue(all(b["url"].startswith("https://") for b in brands))


if __name__ == "__main__":
    unittest.main()

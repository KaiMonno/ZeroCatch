import unittest
from datetime import datetime, timedelta, timezone

from scrapers import alerts

NOW = datetime(2026, 10, 19, 8, 30, tzinfo=timezone.utc)  # a Monday, 1:30am Pacific


def deal(id, source_key="", category="pure_freebie", merchant="Brand", created=NOW - timedelta(hours=3), starts=None, **kw):
    return {
        "id": id, "title": f"Deal {id}", "merchant": merchant, "url": f"https://brand.example/{id}", "category": category,
        "source_key": source_key, "created_at": created.isoformat(), "starts_at": (starts or created).isoformat(),
        "expires_at": None, "requires_account": True, "requires_credit_card": False, "trial_duration_days": None, **kw,
    }


class TopicTest(unittest.TestCase):
    def test_topics(self):
        self.assertEqual(alerts.deal_topic(deal("1", "itch:dev.itch.io/x"), set(), set()), "games")
        self.assertEqual(alerts.deal_topic(deal("2", "trial:hulu", "free_trial"), set(), set()), "trials")
        self.assertEqual(alerts.deal_topic(deal("3", "calendar:wawa-day:2027"), set(), {"wawa-day"}), "food")
        self.assertEqual(alerts.deal_topic(deal("4", merchant="Wendy's"), set(), set()), "food")
        self.assertEqual(alerts.deal_topic(deal("5", "icravefreebies:9"), {"5"}, set()), "food")  # judge said food
        self.assertEqual(alerts.deal_topic(deal("6", "calendar:free-comic-book-day:2027"), set(), {"wawa-day"}), "other")


class DueTest(unittest.TestCase):
    def test_daily(self):
        self.assertTrue(alerts.is_due({"frequency": "daily", "last_sent_at": None}, NOW))
        self.assertFalse(alerts.is_due({"frequency": "daily", "last_sent_at": (NOW - timedelta(hours=2)).isoformat()}, NOW))
        self.assertTrue(alerts.is_due({"frequency": "daily", "last_sent_at": (NOW - timedelta(hours=23)).isoformat()}, NOW))

    def test_weekly_only_on_monday_pacific(self):
        self.assertTrue(alerts.is_due({"frequency": "weekly", "last_sent_at": None}, NOW))
        self.assertFalse(alerts.is_due({"frequency": "weekly", "last_sent_at": None}, NOW + timedelta(days=1)))
        recent = {"frequency": "weekly", "last_sent_at": (NOW - timedelta(days=2)).isoformat()}
        self.assertFalse(alerts.is_due(recent, NOW))


class DealsForTest(unittest.TestCase):
    def setUp(self):
        self.deals = [
            deal("a", "itch:x"),
            deal("b", "trial:y", "free_trial"),
            deal("old", "itch:z", created=NOW - timedelta(days=3)),
            deal("early", "epic:ns:id:d", created=NOW - timedelta(days=5), starts=NOW - timedelta(hours=1)),
        ]
        self.topics = {d["id"]: alerts.deal_topic(d, set(), set()) for d in self.deals}

    def test_new_matching_unclaimed_only(self):
        sub = {"frequency": "daily", "last_sent_at": None, "topics": ["games"]}
        got = [d["id"] for d in alerts.deals_for(sub, self.deals, self.topics, {"a"}, NOW)]
        # "a" claimed, "b" wrong topic, "old" not new; Epic's pre-stored game counts when it starts.
        self.assertEqual(got, ["early"])

    def test_hidden_vendors_are_skipped(self):
        deals = [deal("a", "itch:x", merchant="itch.io"), deal("e", "epic:ns:id:e", merchant="Epic Games")]
        topics = {d["id"]: "games" for d in deals}
        sub = {"frequency": "daily", "last_sent_at": None, "topics": ["games"]}
        got = [d["id"] for d in alerts.deals_for(sub, deals, topics, set(), NOW, {"itch.io"})]
        self.assertEqual(got, ["e"])


class TokenAndRenderTest(unittest.TestCase):
    def test_token_is_stable_and_bound_to_user(self):
        uid = "3f2b1c4d-0000-4000-8000-000000000001"
        token = alerts.unsubscribe_token(uid, "s3cret")
        self.assertTrue(token.startswith(uid + "."))
        self.assertEqual(token, alerts.unsubscribe_token(uid, "s3cret"))
        self.assertNotEqual(token, alerts.unsubscribe_token(uid, "other-secret"))

    def test_render_escapes_and_has_one_click_unsubscribe(self):
        d = deal("x", title="<b>Free</b> & cheap", merchant="A&B")
        email = alerts.render_email([d], {"x": "other"}, "uid.sig")
        self.assertIn("&lt;b&gt;Free&lt;/b&gt; &amp; cheap", email["html"])
        self.assertEqual(email["headers"]["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click")
        self.assertIn("/api/alerts/unsubscribe?token=uid.sig", email["headers"]["List-Unsubscribe"])
        self.assertEqual(email["subject"], "1 new freebie on ZeroCatch")


if __name__ == "__main__":
    unittest.main()

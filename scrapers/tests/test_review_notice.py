import json
import os
import unittest
from unittest import mock

from scrapers import review_notice
from scrapers.review_notice import notify, render_notice


def calendar_lead(title: str, starts: str) -> dict:
    return {
        "source": "calendar",
        "source_key": f"calendar:{title}:2026",
        "title": title,
        "source_url": "https://brand.example/free",
        "suggested_starts_at": starts,
    }


BLOG = {"source": "blog", "source_key": "blog:1", "title": "Free <cone> day", "source_url": "https://blog.example/post"}
# Nov 11, 2026 starts at midnight Pacific (08:00 UTC).
PARKS = calendar_lead("National Parks free entry (Nov 11)", "2026-11-11T08:00:00+00:00")
EARLIER = calendar_lead("Earlier freebie (Nov 3)", "2026-11-03T08:00:00+00:00")


class RenderNoticeTest(unittest.TestCase):
    def test_calendar_leads_lead_the_subject_soonest_first(self):
        email = render_notice([BLOG, PARKS, EARLIER])
        self.assertEqual(email["subject"], "Confirm by Tue Nov 3: Earlier freebie (Nov 3) (+2 more)")
        text = email["text"]
        self.assertLess(text.index("Earlier freebie"), text.index("National Parks"))
        self.assertLess(text.index("National Parks"), text.index("Free <cone> day"))
        self.assertIn("confirm before Wed Nov 11", text)

    def test_blog_only_subject_and_escaping(self):
        email = render_notice([BLOG])
        self.assertEqual(email["subject"], "1 new lead to review on ZeroCatch")
        self.assertIn("Free &lt;cone&gt; day", email["html"])
        self.assertIn(review_notice.REVIEW_URL, email["text"])


class NotifyTest(unittest.TestCase):
    def test_nothing_new_sends_nothing(self):
        with mock.patch("urllib.request.urlopen") as urlopen:
            self.assertEqual(notify([]), "no new leads waiting")
        urlopen.assert_not_called()

    def test_skips_without_a_recipient(self):
        with mock.patch.dict(os.environ, {"RESEND_API_KEY": "k", "REVIEW_NOTIFY_EMAIL": ""}), mock.patch(
            "urllib.request.urlopen"
        ) as urlopen:
            self.assertIn("not configured", notify([PARKS]))
        urlopen.assert_not_called()

    def test_sends_one_email_with_a_stable_idempotency_key(self):
        env = {"RESEND_API_KEY": "k", "REVIEW_NOTIFY_EMAIL": "admin@example.com"}
        with mock.patch.dict(os.environ, env), mock.patch("urllib.request.urlopen") as urlopen:
            self.assertEqual(notify([PARKS, BLOG]), "emailed (2 leads)")
            notify([BLOG, PARKS])
        first, second = (call.args[0] for call in urlopen.call_args_list)
        self.assertTrue(first.full_url.endswith("/emails"))
        self.assertEqual(json.loads(first.data)["to"], ["admin@example.com"])
        self.assertEqual(first.get_header("Idempotency-key"), second.get_header("Idempotency-key"))


if __name__ == "__main__":
    unittest.main()

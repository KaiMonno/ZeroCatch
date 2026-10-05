import unittest
from datetime import datetime, timezone
from unittest import mock

from scrapers import judge
from scrapers.__main__ import apply_judge

NOW = datetime(2026, 10, 4, 12, 0, tzinfo=timezone.utc)
LINKS = [("https://www.starbucks.com/rewards", "Starbucks Rewards"), ("https://www.target.com/circle", "Target")]
GOOD = {
    "qualifies": True, "rejection_reason": "none", "confidence": "high", "category": "pure_freebie",
    "is_food": True, "merchant": "Starbucks", "title": "Free Coffee or Cookie at Target Starbucks",
    "description": "Free brewed coffee or cookie with a free Target Circle account.", "brand_link_index": 0,
    "requires_account": True, "requires_credit_card": False, "starts_on": "2026-10-06", "ends_on": "2026-10-06",
}


class VerdictToDealTest(unittest.TestCase):
    def test_good_verdict_becomes_scheduled_deal(self):
        deal, reason = judge.verdict_to_deal(GOOD, LINKS, NOW)
        self.assertEqual(reason, "")
        self.assertEqual(deal["url"], "https://www.starbucks.com/rewards")  # chosen by index, never by the model
        self.assertEqual(deal["starts_at"], "2026-10-06T04:00:00+00:00")
        self.assertEqual(deal["expires_at"], "2026-10-07T06:59:00+00:00")

    def test_rejections(self):
        cases = {
            "ai: paid_membership": {"qualifies": False, "rejection_reason": "paid_membership"},
            "ai: confidence medium": {"confidence": "medium"},
            "ai: no brand link": {"brand_link_index": 7},
            "ai: card required on a freebie": {"requires_credit_card": True},
            "ai: already ended": {"starts_on": "2026-10-01", "ends_on": "2026-10-02"},
            "ai: missing title or merchant": {"merchant": "  "},
        }
        for expected, patch in cases.items():
            deal, reason = judge.verdict_to_deal({**GOOD, **patch}, LINKS, NOW)
            self.assertIsNone(deal, expected)
            self.assertEqual(reason, expected)

    def test_negative_index_means_no_link(self):
        self.assertEqual(judge.verdict_to_deal({**GOOD, "brand_link_index": -1}, LINKS, NOW)[1], "ai: no brand link")

    def test_no_dates_gets_default_lifetime(self):
        deal, _ = judge.verdict_to_deal({**GOOD, "starts_on": "", "ends_on": ""}, LINKS, NOW)
        self.assertEqual(deal["expires_at"], "2026-10-11T12:00:00+00:00")


def lead(title="FREE Starbucks Coffee"):
    return {"source_key": f"hip2save:{title}", "title": title, "_article_text": "text", "_links": LINKS}


class ApplyJudgeTest(unittest.TestCase):
    def test_shadow_records_without_publishing(self):
        leads = [lead()]
        with mock.patch.object(judge, "call_judge", return_value=GOOD):
            to_publish, tally = apply_judge(leads, "shadow", [])
        self.assertEqual(to_publish, [])
        self.assertEqual(leads[0]["ai_verdict"]["merchant"], "Starbucks")
        self.assertEqual(leads[0]["ai_verdict"]["brand_url"], "https://www.starbucks.com/rewards")
        self.assertEqual(leads[0]["ai_verdict"]["decision"], "publish")
        self.assertNotIn("status", leads[0])
        self.assertEqual(tally["would publish"], 1)

    def test_publish_mode_publishes_and_rejects(self):
        good, bad = lead("good"), lead("bad")
        verdicts = [GOOD, {**GOOD, "qualifies": False, "rejection_reason": "contest"}]
        with mock.patch.object(judge, "call_judge", side_effect=verdicts):
            to_publish, _ = apply_judge([good, bad], "publish", [])
        self.assertEqual([l["title"] for l, _ in to_publish], ["good"])
        self.assertEqual((bad["status"], bad["review_note"]), ("rejected", "ai: contest"))

    def test_api_errors_leave_lead_pending_and_report_once(self):
        errors: list[str] = []
        leads = [lead("a"), lead("b")]
        with mock.patch.object(judge, "call_judge", side_effect=RuntimeError("401 invalid key")):
            to_publish, tally = apply_judge(leads, "publish", errors)
        self.assertEqual((to_publish, tally["error"], len(errors)), ([], 2, 1))
        self.assertNotIn("status", leads[0])

    def test_non_judged_sources_are_skipped(self):
        steam = {"source_key": "steam:1", "title": "Steam"}
        with mock.patch.object(judge, "call_judge") as call:
            apply_judge([steam], "publish", [])
        call.assert_not_called()


class ModeTest(unittest.TestCase):
    def test_modes(self):
        with mock.patch.dict("os.environ", {}, clear=True):
            self.assertEqual(judge.judge_mode(), "off")
        with mock.patch.dict("os.environ", {"ANTHROPIC_API_KEY": "k"}, clear=True):
            self.assertEqual(judge.judge_mode(), "shadow")  # safe default
        with mock.patch.dict("os.environ", {"ANTHROPIC_API_KEY": "k", "AI_JUDGE_MODE": "publish"}, clear=True):
            self.assertEqual(judge.judge_mode(), "publish")


if __name__ == "__main__":
    unittest.main()

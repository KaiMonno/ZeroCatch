import unittest

from scrapers.trials import build_trial_deals, load_trials


class TrialsTest(unittest.TestCase):
    def test_shipped_file_is_valid(self):
        trials = load_trials()
        self.assertGreater(len(trials), 0)
        self.assertEqual(len({t["key"] for t in trials}), len(trials), "duplicate keys")
        for deal in build_trial_deals(trials):
            self.assertTrue(deal["url"].startswith("https://"))
            self.assertGreater(deal["trial_duration_days"], 0)
            self.assertEqual(deal["category"], "free_trial")
            self.assertTrue(deal["instant_cancel_safe"])
            self.assertTrue(deal["source_key"].startswith("trial:"))

    def test_spotify_stays_out(self):
        # Spotify's terms end Premium immediately when a trial is cancelled.
        self.assertNotIn("spotify", {t["key"].split("-")[0] for t in load_trials()})


if __name__ == "__main__":
    unittest.main()

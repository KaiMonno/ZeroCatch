import unittest
from pathlib import Path

from scrapers.robots import Robots

UA = "ZeroCatchBot/0.1 (+https://github.com/KaiMonno/zerocatch)"
SLICKDEALS = Robots.parse((Path(__file__).parent / "fixtures" / "slickdeals_robots.txt").read_text())


class WildcardTest(unittest.TestCase):
    def test_slickdeals_rss_is_disallowed(self):
        # The case urllib.robotparser got wrong: "Disallow: /newsearch.php?*rss=*"
        url = "https://slickdeals.net/newsearch.php?searchin=first&forumchoice%5B%5D=4&rss=1"
        self.assertFalse(SLICKDEALS.can_fetch(UA, url))

    def test_plain_prefix_rules(self):
        self.assertFalse(SLICKDEALS.can_fetch(UA, "https://slickdeals.net/forums/forumdisplay.php?f=25"))
        self.assertTrue(SLICKDEALS.can_fetch(UA, "https://slickdeals.net/forums/forumdisplay.php?f=4"))

    def test_end_anchor(self):
        r = Robots.parse("User-agent: *\nDisallow: /*.pdf$")
        self.assertFalse(r.can_fetch(UA, "https://x.com/files/a.pdf"))
        self.assertTrue(r.can_fetch(UA, "https://x.com/files/a.pdf?download=1"))


class PrecedenceTest(unittest.TestCase):
    def test_longest_match_wins(self):
        r = Robots.parse("User-agent: *\nDisallow: /games/\nAllow: /games/on-sale")
        self.assertTrue(r.can_fetch(UA, "https://x.com/games/on-sale.xml"))
        self.assertFalse(r.can_fetch(UA, "https://x.com/games/top"))

    def test_allow_wins_tie(self):
        r = Robots.parse("User-agent: *\nDisallow: /page\nAllow: /page")
        self.assertTrue(r.can_fetch(UA, "https://x.com/page"))

    def test_specific_group_overrides_star(self):
        r = Robots.parse("User-agent: *\nDisallow: /\n\nUser-agent: ZeroCatchBot\nAllow: /feed")
        self.assertTrue(r.can_fetch(UA, "https://x.com/feed"))
        # the specific group has no rule for /other, so it's allowed (the * group no longer applies)
        self.assertTrue(r.can_fetch(UA, "https://x.com/other"))

    def test_empty_disallow_and_no_rules_allow(self):
        self.assertTrue(Robots.parse("User-agent: *\nDisallow:").can_fetch(UA, "https://x.com/a"))
        self.assertTrue(Robots.parse("").can_fetch(UA, "https://x.com/a"))

    def test_disallow_all(self):
        self.assertFalse(Robots.parse("User-agent: *\nDisallow: /").can_fetch(UA, "https://x.com/"))


if __name__ == "__main__":
    unittest.main()

import unittest
from datetime import date, datetime, timezone

from scrapers.dates import day_window, find_deal_day
from scrapers.links import pick_brand_link

PUB = datetime(2026, 10, 3, 14, 0, tzinfo=timezone.utc)


class FindDealDayTest(unittest.TestCase):
    def test_month_day(self):
        self.assertEqual(find_deal_day("FREE Coffee on October 6th!", PUB), date(2026, 10, 6))
        self.assertEqual(find_deal_day("Sept. 29 is Coffee Day", PUB), date(2026, 9, 29))

    def test_explicit_year(self):
        self.assertEqual(find_deal_day("Donut Day 2027 is June 4, 2027", PUB), date(2027, 6, 4))

    def test_numeric(self):
        self.assertEqual(find_deal_day("Plushies on 10/6", PUB), date(2026, 10, 6))

    def test_fractions_are_not_dates(self):
        self.assertIsNone(find_deal_day("1/2 price pizza", PUB))
        self.assertIsNone(find_deal_day("Free 1/4 lb burger", PUB))

    def test_today_uses_publish_day_in_eastern_time(self):
        late = datetime(2026, 10, 4, 2, 0, tzinfo=timezone.utc)  # 10pm Oct 3 Eastern
        self.assertEqual(find_deal_day("FREE Smoothie (Today Only!)", late), date(2026, 10, 3))

    def test_year_rollover(self):
        dec = datetime(2026, 12, 28, tzinfo=timezone.utc)
        self.assertEqual(find_deal_day("Free pancakes Jan 3", dec), date(2027, 1, 3))

    def test_no_date(self):
        self.assertIsNone(find_deal_day("FREE Cone at Dairy Queen", PUB))


class DayWindowTest(unittest.TestCase):
    def test_covers_all_us_time_zones(self):
        start, end = day_window(date(2026, 10, 6))
        self.assertEqual(start.isoformat(), "2026-10-06T04:00:00+00:00")  # midnight EDT
        self.assertEqual(end.isoformat(), "2026-10-07T06:59:00+00:00")  # 11:59pm PDT


ARTICLE = """
<nav><a href="https://www.starbucks.com/menu">Nav link outside article</a></nav>
<article>
  <a href="https://hip2save.com/deals/other/">Our other post</a>
  <a href="https://on.ltk.com/+abc">Target Circle</a>
  <a href="https://www.amazon.com/dp/B0?tag=wwwhip2saveco-20">Amazon</a>
  <a href="https://www.tiktok.com/@hip2save">TikTok</a>
  <a href="https://www.prnewswire.com/news-releases/x.html">Press release</a>
  <a href="https://www.target.com/circle?utm_source=hip2save&amp;utm_medium=x">Target</a>
  <a href="https://www.starbucks.com/rewards?utm_campaign=x">Starbucks <b>Rewards</b></a>
</article>
"""


class PickBrandLinkTest(unittest.TestCase):
    def test_prefers_merchant_domain_and_strips_tracking(self):
        self.assertEqual(
            pick_brand_link(ARTICLE, "hip2save.com", "starbucks.com"),
            ("https://www.starbucks.com/rewards", "Starbucks Rewards"),
        )

    def test_falls_back_to_first_clean_brand_link(self):
        self.assertEqual(pick_brand_link(ARTICLE, "hip2save.com", None)[0], "https://www.target.com/circle")

    def test_none_when_only_affiliate_links(self):
        self.assertIsNone(pick_brand_link('<article><a href="https://amzn.to/x">a</a></article>', "hip2save.com", None))


if __name__ == "__main__":
    unittest.main()

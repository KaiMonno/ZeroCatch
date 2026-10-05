import unittest

from scrapers.itch import parse_feed

FEED = b"""<?xml version="1.0"?><rss><channel>
<item><plainTitle>Good Game</plainTitle><link>https://dev.itch.io/good-game</link><price>$0.00</price>
  <discountpercent>100</discountpercent><fullPrice>$6.66</fullPrice><saleends>Sat, 31 Oct 2026 17:00:00 GMT</saleends></item>
<item><plainTitle>Tiny Game</plainTitle><link>https://dev.itch.io/tiny</link><price>$0.00</price>
  <discountpercent>100</discountpercent><fullPrice>$1.99</fullPrice><saleends>Sat, 31 Oct 2026 17:00:00 GMT</saleends></item>
<item><plainTitle>Pay What You Want</plainTitle><link>https://dev.itch.io/pwyw</link><price>Free</price>
  <discountpercent>50</discountpercent><fullPrice>$9.99</fullPrice><saleends>Sat, 31 Oct 2026 17:00:00 GMT</saleends></item>
<item><plainTitle>Just Discounted</plainTitle><link>https://dev.itch.io/sale</link><price>$4.99</price>
  <discountpercent>50</discountpercent><fullPrice>$9.99</fullPrice><saleends>Sat, 31 Oct 2026 17:00:00 GMT</saleends></item>
</channel></rss>"""


class ItchTest(unittest.TestCase):
    def test_only_100_percent_off_above_min_price(self):
        [deal] = parse_feed(FEED)
        self.assertEqual(deal["title"], "Good Game: Free on itch.io")
        self.assertEqual(deal["expires_at"], "2026-10-31T17:00:00+00:00")
        self.assertEqual(deal["source_key"], "itch:dev.itch.io/good-game")
        self.assertIn("Normally $6.66", deal["description"])
        self.assertFalse(deal["requires_account"])

    def test_threshold_is_configurable(self):
        self.assertEqual(len(parse_feed(FEED, min_full_price=1.0)), 2)


if __name__ == "__main__":
    unittest.main()

"""Parser tests for the first-party sources, using synthetic payloads shaped
like the real responses (2026-10)."""

import unittest

from scrapers.epic import parse_epic
from scrapers.gog import parse_giveaway
from scrapers.steam import build_deal, parse_search


def epic_element(title, *, current=None, upcoming=None, pct=0, mappings=("game-abc123",), url_slug=None):
    def offers(window):
        return [{"promotionalOffers": [{"startDate": window[0], "endDate": window[1],
                                        "discountSetting": {"discountPercentage": pct}}]}] if window else []
    return {
        "title": title, "id": "id1", "namespace": "ns1", "productSlug": None, "urlSlug": url_slug,
        "catalogNs": {"mappings": [{"pageSlug": s} for s in mappings]}, "offerMappings": [],
        "promotions": {"promotionalOffers": offers(current), "upcomingPromotionalOffers": offers(upcoming)},
    }


def epic_payload(*elements):
    return {"data": {"Catalog": {"searchStore": {"elements": list(elements)}}}}


NOW = ("2026-10-01T15:00:00.000Z", "2026-10-08T15:00:00.000Z")
NEXT = ("2026-10-08T15:00:00.000Z", "2026-10-15T15:00:00.000Z")


class EpicTest(unittest.TestCase):
    def test_current_and_upcoming_free_games(self):
        deals = parse_epic(epic_payload(epic_element("Game A", current=NOW), epic_element("Game B", upcoming=NEXT)))
        self.assertEqual([d["title"] for d in deals], ["Game A", "Game B"])
        a = deals[0]
        self.assertEqual(a["url"], "https://store.epicgames.com/en-US/p/game-abc123")
        self.assertEqual((a["starts_at"], a["expires_at"]), NOW)
        self.assertTrue(a["is_hero_featured"] and a["requires_account"])
        self.assertFalse(a["requires_credit_card"])
        self.assertIn("until Oct 8", a["description"])
        self.assertEqual(a["source_key"], "epic:ns1:id1:2026-10-01")

    def test_partial_discounts_are_not_free(self):
        # Epic's discountPercentage is the share you still pay: 40 means 60% off.
        self.assertEqual(parse_epic(epic_payload(epic_element("Sale", current=NOW, pct=40))), [])

    def test_skips_items_without_promotions(self):
        self.assertEqual(parse_epic(epic_payload(epic_element("Full price"))), [])

    def test_skips_mystery_games_and_missing_slugs(self):
        payload = epic_payload(
            epic_element("Mystery Game", current=NOW),
            epic_element("No page", current=NOW, mappings=(), url_slug="0123456789abcdef0123456789abcdef"),
        )
        self.assertEqual(parse_epic(payload), [])


STEAM_HTML = """
<a href="https://store.steampowered.com/app/111/Cool_Game/?snr=1_7" data-ds-appid="111">
  <span class="title">Cool &amp; Game</span></a>
<a href="https://store.steampowered.com/app/222/Some_DLC/?snr=1_7" data-ds-appid="222">
  <span class="title">Some DLC</span></a>
<a href="https://store.steampowered.com/sub/333/" data-ds-packageid="333"><span class="title">A Package</span></a>
"""


class SteamTest(unittest.TestCase):
    def test_parses_app_rows_only(self):
        rows = parse_search(STEAM_HTML)
        self.assertEqual([(a, n) for a, n, _ in rows], [("111", "Cool & Game"), ("222", "Some DLC")])

    def test_full_game_is_published(self):
        deal = build_deal("111", "Cool & Game", "https://store.steampowered.com/app/111/", {"type": "game"})
        self.assertEqual(deal["source_key"], "steam:111")
        self.assertEqual(deal["title"], "Cool & Game: Free to Keep on Steam")
        self.assertIsNone(deal["expires_at"])  # the nightly sync handles removal

    def test_dlc_is_excluded(self):
        details = {"type": "dlc", "fullgame": {"name": "Base Game"}}
        self.assertIsNone(build_deal("222", "Some DLC", "https://store.steampowered.com/app/222/", details))

    def test_unverified_items_are_excluded(self):
        self.assertIsNone(build_deal("1", "X", "https://s/app/1/", None))
        self.assertIsNone(build_deal("2", "OST", "https://s/app/2/", {"type": "music"}))


GOG_HTML = """
<script>{"products":[{"id":"9","title":"Nox\\u2122 Classic","slug":"nox_classic","productType":"game"}]}</script>
<div class="giveaway"><a _ngcontent-x="" class="giveaway__overlay-link"
   href="https://www.gog.com/en/game/nox_classic" selenium-id="giveawayOverlayLink"></a></div>
"""


class GogTest(unittest.TestCase):
    def test_parses_giveaway_with_title_from_json(self):
        deal = parse_giveaway(GOG_HTML)
        self.assertEqual(deal["title"], "Nox™ Classic: Free on GOG")
        self.assertEqual(deal["url"], "https://www.gog.com/en/game/nox_classic")
        self.assertEqual(deal["source_key"], "gog:giveaway:nox_classic")

    def test_no_giveaway(self):
        self.assertIsNone(parse_giveaway("<html>no banner today</html>"))

    def test_falls_back_to_slug_title(self):
        html = GOG_HTML.replace('"slug":"nox_classic"', '"slug":"other"')
        self.assertEqual(parse_giveaway(html)["title"], "Nox Classic: Free on GOG")


if __name__ == "__main__":
    unittest.main()

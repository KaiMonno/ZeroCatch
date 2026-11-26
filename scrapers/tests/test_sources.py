"""Parser tests for the first-party sources, using synthetic payloads shaped
like the real responses (2026-10)."""

import json
import os
import unittest
import urllib.parse
from unittest import mock

from scrapers import supabase_rest
from scrapers.epic import fetch_epic_deals, parse_epic
from scrapers.gog import parse_giveaway
from scrapers.steam import build_deal, parse_search


def epic_element(title, *, current=None, upcoming=None, pct=0, mappings=("game-abc123",), url_slug=None, price=1999):
    def offers(window):
        return [{"promotionalOffers": [{"startDate": window[0], "endDate": window[1],
                                        "discountSetting": {"discountPercentage": pct}}]}] if window else []
    return {
        "title": title, "id": "id1", "namespace": "ns1", "productSlug": None, "urlSlug": url_slug,
        "catalogNs": {"mappings": [{"pageSlug": s} for s in mappings]}, "offerMappings": [],
        "promotions": {"promotionalOffers": offers(current), "upcomingPromotionalOffers": offers(upcoming)},
        "price": {"totalPrice": {"originalPrice": price}},
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

    def test_skips_free_to_play_games(self):
        # Firestone (2026-11): $0 to begin with; Epic's "giveaway" is an in-game pack.
        self.assertEqual(parse_epic(epic_payload(epic_element("Firestone", upcoming=NEXT, price=0))), [])

    def test_an_empty_feed_is_an_error_not_a_sync(self):
        # Syncing an empty list would unpublish this week's games.
        with mock.patch("scrapers.epic.fetch", return_value=json.dumps(epic_payload()).encode()):
            with self.assertRaises(RuntimeError):
                fetch_epic_deals()


class DeleteStaleDealsTest(unittest.TestCase):
    def _query(self, **kwargs):
        response = mock.MagicMock()
        response.__enter__.return_value.read.return_value = b"[]"
        env = {"SUPABASE_URL": "https://db.example", "SUPABASE_SERVICE_ROLE_KEY": "k"}
        with mock.patch.dict(os.environ, env), mock.patch("urllib.request.urlopen", return_value=response) as urlopen:
            supabase_rest.delete_stale_deals("epic:", ["epic:a"], **kwargs)
        return urllib.parse.unquote(urlopen.call_args.args[0].full_url)

    def test_running_only_keeps_ended_windows(self):
        # Alien: Isolation (Nov 19-26) was swapped out while running: removed.
        # Ended windows also leave Epic's feed, but they're history: kept.
        self.assertIn("expires_at=gt.", self._query(running_only=True))

    def test_default_removes_every_unlisted_deal(self):
        url = self._query()
        self.assertNotIn("expires_at", url)
        self.assertIn('source_key=not.in.("epic:a")', url)


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
        deal = build_deal("111", "Cool & Game", "https://store.steampowered.com/app/111/", {"type": "game", "price_overview": {"discount_percent": 100}})
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


class FetchRetryTest(unittest.TestCase):
    def test_retries_transient_errors_then_succeeds(self):
        import urllib.error
        from unittest import mock

        from scrapers import fetch as f

        calls = []

        class Resp:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def read(self):
                return b"ok"

        def flaky(request, timeout):
            calls.append(1)
            if len(calls) < 3:
                raise urllib.error.URLError(TimeoutError("The read operation timed out"))
            return Resp()

        with mock.patch.object(f.urllib.request, "urlopen", side_effect=flaky), mock.patch.object(f.time, "sleep"):
            self.assertEqual(f._get("https://example.com/feed"), b"ok")
        self.assertEqual(len(calls), 3)

    def test_permanent_errors_are_not_retried(self):
        import urllib.error
        from unittest import mock

        from scrapers import fetch as f

        err = urllib.error.HTTPError("https://example.com", 404, "Not Found", {}, None)
        self.addCleanup(err.close)
        with mock.patch.object(f.urllib.request, "urlopen", side_effect=err) as opener, mock.patch.object(f.time, "sleep"):
            with self.assertRaises(urllib.error.HTTPError):
                f._get("https://example.com/missing")
        self.assertEqual(opener.call_count, 1)

    def test_rate_limits_wait_as_long_as_the_server_asks(self):
        import email.message
        import urllib.error
        from unittest import mock

        from scrapers import fetch as f

        def limited(seconds):
            headers = email.message.Message()
            headers["Retry-After"] = str(seconds)
            err = urllib.error.HTTPError("https://itch.io", 429, "Too Many Requests", headers, None)
            self.addCleanup(err.close)
            return err

        ok = mock.MagicMock()
        ok.__enter__.return_value.read.return_value = b"ok"
        with mock.patch.object(f.urllib.request, "urlopen", side_effect=[limited(30), ok]), mock.patch.object(f.time, "sleep") as sleep:
            self.assertEqual(f._get("https://itch.io/feed"), b"ok")
        sleep.assert_called_once_with(30)

        # Asked to wait longer than a run should stall: give up for tonight.
        with mock.patch.object(f.urllib.request, "urlopen", side_effect=[limited(3600)]), mock.patch.object(f.time, "sleep") as sleep:
            with self.assertRaises(urllib.error.HTTPError):
                f._get("https://itch.io/feed")
        sleep.assert_not_called()


class BatchesTest(unittest.TestCase):
    def test_mixed_rows_keep_column_defaults(self):
        from scrapers.supabase_rest import _batches

        accepted = {"source_key": "a", "title": "A", "_article_text": "x"}
        rejected = {"source_key": "b", "title": "B", "status": "rejected", "review_note": "ai: contest"}
        batches = _batches([accepted, rejected])
        self.assertEqual(len(batches), 2)
        # No row gets a null "status" that would override the database default.
        for batch in batches:
            for row in batch:
                self.assertNotIn(None, row.values())
                self.assertFalse(any(k.startswith("_") for k in row))


class RssSourcesTest(unittest.TestCase):
    def test_sources_are_https_with_key_safe_names(self):
        from scrapers.sources import RSS_SOURCES

        for source in RSS_SOURCES:
            self.assertTrue(source.url.startswith("https://"), source.url)
            # The name becomes the source column and the "name:" source_key prefix.
            self.assertRegex(source.name, r"^[a-z0-9]+$")

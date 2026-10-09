"""Polite HTTP: identify ourselves, honor robots.txt, and retry transient failures."""

import socket
import time
import urllib.error
import urllib.request
import urllib.robotparser
from functools import cache
from urllib.parse import urlsplit

USER_AGENT = "ZeroCatchBot/0.1 (+https://github.com/KaiMonno/zerocatch)"
TIMEOUT_S = 20
RETRY_DELAYS_S = (3, 10)  # two retries; the nightly run has time to spare


class RobotsDisallowed(Exception):
    pass


def _transient(err: Exception) -> bool:
    """Timeouts, dropped connections, rate limits and server errors are worth a retry;
    other 4xx responses (403, 404…) won't change on a second try."""
    if isinstance(err, urllib.error.HTTPError):
        return err.code == 429 or err.code >= 500
    return isinstance(err, (urllib.error.URLError, TimeoutError, socket.timeout, ConnectionError))


def _get(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt, delay in enumerate((*RETRY_DELAYS_S, None)):
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
                return response.read()
        except Exception as err:
            if delay is None or not _transient(err):
                raise
            time.sleep(delay)
    raise AssertionError("unreachable")


@cache
def _robots_for(origin: str) -> urllib.robotparser.RobotFileParser:
    parser = urllib.robotparser.RobotFileParser()
    try:
        parser.parse(_get(f"{origin}/robots.txt").decode("utf-8", "replace").splitlines())
    except urllib.error.HTTPError as err:
        # Per RFC 9309: a missing robots.txt (4xx) allows everything; a server
        # error (5xx) means we must assume everything is disallowed.
        parser.parse([] if 400 <= err.code < 500 else ["User-agent: *", "Disallow: /"])
    return parser


def fetch(url: str) -> bytes:
    parts = urlsplit(url)
    robots = _robots_for(f"{parts.scheme}://{parts.netloc}")
    if not robots.can_fetch(USER_AGENT, url):
        raise RobotsDisallowed(f"robots.txt disallows {url}")

    return _get(url)

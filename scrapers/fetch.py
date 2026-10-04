"""Polite HTTP: identify ourselves and honor robots.txt before every fetch."""

import urllib.error
import urllib.request
import urllib.robotparser
from functools import cache
from urllib.parse import urlsplit

USER_AGENT = "ZeroCatchBot/0.1 (+https://github.com/KaiMonno/zerocatch)"
TIMEOUT_S = 20


class RobotsDisallowed(Exception):
    pass


@cache
def _robots_for(origin: str) -> urllib.robotparser.RobotFileParser:
    parser = urllib.robotparser.RobotFileParser()
    request = urllib.request.Request(f"{origin}/robots.txt", headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
            parser.parse(response.read().decode("utf-8", "replace").splitlines())
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

    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
        return response.read()

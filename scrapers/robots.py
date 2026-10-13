"""robots.txt matching per RFC 9309, including the `*` and `$` wildcards.

Python's urllib.robotparser ignores wildcards, so a rule like
`Disallow: /newsearch.php?*rss=*` was silently treated as "allowed".
This implementation follows the standard instead:
- the group naming our product token wins over the `*` group
- the longest matching rule wins; on a tie, Allow wins
- no matching rule means allowed
"""

import re
from dataclasses import dataclass, field
from urllib.parse import urlsplit


@dataclass
class Robots:
    groups: list[tuple[list[str], list[tuple[bool, str]]]] = field(default_factory=list)  # (agents, [(allow, path)])

    @classmethod
    def parse(cls, text: str) -> "Robots":
        robots, agents, rules, last_was_agent = cls(), [], [], False
        for raw in text.splitlines():
            line = raw.split("#", 1)[0].strip()
            if ":" not in line:
                continue
            key, value = (part.strip() for part in line.split(":", 1))
            key = key.lower()
            if key == "user-agent":
                if not last_was_agent and agents:
                    robots.groups.append((agents, rules))
                    agents, rules = [], []
                agents.append(value.lower())
                last_was_agent = True
            elif key in ("allow", "disallow"):
                last_was_agent = False
                if agents and value:  # an empty Disallow allows everything: no rule needed
                    rules.append((key == "allow", value))
        if agents:
            robots.groups.append((agents, rules))
        return robots

    def _rules_for(self, user_agent: str) -> list[tuple[bool, str]]:
        token = user_agent.split("/")[0].strip().lower()
        specific = [r for agents, r in self.groups if token in agents]
        if specific:
            return [rule for group in specific for rule in group]
        return [rule for agents, r in self.groups if "*" in agents for rule in r]

    def can_fetch(self, user_agent: str, url: str) -> bool:
        parts = urlsplit(url)
        target = (parts.path or "/") + (f"?{parts.query}" if parts.query else "")
        best: tuple[int, bool] | None = None  # (match length, allow)
        for allow, pattern in self._rules_for(user_agent):
            if _matches(pattern, target):
                length = len(pattern)
                if best is None or length > best[0] or (length == best[0] and allow):
                    best = (length, allow)
        return True if best is None else best[1]


def _matches(pattern: str, target: str) -> bool:
    anchored = pattern.endswith("$")
    body = pattern[:-1] if anchored else pattern
    regex = "".join(".*" if ch == "*" else re.escape(ch) for ch in body)
    return re.match(regex + ("$" if anchored else ""), target) is not None


DISALLOW_ALL = Robots.parse("User-agent: *\nDisallow: /")
ALLOW_ALL = Robots()

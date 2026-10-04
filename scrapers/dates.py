"""Find the day a deal happens from text like "on October 6th", "10/6" or
"Today Only", so past deals are dropped and future ones arrive pre-scheduled.

A US deal day runs from midnight Eastern to 11:59pm Pacific, which covers
every mainland time zone.
"""

import re
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

EASTERN = ZoneInfo("America/New_York")
PACIFIC = ZoneInfo("America/Los_Angeles")

_MONTHS = {
    m: i + 1
    for i, names in enumerate(
        [("jan", "january"), ("feb", "february"), ("mar", "march"), ("apr", "april"), ("may",),
         ("jun", "june"), ("jul", "july"), ("aug", "august"), ("sep", "sept", "september"),
         ("oct", "october"), ("nov", "november"), ("dec", "december")]
    )
    for m in names
}  # fmt: skip
_MONTH_DAY_RE = re.compile(
    r"\b(" + "|".join(sorted(_MONTHS, key=len, reverse=True)) + r")\.? (\d{1,2})(?:st|nd|rd|th)?\b(?:,? (\d{4}))?",
    re.I,
)
# Not fractions like "1/2 price" or "1/4 lb".
_NUMERIC_RE = re.compile(
    r"(?<![\d/$.])(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?(?![\d/%])(?! ?(?:price|off|lb|cup|oz|pound))", re.I
)
_TODAY_RE = re.compile(r"\btoday\b", re.I)


def _infer_year(month: int, day: int, published: date) -> date | None:
    try:
        candidate = date(published.year, month, day)
    except ValueError:
        return None
    # "Jan 3" in a late-December post means next year.
    if candidate < published - timedelta(days=180):
        candidate = candidate.replace(year=published.year + 1)
    return candidate


def find_deal_day(text: str, published_at: datetime | None) -> date | None:
    """The single calendar day a deal is tied to, or None if no date is stated."""
    published = (published_at or datetime.now(timezone.utc)).astimezone(EASTERN).date()

    if m := _MONTH_DAY_RE.search(text):
        month, day, year = _MONTHS[m.group(1).lower()], int(m.group(2)), m.group(3)
        if year:
            try:
                return date(int(year), month, day)
            except ValueError:
                return None
        return _infer_year(month, day, published)

    if m := _NUMERIC_RE.search(text):
        month, day, year = int(m.group(1)), int(m.group(2)), m.group(3)
        if 1 <= month <= 12 and 1 <= day <= 31:
            if year:
                try:
                    return date(int(year) + (2000 if len(year) == 2 else 0), month, day)
                except ValueError:
                    return None
            return _infer_year(month, day, published)

    if _TODAY_RE.search(text):
        return published
    return None


def day_window(day: date) -> tuple[datetime, datetime]:
    """Midnight Eastern → 11:59pm Pacific on that day, in UTC."""
    start = datetime.combine(day, time(0, 0), EASTERN)
    end = datetime.combine(day, time(23, 59), PACIFIC)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)

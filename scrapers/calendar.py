"""Recurring food freebies (data/food_calendar.toml).

The file is the approval. Fixed-date entries (7/11, Halloween…) are published
`LEAD_DAYS` ahead with a future start, so they appear on the day. Entries whose
date varies by year ("~03-19") become pre-filled review leads instead, because
someone has to confirm the brand announced that year's date. Keys include
the year, so everything recurs annually.
"""

import calendar as cal
import re
import tomllib
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from .dates import day_window

CALENDAR_FILE = Path(__file__).parent / "data" / "food_calendar.toml"
LEAD_DAYS = 21

_ORDINALS = {"first": 1, "second": 2, "third": 3, "fourth": 4, "last": -1}
_WEEKDAYS = {name.lower(): i for i, name in enumerate(cal.day_name)}
_MONTHS = {name.lower(): i for i, name in enumerate(cal.month_name) if name}
_NTH_RE = re.compile(r"^(first|second|third|fourth|last) (\w+) of (\w+)$", re.I)
_FIXED_RE = re.compile(r"^(~?)(\d{2})-(\d{2})$")


def resolve_date(rule: str, year: int) -> tuple[date, bool]:
    """(date in `year`, is_approximate) for a calendar date rule."""
    rule = rule.strip()
    approximate = rule.startswith("~")
    if m := _FIXED_RE.match(rule):
        return date(year, int(m.group(2)), int(m.group(3))), bool(m.group(1))
    if m := _NTH_RE.match(rule.lstrip("~").strip()):
        ordinal, weekday, month = _ORDINALS[m.group(1).lower()], _WEEKDAYS[m.group(2).lower()], _MONTHS[m.group(3).lower()]
        days = [d for d in cal.Calendar().itermonthdates(year, month) if d.month == month and d.weekday() == weekday]
        return days[ordinal - 1 if ordinal > 0 else -1], approximate
    raise ValueError(f"Unrecognized calendar date rule: {rule!r}")


def upcoming_leads(events: list[dict], today: date, lead_days: int = LEAD_DAYS) -> list[dict]:
    leads = []
    for event in events:
        # Check this year and next, so late-December runs see January events.
        for year in (today.year, today.year + 1):
            day, approximate = resolve_date(event["date"], year)
            if not today <= day <= today + timedelta(days=lead_days):
                continue
            # Multi-day events (e.g. National Parks' July 3-5) run through the last day.
            start = day_window(day)[0]
            end = day_window(day + timedelta(days=int(event.get("days", 1)) - 1))[1]
            check = (
                f"DATE VARIES BY YEAR: confirm {event['merchant']} has announced it for {day:%B} {day.day}, "
                "and fix the dates if not."
                if approximate
                else f"Confirm {event['merchant']} is running it again this year."
            )
            leads.append(
                {
                    "source": "calendar",
                    "source_key": f"calendar:{event['key']}:{year}",
                    "title": f"{event['title']} ({day:%b} {day.day})"[:200],
                    "summary": f"Recurring freebie. {check} {event['description']} Last verified: {event['verified']}.",
                    "source_url": event["url"],
                    "source_categories": ["Recurring"],
                    "published_at": datetime.now(timezone.utc).isoformat(),
                    "is_food": bool(event.get("food", True)),
                    "suggested_category": "pure_freebie",
                    "suggested_merchant": event["merchant"],
                    "suggested_url": event["url"],
                    "suggested_starts_at": start.isoformat(),
                    "suggested_expires_at": end.isoformat(),
                    # Never stored on the lead; used when the entry publishes directly.
                    "_description": event["description"],
                    "_requires_account": bool(event.get("requires_account", False)),
                }
            )
    return leads


def lead_to_deal(lead: dict) -> dict:
    """A fixed-date calendar lead, published directly."""
    return {
        "source_key": lead["source_key"],
        "title": lead["title"],
        "description": lead["_description"],
        "category": "pure_freebie",
        "merchant": lead["suggested_merchant"],
        "url": lead["suggested_url"],
        "requires_account": lead["_requires_account"],
        "requires_credit_card": False,
        "instant_cancel_safe": False,
        "trial_duration_days": None,
        "starts_at": lead["suggested_starts_at"],
        "expires_at": lead["suggested_expires_at"],
        "is_hero_featured": False,
    }


def load_events(path: Path = CALENDAR_FILE) -> list[dict]:
    return tomllib.loads(path.read_text())["event"]


def fetch_calendar() -> tuple[list[dict], list[dict]]:
    """(deals to publish, leads to confirm) within the next LEAD_DAYS."""
    leads = upcoming_leads(load_events(), datetime.now(timezone.utc).date())
    confirm = [lead for lead in leads if "DATE VARIES BY YEAR" in lead["summary"]]
    publish = [lead_to_deal(lead) for lead in leads if lead not in confirm]
    print(f"  calendar: {len(publish)} to publish, {len(confirm)} to confirm (within {LEAD_DAYS} days)")
    return publish, confirm

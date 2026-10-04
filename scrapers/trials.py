"""Curated instant-cancel trials (data/trials.toml) → published deals.

The file is the approval: whatever is listed is published, and anything
removed from the file is unpublished on the next run (see sync in
supabase_rest.delete_stale_deals).
"""

import tomllib
from pathlib import Path

TRIALS_FILE = Path(__file__).parent / "data" / "trials.toml"
KEY_PREFIX = "trial:"


def load_trials(path: Path = TRIALS_FILE) -> list[dict]:
    return tomllib.loads(path.read_text()).get("trial", [])


def build_trial_deals(trials: list[dict]) -> list[dict]:
    return [
        {
            "source_key": f"{KEY_PREFIX}{t['key']}",
            "title": t["title"][:200],
            "description": t["description"],
            "category": "free_trial",
            "merchant": t["merchant"],
            "url": t["url"],
            "requires_account": True,
            "requires_credit_card": bool(t.get("requires_credit_card", True)),
            "instant_cancel_safe": True,
            "trial_duration_days": int(t["duration_days"]),
            "expires_at": None,
            "is_hero_featured": False,
        }
        for t in trials
    ]


def fetch_trial_deals() -> list[dict]:
    deals = build_trial_deals(load_trials())
    print(f"  trials: {len(deals)} curated instant-cancel trials")
    return deals

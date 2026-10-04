"""Minimal Supabase (PostgREST) client: just the one call the scrapers need."""

import json
import os
import urllib.error
import urllib.request


class SupabaseError(Exception):
    pass


def _headers(key: str) -> dict[str, str]:
    headers = {"apikey": key, "Content-Type": "application/json"}
    # Legacy service_role keys are JWTs and also go in Authorization. The newer
    # sb_secret_… keys are not JWTs and must only be sent as `apikey`.
    if not key.startswith("sb_"):
        headers["Authorization"] = f"Bearer {key}"
    return headers


def insert_new_candidates(rows: list[dict]) -> int:
    """Insert leads, skipping any source_key already queued (so re-runs never
    reset a reviewed candidate back to pending). Returns rows actually added."""
    if not rows:
        return 0
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    request = urllib.request.Request(
        f"{url}/rest/v1/deal_candidates?on_conflict=source_key&select=id",
        data=json.dumps(rows).encode(),
        method="POST",
        headers={**_headers(key), "Prefer": "resolution=ignore-duplicates,return=representation"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return len(json.loads(response.read() or b"[]"))
    except urllib.error.HTTPError as err:
        raise SupabaseError(f"{err.code}: {err.read().decode(errors='replace')}") from err

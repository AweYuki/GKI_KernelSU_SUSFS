import os
import re
import json
import base64
import time
import http.client
import urllib.request
import urllib.error
from datetime import datetime

REPO_URL = "https://android.googlesource.com/kernel/common"
BASE_URL = f"{REPO_URL}/+/refs/heads"
# Gitiles refs listing endpoint, fetching all branch / tag names in one request
REFS_URL = f"{REPO_URL}/+refs"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, "data")

# (android_version, kernel_version): (start_date, end_date, deprecated_cutoff_date)
# An end_date of None denotes an active version, automatically using the current month at runtime
TARGETS = {
    ("android12", "5.10"): ("2021-08", None, "2025-06"),
    ("android13", "5.15"): ("2022-06", None, "2025-05"),
    ("android14", "6.1"):  ("2023-06", None, "2025-08"),
    ("android15", "6.6"):  ("2024-10", None, "2025-08"),
    ("android16", "6.12"): ("2025-06", None, "2025-08"),
}

import binascii

ERRORS = (urllib.error.HTTPError, urllib.error.URLError,
          TimeoutError, http.client.RemoteDisconnected,
          ConnectionResetError, OSError, binascii.Error)


def get_end_date(end: str | None) -> str:
    """Return the end date: uses the current month if None."""
    if end is not None:
        return end
    return datetime.now().strftime("%Y-%m")


def make_date_range(start: str, end: str) -> list[str]:
    """Generate a list of YYYY-MM strings from start to end."""
    sy, sm = map(int, start.split("-"))
    ey, em = map(int, end.split("-"))
    dates = []
    y, m = sy, sm
    while (y, m) <= (ey, em):
        dates.append(f"{y}-{m:02d}")
        m += 1
        if m > 12:
            m = 1
            y += 1
    return dates


def try_fetch(url: str) -> str | None:
    """Attempt to fetch a URL; return None on failure."""
    try:
        with urllib.request.urlopen(url, timeout=20) as resp:
            return base64.b64decode(resp.read()).decode("utf-8", errors="replace")
    except ERRORS:
        return None


def fetch_refs() -> tuple[set[str], set[str]] | None:
    """Fetch all upstream branch and tag names at once (without refs/heads or refs/tags prefixes); return None on failure."""
    result = []
    for kind in ("heads", "tags"):
        url = f"{REFS_URL}/{kind}?format=JSON"
        try:
            with urllib.request.urlopen(url, timeout=60) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
        except ERRORS:
            return None
        # Gitiles JSON responses start with an anti-XSSI prefix line
        if raw.startswith(")]}'"):
            parts = raw.split("\n", 1)
            raw = parts[1] if len(parts) > 1 else ""
        try:
            result.append(set(json.loads(raw).keys()))
        except ValueError:
            return None
    return result[0], result[1]


def resolve_ref(branch: str, heads: set[str], tags: set[str]) -> str | None:
    """Resolve the actual upstream location of a monthly branch per build.yml rules:
    Active branch -> refs/heads/<branch>
    Migrated      -> refs/heads/deprecated/<branch>
    Deleted       -> refs/tags/<branch>_rN (release tag with the highest revision number)
    Not found     -> None
    """
    if branch in heads:
        return f"refs/heads/{branch}"
    if f"deprecated/{branch}" in heads:
        return f"refs/heads/deprecated/{branch}"
    prefix = f"{branch}_r"
    best, best_n = None, -1
    for tag in tags:
        if tag.startswith(prefix) and tag[len(prefix):].isdigit():
            n = int(tag[len(prefix):])
            if n > best_n:
                best, best_n = tag, n
    return f"refs/tags/{best}" if best else None


def fetch_makefile(android_ver: str, kernel_ver: str, date: str,
                   dep_cutoff: str,
                   refs: tuple[set[str], set[str]] | None = None) -> str | None:
    """Fetch the Makefile for a monthly branch.

    When refs are provided, fetch directly from the resolved upstream location (including release tags when the branch is deleted);
    otherwise fall back to probing paths one by one: try the expected path first, then fall back.
    """
    branch = f"{android_ver}-{kernel_ver}-{date}"

    if refs is not None:
        ref = resolve_ref(branch, *refs)
        if ref is None:
            return None
        return try_fetch(f"{REPO_URL}/+/{ref}/Makefile?format=TEXT")

    if dep_cutoff and date <= dep_cutoff:
        paths = [f"deprecated/{branch}", branch]
    else:
        paths = [branch, f"deprecated/{branch}"]

    for p in paths:
        url = f"{BASE_URL}/{p}/Makefile?format=TEXT"
        text = try_fetch(url)
        if text is not None:
            return text
        time.sleep(0.3)
    return None


def refresh_refs(entries: list[dict], android_ver: str, kernel_ver: str,
                 refs: tuple[set[str], set[str]]) -> int:
    """Set or update the ref field (actual upstream path) for each entry and return the number of changed entries.

    Branches migrate over time from active to deprecated/ and are eventually deleted, so refresh all entries on every run.
    """
    heads, tags = refs
    changed = 0
    for entry in entries:
        branch = f"{android_ver}-{kernel_ver}-{entry['date']}"
        ref = resolve_ref(branch, heads, tags)
        if entry.get("ref") == ref:
            continue
        if ref is None:
            entry.pop("ref", None)
        else:
            entry["ref"] = ref
        changed += 1
    return changed


def fetch_lts(android_ver: str, kernel_ver: str) -> str | None:
    """Fetch the LTS branch Makefile."""
    lts_branch = f"{android_ver}-{kernel_ver}-lts"
    url = f"{BASE_URL}/{lts_branch}/Makefile?format=TEXT"
    return try_fetch(url)


def parse_version(makefile_text: str) -> tuple[str, str, str] | None:
    """Extract VERSION, PATCHLEVEL, and SUBLEVEL from a Makefile."""
    vals = {}
    for key in ("VERSION", "PATCHLEVEL", "SUBLEVEL"):
        m = re.search(rf"^{key}\s*=\s*(\d+)", makefile_text, re.MULTILINE)
        if not m:
            return None
        vals[key] = m.group(1)
    return vals["VERSION"], vals["PATCHLEVEL"], vals["SUBLEVEL"]


def json_path(android_ver: str, kernel_ver: str) -> str:
    """Return the corresponding JSON file path."""
    return os.path.join(DATA_DIR, android_ver, f"{kernel_ver}.json")

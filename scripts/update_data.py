"""Incrementally update GKI kernel version data.

Reads existing JSON data, fetches only missing months, updates the LTS version,
and refreshes the ref field of each entry according to its actual upstream location
(active / deprecated/ / release tag).
"""

import json
import os
import time

from gki_fetch import (
    TARGETS, DATA_DIR,
    make_date_range, get_end_date,
    fetch_makefile, fetch_lts, fetch_refs, refresh_refs,
    parse_version, json_path,
)


def update_target(android_ver: str, kernel_ver: str,
                  date_start: str, date_end: str | None,
                  dep_cutoff: str,
                  refs: tuple[set[str], set[str]] | None = None) -> bool:
    """Incrementally update a single target and return whether any data changed."""
    path = json_path(android_ver, kernel_ver)
    end = get_end_date(date_end)
    changed = False

    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        entries = data.get("entries", [])
        # Sync deprecated_cutoff (sourced from TARGETS, not maintained manually in JSON)
        if data.get("deprecated_cutoff", "") != dep_cutoff:
            data["deprecated_cutoff"] = dep_cutoff
            changed = True
    else:
        data = {
            "android_version": android_ver,
            "kernel_version": kernel_ver,
            "deprecated_cutoff": dep_cutoff,
            "lts": None,
            "entries": [],
        }
        entries = []

    # Scan the full date range and exclude existing months to backfill missing historical data
    existing_dates = {e["date"] for e in entries}
    all_dates = make_date_range(date_start, end)
    new_dates = [d for d in all_dates if d not in existing_dates]

    if not new_dates:
        print(f"  No new months to fetch")
    else:
        print(f"  Fetching {len(new_dates)} new month(s): {new_dates[0]} ~ {new_dates[-1]}")
        for date in new_dates:
            label = f"{android_ver}-{kernel_ver}-{date}"
            print(f"    [{label}] ", end="", flush=True)

            text = fetch_makefile(android_ver, kernel_ver, date, dep_cutoff, refs)
            if text is None:
                print("not found, skip")
                continue

            ver = parse_version(text)
            if ver is None:
                print("parse failed, skip")
                continue

            version, patchlevel, sublevel = ver
            detail = f"{version}.{patchlevel}.{sublevel}"
            entries.append({"date": date, "kernel": detail})
            changed = True
            print(f"-> {detail}")
            time.sleep(0.3)

    entries.sort(key=lambda e: e["date"])

    # Upstream locations change over time (active -> deprecated/ -> tag only), so refresh all entries on every run
    if refs is not None:
        ref_changes = refresh_refs(entries, android_ver, kernel_ver, refs)
        if ref_changes:
            changed = True
            print(f"  Refreshed upstream ref for {ref_changes} entr{'y' if ref_changes == 1 else 'ies'}")

    lts_label = f"{android_ver}-{kernel_ver}-lts"
    print(f"  [{lts_label}] ", end="", flush=True)
    lts_text = fetch_lts(android_ver, kernel_ver)
    if lts_text is None:
        print("not found, skip")
    else:
        ver = parse_version(lts_text)
        if ver is None:
            print("parse failed, skip")
        else:
            version, patchlevel, sublevel = ver
            lts_value = f"{version}.{patchlevel}.{sublevel}"
            old_lts = data.get("lts")
            if old_lts != lts_value:
                changed = True
                print(f"-> {lts_value} (was {old_lts})")
            else:
                print(f"-> {lts_value} (unchanged)")
            data["lts"] = lts_value

    data["entries"] = entries
    if changed:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"  => Saved {len(entries)} entries to {path}")
    else:
        print(f"  => No changes")

    return changed


def main():
    any_changed = False
    refs = fetch_refs()
    if refs is None:
        # Do not abort the entire update on transient refs endpoint failures; only skip ref refresh
        print("WARNING: failed to fetch upstream refs, ref fields will not be refreshed this run")
    else:
        print(f"Fetched upstream refs: {len(refs[0])} heads, {len(refs[1])} tags")
    for (android_ver, kernel_ver), (date_start, date_end, dep_cutoff) in TARGETS.items():
        print(f"\n=== {android_ver} / {kernel_ver} ===")
        if update_target(android_ver, kernel_ver, date_start, date_end, dep_cutoff, refs):
            any_changed = True

    print(f"\n{'Data updated.' if any_changed else 'All data up-to-date.'}")
    return any_changed


if __name__ == "__main__":
    import sys
    try:
        changed = main()
    except Exception as e:
        print(f"\nFATAL: {e}", file=sys.stderr)
        sys.exit(1)
    # Exit code 0 indicates changes, 2 indicates no changes; 1 on exception
    sys.exit(0 if changed else 2)

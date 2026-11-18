#!/usr/bin/env python3
"""Drop entries for now-built-in modules from Kleaf's GKI module list.

The CIFS step forces CONFIG_CIFS=y / CONFIG_NETFS_SUPPORT=y / CONFIG_KEYS=y so the
feature is built into the image rather than shipped as modules. Kleaf then
verifies that every module named in its GKI module list was actually produced and
fails the build otherwise:

  ERROR: Unable to find fs/netfs/netfs.ko in any of the following directories:
  bazel-out/.../staging/lib/modules/6.18.21-android17-Wild/kernel

android16-6.12 patched this with a sed against modules.bzl. 6.18 moved the list
into bazel/modules_private.bzl, so the sed silently stopped matching.

Removes the given module paths from whichever list file carries them. Safe to
run when a path is absent, and safe to re-run.

Usage: cifs_modules_fix.py <kernel/common> <module path> [more...]
"""

import os
import sys

CANDIDATES = ("modules.bzl", "bazel/modules_private.bzl", "bazel/modules.bzl")


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit("usage: cifs_modules_fix.py <kernel/common> <module path> [more...]")
    root = sys.argv[1].rstrip("/")
    wanted = sys.argv[2:]

    for rel in CANDIDATES:
        path = os.path.join(root, rel)
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as fh:
            lines = fh.read().split("\n")
        out, removed = [], []
        for ln in lines:
            code = ln.split("#", 1)[0].strip()
            stripped = code.rstrip(",").strip().strip('"')
            if stripped in wanted and code.startswith('"'):
                removed.append(stripped)
                continue
            out.append(ln)
        if removed:
            with open(path, "w", encoding="utf-8") as fh:
                fh.write("\n".join(out))
            print(f"  {rel}: removed {', '.join(sorted(set(removed)))}")
        else:
            print(f"  {rel}: nothing to remove")

    # verify
    for rel in CANDIDATES:
        path = os.path.join(root, rel)
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as fh:
            lines = fh.read().splitlines()
        for ln in lines:
            code = ln.split("#", 1)[0]
            for m in wanted:
                if f'"{m}"' in code:
                    sys.exit(f"ERROR: {rel} still lists {m}")
    print("[+] module list clean")


if __name__ == "__main__":
    main()

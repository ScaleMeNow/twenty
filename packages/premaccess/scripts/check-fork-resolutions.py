#!/usr/bin/env python3
"""Every "resolutions" change the fork makes on top of upstream is declared in
RESOLUTIONS.md, and every declared key is still a fork change.

Two failures, no advisory tier:

  UNDECLARED  a (manifest, key) the fork adds, changes or removes against upstream that
              no RESOLUTIONS.md row names.
  STALE KEY   a row key its manifest no longer changes: the condition that retires it
              was met, delete it (and the row when it was the last key).

Covers the root package.json and every nested one: the fork gate's dep-manifest tier
caps nested manifests by line count only, which let a nested resolution go stale
unnoticed (body-parser/qs in standard-application-dependencies, 2026-11-22).

Both sides are read from git, never the working tree: the fork from HEAD, upstream from
the merge-base with --base, so a branch behind upstream is judged on its own changes.

Usage: check-fork-resolutions.py [--base upstream/main]
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections.abc import Iterable

ROWS_FILE = "packages/premaccess/RESOLUTIONS.md"
HEADER = re.compile(r"^\|\s*Manifest\s*\|\s*Key\s*\|")
TICKED = re.compile(r"`([^`]+)`")

Pair = tuple[str, str]  # (manifest path, resolution key)


def git(*args: str) -> str:
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


def blob(rev: str, path: str) -> str | None:
    try:
        return git("show", f"{rev}:{path}")
    except subprocess.CalledProcessError:
        return None


def resolutions(text: str | None) -> dict[str, str]:
    if text is None:
        return {}
    value = json.loads(text).get("resolutions") or {}
    return {str(k): str(v) for k, v in value.items()}


def changed_pairs(ours: dict[str, str], theirs: dict[str, str], path: str) -> set[Pair]:
    """Keys the fork adds, changes or removes in one manifest."""
    keys = set(ours) | set(theirs)
    return {(path, k) for k in keys if ours.get(k) != theirs.get(k)}


def split_cells(line: str) -> list[str]:
    """Split a markdown table line on pipes outside backticks."""
    cells, current, ticked = [], [], False
    for ch in line.strip().strip("|"):
        if ch == "`":
            ticked = not ticked
        if ch == "|" and not ticked:
            cells.append("".join(current).strip())
            current = []
        else:
            current.append(ch)
    cells.append("".join(current).strip())
    return cells


def declared_pairs(text: str) -> set[Pair]:
    """(manifest, key) pairs of the table under the `| Manifest | Key |` header only."""
    pairs: set[Pair] = set()
    in_table = False
    for line in text.splitlines():
        stripped = line.strip()
        if not in_table:
            in_table = bool(HEADER.match(stripped))
            continue
        if not stripped.startswith("|"):
            break
        cells = split_cells(stripped)
        if set(cells[0]) <= {"-", ":", " "}:
            continue
        manifests = TICKED.findall(cells[0])
        if len(manifests) != 1 or len(cells) < 2:
            raise ValueError(f"{ROWS_FILE}: row needs exactly one backticked manifest: {stripped}")
        pairs |= {(manifests[0], key) for key in TICKED.findall(cells[1])}
    if not in_table:
        raise ValueError(f"{ROWS_FILE}: no `| Manifest | Key |` table")
    return pairs


def evaluate(changed: set[Pair], declared: set[Pair]) -> list[str]:
    errors = [
        f"::error file={path}::resolution '{key}' differs from upstream and is not declared in {ROWS_FILE}"
        for path, key in sorted(changed - declared)
    ]
    errors += [
        f"::error file={ROWS_FILE}::'{key}' ({path}) no longer differs from upstream; delete it"
        for path, key in sorted(declared - changed)
    ]
    return errors


def manifests_touched(base: str) -> Iterable[str]:
    out = git("diff", "--name-only", f"{base}...HEAD", "--", "package.json", "*/package.json")
    return [p for p in out.splitlines() if p and "node_modules/" not in p]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--base", default="upstream/main")
    base = parser.parse_args().base

    merge_base = git("merge-base", base, "HEAD").strip()
    changed: set[Pair] = set()
    for path in manifests_touched(base):
        changed |= changed_pairs(
            resolutions(blob("HEAD", path)), resolutions(blob(merge_base, path)), path
        )
    declared = declared_pairs(blob("HEAD", ROWS_FILE) or "")

    errors = evaluate(changed, declared)
    for line in errors:
        print(line)
    if errors:
        print(f"\nFork resolutions check FAILED: {len(errors)} problem(s).")
        return 1
    print(f"Fork resolutions check passed: {len(changed)} fork resolution change(s), all declared.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

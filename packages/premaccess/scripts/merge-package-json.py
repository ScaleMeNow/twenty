#!/usr/bin/env python3
"""Three-way merge of a conflicted package.json during the fork's upstream rebase.

Reads the index stages of PATH (1 = base, 2 = ours/upstream side, 3 = theirs/the
fork commit being replayed) and applies the fork commit's delta onto upstream:

- a key only the fork changed takes the fork's value; a key only the fork
  deleted is deleted;
- a key both sides changed to different version ranges keeps the higher
  version (both sides bump resolutions to patch CVEs, so the newer one wins);
- any other two-sided change (a doc string, a script) keeps upstream's value
  and is printed as KEPT-UPSTREAM so it gets a human look.

Writes PATH with 2-space indent + trailing newline and stages it. Exit 0 when
merged, 1 when a stage is missing (not a three-way conflict).

Usage: merge-package-json.py <path-in-repo>   (run inside the checkout; called by
rebase-onto-upstream.sh)
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from typing import Any

_MISSING = object()
_VERSION = re.compile(r"^[\^~>=<]*\s*v?(\d+(?:\.\d+)*)")


def _stage(n: int, path: str) -> dict[str, Any] | None:
    out = subprocess.run(
        ["git", "show", f":{n}:{path}"], capture_output=True, text=True, check=False
    )
    return json.loads(out.stdout) if out.returncode == 0 else None


def _version_key(value: Any) -> tuple[int, ...] | None:
    if not isinstance(value, str):
        return None
    match = _VERSION.match(value.split("patch:")[-1].split("@npm%3A")[-1])
    return tuple(int(p) for p in match.group(1).split(".")) if match else None


def _merge(base: Any, ours: Any, theirs: Any, path: str, notes: list[str]) -> Any:
    if theirs == base:
        return ours
    if ours == base or ours == theirs:
        return theirs
    if isinstance(base, dict) and isinstance(ours, dict) and isinstance(theirs, dict):
        merged: dict[str, Any] = {}
        for key in [*ours, *(k for k in theirs if k not in ours)]:
            value = _merge(
                base.get(key, _MISSING),
                ours.get(key, _MISSING),
                theirs.get(key, _MISSING),
                f"{path}.{key}",
                notes,
            )
            if value is not _MISSING:
                merged[key] = value
        return merged
    ours_v, theirs_v = _version_key(ours), _version_key(theirs)
    if ours_v is not None and theirs_v is not None:
        winner = theirs if theirs_v > ours_v else ours
        notes.append(
            f"MAX-VERSION {path}: upstream {ours!r} / fork {theirs!r} -> {winner!r}"
        )
        return winner
    notes.append(f"KEPT-UPSTREAM {path}: fork value {theirs!r} dropped")
    return ours


def main() -> int:
    path = sys.argv[1]
    base, ours, theirs = (_stage(n, path) for n in (1, 2, 3))
    if base is None or ours is None or theirs is None:
        print(f"{path}: not a three-way conflict", file=sys.stderr)
        return 1
    notes: list[str] = []
    merged = _merge(base, ours, theirs, path, notes)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(merged, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    subprocess.run(["git", "add", path], check=True)
    for note in notes:
        print(note)
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env bash
# Reconcile Dependabot alerts against packages/premaccess/SECURITY-HOLDS.md.
#
# A held package's alerts are DISMISSED on GitHub as tolerable_risk with a comment
# citing SECURITY-HOLDS.md, so the open list only ever shows work nobody has looked
# at. Every alert lands in exactly one state:
#
#   open, package held                      -> OPEN ON HOLD    FAIL: a new advisory on a
#                                                              held package; review it, then
#                                                              dismiss it citing the hold
#   open, package not held, lockfile in
#     this checkout already patched         -> fixed           pass (Dependabot closes it on
#                                                              its next scan of main)
#   open, anything else                     -> UNDECLARED      FAIL: fix it, or hold it
#   dismissed citing the holds file,
#     package held, lockfile still vulnerable -> held          pass
#   dismissed citing the holds file,
#     package no longer held                -> STALE DISMISSAL FAIL: reopen the alert
#   dismissed citing the holds file,
#     lockfile no longer vulnerable         -> STALE DISMISSAL FAIL: the fix landed; drop
#                                                              the hold, reopen the alert
#   held package with no open and no
#     hold-dismissed alert still vulnerable -> STALE HOLD      FAIL: delete the row
#
# "lockfile in this checkout" is the alert's manifest_path read from disk and matched
# against the advisory range with the repo's own semver, so "fixed" is proven, never
# assumed. Run from any directory of the repo after `yarn install`.
#
# GITHUB_TOKEN cannot read the Dependabot alerts API, so this runs from a machine with
# `gh auth` (or a workflow carrying a PAT), not from a stock Actions job.
set -euo pipefail

REPO="${REPO:-ScaleMeNow/twenty}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HOLDS="$ROOT/packages/premaccess/SECURITY-HOLDS.md"
CITE="SECURITY-HOLDS.md"

[ -f "$HOLDS" ] || { echo "missing $HOLDS" >&2; exit 2; }
[ -d "$ROOT/node_modules/semver" ] || { echo "missing $ROOT/node_modules/semver: run yarn install first" >&2; exit 2; }

# Held packages: the first backticked cell of each table row.
mapfile -t HELD < <(grep -oP '^\| \x60\K[^\x60]+' "$HOLDS" | sort -u)

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

FIELDS='[.number, .state, .dependency.package.name, .dependency.manifest_path, .security_vulnerability.vulnerable_version_range] | @tsv'
gh api "repos/$REPO/dependabot/alerts?state=open&per_page=100" --paginate \
  -q ".[] | $FIELDS" >"$TMP/alerts.tsv"
gh api "repos/$REPO/dependabot/alerts?state=dismissed&per_page=100" --paginate \
  -q ".[] | select(.dismissed_reason == \"tolerable_risk\" and ((.dismissed_comment // \"\") | contains(\"$CITE\"))) | $FIELDS" \
  >>"$TMP/alerts.tsv"

# Append a 6th column: does the alert's lockfile in this checkout still resolve a
# version inside the vulnerable range? vulnerable | patched | no-lockfile.
node - "$ROOT" "$TMP/alerts.tsv" >"$TMP/classified.tsv" <<'NODE'
const fs = require('fs');
const path = require('path');
const [root, file] = process.argv.slice(2);
const semver = require(path.join(root, 'node_modules/semver'));
const parsed = new Map();
const versionsIn = (lockfile, pkg) => {
  if (!parsed.has(lockfile)) {
    const byPkg = new Map();
    let current = null;
    for (const line of fs.readFileSync(lockfile, 'utf8').split('\n')) {
      if (line.startsWith('"')) {
        const first = line.slice(1).split(',')[0];
        current = first.slice(0, first.indexOf('@', first.startsWith('@') ? 1 : 0));
      } else if (current && line.startsWith('  version: ')) {
        byPkg.set(current, [...(byPkg.get(current) ?? []), line.slice(11).trim()]);
        current = null;
      }
    }
    parsed.set(lockfile, byPkg);
  }
  return parsed.get(lockfile).get(pkg) ?? [];
};
for (const row of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
  const [, , pkg, manifest, range] = row.split('\t');
  const lockfile = path.join(root, manifest);
  let lock = 'no-lockfile';
  if (manifest.endsWith('yarn.lock') && fs.existsSync(lockfile)) {
    const semverRange = range.replace(/,\s*/g, ' ');
    const hit = versionsIn(lockfile, pkg).some((v) =>
      semver.satisfies(v, semverRange, { includePrerelease: true }),
    );
    lock = hit ? 'vulnerable' : 'patched';
  }
  console.log(`${row}\t${lock}`);
}
NODE

is_held() {
  local h
  for h in ${HELD[@]+"${HELD[@]}"}; do [ "$h" = "$1" ] && return 0; done
  return 1
}

failures=0
fixed=0
held_ok=0
declare -A COVERED=()

printf '%-6s %-10s %-26s %-16s %s\n' ALERT GITHUB PACKAGE RESULT LOCKFILE
# Pagination over a list that is changing can return an alert twice; count it once.
while IFS=$'\t' read -r num state pkg manifest _range lock; do
  if [ "$state" = "open" ]; then
    if is_held "$pkg"; then
      result="OPEN ON HOLD"; failures=$((failures + 1))
    elif [ "$lock" = "patched" ]; then
      result="fixed"; fixed=$((fixed + 1))
    else
      result="UNDECLARED"; failures=$((failures + 1))
    fi
  elif ! is_held "$pkg" || [ "$lock" != "vulnerable" ]; then
    result="STALE DISMISSAL"; failures=$((failures + 1))
  else
    result="held"; held_ok=$((held_ok + 1)); COVERED["$pkg"]=1
  fi
  printf '%-6s %-10s %-26s %-16s %s (%s)\n' "#$num" "$state" "$pkg" "$result" "$manifest" "$lock"
done < <(awk -F'\t' '!seen[$1]++' "$TMP/classified.tsv" | sort -t$'\t' -k3,3 -k1,1n)

stale=0
for h in ${HELD[@]+"${HELD[@]}"}; do
  if [ -z "${COVERED[$h]:-}" ]; then
    echo "STALE HOLD: $h has no hold-dismissed alert still vulnerable here — delete its row from $CITE"
    stale=$((stale + 1))
  fi
done

echo
if [ "$failures" -gt 0 ] || [ "$stale" -gt 0 ]; then
  echo "FAILED: $failures alert(s) in a failing state, $stale stale hold(s)."
  echo "  UNDECLARED       fix the dependency, or add a row to $CITE and dismiss the alert citing it"
  echo "  OPEN ON HOLD     review the advisory, then: gh api -X PATCH repos/$REPO/dependabot/alerts/<n> \\"
  echo "                   -f state=dismissed -f dismissed_reason=tolerable_risk -f dismissed_comment='Held: packages/premaccess/$CITE (<pkg>). ...'"
  echo "  STALE DISMISSAL  gh api -X PATCH repos/$REPO/dependabot/alerts/<n> -f state=open"
  echo "  STALE HOLD       delete the row from $CITE"
  exit 1
fi
echo "OK: $held_ok alert(s) held (dismissed citing $CITE), $fixed open alert(s) already patched in this checkout, ${#HELD[@]} hold(s), none stale."

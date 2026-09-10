#!/usr/bin/env bash
# Reconcile open Dependabot alerts against packages/premaccess/SECURITY-HOLDS.md.
#
# Two outcomes per alert: it is fixed (so it is not open), or its package is named
# in the holds table with a reason. Anything else fails.
#
# GITHUB_TOKEN cannot read the Dependabot alerts API, so this runs from a machine
# with `gh auth` (or a workflow carrying a PAT), not from a stock Actions job.
set -euo pipefail

REPO="${REPO:-ScaleMeNow/twenty}"
HOLDS="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/SECURITY-HOLDS.md"

[ -f "$HOLDS" ] || { echo "missing $HOLDS" >&2; exit 2; }

# Held packages: the first backticked cell of each table row.
mapfile -t HELD < <(grep -oP '^\| `\K[^`]+' "$HOLDS" | sort -u)

mapfile -t OPEN < <(
  gh api "repos/$REPO/dependabot/alerts?state=open&per_page=100" --paginate \
    -q '.[] | "\(.security_advisory.severity)\t\(.dependency.package.name)"' \
  | sort | uniq -c | awk '{print $2"\t"$3"\t"$1}'
)

undeclared=0
held_seen=()

printf '%-10s %-34s %s\n' SEVERITY PACKAGE STATE
for row in ${OPEN[@]+"${OPEN[@]}"}; do
  sev="$(cut -f1 <<<"$row")"; pkg="$(cut -f2 <<<"$row")"; n="$(cut -f3 <<<"$row")"
  state="UNDECLARED"
  for h in ${HELD[@]+"${HELD[@]}"}; do
    if [ "$h" = "$pkg" ]; then
      state="held"
      held_seen+=("$pkg")
      break
    fi
  done
  printf '%-10s %-34s %s (%s alert(s))\n' "$sev" "$pkg" "$state" "$n"
  [ "$state" = "UNDECLARED" ] && undeclared=$((undeclared + 1))
done

# A hold whose alerts are gone is debt that can no longer fail on its own.
stale=0
for h in ${HELD[@]+"${HELD[@]}"}; do
  found=0
  for seen in ${held_seen[@]+"${held_seen[@]}"}; do
    [ "$seen" = "$h" ] && found=1 && break
  done
  if [ "$found" -eq 0 ]; then
    echo "STALE HOLD: $h has no open alert — delete its row from SECURITY-HOLDS.md"
    stale=$((stale + 1))
  fi
done

echo
if [ "$undeclared" -gt 0 ] || [ "$stale" -gt 0 ]; then
  echo "FAILED: $undeclared undeclared package(s), $stale stale hold(s)."
  echo "Fix the dependency, or add a row to packages/premaccess/SECURITY-HOLDS.md"
  echo "naming the reason and the condition that retires it."
  exit 1
fi
echo "All ${#OPEN[@]} open alert package(s) are declared held; no stale holds."

#!/usr/bin/env bash
# Rebase the current branch onto upstream, resolving the conflicts that recur by
# construction, and stop on any other one.
#
# One copy, two callers: the weekly job (.github/workflows/ci-upstream-rebase-weekly.yaml)
# and the local mirror (scripts/fork-rebase-weekly.sh in ScaleMeNow/meta-dojo).
#
# Recurring conflicts and how they are resolved:
#   **/yarn.lock    upstream's side is taken during the replay (a lockfile is an output,
#                   not a source); at the end the root lockfile is regenerated from the
#                   rebased package.json files, the in-range refreshes declared in
#                   ../lockfile-refresh.txt are replayed, and all of it is committed as
#                   "chore(rebase): regenerate lockfiles on upstream/main <sha>".
#   **/package.json three-way JSON merge (merge-package-json.py): the fork commit's delta
#                   onto upstream, higher version wins when both sides bumped a range.
# From 2026-09-14 to 2026-10-05 every weekly run stopped on yarn.lock alone and the fork
# went 755 commits behind (issue #70).
#
# Fork commits whose changes upstream already carries become empty and are dropped by
# git; they are listed so the caller can report them.
#
# Usage: rebase-onto-upstream.sh <upstream-ref>     (run from the repo root, branch checked out)
#   CONFLICTS_FILE  where to write the unresolved conflict list (default /tmp/conflicts.txt)
#
# Exit codes:
#   0  rebased; lockfile regenerated if it changed
#   3  conflict outside the recurring set; rebase aborted, list in $CONFLICTS_FILE,
#      "STOPPED_AT <sha> <subject>" printed
#   4  rebased, but the lockfile regeneration failed (branch left at the rebased tip)

set -euo pipefail

UPSTREAM="${1:?usage: rebase-onto-upstream.sh <upstream-ref>}"
CONFLICTS_FILE="${CONFLICTS_FILE:-/tmp/conflicts.txt}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# This file and its helper live in the tree the rebase rewrites: run from a copy.
if [ -z "${REBASE_ONTO_UPSTREAM_COPY:-}" ]; then
  copy="$(mktemp -d)"
  cp "$HERE/rebase-onto-upstream.sh" "$HERE/merge-package-json.py" "$copy/"
  REBASE_ONTO_UPSTREAM_COPY=1 bash "$copy/rebase-onto-upstream.sh" "$@" && rc=0 || rc=$?
  rm -rf "$copy"
  exit "$rc"
fi
ATTRS="$(git rev-parse --git-path info/attributes)"
ORIG_HEAD="$(git rev-parse HEAD)"
REPO_ROOT="$(git rev-parse --show-toplevel)"

# Scoped to this command: the driver is passed with -c, the attribute is removed on exit.
mkdir -p "$(dirname "$ATTRS")"
touch "$ATTRS"
cp "$ATTRS" "$ATTRS.rebase-bak"
echo 'yarn.lock merge=premaccess-take-upstream' >> "$ATTRS"
trap 'mv "$ATTRS.rebase-bak" "$ATTRS"' EXIT
GIT=(git -c merge.premaccess-take-upstream.driver=true -c core.editor=true)

if ! "${GIT[@]}" rebase "$UPSTREAM" >/dev/null 2>&1; then
  while :; do
    mapfile -t unresolved < <(git diff --name-only --diff-filter=U)
    if [ "${#unresolved[@]}" -eq 0 ]; then
      echo "rebase stopped without a file conflict:" >&2
      git status --short >&2
      git rebase --abort
      exit 3
    fi
    if printf '%s\n' "${unresolved[@]}" | grep -qv '\(^\|/\)package\.json$'; then
      printf '%s\n' "${unresolved[@]}" | sort -u > "$CONFLICTS_FILE"
      echo "STOPPED_AT $(git log -1 --format='%h %s' REBASE_HEAD)"
      git rebase --abort
      exit 3
    fi
    for f in "${unresolved[@]}"; do
      echo "package.json merge at $(git log -1 --format='%h' REBASE_HEAD): $f"
      PYTHONDONTWRITEBYTECODE=1 python3 "$HERE/merge-package-json.py" "$f" | sed 's/^/  /'
    done
    if "${GIT[@]}" rebase --continue >/dev/null 2>&1; then break; fi
  done
fi

dropped="$(LC_ALL=C comm -23 \
  <(git log --format=%s "$UPSTREAM..$ORIG_HEAD" | LC_ALL=C sort) \
  <(git log --format=%s "$UPSTREAM..HEAD" | LC_ALL=C sort))"
if [ -n "$dropped" ]; then
  echo "fork commits dropped as already upstream:"
  while IFS= read -r subject; do echo "  $subject"; done <<< "$dropped"
fi

# Constraints need a linked node_modules, which update-lockfile mode never builds.
export YARN_ENABLE_CONSTRAINTS_CHECKS=false
if ! yarn install --mode update-lockfile; then
  echo "yarn.lock regeneration failed on the rebased tree" >&2
  exit 4
fi

# Lockfile-only fixes the fork carries (lockfile-refresh.txt); the replay dropped them.
REFRESH_LIST="$REPO_ROOT/packages/premaccess/lockfile-refresh.txt"
if [ -f "$REFRESH_LIST" ]; then
  while read -r dir pkg; do
    case "$dir" in ''|'#'*) continue ;; esac
    if ! (cd "$REPO_ROOT/$dir" && yarn up -R "$pkg" --mode=update-lockfile >/dev/null); then
      echo "lockfile refresh failed: $dir $pkg" >&2
      exit 4
    fi
    echo "lockfile refresh: $dir $pkg"
  done < "$REFRESH_LIST"
fi

git add -u -- '*yarn.lock'
if ! git diff --cached --quiet; then
  git commit -q -m "chore(rebase): regenerate lockfiles on upstream/main $(git rev-parse --short=10 "$UPSTREAM")"
  echo "lockfiles regenerated and committed"
fi

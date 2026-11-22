# Security holds

Every Dependabot alert on `ScaleMeNow/twenty` is either **fixed** or **held here
with the reason it cannot be**. A held alert is dismissed on GitHub as
`tolerable_risk` with a comment citing this file, so the open list only ever shows
work nobody has reviewed. There is no third state: `scripts/check-security-holds.sh`
fails on anything else.

Each entry carries the condition that retires it. Delete the entry the same day
that condition is met — a hold nobody revisits is indistinguishable from the drift
it was meant to replace.

The alert totals move whenever an advisory is published, so this file only counts
per row - `scripts/check-security-holds.sh` is the authority on what is open,
dismissed and declared.

| Package | Alerts | Why it cannot be fixed | Retire when |
|---|---|---|---|
| `@cyntler/react-doc-viewer` | 1 medium | No patched version (`<= 1.17.1` is every release). A direct upstream dependency of twenty-front; removing it is a product decision, not a dependency bump. | upstream publishes a fix, or twenty-front drops the viewer. |
| `glob` | 3 medium (GHSA-3g3m-2fjr-6pw4) | Only the three twenty-server dependency dirs (`application-package/constants/standard-application-dependencies`, `workspace-custom-application-dependencies`, `logic-function-drivers/constants/common-layer-dependencies`): archiver-utils 5 declares glob ^10 and cacache 20 glob ^13, patched only in 14.0.2. Forcing it means editing those upstream manifests and lockfiles, whose checksums upstream's `get-default-application-package-fields.util.spec.ts` pins, and that changes every workspace's application layer identity. Root and the example apps are forced to 14 in `RESOLUTIONS.md`. Reached only by zip and npm-cache tooling, never by user input. | archiver-utils and cacache declare glob >= 14.0.2, or upstream forces it in those dirs. |
| `minimatch` | 3 medium (GHSA-g3hv-75wg-m249) | Same three dirs, through the glob 10/13 copies above (minimatch ^9, ^10); patched only in 11.0.1. Same checksum constraint. | the glob hold above retires, or upstream forces minimatch >= 11.0.1 in those dirs. |

## Reconciling

```bash
gh auth status   # a token with repo security read
yarn install     # the check reads semver from node_modules
bash packages/premaccess/scripts/check-security-holds.sh
```

Per alert, one state:

| GitHub state | Condition | Result |
|---|---|---|
| open | package held here | **OPEN ON HOLD** - a new advisory on a held package; review it, then dismiss it citing this file |
| open | not held, and the alert's lockfile in this checkout no longer resolves a vulnerable version | fixed (Dependabot closes it on its next scan of main) |
| open | anything else | **UNDECLARED** - fix it, or add a row and dismiss it |
| dismissed as `tolerable_risk` citing this file | package held and its lockfile still vulnerable | held |
| dismissed as `tolerable_risk` citing this file | package no longer held, or its lockfile is patched | **STALE DISMISSAL** - reopen it |
| - | a row with no hold-dismissed alert still vulnerable | **STALE HOLD** - delete the row |

Dismissing a held alert, after checking the advisory still has no reachable fix
(GitHub caps the comment at 280 characters):

```bash
gh api -X PATCH repos/ScaleMeNow/twenty/dependabot/alerts/<n> \
  -f state=dismissed -f dismissed_reason=tolerable_risk \
  -f dismissed_comment="Held: packages/premaccess/SECURITY-HOLDS.md (<pkg>). <reason>. Retire: <condition>."
```

Not wired as a GitHub Actions workflow on purpose: `GITHUB_TOKEN` cannot read the
Dependabot alerts API, so a workflow built on it would be red by construction —
the exact failure mode the fork gate was just fixed for. Run it from a machine
with `gh auth`, or from a workflow once a PAT is provisioned.

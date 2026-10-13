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
| `@graphql-tools/utils` | 2 high (root `yarn.lock`, and `packages/twenty-server/package.json` as a direct dependency) | Vulnerable `<= 12.0.0`, first fix 12.0.1, with no backport to 9.x, 10.x or 11.x. The 12.x consumers are fixed (`@graphql-tools/utils@npm:12.0.0` resolution, `^12` refreshed in `lockfile-refresh.txt`); what remains is twenty-server's direct `9.2.1` pin and the graphql-codegen / graphql-tools loaders that declare `^10` and `^11`, all build-time codegen tooling except the server pin, and every one a major bump in upstream code. | twenty-server moves off 9.2.1 and the codegen tooling to `^12.0.1`. |
| `http-cache-semantics` | 4 high (root `yarn.lock`, `seed-dependencies`, `examples/postcard`, `examples/hello-world`) | No patched version: every release (`<= 4.2.0`) is in range. Reached through `cacheable-request` and `make-fetch-happen` (npm/got HTTP caching in build and install tooling). | a patched `http-cache-semantics` release exists; then refresh it in each lockfile. |
| `katex` | 1 low | Fixed in 0.18.2; `rehype-katex` 7 and `micromark-extension-math` 3 (docs math rendering) declare `^0.16.0`, and a 0.x minor is a breaking range. Docs build only. | `rehype-katex` / `micromark-extension-math` accept katex >= 0.18.2. |
| `postcss-selector-parser` | 1 medium | Fixed in 7.1.6; the 6.x copy comes from `postcss-nested` `^6.2.0` and the `tailwindcss-v3` alias `^6.1.2`, a major bump from what they declare. The 7.x consumers already resolve 7.1.6. | `postcss-nested` and the `tailwindcss-v3` alias move to postcss-selector-parser 7. |
| `sprintf-js` | 1 medium | No patched version (`<= 1.1.3` is every release). Reached through `argparse` 1.x, the js-yaml 3 line. | a patched release exists, or js-yaml 3 / argparse 1 leave the tree. |
| `react-router` | 14 medium (GHSA-337j-9hxr-rhxg + GHSA-wrjc-x8rr-h8h6 in each of the 7 nested app lockfiles) | The fix is 7.18.0, a major bump from what these lockfiles can reach. The root tree is on 7.18.4 since upstream's router 7 migration; the 7 lockfiles under `packages/twenty-apps/public/` (call-recorder, companion, fireflies, granola, last-contact, slack, teams) still resolve 6.30.6 because the published `twenty-ui@^1.0.0-alpha.1` they depend on pins `react-router-dom@^6.4.4`. Those lockfiles are upstream's and track the published package, not the workspace. Dependabot security updates cannot fix them either (an `ignore` entry never applied to security updates, and version updates run at `open-pull-requests-limit: 0`), so there is no dependabot.yml entry for them. | the published `twenty-ui` the nested apps consume moves to react-router 7. |

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

# Security holds

Every open Dependabot alert on `ScaleMeNow/twenty` is either **fixed** or **named
here with the reason it cannot be**. There is no third state: an alert that is
neither is a failure, and `scripts/check-security-holds.sh` reports it as one.

Each entry carries the condition that retires it. Delete the entry the same day
that condition is met — a hold nobody revisits is indistinguishable from the drift
it was meant to replace.

The open-alert total moves whenever a new advisory is published, so this file does
not carry one - `scripts/check-security-holds.sh` is the authority on what is open
and whether every open package is declared here.

| Package | Alerts | Why it cannot be fixed | Retire when |
|---|---|---|---|
| `extract-zip` | 2 high — GHSA-7pqw-9j4j-h8q3, GHSA-jmr9-qjv8-65gv | No patched version exists for any release: both advisories report `first_patched_version: null`, and `<= 2.0.1` is the whole package (2.0.1 is still npm latest). Reached only through `@puppeteer/browsers@2.7.1`, which uses it to unpack a browser download at devDependency install time. `@puppeteer/browsers` has since dropped extract-zip, but not on a reachable path: the chain `mintlify` -> `@mintlify/scraping@4.0.970` -> `puppeteer@24.3.1` -> `@puppeteer/browsers@2.7.1` is exact-pinned at every link, the drop lands in `@puppeteer/browsers@3.0.2` (`puppeteer@25.0.2`), and `@mintlify/scraping` still pins `puppeteer@24.3.1` exact in its own latest (4.0.1009). So no parent bump carries the fix, and a resolution would force a major across two exact pins - the shape the `//resolutions` contract rejects by name. | `@mintlify/scraping` pins a puppeteer >= 25.0.2, or extract-zip publishes a fix. |
| `adm-zip` | 1 medium | No patched version (`>= 0.5.9, <= 0.6.0` is every release in range). Already pinned to 0.6.0 by upstream's own `zapier-platform-cli/adm-zip` and `@module-federation/dts-plugin/adm-zip` resolutions. | adm-zip publishes a fix. |
| `@cyntler/react-doc-viewer` | 1 medium | No patched version (`<= 1.17.1` is every release). A direct upstream dependency of twenty-front; removing it is a product decision, not a dependency bump. | upstream publishes a fix, or twenty-front drops the viewer. |
| `react-router` | 4 medium | The fix is 7.18.0. The tree holds 6.30.6 because `react-router-dom@^6.30.6` pins it, and router 7 is a breaking migration that react-router-dom 6 cannot consume. A resolution would break routing rather than patch it. | twentyhq/twenty migrates to react-router 7. |
| `@faker-js/faker` | 1 high - GHSA-qxc2-j82w-r537 | The fix is 10.5.0, and faker 10 ships ESM only - it dropped the CJS build, so twenty-server's Jest cannot load it ("Jest failed to parse a file", `dist/index.js:1`; all 4 unit shards and 7 integration shards on PR #40). The advisory is `helpers.fake` reaching arbitrary code execution, and `helpers.fake` is called nowhere in the repo - of 45 import sites, 44 are tests, seeds and factories, and the one shipped site (`open-api/utils/generate-random-field-value.util.ts`) uses only `string`/`date`/`number`/`person`/`location`/`internet` to build OpenAPI examples. | twenty-server's Jest can load ESM, or faker backports the fix to 9.x. |
| `sharp` (0.33.5 tree only) | high - GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c | Reached only by `favicons@7.2.0` (declares `sharp: ^0.33.1`, so capped `<0.34`) and `@mintlify/prebuild` (pins `0.33.5` exact) - website and docs build tooling that is not in the scanned prod images. Patching means forcing both parents outside their own declared ranges, which the `//resolutions` contract in `package.json` rejects by name; PR #40 did it anyway and it was reverted. Every other sharp copy in the repo is on 0.35.4 - the root lockfile and all 13 nested app lockfiles - so this hold covers the 0.33.5 tree and nothing else. | `favicons` or `@mintlify/prebuild` widens its sharp range. |
| `@ai-sdk/provider-utils` | 1 low | The fix is 4.0.33. Five coupled `@ai-sdk/*` packages pin exact versions (4.0.5, 4.0.15, 4.0.24, 4.0.29, 4.0.30); a single override desynchronises the family against the provider contract it shares. | upstream bumps the `@ai-sdk/*` set. |

## Reconciling

```bash
GH_TOKEN=<token with repo security read> \
  bash packages/premaccess/scripts/check-security-holds.sh
```

Not wired as a GitHub Actions workflow on purpose: `GITHUB_TOKEN` cannot read the
Dependabot alerts API, so a workflow built on it would be red by construction —
the exact failure mode the fork gate was just fixed for. Run it from a machine
with `gh auth`, or from a workflow once a PAT is provisioned.

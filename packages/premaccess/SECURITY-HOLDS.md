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
| `extract-zip` | 2 high — GHSA-7pqw-9j4j-h8q3, GHSA-jmr9-qjv8-65gv | No patched version exists for any release: both advisories report `first_patched_version: null`, and `<= 2.0.1` is the whole package. The mintlify path is gone (upstream's `@mintlify/scraping/puppeteer` resolution lifts it to puppeteer 25.10.0, whose `@puppeteer/browsers` no longer uses extract-zip); the one remaining parent is `@electron/packager@^19.0.0`, reached through upstream's `packages/twenty-companion` desktop build, which unpacks the Electron zip with it at package time. | `@electron/packager` drops extract-zip, or extract-zip publishes a fix. |
| `adm-zip` | 1 medium | No patched version (`>= 0.5.9, <= 0.6.0` is every release in range). Already pinned to 0.6.0 by upstream's own `zapier-platform-cli/adm-zip` and `@module-federation/dts-plugin/adm-zip` resolutions. | adm-zip publishes a fix. |
| `@cyntler/react-doc-viewer` | 1 medium | No patched version (`<= 1.17.1` is every release). A direct upstream dependency of twenty-front; removing it is a product decision, not a dependency bump. | upstream publishes a fix, or twenty-front drops the viewer. |
| `react-router` | 4 medium, nested app lockfiles only | The fix is 7.18.0. The root tree is on 7.18.4 since upstream's router 7 migration; the 7 lockfiles under `packages/twenty-apps/public/` (call-recorder, companion, fireflies, granola, last-contact, slack, teams) still resolve 6.30.6 because the published `twenty-ui@^1.0.0-alpha.1` they depend on pins `react-router-dom@^6.4.4`. Those lockfiles are upstream's and track the published package, not the workspace. The nested-app `ignore` entries in `.github/dependabot.yml` keep the updater from failing on them every week. | the published `twenty-ui` the nested apps consume moves to react-router 7 (drop the dependabot ignore entries at the same time). |
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

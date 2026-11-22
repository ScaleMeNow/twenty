# Fork resolutions

The `"resolutions"` entries the fork adds on top of upstream, in the root `package.json` or a
nested one, each with the advisory it fixes and the condition that retires it. Upstream documents
its own entries in the `"//resolutions"` string; the fork's live here because that string is
upstream's: on every rebase `merge-package-json.py` keeps upstream's copy of it, which dropped the
fork's text once (2026-10-13).

Each row names one manifest: `Manifest` is its path in backticks, `Key` the resolution keys in
backticks, nothing else. `scripts/check-fork-resolutions.py`, a fork gate step, fails on a key the
fork adds, changes or removes in any manifest that no row names, and on a row key that manifest no
longer carries. Root rows also move the fork gate's root `package.json` cap
(`.github/workflows/ci-premaccess-fork-gate.yaml`) to its exact count in the same commit. Delete
the row, the resolution and, for the root, the cap lines the day its condition is met.

Lockfile-only fixes, versions inside ranges the manifests already declare, are not resolutions:
they live in `lockfile-refresh.txt`. Alerts nothing can fix are in `SECURITY-HOLDS.md`.

| Manifest | Key | Forced to | Fixes | Why it has to be forced | Drop when |
|---|---|---|---|---|---|
| `package.json` | `adm-zip@npm:0.6.0` | 0.6.1 | GHSA-7q85-xj36-vmfc (<0.6.1), GHSA-vwc7-r8mq-g2x9 (<=0.6.0) | `@mintlify/cli` and `@mintlify/previewing` exact-pin 0.6.0 (latest `@mintlify/cli` 4.0.1552). | mintlify pins adm-zip >= 0.6.1. |
| `package.json` | `miniflare/undici` | ^7.29.1 | GHSA-3wwx-pv8p-q78v (>=7.28.0 <7.29.1) | miniflare exact-pins undici 7.29.0 through its latest 5.20260926.0-alpha. | miniflare pins undici >= 7.29.1. |
| `package.json` | `@ai-sdk/provider-utils@npm:4.0.5` `@ai-sdk/provider@npm:3.0.2` | 4.0.33 3.0.12 | GHSA-866g-f22w-33x8 (<4.0.33) | `@scalar/agent-chat` exact-pins ai 6.0.33 + `@ai-sdk/vue` 3.0.33 (latest 0.12.37), which exact-pin provider-utils 4.0.5. The provider moves with it so the ai-v6 family keeps one provider copy. | `@scalar/agent-chat` moves to an ai carrying provider-utils >= 4.0.33; drop both together. |
| `package.json` | `@twentyhq/companion/@electron/packager` | ^20.3.0 | extract-zip <= 2.0.1 (GHSA-7pqw-9j4j-h8q3, GHSA-jmr9-qjv8-65gv), no patched release | `@electron/packager` 19 (twenty-companion, declared ^19.0.0) is extract-zip's last parent; 20.0.1 swapped it for `@electron-internal/extract-zip`. The only 20.0.0 break is the download option type, which `scripts/package.mjs` does not pass; 20.0.4 adds the Electron 44 gates the companion's electron 44.1.0 needs. Scoped to the workspace so its upstream manifest stays untouched. | twenty-companion declares `@electron/packager` >= 20.0.1. |
| `package.json` | `miniflare/sharp` | 0.35.5 | sharp < 0.35.5 (high) | miniflare 5.20260926.1-alpha exact-pins sharp 0.35.4. | miniflare pins sharp >= 0.35.5. |
| `package.json` | `verdaccio/compression` | 1.8.2 | compression < 1.8.2 (high) | verdaccio exact-pins compression 1.8.1 (the local registry the create-app e2e CI publishes to). | verdaccio pins compression >= 1.8.2. |
| `package.json` | `@mintlify/prebuild/fflate` | 0.8.3 | fflate >= 0.8.0 < 0.8.3 (medium) | `@mintlify/prebuild` 1.0.1345 exact-pins fflate 0.8.2. | `@mintlify/prebuild` pins fflate >= 0.8.3. |
| `package.json` | `@graphql-tools/utils@npm:12.0.0` | 12.0.1 | @graphql-tools/utils <= 12.0.0 (high) | `@nestjs/graphql` 13.4.5 exact-pins 12.0.0. The 9.x/10.x/11.x copies have no fix and are held in `SECURITY-HOLDS.md`. | `@nestjs/graphql` pins utils >= 12.0.1. |
| `package.json` | `@mintlify/cli/@modelcontextprotocol/sdk` | 1.31.0 | @modelcontextprotocol/sdk >= 1.12.0 < 1.31.0 (high) | `@mintlify/cli` 4.0.1559 exact-pins 1.30.0. | `@mintlify/cli` pins the sdk >= 1.31.0. |
| `package.json` | `glob@npm:^9.3.3` `glob@npm:10.5.0` `glob@npm:^10.0.0` `glob@npm:^10.3.10` `glob@npm:^10.3.7` `glob@npm:^10.5.0` `glob@npm:^11.0.0` `glob@npm:^11.1.0` `glob@npm:^13.0.0` `glob@npm:^13.0.1` `glob@npm:^13.0.2` `glob@npm:^13.0.6` `@node-minify/core/glob` | ^14.0.6 | GHSA-3g3m-2fjr-6pw4, glob >= 9.0.0 <= 14.0.1 (medium) | No 9.x/10.x/11.x/13.x release carries the fix; parents (jest 30, typeorm, lingui, nx tooling, cacache, archiver-utils, twenty-shared/twenty-ui scripts) declare those majors. Verified 2026-11-22 on glob 14.0.6: twenty-shared/twenty-ui build and check:ownership, lingui extract, lint+typecheck of server/front/shared/ui, jest (173 suites). `@node-minify/core/glob` is upstream's entry, value raised from 10.5.0. | every parent declares glob >= 14.0.2, or upstream forces it. |
| `package.json` | `minimatch@npm:^8.0.2` `minimatch@npm:^9.0.3` `minimatch@npm:^9.0.4` `minimatch@npm:^9.0.5` `minimatch@npm:^9.0.9` `minimatch@npm:10.2.3` `minimatch@npm:10.2.5` `minimatch@npm:^10.0.0` `minimatch@npm:^10.0.1` `minimatch@npm:^10.0.3` `minimatch@npm:^10.1.1` `minimatch@npm:^10.2.2` `minimatch@npm:^10.2.4` `minimatch@npm:^10.2.5` `minimatch@npm:10.2.6` | ^11.0.9 | GHSA-g3hv-75wg-m249, minimatch >= 7.0.0 < 11.0.1 (medium) | No 8.x/9.x/10.x release carries the fix; nx, @nestjs/cli, @microsoft/api-extractor, @verdaccio/core exact-pin 10.2.x. Same verification as the glob row. | every parent declares minimatch >= 11.0.1, or upstream forces it. |
| `packages/twenty-apps/examples/hello-world/package.json` | `glob` `minimatch` | ^14.0.6 ^11.0.9 | GHSA-3g3m-2fjr-6pw4, GHSA-g3hv-75wg-m249 | cacache 20 declares glob ^13 (minimatch ^10 through it). Lint and the `twenty` CLI verified; integration runs in CI. | cacache declares glob >= 14.0.2. |
| `packages/twenty-apps/examples/postcard/package.json` | `glob` `minimatch` | ^14.0.6 ^11.0.9 | GHSA-3g3m-2fjr-6pw4, GHSA-g3hv-75wg-m249 | Same as hello-world. | cacache declares glob >= 14.0.2. |

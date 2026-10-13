# Fork resolutions

The root `package.json` `"resolutions"` entries the fork adds on top of upstream, each with
the advisory it fixes and the condition that retires it. Upstream documents its own entries in
the `"//resolutions"` string; the fork's live here because that string is upstream's: on every
rebase `merge-package-json.py` keeps upstream's copy of it, which dropped the fork's text once
(2026-10-13).

Every entry here is counted by the fork gate's `package.json` cap
(`.github/workflows/ci-premaccess-fork-gate.yaml`). Adding or removing one moves the cap in the
same commit. Delete the entry, the resolution and the cap line the day its condition is met.

Lockfile-only fixes, versions inside ranges the manifests already declare, are not resolutions:
they live in `lockfile-refresh.txt`. Alerts nothing can fix are in `SECURITY-HOLDS.md`.

| Resolution | Fixes | Why it has to be forced | Drop when |
|---|---|---|---|
| `adm-zip@npm:0.6.0` -> 0.6.1 | GHSA-7q85-xj36-vmfc (<0.6.1), GHSA-vwc7-r8mq-g2x9 (<=0.6.0) | `@mintlify/cli` and `@mintlify/previewing` exact-pin 0.6.0 (latest `@mintlify/cli` 4.0.1552). | mintlify pins adm-zip >= 0.6.1. |
| `miniflare/undici` ^7.29.1 | GHSA-3wwx-pv8p-q78v (>=7.28.0 <7.29.1) | miniflare exact-pins undici 7.29.0 through its latest 5.20260926.0-alpha. | miniflare pins undici >= 7.29.1. |
| `@ai-sdk/provider-utils@npm:4.0.5` -> 4.0.33 and `@ai-sdk/provider@npm:3.0.2` -> 3.0.12 | GHSA-866g-f22w-33x8 (<4.0.33) | `@scalar/agent-chat` exact-pins ai 6.0.33 + `@ai-sdk/vue` 3.0.33 (latest 0.12.37), which exact-pin provider-utils 4.0.5. The provider moves with it so the ai-v6 family keeps one provider copy. | `@scalar/agent-chat` moves to an ai carrying provider-utils >= 4.0.33; drop both together. |
| `@twentyhq/companion/@electron/packager` ^20.3.0 | extract-zip <= 2.0.1 (GHSA-7pqw-9j4j-h8q3, GHSA-jmr9-qjv8-65gv), no patched release | `@electron/packager` 19 (twenty-companion, declared ^19.0.0) is extract-zip's last parent; 20.0.1 swapped it for `@electron-internal/extract-zip`. The only 20.0.0 break is the download option type, which `scripts/package.mjs` does not pass; 20.0.4 adds the Electron 44 gates the companion's electron 44.1.0 needs. Scoped to the workspace so its upstream manifest stays untouched. | twenty-companion declares `@electron/packager` >= 20.0.1. |
| `sharp@npm:0.33.5` and `sharp@npm:^0.33.1`: upstream's 0.35.4 -> 0.35.5 | sharp < 0.35.5 (high) | Upstream's own entries, value raised. `@mintlify/prebuild` exact-pins sharp 0.33.5 and favicons 7.2.0 (`^0.33.1`). | upstream raises both entries to >= 0.35.5; the merge then keeps the higher value and this row goes. |
| `miniflare/sharp` 0.35.5 | sharp < 0.35.5 (high) | miniflare 5.20260926.1-alpha exact-pins sharp 0.35.4. | miniflare pins sharp >= 0.35.5. |
| `verdaccio/compression` 1.8.2 | compression < 1.8.2 (high) | verdaccio exact-pins compression 1.8.1 (the local registry the create-app e2e CI publishes to). | verdaccio pins compression >= 1.8.2. |
| `@mintlify/prebuild/fflate` 0.8.3 | fflate >= 0.8.0 < 0.8.3 (medium) | `@mintlify/prebuild` 1.0.1345 exact-pins fflate 0.8.2. | `@mintlify/prebuild` pins fflate >= 0.8.3. |
| `@graphql-tools/utils@npm:12.0.0` -> 12.0.1 | @graphql-tools/utils <= 12.0.0 (high) | `@nestjs/graphql` 13.4.5 exact-pins 12.0.0. The 9.x/10.x/11.x copies have no fix and are held in `SECURITY-HOLDS.md`. | `@nestjs/graphql` pins utils >= 12.0.1. |
| `@mintlify/cli/@modelcontextprotocol/sdk` 1.31.0 | @modelcontextprotocol/sdk >= 1.12.0 < 1.31.0 (high) | `@mintlify/cli` 4.0.1559 exact-pins 1.30.0. | `@mintlify/cli` pins the sdk >= 1.31.0. |

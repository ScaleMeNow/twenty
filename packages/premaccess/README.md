# Premaccess module — Twenty fork extension

This package is **Premaccess's NestJS extension to Twenty**, living inside our
fork at `github.com/ScaleMeNow/twenty`. It is the only code path through
which we add behaviour to Twenty.

> Architectural rule: this package and `packages/twenty-front/src/extensions/premaccess/`
> are the **only** places allowed to grow. Everything outside is upstream code
> we keep verbatim. `scripts/fork-ci-gate.sh` enforces this on every PR.

## What lives here

- `src/premaccess.module.ts` — the root NestJS module imported by Twenty's
  `app.module.ts` via the single allowed upstream patch.
- `src/entities/` — TypeORM entities for the three fork targets
  (`genericTarget`, `targetProvenance`, …).
- `src/resolvers/` — GraphQL resolvers (`bulkImport`, generic-target query,
  provenance query).
- `src/services/` — internal services these resolvers depend on.
- `migrations/` — TypeORM migrations that ADD tables. We never `ALTER` an
  existing Twenty table.

## Order of files

1. Land this empty module (one import in `app.module.ts`). Build green. CI
   gate green.
2. Add `BulkImportResolver` (Target C). No new tables.
3. Add `genericTarget` entity + resolver (Target A). One new migration, one
   new table.
4. Add `targetProvenance` entity + resolver (Target B). One new migration,
   one new table.

Each step lands as its own PR and triggers `scripts/fork-ci-gate.sh` + the
upstream test suite + our integration tests. The `upstream-exit.yaml` at the
fork repo root tracks per-target retirement criteria.

See [`docs/TWENTY-FORK-PLAN.md`](../../../../docs/TWENTY-FORK-PLAN.md) in
`meta-dojo` for the full strategy.

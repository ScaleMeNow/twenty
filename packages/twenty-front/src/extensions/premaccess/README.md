# Premaccess frontend extension

Phase 17 of the migration refactor (see `docs/CRM-MANAGER-AUTONOMY.md` in
`meta-dojo` for the full plan).

This directory is the **only** location our fork's CI gate allows free
editing in (alongside `packages/premaccess/`). Everything here is the
Premaccess-authored UI that gives CRM managers self-service control over
their sync pipelines without ever leaving Twenty.

## Status

**Scaffolded, not yet wired to Twenty's router.** The components compile
in isolation and document the target shape; integration with Twenty's
`AppRouter` + Jotai stores happens once Phase 18 (`SyncService`) has its
SQL bodies filled in.

## Layout

```text
extensions/premaccess/
├── README.md
├── index.tsx                       — extension entry point (registered by App.tsx, the 2nd allowed upstream patch)
├── routes.tsx                      — route table mounted under /_premaccess/*
├── components/
│   ├── ConnectorsList.tsx          — list of connectors per workspace
│   ├── ConnectorMapping.tsx        — field mapper UI (source schema ↔ Twenty schema)
│   ├── SyncTrigger.tsx             — "Run now" / "Schedule" button
│   └── InferredEdgesReview.tsx     — ✓ promote / bulk reject for AI-inferred edges
└── graphql/
    └── premaccess.queries.ts       — typed queries against the Phase 18 GraphQL surface
```

## Next steps

1. Land this scaffolding behind a feature flag (`PREMACCESS_UI_ENABLED`).
2. Implement `SyncService` SQL bodies in Phase 18.
3. Replace the Flask admin app's read views with these React equivalents.
4. Add the connector onboarding wizard (the long pole — see plan doc).

# Premaccess frontend extension

Phase 17 of the migration refactor (see `docs/CRM-MANAGER-AUTONOMY.md` in
`meta-dojo` for the full plan).

This directory is the **only** location our fork's CI gate allows free
editing in (alongside `packages/premaccess/`). Everything here is the
Premaccess-authored UI that gives CRM managers self-service control over
their sync pipelines without ever leaving Twenty.

## Status

Wired. `/premaccess/*` is mounted through upstream's workspace route-object
list (`routeObjects.tsx`, one wrapping call in `useCreateWorkspaceAppRouter.tsx`)
and reached from the sidebar section (`PremaccessNavigationSection.tsx`, one
import plus one JSX line in `MainNavigationDrawerScrollableItems.tsx`).

## Layout

```text
extensions/premaccess/
├── README.md
├── routeObjects.tsx                 — appends the /premaccess/* route to upstream's route objects
├── PremaccessNavigationSection.tsx  — sidebar entry
└── PremaccessApp.tsx                — the screen: overview, mappings, bulk import,
                                       inferred-edges review and docs tabs
```

The Phase 17 scaffolding (`index.tsx`, `routes.tsx`, `components/*`,
`graphql/premaccess.queries.ts`) was never mounted and was replaced by the tabs
of `PremaccessApp.tsx`; it was removed on 2026-11-22 when knip flagged it as
unused files. It stays in git history.

## Next steps

1. Implement `SyncService` SQL bodies in Phase 18.
2. Replace the Flask admin app's remaining read views.
3. Add the connector onboarding wizard (the long pole, see the plan doc).

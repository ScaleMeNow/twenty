# Upstream published-image drift

`CI Twenty Apps` runs every changed app twice: against a server **built from this
fork's files** (`local`) and against **`twentycrm/twenty-app-dev:latest`**, the
newest published Twenty release (`dockerhub-latest`). The two arms answer
different questions, and only the first one is ours to answer:

- `local` — do the apps work against the server in this tree? **Blocking.**
- `dockerhub-latest` — do the apps work against the release Twenty ships today?
  **Advisory**, because this fork rebases on `twentyhq/twenty:main` weekly and is
  therefore behind that release for part of every week. A release that closes an
  API an app's tests use has no fix on this side until the rebase brings
  upstream's own adaptation in.

Advisory means the step is tolerated (`continue-on-error` on that arm only, in
`.github/workflows/ci-twenty-apps.yaml`) and the failure is reported as a
warning plus a job-summary entry. It does not mean unread: every failure belongs
in the table below with the condition that retires it, exactly like
[`SECURITY-HOLDS.md`](./SECURITY-HOLDS.md). A failure that is in neither the
table nor a fix is a failure.

## Declared drift

| App | Symptom on `dockerhub-latest` | Why it cannot be fixed here | Retire when |
|---|---|---|---|
| `call-recorder` | 14 of 16 tests in `call-recorder-lifecycle.integration-test.ts` fail with `PERMISSION_DENIED: records of "calendarChannelEventAssociation" are not writable through the API`. | The published server marks that object's `writability` as `SYSTEM`, which no role, app permission or token type can lift: `isWritePermittedByWritability` admits a `SYSTEM` write only for a server-side `system` auth context, which no token strategy mints. A hand-rolled `API_KEY` write on a seeded channel id is refused with the same message, so the app has nothing left to declare. The test needs the association because a calendar event without a `SHARE_EVERYTHING` channel association is filtered out of every `calendarEvents` query, so the app's reconciliation cannot see it. Upstream already rewrote the test to consume dev-seeded visible events instead of creating its own (`discoverVisibleCalendarEventFixtures`), against app code this fork does not have yet. | The weekly rebase brings upstream's rewritten `call-recorder-lifecycle.integration-test.ts` in. Then drop this row. |

## Retired by a fix instead

`twenty-partners` failed the same arm with `INVALID_PAGE_LAYOUT_WIDGET_DATA:
Position layoutMode "GRID" does not match tab layoutMode "CANVAS"` on the
`My Profile` and `My Case Studies` widgets: the published server derives a
widget's layout mode from the legacy `gridPosition` key, and a `GRID` position
cannot sit in a `CANVAS` tab. That one had a form that satisfies both servers —
upstream's own `position: { layoutMode: CANVAS }` — so it is fixed in tree
rather than declared here. The two `page-layout.ts` entries in
`ci-premaccess-fork-gate.yaml` retire when the rebase brings upstream's
identical version in.

## Reconciling

```bash
# reproduce either arm locally, the way CI does
docker run -d --name twenty-app-dev-test -p 2021:2021 \
  -e NODE_PORT=2021 -e SERVER_URL=http://localhost:2021 \
  -e MARKETPLACE_CATALOG_SYNC_CRON_ENABLED=false \
  -e API_RATE_LIMITING_SHORT_LIMIT=100000 -e API_RATE_LIMITING_LONG_LIMIT=100000 \
  twentycrm/twenty-app-dev:latest

cd packages/twenty-apps/<scope>/<app>
TWENTY_API_URL=http://localhost:2021 TWENTY_API_KEY=<seeded key> yarn test
```

The seeded key is the `api-key` output of
`.github/actions/spawn-twenty-app-dev-test`.

To run both arms for one app in CI without touching its files, dispatch
`CI Twenty Apps` on the branch with the `application` input set to the app folder
name — `changed-only` discovery is bypassed for `workflow_dispatch`.

import { type WorkspaceRouteObject } from '@/app/routing/types/WorkspaceRouteObject';

import { PremaccessApp } from './PremaccessApp';

export const PREMACCESS_ROUTE_PATH = '/premaccess/*';

/**
 * Appends the Premaccess route to upstream's workspace route objects.
 *
 * Upstream builds the workspace router from a data-router route-object list
 * (`createWorkspaceRouteObjects`) and projects it onto each surface via
 * `getWorkspaceRouteObjectsForSurface`. Mounting through that list, rather
 * than as an ad-hoc `<Route>`, keeps the extension visible to the
 * `WorkspaceRouteObjectsProvider` and confines the upstream touch in
 * `useCreateWorkspaceAppRouter.tsx` to a single wrapping call.
 *
 * The route is main-surface only: the side panel has no Premaccess screen.
 * React Router ranks `/premaccess/*` above the `*` NotFound wildcard, so the
 * position in the list does not matter.
 */
export const withPremaccessRouteObjects = (
  routeObjects: WorkspaceRouteObject[],
): WorkspaceRouteObject[] => [
  ...routeObjects,
  {
    path: PREMACCESS_ROUTE_PATH,
    element: <PremaccessApp />,
    handle: { workspaceSurfaces: ['main'] },
  },
];

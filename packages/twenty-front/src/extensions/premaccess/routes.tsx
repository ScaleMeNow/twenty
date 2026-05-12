import { Route, Routes } from 'react-router-dom';

import { ConnectorsList } from './components/ConnectorsList';
import { InferredEdgesReview } from './components/InferredEdgesReview';
import { SyncTrigger } from './components/SyncTrigger';

type Props = {
  workspaceId: string;
};

/**
 * Phase 17 — route table for the Premaccess extension.
 *
 * Mounted at `/_premaccess/*` by the upstream patch in `App.tsx` (the second
 * allowed-modify file). Each component is workspace-scoped via Twenty's
 * existing auth context — the workspaceId comes from Twenty's auth state,
 * not from the URL.
 */
export const PremaccessRoutes = ({ workspaceId }: Props) => (
  <Routes>
    <Route path="connectors" element={<ConnectorsList workspaceId={workspaceId} />} />
    <Route
      path="connectors/:id"
      element={
        // Connector detail screen: header + SyncTrigger + ConnectorMapping (lazy-loaded
        // once Phase 18's getConnector + schema-report queries are wired).
        <ConnectorDetailPage workspaceId={workspaceId} />
      }
    />
    <Route path="inferred-edges" element={<InferredEdgesReview workspaceId={workspaceId} />} />
  </Routes>
);

/**
 * Stub — actual implementation pulls connector + schema-report data via the
 * Phase 18 queries and composes <SyncTrigger /> + <ConnectorMapping />.
 */
const ConnectorDetailPage = ({ workspaceId }: { workspaceId: string }) => {
  // useParams resolution lands when the route is actually mounted in App.tsx.
  return (
    <div>
      <h2>Connector detail (scaffold)</h2>
      <p>Workspace: {workspaceId}</p>
      <SyncTrigger connectorId="(pending getConnector query)" />
    </div>
  );
};

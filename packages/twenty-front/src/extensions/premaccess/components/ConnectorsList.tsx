import { useQuery } from '@apollo/client';

import { CONNECTORS_QUERY } from '../graphql/premaccess.queries';

type Connector = {
  id: string;
  source: string;
  displayName: string;
  status: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  fieldOverrideCount: number;
};

type Props = {
  workspaceId: string;
};

/**
 * Phase 17 — ConnectorsList.
 *
 * Lists every connector configured for the current workspace, with last-sync
 * status and a quick path into the field-mapping view. Mounted at
 * `/_premaccess/connectors` once the extension router is wired in `index.tsx`.
 *
 * Style note: Twenty uses Linaria for zero-runtime CSS-in-JS — using styled
 * imports from `@linaria/react` keeps us consistent with upstream's design
 * tokens. For this scaffold we keep markup minimal; visual polish lands when
 * the wizard ships.
 */
export const ConnectorsList = ({ workspaceId }: Props) => {
  const { data, loading, error } = useQuery<{ connectors: Connector[] }>(CONNECTORS_QUERY, {
    variables: { workspaceId },
  });

  if (loading) return <div>Loading connectors…</div>;
  if (error) return <div>Error loading connectors: {error.message}</div>;

  const connectors = data?.connectors ?? [];
  if (connectors.length === 0) {
    return (
      <div>
        <p>No connectors yet.</p>
        <a href="/_premaccess/connectors/new">+ Connect a source</a>
      </div>
    );
  }

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Connectors</h2>
        <a href="/_premaccess/connectors/new">+ Connect a source</a>
      </header>
      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>Name</th>
            <th>Status</th>
            <th>Last sync</th>
            <th>Custom mappings</th>
          </tr>
        </thead>
        <tbody>
          {connectors.map((c) => (
            <tr key={c.id}>
              <td>{c.source}</td>
              <td>
                <a href={`/_premaccess/connectors/${c.id}`}>{c.displayName}</a>
              </td>
              <td>{c.status}</td>
              <td>
                {c.lastSyncAt
                  ? `${new Date(c.lastSyncAt).toLocaleString()} — ${c.lastSyncStatus ?? '?'}`
                  : 'never'}
              </td>
              <td>{c.fieldOverrideCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

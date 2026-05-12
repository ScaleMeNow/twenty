import { useMutation } from '@apollo/client';
import { useState } from 'react';

import { TRIGGER_SYNC_MUTATION } from '../graphql/premaccess.queries';

type Props = {
  connectorId: string;
};

/**
 * Phase 17 — SyncTrigger panel.
 *
 * Drop-in component for a connector detail page. Three buttons: Dry-run,
 * Delta, Full. Calls `triggerSync` and shows the resulting Sync row's
 * status. Polling for live progress is a follow-up.
 */
export const SyncTrigger = ({ connectorId }: Props) => {
  const [trigger, { data, loading, error }] = useMutation(TRIGGER_SYNC_MUTATION);
  const [lastMode, setLastMode] = useState<string | null>(null);

  const run = (mode: 'DELTA' | 'FULL', dryRun: boolean) => {
    setLastMode(`${mode}${dryRun ? ' (dry-run)' : ''}`);
    void trigger({ variables: { connectorId, mode, dryRun } });
  };

  return (
    <div style={{ padding: 12, border: '1px solid #ececec', borderRadius: 4 }}>
      <h3>Run sync</h3>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => run('DELTA', true)} disabled={loading}>Dry-run delta</button>
        <button onClick={() => run('DELTA', false)} disabled={loading}>Run delta</button>
        <button onClick={() => run('FULL', false)} disabled={loading}>Full re-sync</button>
      </div>
      {loading && <p>Starting {lastMode}…</p>}
      {error && <p style={{ color: 'crimson' }}>Failed: {error.message}</p>}
      {data?.triggerSync && (
        <p>
          Started <code>{data.triggerSync.id}</code> — status:{' '}
          <strong>{data.triggerSync.status}</strong>
        </p>
      )}
    </div>
  );
};

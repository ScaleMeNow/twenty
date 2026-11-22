import { doNotTranslate } from 'twenty-shared/i18n';
import { useMutation } from '@apollo/client/react';
import { useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme';

import { TRIGGER_SYNC_MUTATION } from '../graphql/premaccess.queries';

type SyncTriggerProps = {
  connectorId: string;
};

type TriggerSyncResult = {
  triggerSync: {
    id: string;
    status: string;
    startedAt: string;
  };
};

/**
 * Phase 17 — SyncTrigger panel.
 *
 * Drop-in component for a connector detail page. Three buttons: Dry-run,
 * Delta, Full. Calls `triggerSync` and shows the resulting Sync row's
 * status. Polling for live progress is a follow-up.
 */
export const SyncTrigger = ({ connectorId }: SyncTriggerProps) => {
  const [trigger, { data, loading, error }] = useMutation<TriggerSyncResult>(
    TRIGGER_SYNC_MUTATION,
  );
  const [lastMode, setLastMode] = useState<string | null>(null);

  const run = (mode: 'DELTA' | 'FULL', dryRun: boolean) => {
    setLastMode(`${mode}${dryRun ? ' (dry-run)' : ''}`);
    void trigger({ variables: { connectorId, mode, dryRun } });
  };

  return (
    <div
      style={{
        padding: 12,
        border: `1px solid ${themeCssVariables.border.color.light}`,
        borderRadius: 4,
      }}
    >
      <h3>{doNotTranslate('Run sync')}</h3>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => run('DELTA', true)} disabled={loading}>
          {doNotTranslate('Dry-run delta')}
        </button>
        <button onClick={() => run('DELTA', false)} disabled={loading}>
          {doNotTranslate('Run delta')}
        </button>
        <button onClick={() => run('FULL', false)} disabled={loading}>
          {doNotTranslate('Full re-sync')}
        </button>
      </div>
      {loading && (
        <p>
          {doNotTranslate('Starting ')}
          {lastMode}…
        </p>
      )}
      {error && (
        <p style={{ color: 'crimson' }}>
          {doNotTranslate('Failed: ')}
          {error.message}
        </p>
      )}
      {data?.triggerSync && (
        <p>
          {doNotTranslate('Started ')}
          <code>{data.triggerSync.id}</code>
          {doNotTranslate(' — status:')}{' '}
          <strong>{data.triggerSync.status}</strong>
        </p>
      )}
    </div>
  );
};

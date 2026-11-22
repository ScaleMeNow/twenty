import { doNotTranslate } from 'twenty-shared/i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme';

/**
 * Premaccess — CRM Sync workspace surface.
 *
 * Operator-facing UI on top of /_premaccess/* REST endpoints. Designed so a
 * non-technical CRM manager can:
 *   1. Connect a new source CRM (HubSpot, Salesforce, …)
 *   2. Re-map fields and associations without touching YAML
 *   3. Trigger a sync (delta or full, dry-run or live)
 *   4. Review and promote Bedrock-inferred edges with evidence
 *   5. Bulk-import rows ad-hoc when a connector isn't available
 *
 * Every section has inline help, every column header carries a tooltip, and
 * every form shows a working example so workers can copy/paste their way to
 * autonomy. The full reference is mirrored in the on-page Docs panel at the
 * bottom; full reference docs live separately in the meta-dojo workspace.
 */

type Connector = {
  id: string;
  source: string;
  displayName: string;
  status: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  fieldOverrideCount: number;
};

type Sync = {
  id: string;
  connectorId: string | null;
  startedAt: string;
  completedAt: string | null;
  status: string;
  rowsStaged: number;
  edgesStaged: number;
  triggeredByEmail: string | null;
  triggeredByName: string | null;
  mode: string | null;
  dryRun: boolean | null;
  buildId: string | null;
  errorMessage: string | null;
  lastMarkerAt: string | null;
};

type InferredEdge = {
  runId: string;
  semanticType: string;
  fromObject: string;
  fromTwentyId: string;
  toObject: string;
  toTwentyId: string;
  confidence: number;
  evidence: string;
  parentTitle: string | null;
};

const WORKSPACE_ID = '335a4fd5-b578-441d-831d-445222bc08b8';

const readAccessTokenFromCookie = (): string | null => {
  const match = document.cookie.match(/(?:^|;\s*)tokenPair=([^;]+)/);
  if (match === null) {
    return null;
  }
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as {
      accessOrWorkspaceAgnosticToken?: { token?: string };
    };
    return parsed.accessOrWorkspaceAgnosticToken?.token ?? null;
  } catch {
    return null;
  }
};

const fetchJSON = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const token = readAccessTokenFromCookie();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (token !== null) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(path, {
    ...init,
    headers,
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `${res.status} ${res.statusText}${body !== '' ? ` — ${body}` : ''}`,
    );
  }
  return res.json();
};

const styles = {
  page: {
    padding: '24px 28px',
    fontFamily: doNotTranslate('Inter, system-ui, sans-serif'),
    color: themeCssVariables.font.color.primary,
    height: '100%',
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    boxSizing: 'border-box' as const,
    width: '100%',
  } as const,
  pageInner: {
    maxWidth: 1280,
    margin: doNotTranslate('0 auto'),
  } as const,
  h1: { fontSize: 22, fontWeight: 600, marginBottom: 4 } as const,
  subtitle: {
    color: themeCssVariables.font.color.tertiary,
    marginTop: 0,
    fontSize: 13,
    marginBottom: 16,
  } as const,
  helpBanner: {
    background: themeCssVariables.background.tertiary,
    border: `1px solid ${themeCssVariables.border.color.light}`,
    borderLeft: `3px solid ${themeCssVariables.color.blue}`,
    borderRadius: 6,
    padding: '12px 14px',
    fontSize: 13,
    color: themeCssVariables.font.color.secondary,
    marginBottom: 18,
    lineHeight: 1.5,
  } as const,
  section: { marginTop: 28 } as const,
  sectionHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 10,
  } as const,
  sectionTitle: { fontSize: 15, fontWeight: 600 } as const,
  sectionHelp: {
    fontSize: 12,
    color: themeCssVariables.font.color.tertiary,
  } as const,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 13,
    background: themeCssVariables.background.primary,
    border: `1px solid ${themeCssVariables.border.color.medium}`,
    borderRadius: 6,
    overflow: 'hidden' as const,
  },
  thRow: {
    background: themeCssVariables.background.secondary,
    textAlign: 'left' as const,
    color: themeCssVariables.font.color.secondary,
  },
  th: {
    padding: '10px 12px',
    fontWeight: 500,
    fontSize: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    cursor: 'help' as const,
  },
  tdRow: {
    borderTop: `1px solid ${themeCssVariables.border.color.light}`,
  } as const,
  td: { padding: '10px 12px' } as const,
  btn: {
    padding: '6px 12px',
    fontSize: 12,
    borderRadius: 4,
    border: `1px solid ${themeCssVariables.border.color.medium}`,
    background: themeCssVariables.background.tertiary,
    color: themeCssVariables.font.color.primary,
    cursor: 'pointer' as const,
  },
  btnPrimary: {
    padding: '8px 14px',
    fontSize: 13,
    borderRadius: 4,
    border: `1px solid ${themeCssVariables.color.blue}`,
    background: themeCssVariables.color.blue,
    color: themeCssVariables.font.color.inverted,
    cursor: 'pointer' as const,
    fontWeight: 500,
  },
  btnDanger: {
    padding: '6px 12px',
    fontSize: 12,
    borderRadius: 4,
    border: `1px solid ${themeCssVariables.border.color.danger}`,
    background: themeCssVariables.background.transparent.danger,
    color: themeCssVariables.font.color.danger,
    cursor: 'pointer' as const,
  },
  card: {
    border: `1px solid ${themeCssVariables.border.color.medium}`,
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
    background: themeCssVariables.background.primary,
  },
  errorBanner: {
    background: themeCssVariables.background.transparent.danger,
    border: `1px solid ${themeCssVariables.border.color.danger}`,
    color: themeCssVariables.font.color.danger,
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    fontSize: 13,
    fontFamily: doNotTranslate(
      'ui-monospace, SFMono-Regular, Menlo, monospace',
    ),
  },
  okBanner: {
    background: themeCssVariables.background.transparent.success,
    border: `1px solid ${themeCssVariables.color.green}`,
    color: themeCssVariables.tag.text.green,
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    fontSize: 13,
  },
  pill: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 9999,
    fontSize: 11,
    fontWeight: 500,
  } as const,
  input: {
    width: '100%',
    padding: '8px 10px',
    fontSize: 13,
    background: themeCssVariables.background.secondary,
    color: themeCssVariables.font.color.primary,
    border: `1px solid ${themeCssVariables.border.color.medium}`,
    borderRadius: 4,
    fontFamily: 'inherit',
  } as const,
  label: {
    fontSize: 12,
    color: themeCssVariables.font.color.secondary,
    marginBottom: 4,
    display: 'block',
  } as const,
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
    marginBottom: 12,
  } as const,
  formCard: {
    background: themeCssVariables.background.secondary,
    border: `1px solid ${themeCssVariables.border.color.light}`,
    borderRadius: 6,
    padding: 16,
    marginBottom: 16,
  } as const,
  tabs: {
    display: 'flex',
    gap: 4,
    borderBottom: `1px solid ${themeCssVariables.border.color.medium}`,
    marginBottom: 16,
  } as const,
  tab: {
    padding: '8px 16px',
    fontSize: 13,
    color: themeCssVariables.font.color.tertiary,
    cursor: 'pointer' as const,
    borderBottom: '2px solid transparent',
  },
  tabActive: {
    color: themeCssVariables.font.color.primary,
    borderBottom: `2px solid ${themeCssVariables.color.blue}`,
  } as const,
  code: {
    background: themeCssVariables.background.secondary,
    padding: '2px 5px',
    borderRadius: 3,
    fontFamily: doNotTranslate(
      'ui-monospace, SFMono-Regular, Menlo, monospace',
    ),
    fontSize: 12,
    color: themeCssVariables.font.color.secondary,
  } as const,
  codeBlock: {
    background: themeCssVariables.background.secondary,
    padding: 12,
    borderRadius: 4,
    fontFamily: doNotTranslate(
      'ui-monospace, SFMono-Regular, Menlo, monospace',
    ),
    fontSize: 12,
    color: themeCssVariables.font.color.secondary,
    overflow: 'auto' as const,
    whiteSpace: 'pre-wrap' as const,
    marginTop: 8,
    border: `1px solid ${themeCssVariables.border.color.light}`,
  },
};

const pillFor = (status: string) => {
  const palette: Record<string, { bg: string; fg: string }> = {
    active: {
      bg: themeCssVariables.background.transparent.success,
      fg: themeCssVariables.tag.text.green,
    },
    pending: {
      bg: themeCssVariables.tag.background.yellow,
      fg: themeCssVariables.tag.text.yellow,
    },
    failed: {
      bg: themeCssVariables.background.transparent.danger,
      fg: themeCssVariables.font.color.danger,
    },
    completed: {
      bg: themeCssVariables.background.transparent.blue,
      fg: themeCssVariables.tag.text.blue,
    },
    'bulk-import': {
      bg: themeCssVariables.tag.background.purple,
      fg: themeCssVariables.tag.text.purple,
    },
  };
  const colors = palette[status] ?? {
    bg: themeCssVariables.tag.background.gray,
    fg: themeCssVariables.font.color.secondary,
  };
  return { ...styles.pill, background: colors.bg, color: colors.fg };
};

type TabKey = 'overview' | 'mappings' | 'bulk' | 'inferred' | 'docs';

const STAGES: Array<{ key: string; label: string }> = [
  { key: 'pending', label: doNotTranslate('Queued (SQS)') },
  { key: 'in_progress', label: doNotTranslate('Marked in-progress (Lambda)') },
  { key: 'build', label: doNotTranslate('CodeBuild migration') },
  { key: 'done', label: doNotTranslate('Marker complete (Lambda)') },
];

const PipelineStages = ({ s }: { s: Sync }) => {
  // Derive stage states from the row's status + presence of buildId.
  const status = s.status;
  const hasBuild = s.buildId !== null;
  const stateFor = (key: string): 'pending' | 'running' | 'done' | 'failed' => {
    if (status === 'failed') {
      if (key === 'pending') {
        return 'done';
      }
      if (key === 'in_progress') {
        return s.lastMarkerAt !== null ? 'done' : 'failed';
      }
      if (key === 'build') {
        return hasBuild ? 'failed' : 'pending';
      }
      if (key === 'done') {
        return 'failed';
      }
    }
    if (status === 'completed') {
      return 'done';
    }
    if (status === 'in_progress') {
      if (key === 'pending') {
        return 'done';
      }
      if (key === 'in_progress') {
        return 'done';
      }
      if (key === 'build') {
        return hasBuild ? 'running' : 'running';
      }
      if (key === 'done') {
        return 'pending';
      }
    }
    if (status === 'pending') {
      if (key === 'pending') {
        return 'running';
      }
      return 'pending';
    }
    return 'pending';
  };
  const dot = (st: ReturnType<typeof stateFor>) => {
    const palette = {
      pending: themeCssVariables.background.transparent.medium,
      running: themeCssVariables.color.yellow,
      done: themeCssVariables.color.green,
      failed: themeCssVariables.color.red,
    } as const;
    return (
      <span
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: 999,
          background: palette[st],
          marginRight: 8,
          verticalAlign: 'middle',
        }}
      />
    );
  };
  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {STAGES.map((stg) => {
        const st = stateFor(stg.key);
        return (
          <li key={stg.key} style={{ padding: '3px 0', fontSize: 13 }}>
            {dot(st)}
            <span
              style={{
                color:
                  st === 'pending'
                    ? themeCssVariables.font.color.tertiary
                    : 'inherit',
              }}
            >
              {stg.label}
            </span>
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                color: themeCssVariables.font.color.tertiary,
              }}
            >
              {st === 'pending' && doNotTranslate('not yet')}
              {st === 'running' && 'running…'}
              {st === 'done' && 'done'}
              {st === 'failed' && 'failed'}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

const InfoIcon = ({ tip }: { tip: string }) => (
  <span
    title={tip}
    aria-label={tip}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 14,
      height: 14,
      marginLeft: 6,
      verticalAlign: 'middle',
      cursor: 'help',
      borderRadius: '50%',
      border: '1px solid currentColor',
      fontSize: 9,
      fontWeight: 700,
      lineHeight: 1,
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontStyle: 'italic',
      opacity: 0.5,
      userSelect: 'none',
    }}
  >
    {doNotTranslate('i')}
  </span>
);

const Th = ({ children, tip }: { children: React.ReactNode; tip: string }) => (
  <th style={styles.th} title={tip}>
    {children}
    <InfoIcon tip={tip} />
  </th>
);

export const PremaccessApp = () => {
  const [tab, setTab] = useState<TabKey>('overview');
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [syncs, setSyncs] = useState<Sync[]>([]);
  const [edges, setEdges] = useState<InferredEdge[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [minConfidence, setMinConfidence] = useState(0.7);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(
    null,
  );

  const refresh = useCallback(async () => {
    try {
      setErr(null);
      const [c, s, e] = await Promise.all([
        fetchJSON<Connector[]>(
          `/_premaccess/connectors?workspaceId=${WORKSPACE_ID}`,
        ),
        fetchJSON<Sync[]>(`/_premaccess/syncs?limit=30`),
        fetchJSON<InferredEdge[]>(
          `/_premaccess/inferred-edges?workspaceId=${WORKSPACE_ID}&minConfidence=${minConfidence}`,
        ),
      ]);
      setConnectors(c);
      setSyncs(s);
      setEdges(e);
      // Functional update: selecting a connector must not re-run the fetch.
      setSelectedConnectorId((current) =>
        current === null && c.length > 0 ? c[0].id : current,
      );
    } catch (x) {
      setErr((x as Error).message);
    }
  }, [minConfidence]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const flash = (msg: string) => {
    setOk(msg);
    setTimeout(() => setOk(null), 4000);
  };

  const wrap = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      flash(`${label} done.`);
      await refresh();
    } catch (x) {
      setErr((x as Error).message);
    }
    setBusy(false);
  };

  return (
    <div style={styles.page}>
      <div style={styles.pageInner}>
        <div style={styles.h1}>
          {doNotTranslate('Premaccess — CRM Sync Console')}
        </div>
        <div style={styles.subtitle}>
          {doNotTranslate(
            'Operator console for CRM-Manager autonomy. Workspace ',
          )}
          {WORKSPACE_ID}.
        </div>

        <div style={styles.helpBanner}>
          <strong>{doNotTranslate('How this works:')}</strong>
          {doNotTranslate(' Each ')}
          <em>{doNotTranslate('connector')}</em>
          {doNotTranslate(
            ' is one source CRM (HubSpot, Salesforce…) linked to this Twenty workspace. A',
          )}{' '}
          <em>{doNotTranslate('sync')}</em>
          {doNotTranslate(
            " reads from the source, normalises rows, and loads them into Twenty's tables. The pipeline also detects",
          )}{' '}
          <em>{doNotTranslate('inferred edges')}</em>
          {doNotTranslate(
            " using Bedrock — links between tasks/notes and people/companies that the source CRM didn't have explicitly. You approve or reject those before they touch the workspace.",
          )}
          <br />
          <span style={{ color: themeCssVariables.font.color.tertiary }}>
            {doNotTranslate(
              'Need the full reference? Open the Docs tab — quick reference for the happy path, cURL examples, and troubleshooting.',
            )}
          </span>
        </div>

        {err !== null && (
          <div style={styles.errorBanner}>
            {doNotTranslate('Error: ')}
            {err}
          </div>
        )}
        {ok !== null && <div style={styles.okBanner}>{ok}</div>}

        <div style={styles.tabs}>
          {(
            [
              ['overview', doNotTranslate('1. Connectors & runs')],
              ['mappings', doNotTranslate('2. Field & assoc. mappings')],
              ['bulk', doNotTranslate('3. Bulk import')],
              ['inferred', doNotTranslate('4. Review inferred edges')],
              ['docs', doNotTranslate('Docs')],
            ] as Array<[TabKey, string]>
          ).map(([k, label]) => (
            <div
              key={k}
              style={{ ...styles.tab, ...(tab === k ? styles.tabActive : {}) }}
              onClick={() => setTab(k)}
            >
              {label}
            </div>
          ))}
        </div>

        {tab === 'overview' && (
          <OverviewTab
            connectors={connectors}
            syncs={syncs}
            busy={busy}
            onCreate={(input) =>
              wrap(doNotTranslate('Connector created'), () =>
                fetchJSON('/_premaccess/connectors', {
                  method: 'POST',
                  body: JSON.stringify(input),
                }),
              )
            }
            onTrigger={(id, dryRun) =>
              wrap(
                doNotTranslate(`Sync ${dryRun ? 'dry-run' : 'live'} triggered`),
                () =>
                  fetchJSON(`/_premaccess/connectors/${id}/sync`, {
                    method: 'POST',
                    body: JSON.stringify({ mode: 'DELTA', dryRun }),
                  }),
              )
            }
            onUpdate={(id, patch) =>
              wrap(doNotTranslate('Connector updated'), () =>
                fetchJSON(`/_premaccess/connectors/${id}`, {
                  method: 'PATCH',
                  body: JSON.stringify(patch),
                }),
              )
            }
            onDelete={(id) =>
              wrap(doNotTranslate('Connector deleted'), () =>
                fetchJSON(`/_premaccess/connectors/${id}`, {
                  method: 'DELETE',
                }),
              )
            }
          />
        )}

        {tab === 'mappings' && (
          <MappingsTab
            connectors={connectors}
            selectedConnectorId={selectedConnectorId}
            setSelectedConnectorId={setSelectedConnectorId}
            busy={busy}
            onFieldMap={(connectorId, body) =>
              wrap(doNotTranslate('Field mapping saved'), () =>
                fetchJSON(
                  `/_premaccess/connectors/${connectorId}/field-mapping`,
                  {
                    method: 'POST',
                    body: JSON.stringify(body),
                  },
                ),
              )
            }
            onAssocMap={(connectorId, body) =>
              wrap(doNotTranslate('Association mapping saved'), () =>
                fetchJSON(
                  `/_premaccess/connectors/${connectorId}/association-mapping`,
                  {
                    method: 'POST',
                    body: JSON.stringify(body),
                  },
                ),
              )
            }
            onFieldDelete={(connectorId, twentyObject, sourceProperty) =>
              wrap(doNotTranslate('Field override removed'), () =>
                fetchJSON(
                  `/_premaccess/connectors/${connectorId}/field-mapping?twentyObject=${encodeURIComponent(twentyObject)}&sourceProperty=${encodeURIComponent(sourceProperty)}`,
                  { method: 'DELETE' },
                ),
              )
            }
            onAssocDelete={(connectorId, nativePair) =>
              wrap(doNotTranslate('Association override removed'), () =>
                fetchJSON(
                  `/_premaccess/connectors/${connectorId}/association-mapping?nativePair=${encodeURIComponent(nativePair)}`,
                  { method: 'DELETE' },
                ),
              )
            }
          />
        )}

        {tab === 'bulk' && (
          <BulkImportTab
            connectors={connectors}
            selectedConnectorId={selectedConnectorId}
            setSelectedConnectorId={setSelectedConnectorId}
            busy={busy}
            onSubmit={(connectorId, body) =>
              wrap(doNotTranslate(`Bulk import queued`), () =>
                fetchJSON(
                  `/_premaccess/connectors/${connectorId}/bulk-import`,
                  {
                    method: 'POST',
                    body: JSON.stringify(body),
                  },
                ),
              )
            }
          />
        )}

        {tab === 'inferred' && (
          <InferredTab
            edges={edges}
            minConfidence={minConfidence}
            setMinConfidence={setMinConfidence}
            busy={busy}
            onPromote={(e) =>
              wrap(doNotTranslate('Edge promoted'), () =>
                fetchJSON('/_premaccess/inferred-edges/promote', {
                  method: 'POST',
                  body: JSON.stringify({
                    runId: e.runId,
                    semanticType: e.semanticType,
                    fromTwentyId: e.fromTwentyId,
                    toTwentyId: e.toTwentyId,
                  }),
                }),
              )
            }
            onRejectBelow={(runId, conf) =>
              wrap(doNotTranslate('Edges rejected'), () =>
                fetchJSON('/_premaccess/inferred-edges/reject-below', {
                  method: 'POST',
                  body: JSON.stringify({ runId, confidence: conf }),
                }),
              )
            }
          />
        )}

        {tab === 'docs' && <DocsTab />}
      </div>
    </div>
  );
};

const OverviewTab = ({
  connectors,
  syncs,
  busy,
  onCreate,
  onTrigger,
  onUpdate,
  onDelete,
}: {
  connectors: Connector[];
  syncs: Sync[];
  busy: boolean;
  onCreate: (input: {
    source: string;
    displayName: string;
    workspaceId: string;
  }) => Promise<void>;
  onTrigger: (id: string, dryRun: boolean) => Promise<void>;
  onUpdate: (
    id: string,
    patch: { displayName?: string; status?: string },
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) => {
  const [source, setSource] = useState('hubspot');
  const [displayName, setDisplayName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [expandedSyncId, setExpandedSyncId] = useState<string | null>(null);

  return (
    <>
      <div style={styles.formCard}>
        <div style={{ ...styles.sectionTitle, marginBottom: 4 }}>
          {doNotTranslate('+ Connect a new source CRM')}
        </div>
        <div style={styles.sectionHelp}>
          {doNotTranslate(
            "Pick the source CRM and give it a memorable display name. Credentials for the source are configured separately by an admin before the connector can run — ask if you don't have them yet.",
          )}
        </div>
        <div style={{ ...styles.formGrid, marginTop: 12 }}>
          <div>
            <label style={styles.label}>
              {doNotTranslate('Source')}{' '}
              <InfoIcon
                tip={doNotTranslate(
                  "Source CRM type. Pick the system you're pulling data from.",
                )}
              />
            </label>
            <select
              style={styles.input}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="hubspot">{doNotTranslate('hubspot')}</option>
              <option value="salesforce" disabled>
                {doNotTranslate('salesforce (coming soon)')}
              </option>
              <option value="pipedrive" disabled>
                {doNotTranslate('pipedrive (coming soon)')}
              </option>
            </select>
          </div>
          <div>
            <label style={styles.label}>
              {doNotTranslate('Display name')}{' '}
              <InfoIcon
                tip={doNotTranslate(
                  "Free-text name shown in the connectors list. Pick something colleagues will recognise (e.g. 'HubSpot Prod', 'HubSpot Sandbox').",
                )}
              />
            </label>
            <input
              style={styles.input}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={doNotTranslate('HubSpot Prod')}
            />
          </div>
        </div>
        <button
          style={styles.btnPrimary}
          disabled={busy || displayName.trim() === ''}
          onClick={() =>
            onCreate({
              source,
              displayName: displayName.trim(),
              workspaceId: WORKSPACE_ID,
            })
          }
        >
          {doNotTranslate('Create connector')}
        </button>
      </div>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionTitle}>{doNotTranslate('Connectors')}</div>
          <div style={styles.sectionHelp}>
            {doNotTranslate('One row per source CRM linked to this workspace.')}
          </div>
        </div>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thRow}>
              <Th
                tip={doNotTranslate('Connector kind (hubspot, salesforce, …)')}
              >
                {doNotTranslate('Source')}
              </Th>
              <Th
                tip={doNotTranslate(
                  'Display name you set when creating the connector',
                )}
              >
                {doNotTranslate('Name')}
              </Th>
              <Th
                tip={doNotTranslate(
                  'active = healthy. failed = last sync errored. Hover the last-sync cell for the run status.',
                )}
              >
                {doNotTranslate('Status')}
              </Th>
              <Th
                tip={doNotTranslate(
                  'Number of HubSpot/source properties remapped to a Twenty field. 0 means the default mapping.yaml is used unchanged.',
                )}
              >
                {doNotTranslate('Field overrides')}
              </Th>
              <Th
                tip={doNotTranslate(
                  'Wall-clock time the most recent run was triggered. Empty if never run.',
                )}
              >
                {doNotTranslate('Last sync')}
              </Th>
              <th style={styles.th}>{doNotTranslate('Action')}</th>
            </tr>
          </thead>
          <tbody>
            {connectors.length === 0 && (
              <tr style={styles.tdRow}>
                <td style={styles.td} colSpan={6}>
                  {doNotTranslate(
                    'No connectors yet. Use the form above to create one.',
                  )}
                </td>
              </tr>
            )}
            {connectors.map((c) => {
              const editing = editingId === c.id;
              return (
                <tr key={c.id} style={styles.tdRow}>
                  <td style={styles.td}>{c.source}</td>
                  <td style={styles.td}>
                    {editing ? (
                      <input
                        style={{ ...styles.input, padding: '4px 8px' }}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    ) : (
                      c.displayName
                    )}
                  </td>
                  <td style={styles.td}>
                    {editing ? (
                      <select
                        style={{ ...styles.input, padding: '4px 8px' }}
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                      >
                        <option value="active">
                          {doNotTranslate('active')}
                        </option>
                        <option value="paused">
                          {doNotTranslate('paused')}
                        </option>
                        <option value="archived">
                          {doNotTranslate('archived')}
                        </option>
                      </select>
                    ) : (
                      <span style={pillFor(c.status)}>{c.status}</span>
                    )}
                  </td>
                  <td style={styles.td}>{c.fieldOverrideCount}</td>
                  <td style={styles.td}>
                    {c.lastSyncAt === null
                      ? '—'
                      : new Date(c.lastSyncAt).toLocaleString()}
                    {c.lastSyncStatus !== null && (
                      <>
                        {' '}
                        <span style={pillFor(c.lastSyncStatus)}>
                          {c.lastSyncStatus}
                        </span>
                      </>
                    )}
                  </td>
                  <td style={styles.td}>
                    {editing ? (
                      <>
                        <button
                          style={{ ...styles.btnPrimary, marginRight: 6 }}
                          disabled={busy}
                          onClick={async () => {
                            await onUpdate(c.id, {
                              displayName: editName.trim(),
                              status: editStatus,
                            });
                            setEditingId(null);
                          }}
                        >
                          {doNotTranslate('Save')}
                        </button>
                        <button
                          style={styles.btn}
                          disabled={busy}
                          onClick={() => setEditingId(null)}
                        >
                          {doNotTranslate('Cancel')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          style={{ ...styles.btn, marginRight: 6 }}
                          onClick={() => {
                            setEditingId(c.id);
                            setEditName(c.displayName);
                            setEditStatus(c.status);
                          }}
                          disabled={busy}
                          title="Edit display name + status. Source cannot be changed."
                        >
                          {doNotTranslate('Edit')}
                        </button>
                        <button
                          style={{ ...styles.btn, marginRight: 6 }}
                          onClick={() => onTrigger(c.id, true)}
                          disabled={busy}
                          title="Dry-run: extract + stage + diff, but rollback before writing to the workspace. Safe on production data."
                        >
                          {doNotTranslate('Dry-run sync')}
                        </button>
                        <button
                          style={{ ...styles.btnPrimary, marginRight: 6 }}
                          onClick={() => {
                            if (
                              window.confirm(
                                'Live sync will WRITE to the workspace tables. Continue?',
                              )
                            ) {
                              void onTrigger(c.id, false);
                            }
                          }}
                          disabled={busy}
                          title="Live sync: same as dry-run but commits the load. Always run a dry-run first."
                        >
                          {doNotTranslate('Live sync')}
                        </button>
                        <button
                          style={styles.btnDanger}
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete connector '${c.displayName}'? Its runs + override rows stay in migration_staging, but no further syncs will trigger.`,
                              )
                            ) {
                              void onDelete(c.id);
                            }
                          }}
                          title="Soft-style delete: removes the connector row. Past runs and inferred edges are preserved for audit."
                        >
                          {doNotTranslate('Delete')}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionTitle}>{doNotTranslate('Recent runs')}</div>
          <div style={styles.sectionHelp}>
            {doNotTranslate(
              'Last 30 runs across all connectors. Use this to confirm a sync landed and to see how much data it moved.',
            )}
          </div>
        </div>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thRow}>
              <Th
                tip={doNotTranslate('When the run was triggered (local time).')}
              >
                {doNotTranslate('Started')}
              </Th>
              <Th tip={doNotTranslate('User who triggered this run.')}>
                {doNotTranslate('Triggered by')}
              </Th>
              <Th
                tip={doNotTranslate(
                  'full = re-extracts everything; delta = only changes since last sync. dry-run = stages but does not commit.',
                )}
              >
                {doNotTranslate('Mode')}
              </Th>
              <Th
                tip={doNotTranslate(
                  "pending = queued. in_progress = the orchestrator is working on it. completed = succeeded. failed = inspect the run record's error_message.",
                )}
              >
                {doNotTranslate('Status')}
              </Th>
              <Th
                tip={doNotTranslate(
                  'Rows normalised and staged for load. Excludes rows skipped by dedup.',
                )}
              >
                {doNotTranslate('Rows')}
              </Th>
              <Th
                tip={doNotTranslate(
                  'Association edges staged, including AI-inferred ones pending review in Tab 4.',
                )}
              >
                {doNotTranslate('Edges')}
              </Th>
            </tr>
          </thead>
          <tbody>
            {syncs.length === 0 && (
              <tr style={styles.tdRow}>
                <td style={styles.td} colSpan={6}>
                  {doNotTranslate(
                    'No runs yet. Trigger a sync from the table above.',
                  )}
                </td>
              </tr>
            )}
            {syncs.map((s) => {
              const triggeredBy =
                s.triggeredByName ?? s.triggeredByEmail ?? '—';
              const modeLabel =
                s.mode === null
                  ? '—'
                  : `${s.mode}${s.dryRun === true ? doNotTranslate(' · dry-run') : s.dryRun === false ? doNotTranslate(' · live') : ''}`;
              const isOpen = expandedSyncId === s.id;
              const buildConsoleUrl =
                s.buildId === null
                  ? null
                  : `https://eu-west-1.console.aws.amazon.com/codesuite/codebuild/152160818779/projects/gbl-dev-premaccess-migration/build/${encodeURIComponent(s.buildId)}/?region=eu-west-1`;
              return (
                <>
                  <tr
                    key={s.id}
                    style={{ ...styles.tdRow, cursor: 'pointer' }}
                    onClick={() => setExpandedSyncId(isOpen ? null : s.id)}
                    title={`Click to ${isOpen ? 'collapse' : 'inspect'} run ${s.id}`}
                  >
                    <td style={styles.td}>
                      <span style={{ opacity: 0.5, marginRight: 6 }}>
                        {isOpen ? '▾' : '▸'}
                      </span>
                      {new Date(s.startedAt).toLocaleString()}
                    </td>
                    <td style={styles.td} title={s.triggeredByEmail ?? ''}>
                      {triggeredBy}
                    </td>
                    <td style={styles.td}>{modeLabel}</td>
                    <td style={styles.td}>
                      <span style={pillFor(s.status)}>{s.status}</span>
                    </td>
                    <td style={styles.td}>{s.rowsStaged}</td>
                    <td style={styles.td}>{s.edgesStaged}</td>
                  </tr>
                  {isOpen && (
                    <tr key={`${s.id}-detail`} style={styles.tdRow}>
                      <td style={{ ...styles.td, padding: 18 }} colSpan={6}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '160px 1fr',
                            gap: '6px 12px',
                            fontSize: 13,
                          }}
                        >
                          <div
                            style={{
                              color: themeCssVariables.font.color.tertiary,
                            }}
                          >
                            {doNotTranslate('Run ID')}
                          </div>
                          <div>
                            <code style={styles.code}>{s.id}</code>
                          </div>
                          <div
                            style={{
                              color: themeCssVariables.font.color.tertiary,
                            }}
                          >
                            {doNotTranslate('Started')}
                          </div>
                          <div>{new Date(s.startedAt).toLocaleString()}</div>
                          <div
                            style={{
                              color: themeCssVariables.font.color.tertiary,
                            }}
                          >
                            {doNotTranslate('Completed')}
                          </div>
                          <div>
                            {s.completedAt === null
                              ? '—'
                              : new Date(s.completedAt).toLocaleString()}
                          </div>
                          <div
                            style={{
                              color: themeCssVariables.font.color.tertiary,
                            }}
                          >
                            {doNotTranslate('Last orchestrator event')}
                          </div>
                          <div>
                            {s.lastMarkerAt === null
                              ? '—'
                              : new Date(s.lastMarkerAt).toLocaleString()}
                          </div>
                          <div
                            style={{
                              color: themeCssVariables.font.color.tertiary,
                            }}
                          >
                            {doNotTranslate('CodeBuild build ID')}
                          </div>
                          <div>
                            {s.buildId === null ? (
                              <span style={{ opacity: 0.5 }}>
                                {doNotTranslate(
                                  'not started — the orchestrator has not reached the build step yet',
                                )}
                              </span>
                            ) : (
                              <>
                                <code style={styles.code}>{s.buildId}</code>
                                {buildConsoleUrl !== null && (
                                  <>
                                    {' '}
                                    <a
                                      href={buildConsoleUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        color: themeCssVariables.color.blue,
                                      }}
                                    >
                                      {doNotTranslate('open in AWS console ↗')}
                                    </a>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                          <div
                            style={{
                              color: themeCssVariables.font.color.tertiary,
                            }}
                          >
                            {doNotTranslate('Pipeline stages')}
                          </div>
                          <div>
                            <PipelineStages s={s} />
                          </div>
                          {s.errorMessage !== null && (
                            <>
                              <div
                                style={{
                                  color: themeCssVariables.font.color.tertiary,
                                }}
                              >
                                {doNotTranslate('Error')}
                              </div>
                              <pre
                                style={{
                                  ...styles.codeBlock,
                                  marginTop: 0,
                                  maxHeight: 220,
                                }}
                              >
                                {s.errorMessage}
                              </pre>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
};

type FieldOverride = {
  twentyObject: string;
  sourceProperty: string;
  action: string;
  twentyField: string | null;
  updatedAt: string;
};
type AssocOverride = {
  nativePair: string;
  semanticName: string | null;
  updatedAt: string;
};

const MappingsTab = ({
  connectors,
  selectedConnectorId,
  setSelectedConnectorId,
  busy,
  onFieldMap,
  onAssocMap,
  onFieldDelete,
  onAssocDelete,
}: {
  connectors: Connector[];
  selectedConnectorId: string | null;
  setSelectedConnectorId: (id: string) => void;
  busy: boolean;
  onFieldMap: (
    connectorId: string,
    body: {
      twentyObject: string;
      sourceProperty: string;
      action: string;
      twentyField?: string;
    },
  ) => Promise<void>;
  onAssocMap: (
    connectorId: string,
    body: { nativePair: string; semanticName?: string },
  ) => Promise<void>;
  onFieldDelete: (
    connectorId: string,
    twentyObject: string,
    sourceProperty: string,
  ) => Promise<void>;
  onAssocDelete: (connectorId: string, nativePair: string) => Promise<void>;
}) => {
  const [twentyObject, setTwentyObject] = useState('company');
  const [sourceProperty, setSourceProperty] = useState('');
  const [action, setAction] = useState('alias');
  const [twentyField, setTwentyField] = useState('');

  const [nativePair, setNativePair] = useState('');
  const [semanticName, setSemanticName] = useState('');

  const [fieldOverrides, setFieldOverrides] = useState<FieldOverride[]>([]);
  const [assocOverrides, setAssocOverrides] = useState<AssocOverride[]>([]);

  useEffect(() => {
    if (selectedConnectorId === null) {
      setFieldOverrides([]);
      setAssocOverrides([]);
      return;
    }
    (async () => {
      try {
        const [f, a] = await Promise.all([
          fetchJSON<FieldOverride[]>(
            `/_premaccess/connectors/${selectedConnectorId}/field-mappings`,
          ),
          fetchJSON<AssocOverride[]>(
            `/_premaccess/connectors/${selectedConnectorId}/association-mappings`,
          ),
        ]);
        setFieldOverrides(f);
        setAssocOverrides(a);
      } catch {
        // surface in parent err state via parent fetch already; swallow here
      }
    })();
  }, [selectedConnectorId, busy]);

  if (connectors.length === 0) {
    return (
      <div style={styles.helpBanner}>
        {doNotTranslate('No connectors yet. Create one in ')}
        <strong>{doNotTranslate('1. Connectors & runs')}</strong>{' '}
        {doNotTranslate('first.')}
      </div>
    );
  }

  return (
    <>
      <div style={styles.formCard}>
        <div style={{ ...styles.sectionTitle, marginBottom: 4 }}>
          {doNotTranslate('Connector')}
        </div>
        <div style={styles.sectionHelp}>
          {doNotTranslate(
            'Mappings apply per connector — pick which one to edit.',
          )}
        </div>
        <select
          style={{ ...styles.input, marginTop: 8, maxWidth: 360 }}
          value={selectedConnectorId ?? ''}
          onChange={(e) => setSelectedConnectorId(e.target.value)}
        >
          {connectors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName} ({c.source})
            </option>
          ))}
        </select>
      </div>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionTitle}>
            {doNotTranslate('Current field overrides')}
          </div>
          <div style={styles.sectionHelp}>
            {fieldOverrides.length}
            {doNotTranslate(
              " override(s) on this connector. Anything not listed here uses the connector's default mapping.",
            )}
          </div>
        </div>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thRow}>
              <Th tip={doNotTranslate('Twenty target table.')}>
                {doNotTranslate('Twenty object')}
              </Th>
              <Th tip={doNotTranslate('Source CRM property name.')}>
                {doNotTranslate('Source property')}
              </Th>
              <Th tip={doNotTranslate('alias / custom / ignore.')}>
                {doNotTranslate('Action')}
              </Th>
              <Th
                tip={doNotTranslate(
                  'Target field name on Twenty (only for alias / custom).',
                )}
              >
                {doNotTranslate('Twenty field')}
              </Th>
              <Th tip={doNotTranslate('Last write time.')}>
                {doNotTranslate('Updated')}
              </Th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {fieldOverrides.length === 0 && (
              <tr style={styles.tdRow}>
                <td style={styles.td} colSpan={6}>
                  {doNotTranslate('No overrides yet. Add one below.')}
                </td>
              </tr>
            )}
            {fieldOverrides.map((o, i) => (
              <tr key={i} style={styles.tdRow}>
                <td style={styles.td}>{o.twentyObject}</td>
                <td style={styles.td}>
                  <code style={styles.code}>{o.sourceProperty}</code>
                </td>
                <td style={styles.td}>
                  <span
                    style={pillFor(
                      o.action === 'ignore'
                        ? 'failed'
                        : o.action === 'alias'
                          ? 'active'
                          : 'completed',
                    )}
                  >
                    {o.action}
                  </span>
                </td>
                <td style={styles.td}>
                  {o.twentyField === null ? (
                    <span style={{ opacity: 0.5 }}>—</span>
                  ) : (
                    <code style={styles.code}>{o.twentyField}</code>
                  )}
                </td>
                <td style={styles.td}>
                  {new Date(o.updatedAt).toLocaleString()}
                </td>
                <td style={styles.td}>
                  <button
                    style={styles.btnDanger}
                    disabled={busy || selectedConnectorId === null}
                    onClick={() => {
                      if (
                        selectedConnectorId !== null &&
                        window.confirm(
                          `Remove field override ${o.twentyObject}.${o.sourceProperty}?`,
                        )
                      ) {
                        void onFieldDelete(
                          selectedConnectorId,
                          o.twentyObject,
                          o.sourceProperty,
                        );
                      }
                    }}
                  >
                    {doNotTranslate('Remove')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionTitle}>
            {doNotTranslate('Current association overrides')}
          </div>
          <div style={styles.sectionHelp}>
            {assocOverrides.length}
            {doNotTranslate(
              ' override(s). Sets the canonical semantic for native pairs.',
            )}
          </div>
        </div>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thRow}>
              <Th tip={doNotTranslate('Source pair, format left:right.')}>
                {doNotTranslate('Native pair')}
              </Th>
              <Th tip={doNotTranslate('Twenty canonical semantic name.')}>
                {doNotTranslate('Semantic name')}
              </Th>
              <Th tip={doNotTranslate('Last write time.')}>
                {doNotTranslate('Updated')}
              </Th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {assocOverrides.length === 0 && (
              <tr style={styles.tdRow}>
                <td style={styles.td} colSpan={4}>
                  {doNotTranslate('No overrides yet. Add one below.')}
                </td>
              </tr>
            )}
            {assocOverrides.map((o, i) => (
              <tr key={i} style={styles.tdRow}>
                <td style={styles.td}>
                  <code style={styles.code}>{o.nativePair}</code>
                </td>
                <td style={styles.td}>
                  {o.semanticName === null ? (
                    <span style={{ opacity: 0.5 }}>—</span>
                  ) : (
                    <code style={styles.code}>{o.semanticName}</code>
                  )}
                </td>
                <td style={styles.td}>
                  {new Date(o.updatedAt).toLocaleString()}
                </td>
                <td style={styles.td}>
                  <button
                    style={styles.btnDanger}
                    disabled={busy || selectedConnectorId === null}
                    onClick={() => {
                      if (
                        selectedConnectorId !== null &&
                        window.confirm(
                          `Remove association override ${o.nativePair}?`,
                        )
                      ) {
                        void onAssocDelete(selectedConnectorId, o.nativePair);
                      }
                    }}
                  >
                    {doNotTranslate('Remove')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div style={styles.formCard}>
        <div style={{ ...styles.sectionTitle, marginBottom: 4 }}>
          {doNotTranslate('Field mapping override')}
        </div>
        <div style={styles.sectionHelp}>
          {doNotTranslate(
            'Decide what happens to a source property at load time. Each connector ships with sensible defaults — overrides set here apply only to this connector and win at sync time.',
          )}
        </div>
        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>
              {doNotTranslate('Twenty object')}{' '}
              <InfoIcon
                tip={doNotTranslate(
                  'Which Twenty table the source property lands on: company, person, opportunity, task, note.',
                )}
              />
            </label>
            <select
              style={styles.input}
              value={twentyObject}
              onChange={(e) => setTwentyObject(e.target.value)}
            >
              <option>{doNotTranslate('company')}</option>
              <option>{doNotTranslate('person')}</option>
              <option>{doNotTranslate('opportunity')}</option>
              <option>{doNotTranslate('task')}</option>
              <option>{doNotTranslate('note')}</option>
            </select>
          </div>
          <div>
            <label style={styles.label}>
              {doNotTranslate('Source property')}{' '}
              <InfoIcon
                tip={doNotTranslate(
                  "The source CRM property name exactly as it appears in the source (e.g. 'hs_lead_status' on HubSpot).",
                )}
              />
            </label>
            <input
              style={styles.input}
              value={sourceProperty}
              onChange={(e) => setSourceProperty(e.target.value)}
              placeholder={doNotTranslate('hs_lead_status')}
            />
          </div>
          <div>
            <label style={styles.label}>
              {doNotTranslate('Action')}{' '}
              <InfoIcon
                tip={doNotTranslate(
                  'alias = map to an existing Twenty field. custom = create a new custom field in Twenty. ignore = drop the property on load.',
                )}
              />
            </label>
            <select
              style={styles.input}
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="alias">
                {doNotTranslate('alias → existing field')}
              </option>
              <option value="custom">
                {doNotTranslate('custom → new field')}
              </option>
              <option value="ignore">{doNotTranslate('ignore → drop')}</option>
            </select>
          </div>
          <div>
            <label style={styles.label}>
              {doNotTranslate('Twenty field')}{' '}
              {action === 'ignore' ? (
                <span style={{ opacity: 0.5 }}>
                  {doNotTranslate('(unused)')}
                </span>
              ) : (
                <InfoIcon
                  tip={doNotTranslate(
                    "Required for 'alias' — the existing field name on Twenty (e.g. 'leadStatus'). Required for 'custom' — the new field name to create. Leave empty for 'ignore'.",
                  )}
                />
              )}
            </label>
            <input
              style={styles.input}
              value={twentyField}
              onChange={(e) => setTwentyField(e.target.value)}
              placeholder={doNotTranslate('leadStatus')}
              disabled={action === 'ignore'}
            />
          </div>
        </div>
        <button
          style={styles.btnPrimary}
          disabled={
            busy || selectedConnectorId === null || sourceProperty.trim() === ''
          }
          onClick={() =>
            selectedConnectorId !== null &&
            onFieldMap(selectedConnectorId, {
              twentyObject,
              sourceProperty: sourceProperty.trim(),
              action,
              twentyField:
                twentyField.trim() === '' ? undefined : twentyField.trim(),
            })
          }
        >
          {doNotTranslate('Save field mapping')}
        </button>
      </div>

      <div style={styles.formCard}>
        <div style={{ ...styles.sectionTitle, marginBottom: 4 }}>
          {doNotTranslate('Association mapping override')}
        </div>
        <div style={styles.sectionHelp}>
          {doNotTranslate(
            "Tells the connector what semantic association a native pair represents. Example: HubSpot's",
          )}{' '}
          <code style={styles.code}>{doNotTranslate('company:contact')}</code>
          {doNotTranslate(' pair is universally')}{' '}
          <code style={styles.code}>{doNotTranslate('employs')}</code>
          {doNotTranslate(" in Twenty's semantic graph.")}
        </div>
        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>
              {doNotTranslate('Native pair')}{' '}
              <InfoIcon
                tip={doNotTranslate(
                  "Native association name from the source. Format: left:right using the source's object names. E.g. HubSpot 'companies:contacts'.",
                )}
              />
            </label>
            <input
              style={styles.input}
              value={nativePair}
              onChange={(e) => setNativePair(e.target.value)}
              placeholder={doNotTranslate('company:person')}
            />
          </div>
          <div>
            <label style={styles.label}>
              {doNotTranslate('Semantic name')}{' '}
              <InfoIcon
                tip={doNotTranslate(
                  'Canonical Twenty semantic name used by the universal association graph. Examples: employs, attended_by, owned_by.',
                )}
              />
            </label>
            <input
              style={styles.input}
              value={semanticName}
              onChange={(e) => setSemanticName(e.target.value)}
              placeholder={doNotTranslate('employs')}
            />
          </div>
        </div>
        <button
          style={styles.btnPrimary}
          disabled={
            busy || selectedConnectorId === null || nativePair.trim() === ''
          }
          onClick={() =>
            selectedConnectorId !== null &&
            onAssocMap(selectedConnectorId, {
              nativePair: nativePair.trim(),
              semanticName:
                semanticName.trim() === '' ? undefined : semanticName.trim(),
            })
          }
        >
          {doNotTranslate('Save association mapping')}
        </button>
      </div>
    </>
  );
};

const BulkImportTab = ({
  connectors,
  selectedConnectorId,
  setSelectedConnectorId,
  busy,
  onSubmit,
}: {
  connectors: Connector[];
  selectedConnectorId: string | null;
  setSelectedConnectorId: (id: string) => void;
  busy: boolean;
  onSubmit: (
    connectorId: string,
    body: { twentyObject: string; rows: Array<Record<string, unknown>> },
  ) => Promise<void>;
}) => {
  const [twentyObject, setTwentyObject] = useState('company');
  const sampleRef = useRef<HTMLTextAreaElement>(null);

  const sampleJSON = JSON.stringify(
    [
      {
        natural_key: 'acme.com',
        domain: 'acme.com',
        name: doNotTranslate('Acme Inc.'),
      },
      {
        natural_key: 'globex.com',
        domain: 'globex.com',
        name: doNotTranslate('Globex Corp.'),
      },
    ],
    null,
    2,
  );
  const [text, setText] = useState(sampleJSON);

  if (connectors.length === 0) {
    return (
      <div style={styles.helpBanner}>
        {doNotTranslate(
          'No connectors yet. Bulk import needs a connector to scope the run to —',
        )}{' '}
        {doNotTranslate('create one in ')}
        <strong>{doNotTranslate('1. Connectors & runs')}</strong>
        {doNotTranslate(' first.')}
      </div>
    );
  }

  return (
    <>
      <div style={styles.formCard}>
        <div style={{ ...styles.sectionTitle, marginBottom: 4 }}>
          {doNotTranslate('Bulk import rows')}
        </div>
        <div style={styles.sectionHelp}>
          {doNotTranslate(
            'One-shot import for ad-hoc data (CSV uploads, manual lists, paper-form transcription). Rows are queued into',
          )}{' '}
          <code style={styles.code}>
            {doNotTranslate('migration_staging.normalized_rows')}
          </code>{' '}
          {doNotTranslate(
            'under a fresh run, ready for the loader to push into Twenty.',
          )}
          <br />
          {doNotTranslate('Required per row: ')}
          <code style={styles.code}>{doNotTranslate('natural_key')}</code>
          {doNotTranslate(
            ' (any stable string — domain, email, internal ID). Optional:',
          )}{' '}
          <code style={styles.code}>{doNotTranslate('external_id')}</code>
          {doNotTranslate(
            " (defaults to natural_key). Everything else is stored in the raw JSON and used by the connector's normaliser.",
          )}
        </div>
        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>{doNotTranslate('Connector')}</label>
            <select
              style={styles.input}
              value={selectedConnectorId ?? ''}
              onChange={(e) => setSelectedConnectorId(e.target.value)}
            >
              {connectors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName} ({c.source})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={styles.label}>
              {doNotTranslate('Twenty object')}
            </label>
            <select
              style={styles.input}
              value={twentyObject}
              onChange={(e) => setTwentyObject(e.target.value)}
            >
              <option>{doNotTranslate('company')}</option>
              <option>{doNotTranslate('person')}</option>
              <option>{doNotTranslate('opportunity')}</option>
              <option>{doNotTranslate('task')}</option>
              <option>{doNotTranslate('note')}</option>
            </select>
          </div>
        </div>
        <label style={styles.label}>
          {doNotTranslate('Rows (JSON array)')}
        </label>
        <textarea
          ref={sampleRef}
          style={{
            ...styles.input,
            minHeight: 200,
            fontFamily: 'ui-monospace, Menlo, monospace',
          }}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            style={styles.btn}
            onClick={() => setText(sampleJSON)}
            title="Reset the textarea to a working example."
          >
            {doNotTranslate('Reset to example')}
          </button>
          <button
            style={styles.btnPrimary}
            disabled={busy || selectedConnectorId === null}
            onClick={() => {
              let rows: Array<Record<string, unknown>>;
              try {
                rows = JSON.parse(text);
                if (!Array.isArray(rows)) {
                  throw new Error('Top-level must be a JSON array.');
                }
              } catch (e) {
                alert(`Invalid JSON: ${(e as Error).message}`);
                return;
              }
              if (selectedConnectorId !== null) {
                void onSubmit(selectedConnectorId, { twentyObject, rows });
              }
            }}
          >
            {doNotTranslate('Queue bulk import')}
          </button>
        </div>
      </div>
    </>
  );
};

const InferredTab = ({
  edges,
  minConfidence,
  setMinConfidence,
  busy,
  onPromote,
  onRejectBelow,
}: {
  edges: InferredEdge[];
  minConfidence: number;
  setMinConfidence: (v: number) => void;
  busy: boolean;
  onPromote: (e: InferredEdge) => Promise<void>;
  onRejectBelow: (runId: string, conf: number) => Promise<void>;
}) => {
  const grouped = useMemo(() => {
    const m = new Map<string, InferredEdge[]>();
    for (const e of edges) {
      const arr = m.get(e.runId) ?? [];
      arr.push(e);
      m.set(e.runId, arr);
    }
    return m;
  }, [edges]);

  return (
    <>
      <div style={styles.helpBanner}>
        <strong>{doNotTranslate('Inferred edges')}</strong>
        {doNotTranslate(
          " are links Bedrock (Claude Sonnet 4.6) detected between rows the source CRM did not connect explicitly — for example, a task whose title mentions a person's name. Each edge carries an evidence string and a confidence score. Promote the ones you trust; bulk-reject the rest under a threshold.",
        )}
        <br />
        <span style={{ color: themeCssVariables.font.color.tertiary }}>
          {doNotTranslate(
            'Threshold ≥ 0.9 is usually safe to auto-promote in batch. Below 0.7 is noisy — start there and walk up.',
          )}
        </span>
      </div>

      <div
        style={{
          ...styles.formCard,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <label style={{ ...styles.label, margin: 0 }}>
          {doNotTranslate('Minimum confidence:')}
        </label>
        <input
          type="range"
          min={0.5}
          max={1}
          step={0.05}
          value={minConfidence}
          onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
          style={{ flex: 1, maxWidth: 320 }}
        />
        <code style={styles.code}>{minConfidence.toFixed(2)}</code>
        <span style={{ ...styles.sectionHelp, marginLeft: 'auto' }}>
          {edges.length}
          {doNotTranslate(' edge(s) at this threshold')}
        </span>
      </div>

      {[...grouped.entries()].map(([runId, runEdges]) => (
        <div key={runId} style={styles.card}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 13 }}>
              {doNotTranslate('Run ')}
              <code style={styles.code}>{runId.slice(0, 8)}…</code> ·{' '}
              {runEdges.length}
              {doNotTranslate(' edge(s)')}
            </div>
            <button
              style={styles.btnDanger}
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    `Reject ALL edges below confidence ${minConfidence.toFixed(2)} from run ${runId.slice(
                      0,
                      8,
                    )}…? This is destructive.`,
                  )
                ) {
                  void onRejectBelow(runId, minConfidence);
                }
              }}
              title="Delete every inferred edge in this run whose confidence is ≤ the slider threshold. Edges already promoted are not touched."
            >
              {doNotTranslate('Reject all below ')}
              {minConfidence.toFixed(2)}
            </button>
          </div>
          {runEdges.map((e, i) => (
            <div
              key={i}
              style={{
                borderTop:
                  i === 0
                    ? 'none'
                    : `1px solid ${themeCssVariables.border.color.light}`,
                paddingTop: i === 0 ? 0 : 10,
                paddingBottom: 10,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                {e.semanticType} · {e.fromObject} → {e.toObject}{' '}
                <span style={pillFor('completed')}>
                  {e.confidence.toFixed(2)}
                </span>
              </div>
              <div
                style={{
                  color: themeCssVariables.font.color.secondary,
                  fontSize: 13,
                }}
              >
                {e.evidence}
              </div>
              {e.parentTitle !== null && (
                <div
                  style={{
                    color: themeCssVariables.font.color.tertiary,
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  {doNotTranslate('&ldquo;')}
                  {e.parentTitle}
                  {doNotTranslate('&rdquo;')}
                </div>
              )}
              <button
                style={{ ...styles.btn, marginTop: 8 }}
                onClick={() => onPromote(e)}
                disabled={busy}
                title="Mark this edge as manually approved. The loader will write it into Twenty's association graph alongside CRM-native edges."
              >
                {doNotTranslate('Promote to canonical')}
              </button>
            </div>
          ))}
        </div>
      ))}

      {edges.length === 0 && (
        <div
          style={{ color: themeCssVariables.font.color.tertiary, fontSize: 13 }}
        >
          {doNotTranslate('No pending inferred edges at confidence ≥ ')}
          {minConfidence.toFixed(2)}.
        </div>
      )}
    </>
  );
};

const DocsTab = () => (
  <div style={styles.card}>
    <div style={{ ...styles.sectionTitle, marginBottom: 12 }}>
      {doNotTranslate('Docs · quick reference')}
    </div>

    <details open style={{ marginBottom: 10 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
        {doNotTranslate('Concepts in 30 seconds')}
      </summary>
      <ul
        style={{
          fontSize: 13,
          lineHeight: 1.7,
          color: themeCssVariables.font.color.secondary,
        }}
      >
        <li>
          <strong>{doNotTranslate('Connector')}</strong>
          {doNotTranslate(
            ' — one source CRM (HubSpot, Salesforce…) linked to this Twenty workspace. Each gets its own credentials and mappings.',
          )}
        </li>
        <li>
          <strong>{doNotTranslate('Sync run')}</strong>
          {doNotTranslate(
            ' — a single extract → normalize → load cycle. Always start with a dry-run to see counts before committing.',
          )}
        </li>
        <li>
          <strong>{doNotTranslate('Inferred edges')}</strong>
          {doNotTranslate(
            " — links Bedrock detects between tasks/notes and people/companies the source CRM didn't connect explicitly. You review and approve them in Tab 4.",
          )}
        </li>
      </ul>
    </details>

    <details style={{ marginBottom: 10 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
        {doNotTranslate('End-to-end happy path')}
      </summary>
      <ol
        style={{
          fontSize: 13,
          lineHeight: 1.7,
          color: themeCssVariables.font.color.secondary,
        }}
      >
        <li>
          {doNotTranslate(
            'Create a connector (Tab 1 → "Connect a new source CRM").',
          )}
        </li>
        <li>
          {doNotTranslate(
            'Optionally override field/association mappings (Tab 2). Skip if defaults are fine.',
          )}
        </li>
        <li>
          {doNotTranslate('Trigger a ')}
          <strong>{doNotTranslate('dry-run sync')}</strong>
          {doNotTranslate(
            " first — never a live one until you've seen the row count.",
          )}
        </li>
        <li>
          {doNotTranslate(
            'Watch the run row appear in "Recent runs". Wait for status → completed.',
          )}
        </li>
        <li>
          {doNotTranslate(
            'Switch to Tab 4 and review inferred edges. Promote the obvious ones, reject the rest below a threshold.',
          )}
        </li>
        <li>
          {doNotTranslate('When happy, trigger a ')}
          <strong>{doNotTranslate('live sync')}</strong>
          {doNotTranslate(' on the same connector. Same diff, but commits.')}
        </li>
      </ol>
    </details>

    <details style={{ marginBottom: 10 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
        {doNotTranslate('cURL reference (power users)')}
      </summary>
      <pre style={styles.codeBlock}>
        {doNotTranslate(`# List connectors
curl -H "Authorization: Bearer $TOKEN" \\
  https://dev.dojo.bamrun.com/_premaccess/connectors?workspaceId=$WS

# Create connector
curl -H "Authorization: Bearer $TOKEN" \\
  -H 'Content-Type: application/json' \\
  -d '{"source":"hubspot","displayName":"HubSpot Prod","workspaceId":"'$WS'"}' \\
  https://dev.dojo.bamrun.com/_premaccess/connectors

# Trigger DELTA dry-run
curl -H "Authorization: Bearer $TOKEN" \\
  -H 'Content-Type: application/json' \\
  -d '{"mode":"DELTA","dryRun":true}' \\
  https://dev.dojo.bamrun.com/_premaccess/connectors/$ID/sync

# Promote an inferred edge
curl -H "Authorization: Bearer $TOKEN" \\
  -H 'Content-Type: application/json' \\
  -d '{"runId":"...","semanticType":"task_about_person","fromTwentyId":"...","toTwentyId":"..."}' \\
  https://dev.dojo.bamrun.com/_premaccess/inferred-edges/promote`)}
      </pre>
    </details>

    <details style={{ marginBottom: 10 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
        {doNotTranslate('Troubleshooting')}
      </summary>
      <ul
        style={{
          fontSize: 13,
          lineHeight: 1.7,
          color: themeCssVariables.font.color.secondary,
        }}
      >
        <li>
          <strong>{doNotTranslate('401 Unauthorized')}</strong>
          {doNotTranslate(
            ' — your Twenty session expired. Log out and back in.',
          )}
        </li>
        <li>
          <strong>{doNotTranslate('Sync stuck at pending')}</strong>
          {doNotTranslate(
            ' — the background worker that picks up runs is not wired yet. Pending rows are normal in the current preview build; ask an admin if it stays pending overnight.',
          )}
        </li>
        <li>
          <strong>{doNotTranslate('Bulk import returns failed &gt; 0')}</strong>
          {doNotTranslate(
            " — open the firstError field in the response. Most common cause: two rows share the same natural_key. Make every row's natural_key unique.",
          )}
        </li>
        <li>
          <strong>
            {doNotTranslate('Login screen reappears after deploy')}
          </strong>
          {doNotTranslate(
            ' — JWT secret is pinned, but access tokens expire on a TTL. Re-enter your credentials; the session sticks across deploys after that.',
          )}
        </li>
      </ul>
    </details>
  </div>
);

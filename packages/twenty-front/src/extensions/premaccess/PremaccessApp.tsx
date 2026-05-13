import { useEffect, useMemo, useRef, useState } from 'react';

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
 * bottom; the canonical version lives in docs/MIGRATION-RUNBOOK.md.
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
  if (match === null) return null;
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
  const res = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${body !== '' ? ` — ${body}` : ''}`);
  }
  return res.json();
};

const styles = {
  page: {
    padding: '24px 28px',
    fontFamily: 'Inter, system-ui, sans-serif',
    color: 'var(--t-font-color-primary, #f3f3f3)',
    minHeight: '100%',
    maxWidth: 1280,
  } as const,
  h1: { fontSize: 22, fontWeight: 600, marginBottom: 4 } as const,
  subtitle: { color: 'var(--t-font-color-tertiary, #888)', marginTop: 0, fontSize: 13, marginBottom: 16 } as const,
  helpBanner: {
    background: 'var(--t-background-tertiary, #1f2937)',
    border: '1px solid var(--t-border-color-light, #2a3441)',
    borderLeft: '3px solid #60a5fa',
    borderRadius: 6,
    padding: '12px 14px',
    fontSize: 13,
    color: 'var(--t-font-color-secondary, #cbd5e1)',
    marginBottom: 18,
    lineHeight: 1.5,
  } as const,
  section: { marginTop: 28 } as const,
  sectionHeader: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 } as const,
  sectionTitle: { fontSize: 15, fontWeight: 600 } as const,
  sectionHelp: { fontSize: 12, color: 'var(--t-font-color-tertiary, #888)' } as const,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 13,
    background: 'var(--t-background-primary, #1a1a1a)',
    border: '1px solid var(--t-border-color-medium, #2a2a2a)',
    borderRadius: 6,
    overflow: 'hidden' as const,
  },
  thRow: {
    background: 'var(--t-background-secondary, #222)',
    textAlign: 'left' as const,
    color: 'var(--t-font-color-secondary, #aaa)',
  },
  th: {
    padding: '10px 12px',
    fontWeight: 500,
    fontSize: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    cursor: 'help' as const,
  },
  tdRow: { borderTop: '1px solid var(--t-border-color-light, #2a2a2a)' } as const,
  td: { padding: '10px 12px' } as const,
  btn: {
    padding: '6px 12px',
    fontSize: 12,
    borderRadius: 4,
    border: '1px solid var(--t-border-color-medium, #2a2a2a)',
    background: 'var(--t-background-tertiary, #2b2b2b)',
    color: 'var(--t-font-color-primary, #f3f3f3)',
    cursor: 'pointer' as const,
  },
  btnPrimary: {
    padding: '8px 14px',
    fontSize: 13,
    borderRadius: 4,
    border: '1px solid #2563eb',
    background: '#2563eb',
    color: '#fff',
    cursor: 'pointer' as const,
    fontWeight: 500,
  },
  btnDanger: {
    padding: '6px 12px',
    fontSize: 12,
    borderRadius: 4,
    border: '1px solid #b91c1c',
    background: 'rgba(220,38,38,0.15)',
    color: '#fca5a5',
    cursor: 'pointer' as const,
  },
  card: {
    border: '1px solid var(--t-border-color-medium, #2a2a2a)',
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
    background: 'var(--t-background-primary, #1a1a1a)',
  },
  errorBanner: {
    background: 'rgba(220, 38, 38, 0.12)',
    border: '1px solid rgba(220, 38, 38, 0.4)',
    color: '#fca5a5',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    fontSize: 13,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  okBanner: {
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.4)',
    color: '#86efac',
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
    background: 'var(--t-background-secondary, #222)',
    color: 'var(--t-font-color-primary, #f3f3f3)',
    border: '1px solid var(--t-border-color-medium, #2a2a2a)',
    borderRadius: 4,
    fontFamily: 'inherit',
  } as const,
  label: { fontSize: 12, color: 'var(--t-font-color-secondary, #aaa)', marginBottom: 4, display: 'block' } as const,
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 } as const,
  formCard: {
    background: 'var(--t-background-secondary, #1c1c1c)',
    border: '1px solid var(--t-border-color-light, #2a2a2a)',
    borderRadius: 6,
    padding: 16,
    marginBottom: 16,
  } as const,
  tabs: { display: 'flex', gap: 4, borderBottom: '1px solid var(--t-border-color-medium, #2a2a2a)', marginBottom: 16 } as const,
  tab: { padding: '8px 16px', fontSize: 13, color: 'var(--t-font-color-tertiary, #888)', cursor: 'pointer' as const, borderBottom: '2px solid transparent' },
  tabActive: { color: 'var(--t-font-color-primary, #f3f3f3)', borderBottom: '2px solid #2563eb' } as const,
  code: {
    background: 'var(--t-background-secondary, #0f1419)',
    padding: '2px 5px',
    borderRadius: 3,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 12,
    color: '#fde047',
  } as const,
  codeBlock: {
    background: 'var(--t-background-secondary, #0f1419)',
    padding: 12,
    borderRadius: 4,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 12,
    color: '#cbd5e1',
    overflow: 'auto' as const,
    whiteSpace: 'pre-wrap' as const,
    marginTop: 8,
    border: '1px solid var(--t-border-color-light, #2a2a2a)',
  },
};

const pillFor = (status: string) => {
  const palette: Record<string, { bg: string; fg: string }> = {
    active: { bg: 'rgba(34,197,94,0.15)', fg: '#86efac' },
    pending: { bg: 'rgba(234,179,8,0.15)', fg: '#fde047' },
    failed: { bg: 'rgba(220,38,38,0.15)', fg: '#fca5a5' },
    completed: { bg: 'rgba(59,130,246,0.15)', fg: '#93c5fd' },
    'bulk-import': { bg: 'rgba(168,85,247,0.15)', fg: '#d8b4fe' },
  };
  const colors = palette[status] ?? { bg: 'rgba(148,163,184,0.15)', fg: '#cbd5e1' };
  return { ...styles.pill, background: colors.bg, color: colors.fg };
};

type TabKey = 'overview' | 'mappings' | 'bulk' | 'inferred' | 'docs';

const Th = ({ children, tip }: { children: React.ReactNode; tip: string }) => (
  <th style={styles.th} title={tip}>
    {children} <span style={{ opacity: 0.4, fontSize: 10 }}>ⓘ</span>
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
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setErr(null);
      const [c, s, e] = await Promise.all([
        fetchJSON<Connector[]>(`/_premaccess/connectors?workspaceId=${WORKSPACE_ID}`),
        fetchJSON<Sync[]>(`/_premaccess/syncs?limit=30`),
        fetchJSON<InferredEdge[]>(
          `/_premaccess/inferred-edges?workspaceId=${WORKSPACE_ID}&minConfidence=${minConfidence}`,
        ),
      ]);
      setConnectors(c);
      setSyncs(s);
      setEdges(e);
      if (selectedConnectorId === null && c.length > 0) setSelectedConnectorId(c[0].id);
    } catch (x) {
      setErr((x as Error).message);
    }
  };

  useEffect(() => {
    void refresh();
  }, [minConfidence]);

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
      <div style={styles.h1}>Premaccess — CRM Sync Console</div>
      <div style={styles.subtitle}>
        Operator console for CRM-Manager autonomy. Workspace {WORKSPACE_ID}.
      </div>

      <div style={styles.helpBanner}>
        <strong>How this works:</strong> Each <em>connector</em> is one source CRM (HubSpot, Salesforce…)
        linked to this Twenty workspace. A <em>sync</em> reads from the source, normalises rows, and
        loads them into Twenty's tables. The pipeline also detects <em>inferred edges</em> using
        Bedrock — links between tasks/notes and people/companies that the source CRM didn't have
        explicitly. You approve or reject those before they touch the workspace.
        <br />
        <span style={{ color: 'var(--t-font-color-tertiary, #888)' }}>
          Need the canonical reference? See <code style={styles.code}>docs/MIGRATION-RUNBOOK.md</code>
          {' '}and{' '}
          <code style={styles.code}>migration/MIGRATION_WORKFLOW.md</code> in the meta-dojo repo.
        </span>
      </div>

      {err !== null && <div style={styles.errorBanner}>Error: {err}</div>}
      {ok !== null && <div style={styles.okBanner}>{ok}</div>}

      <div style={styles.tabs}>
        {(
          [
            ['overview', '1. Connectors & runs'],
            ['mappings', '2. Field & assoc. mappings'],
            ['bulk', '3. Bulk import'],
            ['inferred', '4. Review inferred edges'],
            ['docs', 'Docs'],
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
          onCreate={(input) => wrap('Connector created', () =>
            fetchJSON('/_premaccess/connectors', { method: 'POST', body: JSON.stringify(input) }),
          )}
          onTrigger={(id, dryRun) =>
            wrap(`Sync ${dryRun ? 'dry-run' : 'live'} triggered`, () =>
              fetchJSON(`/_premaccess/connectors/${id}/sync`, {
                method: 'POST',
                body: JSON.stringify({ mode: 'DELTA', dryRun }),
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
            wrap('Field mapping saved', () =>
              fetchJSON(`/_premaccess/connectors/${connectorId}/field-mapping`, {
                method: 'POST',
                body: JSON.stringify(body),
              }),
            )
          }
          onAssocMap={(connectorId, body) =>
            wrap('Association mapping saved', () =>
              fetchJSON(`/_premaccess/connectors/${connectorId}/association-mapping`, {
                method: 'POST',
                body: JSON.stringify(body),
              }),
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
            wrap(`Bulk import queued`, () =>
              fetchJSON(`/_premaccess/connectors/${connectorId}/bulk-import`, {
                method: 'POST',
                body: JSON.stringify(body),
              }),
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
            wrap('Edge promoted', () =>
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
            wrap('Edges rejected', () =>
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
  );
};

const OverviewTab = ({
  connectors,
  syncs,
  busy,
  onCreate,
  onTrigger,
}: {
  connectors: Connector[];
  syncs: Sync[];
  busy: boolean;
  onCreate: (input: { source: string; displayName: string; workspaceId: string }) => Promise<void>;
  onTrigger: (id: string, dryRun: boolean) => Promise<void>;
}) => {
  const [source, setSource] = useState('hubspot');
  const [displayName, setDisplayName] = useState('');

  return (
    <>
      <div style={styles.formCard}>
        <div style={{ ...styles.sectionTitle, marginBottom: 4 }}>
          + Connect a new source CRM
        </div>
        <div style={styles.sectionHelp}>
          Pick the source CRM and give it a memorable display name. Credentials are configured
          separately in the source connector's README (HubSpot needs a private-app token, for
          instance — see <code style={styles.code}>migration/connectors/hubspot/README.md</code>).
        </div>
        <div style={{ ...styles.formGrid, marginTop: 12 }}>
          <div>
            <label style={styles.label} title="The connector kind. Must match a registered connector in migration/connectors/.">
              Source ⓘ
            </label>
            <select style={styles.input} value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="hubspot">hubspot</option>
              <option value="salesforce" disabled>
                salesforce (coming soon)
              </option>
              <option value="pipedrive" disabled>
                pipedrive (coming soon)
              </option>
            </select>
          </div>
          <div>
            <label style={styles.label} title="Free-text name shown in the connectors list. Pick something CRM workers will recognise (e.g. 'HubSpot Prod', 'HubSpot Sandbox').">
              Display name ⓘ
            </label>
            <input
              style={styles.input}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="HubSpot Prod"
            />
          </div>
        </div>
        <button
          style={styles.btnPrimary}
          disabled={busy || displayName.trim() === ''}
          onClick={() => onCreate({ source, displayName: displayName.trim(), workspaceId: WORKSPACE_ID })}
        >
          Create connector
        </button>
      </div>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionTitle}>Connectors</div>
          <div style={styles.sectionHelp}>One row per source CRM linked to this workspace.</div>
        </div>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thRow}>
              <Th tip="Connector kind (hubspot, salesforce, …)">Source</Th>
              <Th tip="Display name you set when creating the connector">Name</Th>
              <Th tip="active = healthy. failed = last sync errored. Hover the last-sync cell for the run status.">
                Status
              </Th>
              <Th tip="Number of HubSpot/source properties remapped to a Twenty field. 0 means the default mapping.yaml is used unchanged.">
                Field overrides
              </Th>
              <Th tip="Wall-clock time the most recent run was triggered. Empty if never run.">
                Last sync
              </Th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {connectors.length === 0 && (
              <tr style={styles.tdRow}>
                <td style={styles.td} colSpan={6}>
                  No connectors yet. Use the form above to create one.
                </td>
              </tr>
            )}
            {connectors.map((c) => (
              <tr key={c.id} style={styles.tdRow}>
                <td style={styles.td}>{c.source}</td>
                <td style={styles.td}>{c.displayName}</td>
                <td style={styles.td}>
                  <span style={pillFor(c.status)}>{c.status}</span>
                </td>
                <td style={styles.td}>{c.fieldOverrideCount}</td>
                <td style={styles.td}>
                  {c.lastSyncAt === null ? '—' : new Date(c.lastSyncAt).toLocaleString()}
                  {c.lastSyncStatus !== null && (
                    <>
                      {' '}
                      <span style={pillFor(c.lastSyncStatus)}>{c.lastSyncStatus}</span>
                    </>
                  )}
                </td>
                <td style={styles.td}>
                  <button
                    style={{ ...styles.btn, marginRight: 6 }}
                    onClick={() => onTrigger(c.id, true)}
                    disabled={busy}
                    title="Dry-run: extract + stage + diff, but rollback before writing to the workspace. Safe on production data."
                  >
                    Dry-run sync
                  </button>
                  <button
                    style={styles.btnPrimary}
                    onClick={() => {
                      if (window.confirm('Live sync will WRITE to the workspace tables. Continue?')) {
                        void onTrigger(c.id, false);
                      }
                    }}
                    disabled={busy}
                    title="Live sync: same as dry-run but commits the load. Always run a dry-run first."
                  >
                    Live sync
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionTitle}>Recent runs</div>
          <div style={styles.sectionHelp}>
            Last 30 runs across all connectors. Use this to confirm a sync landed and to see how
            much data it moved.
          </div>
        </div>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thRow}>
              <Th tip="UTC timestamp when the run was inserted. Click any row to copy the run ID.">
                Started
              </Th>
              <Th tip="pending = queued. completed = succeeded. failed = check the run record's error column in migration_staging.runs.">
                Status
              </Th>
              <Th tip="Number of rows normalised into migration_staging.normalized_rows. Excludes rows skipped by IF NOT EXISTS dedup.">
                Rows staged
              </Th>
              <Th tip="Number of association edges (semantic types like task_about_person) staged in migration_staging.association_edges, including AI-inferred ones.">
                Edges staged
              </Th>
            </tr>
          </thead>
          <tbody>
            {syncs.length === 0 && (
              <tr style={styles.tdRow}>
                <td style={styles.td} colSpan={4}>
                  No runs yet. Trigger a sync from the table above.
                </td>
              </tr>
            )}
            {syncs.map((s) => (
              <tr key={s.id} style={styles.tdRow} title={`Run ID: ${s.id}`}>
                <td style={styles.td}>{new Date(s.startedAt).toLocaleString()}</td>
                <td style={styles.td}>
                  <span style={pillFor(s.status)}>{s.status}</span>
                </td>
                <td style={styles.td}>{s.rowsStaged}</td>
                <td style={styles.td}>{s.edgesStaged}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
};

const MappingsTab = ({
  connectors,
  selectedConnectorId,
  setSelectedConnectorId,
  busy,
  onFieldMap,
  onAssocMap,
}: {
  connectors: Connector[];
  selectedConnectorId: string | null;
  setSelectedConnectorId: (id: string) => void;
  busy: boolean;
  onFieldMap: (
    connectorId: string,
    body: { twentyObject: string; sourceProperty: string; action: string; twentyField?: string },
  ) => Promise<void>;
  onAssocMap: (connectorId: string, body: { nativePair: string; semanticName?: string }) => Promise<void>;
}) => {
  const [twentyObject, setTwentyObject] = useState('company');
  const [sourceProperty, setSourceProperty] = useState('');
  const [action, setAction] = useState('alias');
  const [twentyField, setTwentyField] = useState('');

  const [nativePair, setNativePair] = useState('');
  const [semanticName, setSemanticName] = useState('');

  if (connectors.length === 0)
    return (
      <div style={styles.helpBanner}>
        No connectors yet. Create one in <strong>1. Connectors & runs</strong> first.
      </div>
    );

  return (
    <>
      <div style={styles.formCard}>
        <div style={{ ...styles.sectionTitle, marginBottom: 4 }}>Connector</div>
        <div style={styles.sectionHelp}>Mappings apply per connector — pick which one to edit.</div>
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

      <div style={styles.formCard}>
        <div style={{ ...styles.sectionTitle, marginBottom: 4 }}>Field mapping override</div>
        <div style={styles.sectionHelp}>
          Decide what happens to a source property at load time. Default rules live in{' '}
          <code style={styles.code}>migration/connectors/&lt;source&gt;/mapping.yaml</code> — what you
          set here overrides them per connector.
        </div>
        <div style={styles.formGrid}>
          <div>
            <label style={styles.label} title="Twenty target object: company, person, opportunity, task, note, …">
              Twenty object ⓘ
            </label>
            <select style={styles.input} value={twentyObject} onChange={(e) => setTwentyObject(e.target.value)}>
              <option>company</option>
              <option>person</option>
              <option>opportunity</option>
              <option>task</option>
              <option>note</option>
            </select>
          </div>
          <div>
            <label style={styles.label} title="The source CRM property name exactly as it appears in the source API (e.g. 'hs_lead_status' on HubSpot).">
              Source property ⓘ
            </label>
            <input
              style={styles.input}
              value={sourceProperty}
              onChange={(e) => setSourceProperty(e.target.value)}
              placeholder="hs_lead_status"
            />
          </div>
          <div>
            <label
              style={styles.label}
              title="alias = map to an existing Twenty field. custom = create a new custom field in Twenty. ignore = drop on load."
            >
              Action ⓘ
            </label>
            <select style={styles.input} value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="alias">alias → existing field</option>
              <option value="custom">custom → new field</option>
              <option value="ignore">ignore → drop</option>
            </select>
          </div>
          <div>
            <label
              style={styles.label}
              title="Required for 'alias' (target field name on Twenty side, e.g. 'leadStatus'). Required for 'custom' (new field name). Leave empty for 'ignore'."
            >
              Twenty field {action === 'ignore' ? '(unused)' : '⓮'}
            </label>
            <input
              style={styles.input}
              value={twentyField}
              onChange={(e) => setTwentyField(e.target.value)}
              placeholder="leadStatus"
              disabled={action === 'ignore'}
            />
          </div>
        </div>
        <button
          style={styles.btnPrimary}
          disabled={busy || selectedConnectorId === null || sourceProperty.trim() === ''}
          onClick={() =>
            selectedConnectorId !== null &&
            onFieldMap(selectedConnectorId, {
              twentyObject,
              sourceProperty: sourceProperty.trim(),
              action,
              twentyField: twentyField.trim() === '' ? undefined : twentyField.trim(),
            })
          }
        >
          Save field mapping
        </button>
      </div>

      <div style={styles.formCard}>
        <div style={{ ...styles.sectionTitle, marginBottom: 4 }}>Association mapping override</div>
        <div style={styles.sectionHelp}>
          Tells the connector what semantic association a native pair represents. Example: HubSpot's{' '}
          <code style={styles.code}>company:contact</code> pair is universally{' '}
          <code style={styles.code}>employs</code> in Twenty's semantic graph.
        </div>
        <div style={styles.formGrid}>
          <div>
            <label
              style={styles.label}
              title="Native association name from the source CRM. Format: <left>:<right> using the source's object names. E.g. HubSpot 'companies:contacts'."
            >
              Native pair ⓘ
            </label>
            <input
              style={styles.input}
              value={nativePair}
              onChange={(e) => setNativePair(e.target.value)}
              placeholder="company:person"
            />
          </div>
          <div>
            <label
              style={styles.label}
              title="Canonical Twenty semantic name. Used by the universal association graph (Phase 13 — see docs/ASSOCIATION-GRAPH.md). Examples: employs, attended_by, owned_by."
            >
              Semantic name ⓘ
            </label>
            <input
              style={styles.input}
              value={semanticName}
              onChange={(e) => setSemanticName(e.target.value)}
              placeholder="employs"
            />
          </div>
        </div>
        <button
          style={styles.btnPrimary}
          disabled={busy || selectedConnectorId === null || nativePair.trim() === ''}
          onClick={() =>
            selectedConnectorId !== null &&
            onAssocMap(selectedConnectorId, {
              nativePair: nativePair.trim(),
              semanticName: semanticName.trim() === '' ? undefined : semanticName.trim(),
            })
          }
        >
          Save association mapping
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
      { natural_key: 'acme.com', domain: 'acme.com', name: 'Acme Inc.' },
      { natural_key: 'globex.com', domain: 'globex.com', name: 'Globex Corp.' },
    ],
    null,
    2,
  );
  const [text, setText] = useState(sampleJSON);

  if (connectors.length === 0)
    return (
      <div style={styles.helpBanner}>
        No connectors yet. Bulk import needs a connector to scope the run to —{' '}
        create one in <strong>1. Connectors & runs</strong> first.
      </div>
    );

  return (
    <>
      <div style={styles.formCard}>
        <div style={{ ...styles.sectionTitle, marginBottom: 4 }}>Bulk import rows</div>
        <div style={styles.sectionHelp}>
          One-shot import for ad-hoc data (CSV uploads, manual lists, paper-form transcription).
          Rows are queued into <code style={styles.code}>migration_staging.normalized_rows</code> under
          a fresh run, ready for the loader to push into Twenty.
          <br />
          Required per row: <code style={styles.code}>natural_key</code> (any stable string — domain,
          email, internal ID). Optional: <code style={styles.code}>external_id</code> (defaults to
          natural_key). Everything else is stored in the raw JSON and used by the connector's normaliser.
        </div>
        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>Connector</label>
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
            <label style={styles.label}>Twenty object</label>
            <select style={styles.input} value={twentyObject} onChange={(e) => setTwentyObject(e.target.value)}>
              <option>company</option>
              <option>person</option>
              <option>opportunity</option>
              <option>task</option>
              <option>note</option>
            </select>
          </div>
        </div>
        <label style={styles.label}>Rows (JSON array)</label>
        <textarea
          ref={sampleRef}
          style={{ ...styles.input, minHeight: 200, fontFamily: 'ui-monospace, Menlo, monospace' }}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            style={styles.btn}
            onClick={() => setText(sampleJSON)}
            title="Reset the textarea to a working example."
          >
            Reset to example
          </button>
          <button
            style={styles.btnPrimary}
            disabled={busy || selectedConnectorId === null}
            onClick={() => {
              let rows: Array<Record<string, unknown>>;
              try {
                rows = JSON.parse(text);
                if (!Array.isArray(rows)) throw new Error('Top-level must be a JSON array.');
              } catch (e) {
                alert(`Invalid JSON: ${(e as Error).message}`);
                return;
              }
              if (selectedConnectorId !== null)
                void onSubmit(selectedConnectorId, { twentyObject, rows });
            }}
          >
            Queue bulk import
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
        <strong>Inferred edges</strong> are links Bedrock (Claude Sonnet 4.6) detected between
        rows the source CRM did not connect explicitly — for example, a task whose title mentions a
        person's name. Each edge carries an evidence string and a confidence score. Promote the ones
        you trust; bulk-reject the rest under a threshold.
        <br />
        <span style={{ color: 'var(--t-font-color-tertiary, #888)' }}>
          Threshold ≥ 0.9 is usually safe to auto-promote in batch. Below 0.7 is noisy — start there
          and walk up.
        </span>
      </div>

      <div style={{ ...styles.formCard, display: 'flex', alignItems: 'center', gap: 14 }}>
        <label style={{ ...styles.label, margin: 0 }}>Minimum confidence:</label>
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
          {edges.length} edge(s) at this threshold
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
              Run <code style={styles.code}>{runId.slice(0, 8)}…</code> · {runEdges.length} edge(s)
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
                )
                  void onRejectBelow(runId, minConfidence);
              }}
              title="Delete every inferred edge in this run whose confidence is ≤ the slider threshold. Edges already promoted are not touched."
            >
              Reject all below {minConfidence.toFixed(2)}
            </button>
          </div>
          {runEdges.map((e, i) => (
            <div
              key={i}
              style={{
                borderTop: i === 0 ? 'none' : '1px solid var(--t-border-color-light, #2a2a2a)',
                paddingTop: i === 0 ? 0 : 10,
                paddingBottom: 10,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                {e.semanticType} · {e.fromObject} → {e.toObject}{' '}
                <span style={pillFor('completed')}>{e.confidence.toFixed(2)}</span>
              </div>
              <div style={{ color: 'var(--t-font-color-secondary, #aaa)', fontSize: 13 }}>
                {e.evidence}
              </div>
              {e.parentTitle !== null && (
                <div style={{ color: 'var(--t-font-color-tertiary, #888)', fontSize: 12, marginTop: 4 }}>
                  &ldquo;{e.parentTitle}&rdquo;
                </div>
              )}
              <button
                style={{ ...styles.btn, marginTop: 8 }}
                onClick={() => onPromote(e)}
                disabled={busy}
                title="Mark this edge as manually approved. The loader will write it into Twenty's association graph alongside CRM-native edges."
              >
                Promote to canonical
              </button>
            </div>
          ))}
        </div>
      ))}

      {edges.length === 0 && (
        <div style={{ color: 'var(--t-font-color-tertiary, #888)', fontSize: 13 }}>
          No pending inferred edges at confidence ≥ {minConfidence.toFixed(2)}.
        </div>
      )}
    </>
  );
};

const DocsTab = () => (
  <div style={styles.card}>
    <div style={{ ...styles.sectionTitle, marginBottom: 12 }}>Docs · quick reference</div>

    <details open style={{ marginBottom: 10 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 500 }}>What lives where?</summary>
      <ul style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--t-font-color-secondary, #aaa)' }}>
        <li>
          <code style={styles.code}>migration/</code> — Python ETL package. <code style={styles.code}>python -m migration …</code> from the meta-dojo
          repo root.
        </li>
        <li>
          <code style={styles.code}>migration_staging</code> schema on the Twenty RDS — all sync
          state lives here: <code style={styles.code}>connectors</code>,{' '}
          <code style={styles.code}>runs</code>, <code style={styles.code}>normalized_rows</code>,{' '}
          <code style={styles.code}>association_edges</code>, override tables.
        </li>
        <li>
          <code style={styles.code}>/_premaccess/*</code> REST routes — what this UI calls. All
          authenticated; you need a Twenty session.
        </li>
      </ul>
    </details>

    <details style={{ marginBottom: 10 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 500 }}>End-to-end happy path</summary>
      <ol style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--t-font-color-secondary, #aaa)' }}>
        <li>Create a connector (Tab 1 → "Connect a new source CRM").</li>
        <li>Optionally override field/association mappings (Tab 2). Skip if defaults are fine.</li>
        <li>Trigger a <strong>dry-run sync</strong> first — never a live one until you've seen the row count.</li>
        <li>Watch the run row appear in "Recent runs". Wait for status → completed.</li>
        <li>Switch to Tab 4 and review inferred edges. Promote the obvious ones, reject the rest below a threshold.</li>
        <li>When happy, trigger a <strong>live sync</strong> on the same connector. Same diff, but commits.</li>
      </ol>
    </details>

    <details style={{ marginBottom: 10 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 500 }}>cURL reference (power users)</summary>
      <pre style={styles.codeBlock}>{`# List connectors
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
  https://dev.dojo.bamrun.com/_premaccess/inferred-edges/promote`}</pre>
    </details>

    <details style={{ marginBottom: 10 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Troubleshooting</summary>
      <ul style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--t-font-color-secondary, #aaa)' }}>
        <li>
          <strong>401 Unauthorized</strong> — your Twenty session expired. Log out and back in.
        </li>
        <li>
          <strong>Sync stuck at pending</strong> — the worker / CodeBuild step that picks up runs is
          not wired yet (Phase 18 roadmap). Pending rows are normal until the orchestrator lands.
        </li>
        <li>
          <strong>Bulk import returns failed &gt; 0</strong> — open the firstError field in the
          response. Most common cause: duplicate <code style={styles.code}>(run_id, twenty_object, external_id)</code>{' '}
          — make sure your rows have unique natural_keys.
        </li>
        <li>
          <strong>Login screen reappears after deploy</strong> — JWT secret is pinned, but access
          tokens expire on a TTL. Re-enter your credentials; the session sticks across deploys after
          that.
        </li>
      </ul>
    </details>
  </div>
);

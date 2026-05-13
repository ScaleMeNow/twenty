import { useEffect, useMemo, useState } from 'react';

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
    throw new Error(`${res.status} ${res.statusText}${body ? ` — ${body}` : ''}`);
  }
  return res.json();
};

const layoutStyles = {
  page: {
    padding: '24px',
    fontFamily: 'Inter, system-ui, sans-serif',
    color: 'var(--font-color-primary, #f3f3f3)',
    background: 'var(--background-noisy, transparent)',
    minHeight: '100%',
  } as const,
  header: { marginBottom: 4, fontSize: 22, fontWeight: 600 } as const,
  subtitle: { color: 'var(--font-color-tertiary, #888)', marginTop: 0, fontSize: 13 } as const,
  section: { marginTop: 28 } as const,
  sectionTitle: { fontSize: 15, fontWeight: 600, marginBottom: 10 } as const,
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    background: 'var(--background-primary, #1a1a1a)',
    border: '1px solid var(--border-color-medium, #2a2a2a)',
    borderRadius: 6,
    overflow: 'hidden',
  } as const,
  thRow: {
    background: 'var(--background-secondary, #222)',
    textAlign: 'left',
    color: 'var(--font-color-secondary, #aaa)',
  } as const,
  th: { padding: '10px 12px', fontWeight: 500, fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  tdRow: { borderTop: '1px solid var(--border-color-light, #2a2a2a)' } as const,
  td: { padding: '10px 12px' } as const,
  button: {
    padding: '6px 12px',
    fontSize: 12,
    borderRadius: 4,
    border: '1px solid var(--border-color-medium, #2a2a2a)',
    background: 'var(--background-tertiary, #2b2b2b)',
    color: 'var(--font-color-primary, #f3f3f3)',
    cursor: 'pointer',
  } as const,
  card: {
    border: '1px solid var(--border-color-medium, #2a2a2a)',
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
    background: 'var(--background-primary, #1a1a1a)',
  } as const,
  errorBanner: {
    background: 'rgba(220, 38, 38, 0.12)',
    border: '1px solid rgba(220, 38, 38, 0.4)',
    color: '#fca5a5',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    fontSize: 13,
  } as const,
  pill: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 9999,
    fontSize: 11,
    fontWeight: 500,
  } as const,
};

const pillFor = (status: string) => {
  const palette: Record<string, { bg: string; fg: string }> = {
    active: { bg: 'rgba(34,197,94,0.15)', fg: '#86efac' },
    pending: { bg: 'rgba(234,179,8,0.15)', fg: '#fde047' },
    failed: { bg: 'rgba(220,38,38,0.15)', fg: '#fca5a5' },
    completed: { bg: 'rgba(59,130,246,0.15)', fg: '#93c5fd' },
  };
  const colors = palette[status] ?? { bg: 'rgba(148,163,184,0.15)', fg: '#cbd5e1' };
  return { ...layoutStyles.pill, background: colors.bg, color: colors.fg };
};

export const PremaccessApp = () => {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [syncs, setSyncs] = useState<Sync[]>([]);
  const [edges, setEdges] = useState<InferredEdge[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      setErr(null);
      const [c, s, e] = await Promise.all([
        fetchJSON<Connector[]>(`/_premaccess/connectors?workspaceId=${WORKSPACE_ID}`),
        fetchJSON<Sync[]>(`/_premaccess/syncs?limit=20`),
        fetchJSON<InferredEdge[]>(
          `/_premaccess/inferred-edges?workspaceId=${WORKSPACE_ID}&minConfidence=0.7`,
        ),
      ]);
      setConnectors(c);
      setSyncs(s);
      setEdges(e);
    } catch (x) {
      setErr((x as Error).message);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const trigger = async (id: string) => {
    setBusy(true);
    try {
      await fetchJSON(`/_premaccess/connectors/${id}/sync`, {
        method: 'POST',
        body: JSON.stringify({ mode: 'DELTA', dryRun: true }),
      });
      await refresh();
    } catch (x) {
      setErr((x as Error).message);
    }
    setBusy(false);
  };

  const promote = async (edge: InferredEdge) => {
    setBusy(true);
    try {
      await fetchJSON(`/_premaccess/inferred-edges/promote`, {
        method: 'POST',
        body: JSON.stringify({
          runId: edge.runId,
          semanticType: edge.semanticType,
          fromTwentyId: edge.fromTwentyId,
          toTwentyId: edge.toTwentyId,
        }),
      });
      await refresh();
    } catch (x) {
      setErr((x as Error).message);
    }
    setBusy(false);
  };

  const totalEdges = useMemo(() => edges.length, [edges]);

  return (
    <div style={layoutStyles.page}>
      <div style={layoutStyles.header}>Premaccess — CRM Sync</div>
      <div style={layoutStyles.subtitle}>
        Workspace {WORKSPACE_ID} · Phase 16 / 17 / 18 surface · {connectors.length} connector(s) ·{' '}
        {syncs.length} recent run(s) · {totalEdges} pending inferred edge(s)
      </div>

      {err !== null && <div style={layoutStyles.errorBanner}>Error: {err}</div>}

      <section style={layoutStyles.section}>
        <div style={layoutStyles.sectionTitle}>Connectors</div>
        <table style={layoutStyles.table}>
          <thead>
            <tr style={layoutStyles.thRow}>
              <th style={layoutStyles.th}>Source</th>
              <th style={layoutStyles.th}>Display name</th>
              <th style={layoutStyles.th}>Status</th>
              <th style={layoutStyles.th}>Field overrides</th>
              <th style={layoutStyles.th}>Last sync</th>
              <th style={layoutStyles.th}></th>
            </tr>
          </thead>
          <tbody>
            {connectors.length === 0 && (
              <tr style={layoutStyles.tdRow}>
                <td style={layoutStyles.td} colSpan={6}>
                  No connectors. Use POST /_premaccess/connectors to create one.
                </td>
              </tr>
            )}
            {connectors.map((c) => (
              <tr key={c.id} style={layoutStyles.tdRow}>
                <td style={layoutStyles.td}>{c.source}</td>
                <td style={layoutStyles.td}>{c.displayName}</td>
                <td style={layoutStyles.td}>
                  <span style={pillFor(c.status)}>{c.status}</span>
                </td>
                <td style={layoutStyles.td}>{c.fieldOverrideCount}</td>
                <td style={layoutStyles.td}>{c.lastSyncAt ?? '—'}</td>
                <td style={layoutStyles.td}>
                  <button style={layoutStyles.button} onClick={() => trigger(c.id)} disabled={busy}>
                    Sync DELTA (dry-run)
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={layoutStyles.section}>
        <div style={layoutStyles.sectionTitle}>Recent syncs</div>
        <table style={layoutStyles.table}>
          <thead>
            <tr style={layoutStyles.thRow}>
              <th style={layoutStyles.th}>Started</th>
              <th style={layoutStyles.th}>Status</th>
              <th style={layoutStyles.th}>Rows</th>
              <th style={layoutStyles.th}>Edges</th>
            </tr>
          </thead>
          <tbody>
            {syncs.length === 0 && (
              <tr style={layoutStyles.tdRow}>
                <td style={layoutStyles.td} colSpan={4}>
                  No runs yet.
                </td>
              </tr>
            )}
            {syncs.map((s) => (
              <tr key={s.id} style={layoutStyles.tdRow}>
                <td style={layoutStyles.td}>{s.startedAt}</td>
                <td style={layoutStyles.td}>
                  <span style={pillFor(s.status)}>{s.status}</span>
                </td>
                <td style={layoutStyles.td}>{s.rowsStaged}</td>
                <td style={layoutStyles.td}>{s.edgesStaged}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={layoutStyles.section}>
        <div style={layoutStyles.sectionTitle}>Pending Bedrock-inferred edges</div>
        {edges.length === 0 && (
          <div style={{ color: 'var(--font-color-tertiary, #888)', fontSize: 13 }}>
            No pending inferred edges above 0.7.
          </div>
        )}
        {edges.map((e, i) => (
          <div key={i} style={layoutStyles.card}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {e.semanticType} · {e.fromObject} → {e.toObject} ·{' '}
              <span style={pillFor('completed')}>{e.confidence.toFixed(2)}</span>
            </div>
            <div style={{ color: 'var(--font-color-secondary, #aaa)', fontSize: 13, marginTop: 6 }}>
              {e.evidence}
            </div>
            {e.parentTitle !== null && (
              <div style={{ color: 'var(--font-color-tertiary, #888)', fontSize: 12, marginTop: 4 }}>
                &ldquo;{e.parentTitle}&rdquo;
              </div>
            )}
            <button
              style={{ ...layoutStyles.button, marginTop: 10 }}
              onClick={() => promote(e)}
              disabled={busy}
            >
              Promote to canonical
            </button>
          </div>
        ))}
      </section>
    </div>
  );
};

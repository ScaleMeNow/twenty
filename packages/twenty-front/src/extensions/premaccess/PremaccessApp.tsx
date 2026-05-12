import { useEffect, useState } from 'react';

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

const fetchJSON = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
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
        fetchJSON<InferredEdge[]>(`/_premaccess/inferred-edges?workspaceId=${WORKSPACE_ID}&minConfidence=0.7`),
      ]);
      setConnectors(c);
      setSyncs(s);
      setEdges(e);
    } catch (x) {
      setErr((x as Error).message);
    }
  };

  useEffect(() => {
    refresh();
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

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#1a1a1a' }}>
      <h1 style={{ marginBottom: 4 }}>Premaccess — CRM Sync</h1>
      <p style={{ color: '#666', marginTop: 0 }}>
        Workspace {WORKSPACE_ID} · Phase 16/17/18 surface
      </p>
      {err && (
        <div style={{ background: '#fde2e2', padding: 12, borderRadius: 6, marginBottom: 16 }}>
          Error: {err}
        </div>
      )}
      <section style={{ marginTop: 24 }}>
        <h2>Connectors ({connectors.length})</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
              <th style={{ padding: 8 }}>Source</th>
              <th style={{ padding: 8 }}>Name</th>
              <th style={{ padding: 8 }}>Status</th>
              <th style={{ padding: 8 }}>Field overrides</th>
              <th style={{ padding: 8 }}>Last sync</th>
              <th style={{ padding: 8 }}></th>
            </tr>
          </thead>
          <tbody>
            {connectors.map((c) => (
              <tr key={c.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{c.source}</td>
                <td style={{ padding: 8 }}>{c.displayName}</td>
                <td style={{ padding: 8 }}>{c.status}</td>
                <td style={{ padding: 8 }}>{c.fieldOverrideCount}</td>
                <td style={{ padding: 8 }}>{c.lastSyncAt ?? '—'}</td>
                <td style={{ padding: 8 }}>
                  <button onClick={() => trigger(c.id)} disabled={busy}>
                    Sync DELTA (dry-run)
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section style={{ marginTop: 32 }}>
        <h2>Recent syncs ({syncs.length})</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
              <th style={{ padding: 8 }}>Started</th>
              <th style={{ padding: 8 }}>Status</th>
              <th style={{ padding: 8 }}>Rows</th>
              <th style={{ padding: 8 }}>Edges</th>
            </tr>
          </thead>
          <tbody>
            {syncs.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{s.startedAt}</td>
                <td style={{ padding: 8 }}>{s.status}</td>
                <td style={{ padding: 8 }}>{s.rowsStaged}</td>
                <td style={{ padding: 8 }}>{s.edgesStaged}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section style={{ marginTop: 32 }}>
        <h2>Pending Bedrock-inferred edges ({edges.length})</h2>
        {edges.length === 0 && <p style={{ color: '#666' }}>No pending inferred edges above 0.7.</p>}
        {edges.map((e, i) => (
          <div
            key={i}
            style={{
              border: '1px solid #eee',
              borderRadius: 6,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {e.semanticType} · {e.fromObject} → {e.toObject} · conf {e.confidence.toFixed(2)}
            </div>
            <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>{e.evidence}</div>
            {e.parentTitle && (
              <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>"{e.parentTitle}"</div>
            )}
            <button onClick={() => promote(e)} disabled={busy} style={{ marginTop: 8 }}>
              Promote to canonical
            </button>
          </div>
        ))}
      </section>
    </div>
  );
};

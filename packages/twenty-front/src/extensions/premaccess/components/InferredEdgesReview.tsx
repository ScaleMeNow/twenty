import { useMutation, useQuery } from '@apollo/client';

import {
  INFERRED_EDGES_PENDING_QUERY,
  PROMOTE_INFERRED_EDGE_MUTATION,
  REJECT_INFERRED_EDGES_BELOW_MUTATION,
} from '../graphql/premaccess.queries';

type Props = {
  workspaceId: string;
  minConfidence?: number;
};

/**
 * Phase 17 — InferredEdgesReview.
 *
 * The Twenty-native equivalent of the Flask admin app's `/inferred` page. Lists
 * AI-inferred association edges across all runs for the workspace, with
 * per-edge ✓ promote and a bulk-reject-below-threshold action.
 *
 * Designed to plug into Twenty's right-rail panel slot system so it can render
 * inline on any record-detail page later (showing inferred edges for that
 * specific record). For now this is a standalone page.
 */
export const InferredEdgesReview = ({ workspaceId, minConfidence = 0.7 }: Props) => {
  const { data, loading, error, refetch } = useQuery(INFERRED_EDGES_PENDING_QUERY, {
    variables: { workspaceId, minConfidence },
  });
  const [promote, { loading: promoting }] = useMutation(PROMOTE_INFERRED_EDGE_MUTATION);
  const [rejectBelow, { loading: rejecting }] = useMutation(REJECT_INFERRED_EDGES_BELOW_MUTATION);

  if (loading) return <div>Loading inferred edges…</div>;
  if (error) return <div>Error: {error.message}</div>;

  const edges = data?.inferredEdgesPending ?? [];

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2>AI-inferred associations</h2>
        <div>
          {edges.length > 0 && (
            <button
              onClick={async () => {
                const ceil = window.prompt('Reject inferred edges below confidence:', '0.85');
                if (!ceil) return;
                const runId = edges[0].runId;
                await rejectBelow({ variables: { runId, confidence: parseFloat(ceil) } });
                void refetch();
              }}
              disabled={rejecting}
            >
              Bulk reject below…
            </button>
          )}
        </div>
      </header>

      {edges.length === 0 ? (
        <p>No inferred edges pending review at confidence ≥ {minConfidence}.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Conf</th>
              <th>Semantic</th>
              <th>From (parent)</th>
              <th>→ To</th>
              <th>Evidence</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {edges.map((e: any) => (
              <tr key={`${e.runId}_${e.semanticType}_${e.fromTwentyId}_${e.toTwentyId}`}>
                <td>{(e.confidence as number).toFixed(2)}</td>
                <td><code>{e.semanticType}</code></td>
                <td>{e.parentTitle ?? e.fromTwentyId.slice(0, 8)}</td>
                <td>{e.toObject} · {e.toTwentyId.slice(0, 8)}</td>
                <td>{e.evidence ?? '—'}</td>
                <td>
                  <button
                    disabled={promoting}
                    onClick={async () => {
                      await promote({
                        variables: {
                          input: {
                            runId: e.runId,
                            semanticType: e.semanticType,
                            fromTwentyId: e.fromTwentyId,
                            toTwentyId: e.toTwentyId,
                          },
                        },
                      });
                      void refetch();
                    }}
                  >
                    ✓ promote
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

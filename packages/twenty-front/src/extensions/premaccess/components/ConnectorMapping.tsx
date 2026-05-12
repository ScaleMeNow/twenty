import { useMutation } from '@apollo/client';
import { useState } from 'react';

import { SET_FIELD_MAPPING_MUTATION } from '../graphql/premaccess.queries';

type Props = {
  connectorId: string;
  /** Source schema rows from the `schema-report` API (Phase 13 already produces this). */
  sourceProperties: Array<{
    twentyObject: string;
    sourceProperty: string;
    sourceType: string;
    currentAction?: 'alias' | 'custom' | 'ignore';
    currentTwentyField?: string | null;
    aiSuggestion?: { action: 'alias' | 'custom'; twentyField: string; confidence: number };
  }>;
  /** Twenty's manifest field list, keyed by object. */
  twentyFieldsByObject: Record<string, Array<{ name: string; type: string }>>;
};

/**
 * Phase 17 — ConnectorMapping (field mapper).
 *
 * For each source property, the CRM manager picks: alias to which Twenty
 * field, mark as a custom TEXT field, or ignore. AI suggestions appear
 * pre-filled with a ✓ accept button.
 *
 * This component is the **long pole** of Phase 17 — the wizard, the autocomplete
 * search, the drag-to-alias UX. The scaffold below shows the contract; the UX
 * polish ships incrementally.
 */
export const ConnectorMapping = ({ connectorId, sourceProperties, twentyFieldsByObject }: Props) => {
  const [setMapping] = useMutation(SET_FIELD_MAPPING_MUTATION);
  const [localState, setLocalState] = useState<Record<string, { action: string; twentyField: string }>>({});

  const update = (
    twentyObject: string, sourceProperty: string, action: string, twentyField: string,
  ) => {
    const key = `${twentyObject}/${sourceProperty}`;
    setLocalState((s) => ({ ...s, [key]: { action, twentyField } }));
    void setMapping({
      variables: {
        input: { connectorId, twentyObject, sourceProperty, action,
                 twentyField: action === 'ignore' ? null : twentyField },
      },
    });
  };

  return (
    <div>
      <h3>Field mappings</h3>
      <table>
        <thead>
          <tr>
            <th>Twenty object</th>
            <th>Source property</th>
            <th>Type</th>
            <th>Action</th>
            <th>Twenty field</th>
            <th>AI suggestion</th>
          </tr>
        </thead>
        <tbody>
          {sourceProperties.map((p) => {
            const key = `${p.twentyObject}/${p.sourceProperty}`;
            const current = localState[key] ?? {
              action: p.currentAction ?? 'ignore',
              twentyField: p.currentTwentyField ?? '',
            };
            const fields = twentyFieldsByObject[p.twentyObject] ?? [];
            return (
              <tr key={key}>
                <td><code>{p.twentyObject}</code></td>
                <td><code>{p.sourceProperty}</code></td>
                <td>{p.sourceType}</td>
                <td>
                  <select
                    value={current.action}
                    onChange={(e) => update(p.twentyObject, p.sourceProperty, e.target.value, current.twentyField)}
                  >
                    <option value="alias">alias</option>
                    <option value="custom">custom TEXT</option>
                    <option value="ignore">ignore</option>
                  </select>
                </td>
                <td>
                  {current.action === 'ignore' ? <span>—</span> : (
                    <select
                      value={current.twentyField}
                      onChange={(e) => update(p.twentyObject, p.sourceProperty, current.action, e.target.value)}
                    >
                      <option value="">(pick a field)</option>
                      {fields.map((f) => (
                        <option key={f.name} value={f.name}>{f.name} ({f.type})</option>
                      ))}
                    </select>
                  )}
                </td>
                <td>
                  {p.aiSuggestion ? (
                    <button
                      type="button"
                      onClick={() => update(
                        p.twentyObject, p.sourceProperty,
                        p.aiSuggestion!.action, p.aiSuggestion!.twentyField,
                      )}
                      title={`Confidence ${(p.aiSuggestion.confidence * 100).toFixed(0)}%`}
                    >
                      ✓ {p.aiSuggestion.action} → {p.aiSuggestion.twentyField}
                    </button>
                  ) : <span>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

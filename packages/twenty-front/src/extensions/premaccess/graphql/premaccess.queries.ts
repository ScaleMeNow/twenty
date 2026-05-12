import { gql } from '@apollo/client';

/**
 * Phase 17 — typed GraphQL operations against the Phase 18 backend.
 *
 * These mirror the SyncResolver in `packages/premaccess/src/resolvers/sync.resolver.ts`.
 * When upstream's codegen runs (`graphql:generate`), it'll emit the matching
 * TypeScript types under `__generated__/`.
 */

export const CONNECTORS_QUERY = gql`
  query Connectors($workspaceId: ID!) {
    connectors(workspaceId: $workspaceId) {
      id
      source
      displayName
      status
      lastSyncAt
      lastSyncStatus
      fieldOverrideCount
    }
  }
`;

export const RECENT_SYNCS_QUERY = gql`
  query RecentSyncs($connectorId: ID, $limit: Int) {
    recentSyncs(connectorId: $connectorId, limit: $limit) {
      id
      connectorId
      startedAt
      completedAt
      status
      rowsStaged
      edgesStaged
    }
  }
`;

export const INFERRED_EDGES_PENDING_QUERY = gql`
  query InferredEdgesPending($workspaceId: ID!, $minConfidence: Float) {
    inferredEdgesPending(workspaceId: $workspaceId, minConfidence: $minConfidence) {
      runId
      semanticType
      fromObject
      fromTwentyId
      toObject
      toTwentyId
      confidence
      evidence
      parentTitle
    }
  }
`;

export const TRIGGER_SYNC_MUTATION = gql`
  mutation TriggerSync($connectorId: ID!, $mode: SyncMode, $dryRun: Boolean) {
    triggerSync(connectorId: $connectorId, mode: $mode, dryRun: $dryRun) {
      id
      status
      startedAt
    }
  }
`;

export const SET_FIELD_MAPPING_MUTATION = gql`
  mutation SetFieldMapping($input: SetFieldMappingInput!) {
    setFieldMapping(input: $input)
  }
`;

export const PROMOTE_INFERRED_EDGE_MUTATION = gql`
  mutation PromoteInferredEdge($input: EdgeKeyInput!) {
    promoteInferredEdge(input: $input)
  }
`;

export const REJECT_INFERRED_EDGES_BELOW_MUTATION = gql`
  mutation RejectInferredEdgesBelow($runId: ID!, $confidence: Float!) {
    rejectInferredEdgesBelow(runId: $runId, confidence: $confidence)
  }
`;

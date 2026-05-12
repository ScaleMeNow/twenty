import { Injectable, Logger } from '@nestjs/common';

import {
  ConnectorDto,
  ConnectConnectorInput,
  EdgeKeyInput,
  InferredEdgeDto,
  SetAssociationMappingInput,
  SetFieldMappingInput,
  SyncDto,
  SyncModeEnum,
} from '../dto/connector.dto';

/**
 * Phase 18 — service layer.
 *
 * This service is the seam between Twenty's GraphQL surface (resolver) and
 * the migration_staging tables that the Python pipeline owns. It deliberately
 * stays thin — actual SQL goes through ``WorkspaceDataSource`` (already
 * available in the upstream NestJS context). The methods below are stubs
 * pending DataSource wiring; the resolver against them already compiles.
 *
 * When `triggerSync` is called, the service either:
 *  - enqueues a BullMQ job (preferred — Twenty already runs BullMQ), or
 *  - sends a `StartBuild` to AWS CodeBuild if `MIGRATION_TRIGGER=codebuild`
 *
 * which then runs the existing CLI (`python -m migration migrate ...`). The
 * service polls `migration_staging.runs` for status.
 */

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  // ── Queries ─────────────────────────────────────────────────────────────

  async listConnectors(workspaceId: string): Promise<ConnectorDto[]> {
    this.logger.debug(`listConnectors workspace=${workspaceId}`);
    // TODO(phase-18): SELECT FROM migration_staging.connectors WHERE workspace_id = $1
    // joined with LEFT JOIN LATERAL on the most recent run for that connector.
    return [];
  }

  async getConnector(id: string): Promise<ConnectorDto | null> {
    this.logger.debug(`getConnector id=${id}`);
    return null;
  }

  async recentSyncs(connectorId: string | null, limit = 50): Promise<SyncDto[]> {
    this.logger.debug(`recentSyncs connector=${connectorId ?? '*'} limit=${limit}`);
    return [];
  }

  async pendingInferredEdges(workspaceId: string, minConfidence = 0.7): Promise<InferredEdgeDto[]> {
    this.logger.debug(`pendingInferredEdges workspace=${workspaceId} minConf=${minConfidence}`);
    return [];
  }

  // ── Mutations ───────────────────────────────────────────────────────────

  async connect(input: ConnectConnectorInput): Promise<ConnectorDto> {
    this.logger.log(`connect source=${input.source} ws=${input.workspaceId}`);
    // TODO(phase-18): INSERT INTO migration_staging.connectors (id, source, ...)
    throw new Error('Not implemented yet — Phase 18 stub');
  }

  async setFieldMapping(input: SetFieldMappingInput): Promise<boolean> {
    this.logger.log(`setFieldMapping connector=${input.connectorId} ${input.twentyObject}.${input.sourceProperty} → ${input.action}`);
    // TODO(phase-18): UPSERT into migration_staging.connector_field_overrides
    throw new Error('Not implemented yet — Phase 18 stub');
  }

  async setAssociationMapping(input: SetAssociationMappingInput): Promise<boolean> {
    this.logger.log(`setAssociationMapping connector=${input.connectorId} pair=${input.nativePair} → ${input.semanticName ?? '(disabled)'}`);
    throw new Error('Not implemented yet — Phase 18 stub');
  }

  async triggerSync(connectorId: string, mode: SyncModeEnum, dryRun: boolean): Promise<SyncDto> {
    this.logger.log(`triggerSync connector=${connectorId} mode=${mode} dryRun=${dryRun}`);
    // TODO(phase-18): enqueue a BullMQ job that runs `python -m migration migrate`
    // OR call CodeBuild StartBuild when MIGRATION_TRIGGER=codebuild.
    throw new Error('Not implemented yet — Phase 18 stub');
  }

  async scheduleSync(connectorId: string, cron: string | null): Promise<boolean> {
    this.logger.log(`scheduleSync connector=${connectorId} cron=${cron ?? '(unscheduled)'}`);
    throw new Error('Not implemented yet — Phase 18 stub');
  }

  async promoteInferredEdge(key: EdgeKeyInput): Promise<boolean> {
    this.logger.log(`promoteInferredEdge run=${key.runId} sem=${key.semanticType}`);
    throw new Error('Not implemented yet — Phase 18 stub');
  }

  async rejectInferredEdgesBelow(runId: string, confidence: number): Promise<number> {
    this.logger.log(`rejectInferredEdgesBelow run=${runId} ceil=${confidence}`);
    throw new Error('Not implemented yet — Phase 18 stub');
  }
}

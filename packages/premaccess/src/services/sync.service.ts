import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';

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
 * Phase 18 — SyncService.
 *
 * Talks directly to migration_staging via its own pg Pool, built from
 * PG_DATABASE_URL (set by Twenty's entrypoint). Deliberately decoupled from
 * Twenty's TypeORM DataSources so upstream changes to those don't affect us.
 *
 * triggerSync writes a stub row into migration_staging.runs. Actual sync
 * orchestration (CodeBuild StartBuild / BullMQ enqueue) is a follow-up;
 * the row is enough for the UI to display "kicked off, status=pending".
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private pool: Pool | null = null;

  private getPool(): Pool {
    if (this.pool === null) {
      const url = process.env.PG_DATABASE_URL;
      if (!url) {
        throw new Error('PG_DATABASE_URL is not set — SyncService cannot reach migration_staging');
      }
      this.pool = new Pool({ connectionString: url, max: 4 });
    }
    return this.pool;
  }

  async listConnectors(workspaceId: string): Promise<ConnectorDto[]> {
    const sql = `
      SELECT c.id::text AS id,
             c.source,
             c.display_name AS "displayName",
             c.status,
             (SELECT MAX(r.started_at) FROM migration_staging.runs r
              WHERE (r.meta->>'connector_id') = c.id::text) AS "lastSyncAt",
             (SELECT r.status FROM migration_staging.runs r
              WHERE (r.meta->>'connector_id') = c.id::text
              ORDER BY r.started_at DESC LIMIT 1) AS "lastSyncStatus",
             COALESCE((SELECT COUNT(*) FROM migration_staging.connector_field_overrides f
                       WHERE f.connector_id = c.id), 0)::int AS "fieldOverrideCount"
      FROM migration_staging.connectors c
      WHERE c.workspace_id = $1::uuid
      ORDER BY c.updated_at DESC
    `;
    try {
      const { rows } = await this.getPool().query(sql, [workspaceId]);
      return rows;
    } catch (e) {
      this.logger.error(`listConnectors failed: ${(e as Error).message}`);
      return [];
    }
  }

  async getConnector(id: string): Promise<ConnectorDto | null> {
    const { rows } = await this.getPool().query(
      `SELECT c.id::text AS id, c.source, c.display_name AS "displayName",
              c.status, NULL::timestamptz AS "lastSyncAt", NULL::text AS "lastSyncStatus",
              0 AS "fieldOverrideCount"
       FROM migration_staging.connectors c WHERE c.id = $1::uuid`,
      [id],
    );
    return rows[0] ?? null;
  }

  async recentSyncs(connectorId: string | null, limit = 50): Promise<SyncDto[]> {
    const args: any[] = [limit];
    let where = '';
    if (connectorId) { args.push(connectorId); where = `AND (r.meta->>'connector_id') = $2::text`; }
    const sql = `
      SELECT r.id::text AS id,
             (r.meta->>'connector_id') AS "connectorId",
             r.started_at AS "startedAt",
             r.completed_at AS "completedAt",
             r.status,
             COALESCE((SELECT COUNT(*) FROM migration_staging.normalized_rows nr
                       WHERE nr.run_id = r.id), 0)::int AS "rowsStaged",
             COALESCE((SELECT COUNT(*) FROM migration_staging.association_edges ae
                       WHERE ae.run_id = r.id), 0)::int AS "edgesStaged"
      FROM migration_staging.runs r WHERE 1=1 ${where}
      ORDER BY r.started_at DESC LIMIT $1
    `;
    try {
      const { rows } = await this.getPool().query(sql, args);
      return rows;
    } catch (e) {
      this.logger.error(`recentSyncs failed: ${(e as Error).message}`);
      return [];
    }
  }

  async pendingInferredEdges(workspaceId: string, minConfidence = 0.7): Promise<InferredEdgeDto[]> {
    const sql = `
      SELECT ae.run_id::text AS "runId",
             ae.semantic_type AS "semanticType",
             ae.from_object AS "fromObject",
             ae.from_twenty_id::text AS "fromTwentyId",
             ae.to_object AS "toObject",
             ae.to_twenty_id::text AS "toTwentyId",
             ae.confidence::float AS confidence,
             ae.payload->>'evidence' AS evidence,
             (SELECT (nr.row_json->>'title') FROM migration_staging.normalized_rows nr
              WHERE nr.run_id = ae.run_id AND nr.twenty_object = ae.from_object
                AND nr.twenty_id = ae.from_twenty_id LIMIT 1) AS "parentTitle"
      FROM migration_staging.association_edges ae
      WHERE ae.inferred = true AND ae.confidence >= $1::real
      ORDER BY ae.confidence DESC, ae.semantic_type LIMIT 200
    `;
    try {
      const { rows } = await this.getPool().query(sql, [minConfidence]);
      return rows;
    } catch (e) {
      this.logger.error(`pendingInferredEdges failed: ${(e as Error).message}`);
      return [];
    }
  }

  async connect(input: ConnectConnectorInput): Promise<ConnectorDto> {
    const { rows } = await this.getPool().query(
      `INSERT INTO migration_staging.connectors
         (id, source, display_name, workspace_id, credentials_secret_arn, status)
       VALUES (gen_random_uuid(), $1, $2, $3::uuid, $4, 'active')
       RETURNING id::text AS id, source, display_name AS "displayName", status,
                 NULL::timestamptz AS "lastSyncAt", NULL::text AS "lastSyncStatus",
                 0 AS "fieldOverrideCount"`,
      [input.source, input.displayName, input.workspaceId, input.credentialsSecretArn ?? null],
    );
    return rows[0];
  }

  async setFieldMapping(input: SetFieldMappingInput): Promise<boolean> {
    await this.getPool().query(
      `INSERT INTO migration_staging.connector_field_overrides
         (connector_id, twenty_object, source_property, action, twenty_field, updated_at)
       VALUES ($1::uuid, $2, $3, $4, $5, NOW())
       ON CONFLICT (connector_id, twenty_object, source_property) DO UPDATE
         SET action = EXCLUDED.action,
             twenty_field = EXCLUDED.twenty_field,
             updated_at = NOW()`,
      [input.connectorId, input.twentyObject, input.sourceProperty, input.action, input.twentyField ?? null],
    );
    return true;
  }

  async setAssociationMapping(input: SetAssociationMappingInput): Promise<boolean> {
    await this.getPool().query(
      `INSERT INTO migration_staging.connector_assoc_overrides
         (connector_id, native_pair, semantic_name, updated_at)
       VALUES ($1::uuid, $2, $3, NOW())
       ON CONFLICT (connector_id, native_pair) DO UPDATE
         SET semantic_name = EXCLUDED.semantic_name, updated_at = NOW()`,
      [input.connectorId, input.nativePair, input.semanticName ?? null],
    );
    return true;
  }

  async triggerSync(connectorId: string, mode: SyncModeEnum, dryRun: boolean): Promise<SyncDto> {
    const { rows } = await this.getPool().query(
      `INSERT INTO migration_staging.runs
         (id, workspace_id, mode, status, started_at, meta)
       VALUES (
         gen_random_uuid(),
         (SELECT workspace_id FROM migration_staging.connectors WHERE id = $1::uuid),
         $2, 'pending', NOW(),
         jsonb_build_object('connector_id', $1::text, 'dry_run', $3::boolean,
                            'triggered_via', 'graphql', 'triggered_at', NOW())
       )
       RETURNING id::text AS id, started_at AS "startedAt", NULL::timestamptz AS "completedAt", status`,
      [connectorId, mode.toString().toLowerCase(), dryRun],
    );
    return { ...rows[0], connectorId, rowsStaged: 0, edgesStaged: 0 };
  }

  async scheduleSync(connectorId: string, cron: string | null): Promise<boolean> {
    this.logger.log(`scheduleSync connector=${connectorId} cron=${cron ?? '(unscheduled)'}`);
    return true;
  }

  async promoteInferredEdge(key: EdgeKeyInput): Promise<boolean> {
    const { rowCount } = await this.getPool().query(
      `UPDATE migration_staging.association_edges
         SET inferred = false, source = 'manual-approved', confidence = 1.0,
             payload = COALESCE(payload, '{}'::jsonb) ||
                       jsonb_build_object('promoted_from', source, 'promoted_at', NOW())
       WHERE run_id = $1::uuid AND semantic_type = $2
         AND from_twenty_id = $3::uuid AND to_twenty_id = $4::uuid AND inferred = true`,
      [key.runId, key.semanticType, key.fromTwentyId, key.toTwentyId],
    );
    return (rowCount ?? 0) > 0;
  }

  async rejectInferredEdgesBelow(runId: string, confidence: number): Promise<number> {
    const { rowCount } = await this.getPool().query(
      `DELETE FROM migration_staging.association_edges
       WHERE run_id = $1::uuid AND inferred = true AND confidence <= $2::real`,
      [runId, confidence],
    );
    return rowCount ?? 0;
  }
}

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
import { QueueService } from './queue.service';

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

  constructor(private readonly queueService: QueueService) {}

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
      `SELECT c.id::text AS id, c.source, c.display_name AS "displayName", c.status,
              (SELECT MAX(r.started_at) FROM migration_staging.runs r
               WHERE (r.meta->>'connector_id') = c.id::text) AS "lastSyncAt",
              (SELECT r.status FROM migration_staging.runs r
               WHERE (r.meta->>'connector_id') = c.id::text
               ORDER BY r.started_at DESC LIMIT 1) AS "lastSyncStatus",
              COALESCE((SELECT COUNT(*) FROM migration_staging.connector_field_overrides f
                        WHERE f.connector_id = c.id), 0)::int AS "fieldOverrideCount"
       FROM migration_staging.connectors c WHERE c.id = $1::uuid`,
      [id],
    );
    return rows[0] ?? null;
  }

  async bulkImport(input: { connectorId: string; twentyObject: string; rows: Array<Record<string, unknown>> }): Promise<{ runId: string | null; queued: number; failed?: number; firstError?: string; phase?: string }> {
    const pool = this.getPool();
    let runId: string;
    try {
      const r = await pool.query(
        `INSERT INTO migration_staging.runs
           (id, workspace_id, mode, status, started_at, meta)
         VALUES (
           gen_random_uuid(),
           (SELECT workspace_id FROM migration_staging.connectors WHERE id = $1::uuid),
           'bulk-import', 'pending', NOW(),
           jsonb_build_object(
             'connector_id', $1::text,
             'twenty_object', $2::text,
             'source_count', $3::int,
             'phase', '15c-bulk-import',
             'triggered_via', 'rest'
           )
         )
         RETURNING id::text AS id`,
        [input.connectorId, input.twentyObject, input.rows.length],
      );
      runId = r.rows[0].id as string;
    } catch (e) {
      const msg = (e as Error).message;
      this.logger.error(`bulkImport run-insert failed: ${msg}`);
      return { runId: null, queued: 0, failed: input.rows.length, firstError: msg, phase: 'run-insert' };
    }
    let index = 0;
    let failed = 0;
    let firstError: string | undefined;
    for (const row of input.rows) {
      const naturalKey = (row.natural_key as string) ?? null;
      const externalId = (row.external_id as string) ?? naturalKey ?? `bulk-${runId}-${index}`;
      try {
        await pool.query(
          `INSERT INTO migration_staging.normalized_rows
             (run_id, twenty_object, external_id, twenty_id, natural_key, source, row_json)
           VALUES ($1::uuid, $2, $3, gen_random_uuid(), $4, 'bulk-import', $5::jsonb)
           ON CONFLICT (run_id, twenty_object, external_id) DO UPDATE
             SET row_json = EXCLUDED.row_json, built_at = NOW()`,
          [runId, input.twentyObject, externalId, naturalKey, JSON.stringify(row)],
        );
      } catch (e) {
        failed += 1;
        const msg = (e as Error).message;
        if (firstError === undefined) firstError = `idx=${index}: ${msg}`;
        this.logger.error(`bulkImport row-insert failed idx=${index}: ${msg}`);
      }
      index += 1;
    }
    return { runId, queued: input.rows.length - failed, failed, firstError };
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
             r.mode AS mode,
             (r.meta->>'dry_run')::boolean AS "dryRun",
             (r.meta->>'triggered_by_email') AS "triggeredByEmail",
             (r.meta->>'triggered_by_name')  AS "triggeredByName",
             (r.meta->>'build_id')           AS "buildId",
             (r.meta->>'error_message')      AS "errorMessage",
             NULLIF(r.meta->>'last_marker_at','')::timestamptz AS "lastMarkerAt",
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

  async updateConnector(
    id: string,
    patch: { displayName?: string; status?: string; credentialsSecretArn?: string | null },
  ): Promise<ConnectorDto | null> {
    const sets: string[] = [];
    const args: any[] = [id];
    if (patch.displayName !== undefined) {
      args.push(patch.displayName);
      sets.push(`display_name = $${args.length}::text`);
    }
    if (patch.status !== undefined) {
      args.push(patch.status);
      sets.push(`status = $${args.length}::text`);
    }
    if (patch.credentialsSecretArn !== undefined) {
      args.push(patch.credentialsSecretArn);
      sets.push(`credentials_secret_arn = $${args.length}::text`);
    }
    if (sets.length === 0) return this.getConnector(id);
    sets.push('updated_at = NOW()');
    await this.getPool().query(
      `UPDATE migration_staging.connectors SET ${sets.join(', ')} WHERE id = $1::uuid`,
      args,
    );
    return this.getConnector(id);
  }

  async deleteConnector(id: string): Promise<{ deleted: boolean }> {
    const { rowCount } = await this.getPool().query(
      `DELETE FROM migration_staging.connectors WHERE id = $1::uuid`,
      [id],
    );
    return { deleted: (rowCount ?? 0) > 0 };
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

  async listFieldOverrides(connectorId: string): Promise<Array<{ twentyObject: string; sourceProperty: string; action: string; twentyField: string | null; updatedAt: string }>> {
    const { rows } = await this.getPool().query(
      `SELECT twenty_object AS "twentyObject",
              source_property AS "sourceProperty",
              action,
              twenty_field AS "twentyField",
              updated_at AS "updatedAt"
       FROM migration_staging.connector_field_overrides
       WHERE connector_id = $1::uuid
       ORDER BY twenty_object, source_property`,
      [connectorId],
    );
    return rows;
  }

  async listAssocOverrides(connectorId: string): Promise<Array<{ nativePair: string; semanticName: string | null; updatedAt: string }>> {
    const { rows } = await this.getPool().query(
      `SELECT native_pair AS "nativePair",
              semantic_name AS "semanticName",
              updated_at AS "updatedAt"
       FROM migration_staging.connector_assoc_overrides
       WHERE connector_id = $1::uuid
       ORDER BY native_pair`,
      [connectorId],
    );
    return rows;
  }

  async deleteFieldOverride(connectorId: string, twentyObject: string, sourceProperty: string): Promise<{ deleted: boolean }> {
    const { rowCount } = await this.getPool().query(
      `DELETE FROM migration_staging.connector_field_overrides
       WHERE connector_id = $1::uuid AND twenty_object = $2::text AND source_property = $3::text`,
      [connectorId, twentyObject, sourceProperty],
    );
    return { deleted: (rowCount ?? 0) > 0 };
  }

  async deleteAssocOverride(connectorId: string, nativePair: string): Promise<{ deleted: boolean }> {
    const { rowCount } = await this.getPool().query(
      `DELETE FROM migration_staging.connector_assoc_overrides
       WHERE connector_id = $1::uuid AND native_pair = $2::text`,
      [connectorId, nativePair],
    );
    return { deleted: (rowCount ?? 0) > 0 };
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

  async triggerSync(connectorId: string, mode: SyncModeEnum, dryRun: boolean, triggeredBy?: { userId?: string | null }): Promise<SyncDto> {
    const pool = this.getPool();
    const userId = triggeredBy?.userId ?? null;
    const insertRes = await pool.query(
      `WITH u AS (
         SELECT id::text AS id, email,
                NULLIF(TRIM(CONCAT_WS(' ', "firstName", "lastName")), '') AS name
         FROM core."user" WHERE id = $4::uuid
       )
       INSERT INTO migration_staging.runs
         (id, workspace_id, mode, status, started_at, meta)
       VALUES (
         gen_random_uuid(),
         (SELECT workspace_id FROM migration_staging.connectors WHERE id = $1::uuid),
         $2, 'pending', NOW(),
         jsonb_strip_nulls(jsonb_build_object(
           'connector_id', $1::text,
           'dry_run', $3::boolean,
           'triggered_via', 'rest',
           'triggered_at', NOW(),
           'triggered_by_user_id', $4::text,
           'triggered_by_email', (SELECT email FROM u),
           'triggered_by_name',  (SELECT name  FROM u)
         ))
       )
       RETURNING id::text AS id, started_at AS "startedAt",
                 (SELECT workspace_id::text FROM migration_staging.connectors WHERE id = $1::uuid) AS "workspaceId",
                 status`,
      [connectorId, mode.toString().toLowerCase(), dryRun, userId],
    );
    const row = insertRes.rows[0] as { id: string; startedAt: string; workspaceId: string; status: string };

    try {
      const publish = await this.queueService.publishRun({
        runId: row.id,
        connectorId,
        workspaceId: row.workspaceId,
        mode: mode.toString().toLowerCase(),
        dryRun,
      });
      if (publish.skipped) {
        this.logger.log(`run ${row.id} inserted; queue disabled, stays pending`);
      } else {
        this.logger.log(`run ${row.id} queued (sqs message ${publish.messageId})`);
      }
    } catch (e) {
      const msg = (e as Error).message;
      this.logger.error(`run ${row.id} SQS publish failed: ${msg}`);
      await pool.query(
        `UPDATE migration_staging.runs
           SET status = 'failed',
               completed_at = NOW(),
               meta = COALESCE(meta, '{}'::jsonb) ||
                      jsonb_build_object('error_message', $2::text, 'phase19_publish_failed', true)
         WHERE id = $1::uuid`,
        [row.id, msg],
      );
      return { id: row.id, startedAt: new Date(row.startedAt), completedAt: new Date(), status: 'failed', connectorId, rowsStaged: 0, edgesStaged: 0 };
    }
    return { id: row.id, startedAt: new Date(row.startedAt), completedAt: null, status: row.status, connectorId, rowsStaged: 0, edgesStaged: 0 };
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

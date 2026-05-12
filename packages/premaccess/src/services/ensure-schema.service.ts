import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

/**
 * Idempotent guard: ensures schema columns Twenty entities expect actually
 * exist on the dev RDS, even when `command upgrade` (entrypoint.sh) silently
 * skips them.
 *
 * Background: Twenty's upgrade sequence runner checks `core.upgradeMigration`
 * before applying any fast-instance command. If a row marking the command as
 * 'completed' exists from a prior boot — even if the underlying ALTER never
 * actually ran — the runner skips it. We hit this on gbl-dev where login
 * blew up with `column ... isInternalMessagesImportEnabled does not exist`
 * despite `command upgrade` exiting 0.
 *
 * This service runs at boot, after Nest has wired the pg pool, and applies
 * the same ALTER statements as Twenty's own migration files but unconditionally
 * (ADD COLUMN IF NOT EXISTS). Postgres rejects duplicates silently, so the
 * guard is safe to leave in place permanently.
 *
 * Each entry below mirrors the body of the corresponding migration file
 * under `packages/twenty-server/src/database/commands/upgrade-version-command/`.
 * Add new entries here when an upstream rebase brings a new entity column the
 * dev DB starts complaining about.
 */
@Injectable()
export class EnsureSchemaService implements OnModuleInit {
  private readonly logger = new Logger(EnsureSchemaService.name);

  private readonly statements: ReadonlyArray<{ name: string; sql: string }> = [
    {
      name: '2-5-add-is-internal-messages-import-enabled',
      sql: 'ALTER TABLE "core"."workspace" ADD COLUMN IF NOT EXISTS "isInternalMessagesImportEnabled" boolean NOT NULL DEFAULT false',
    },
  ];

  async onModuleInit(): Promise<void> {
    const url = process.env.PG_DATABASE_URL;
    if (!url) {
      this.logger.warn('PG_DATABASE_URL not set, skipping schema guard');
      return;
    }
    const pool = new Pool({ connectionString: url, max: 1 });
    try {
      for (const { name, sql } of this.statements) {
        try {
          await pool.query(sql);
          this.logger.log(`schema-guard applied: ${name}`);
        } catch (e) {
          this.logger.error(`schema-guard failed ${name}: ${(e as Error).message}`);
        }
      }
    } finally {
      await pool.end();
    }
  }
}

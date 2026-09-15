import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

/**
 * Idempotent guard: ensures schema objects Twenty entities expect actually
 * exist on the dev RDS, even when `command upgrade` (entrypoint.sh) silently
 * skips the command that should have created them.
 *
 * Background: the upgrade sequence resumes *by name*. It reads the last
 * attempted command from `core.upgradeMigration`, locates that name in the
 * freshly built sequence and restarts there. An upstream rebase that adds a
 * command sorting *behind* that resume point therefore never runs it, and the
 * gap is permanent and silent.
 *
 * That is how gbl-dev lost `core."signingKey"`: `CreateSigningKeyTable`
 * (2.5.0, ts 1778550000000) landed upstream on 2026-05-12, a day after the
 * instance had recorded `EncryptConnectedAccountTokens` (2.5.0 slow, ts
 * 1798000004000) as completed. Every boot from 2026-08-26 on aborted at
 * `EncryptSigningKeyPrivateKeys` with `relation "core.signingKey" does not
 * exist`, pinning the instance below 2.23 — so `applicationId` stayed hidden
 * on `KeyValuePairEntity`, `/client-config` answered 500 and the front showed
 * "Unable to Reach Back-end". The earlier `isInternalMessagesImportEnabled`
 * failure came from the same mechanism.
 *
 * This service runs at boot, after Nest has wired the pg pool, and applies the
 * same statements as Twenty's own command files but unconditionally (IF NOT
 * EXISTS). Postgres accepts the duplicates as no-ops, so the guard is safe to
 * leave in place permanently.
 *
 * Each entry below mirrors the body of the corresponding command file under
 * `packages/twenty-server/src/database/commands/upgrade-version-command/`.
 * Add new entries when an upstream rebase brings a command the dev DB starts
 * complaining about — `scripts/upgrade-sequence-gaps.py` in the meta-workspace
 * lists exactly which commands the resume point has skipped.
 *
 * Additive statements only. A skipped command that DROPs (currently
 * `DropPostgresCredentialsTable`, 2.5.0 ts 1798500000000) is deliberately not
 * mirrored here — dropping a table is not something a boot guard does
 * unattended.
 */
@Injectable()
export class EnsureSchemaService implements OnModuleInit {
  private readonly logger = new Logger(EnsureSchemaService.name);

  private readonly statements: ReadonlyArray<{ name: string; sql: string }> = [
    {
      name: '2-5-add-is-internal-messages-import-enabled',
      sql: 'ALTER TABLE "core"."workspace" ADD COLUMN IF NOT EXISTS "isInternalMessagesImportEnabled" boolean NOT NULL DEFAULT false',
    },
    {
      name: '2-5-add-sub-field-name-to-view-sort',
      sql: 'ALTER TABLE "core"."viewSort" ADD COLUMN IF NOT EXISTS "subFieldName" character varying',
    },
    {
      name: '2-5-add-relation-target-field-metadata-id-to-view-filter',
      sql: 'ALTER TABLE "core"."viewFilter" ADD COLUMN IF NOT EXISTS "relationTargetFieldMetadataId" uuid',
    },
    {
      name: '2-5-create-signing-key-table',
      sql: `CREATE TABLE IF NOT EXISTS "core"."signingKey" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "publicKey" character varying NOT NULL,
        "privateKey" character varying,
        "isCurrent" boolean NOT NULL DEFAULT false,
        "revokedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_signingKey_id" PRIMARY KEY ("id")
      )`,
    },
    {
      name: '2-5-create-signing-key-is-current-unique-index',
      sql: 'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_SIGNING_KEY_IS_CURRENT_UNIQUE" ON "core"."signingKey" ("isCurrent") WHERE "isCurrent" = true',
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
          this.logger.error(
            `schema-guard failed ${name}: ${(e as Error).message}`,
          );
        }
      }
    } finally {
      await pool.end();
    }
  }
}

/**
 * Premaccess extension module for Twenty.
 *
 * Imported via a single line in upstream's app.module.ts — see
 * docs/TWENTY-FORK-PLAN.md §4 in meta-dojo. This module is the entry point
 * for the fork phases:
 *
 *   - Phase 15 Target C (BulkImportResolver)        — fires Twenty events at a controlled rate
 *   - Phase 15 Target A (GenericTargetResolver)     — polymorphic join for any object pair
 *   - Phase 15 Target B (TargetProvenanceResolver)  — source/confidence/evidence per edge
 *   - Phase 18          (Sync REST + GraphQL)       — CRM-Manager autonomy API
 *
 * REST surface (PremaccessController) is the primary entry point — Twenty's
 * GraphQL build is code-first with explicit per-endpoint resolver lists, so
 * the SyncResolver stays registered but won't appear in /graphql until we
 * patch CoreGraphQLApiModule (deferred). The controller is reachable
 * immediately at /_premaccess/* via Twenty's normal Nest routing.
 */

import { Module } from '@nestjs/common';

import { PremaccessController } from './controllers/premaccess.controller';
import { SyncResolver } from './resolvers/sync.resolver';
import { EnsureSchemaService } from './services/ensure-schema.service';
import { SyncService } from './services/sync.service';

@Module({
  imports: [],
  controllers: [PremaccessController],
  providers: [SyncResolver, SyncService, EnsureSchemaService],
  exports: [SyncService],
})
export class PremaccessModule {}

/**
 * Premaccess extension module for Twenty.
 *
 * Imported via a single line in upstream's app.module.ts — see
 * docs/TWENTY-FORK-PLAN.md §4 in meta-dojo. This module is the entry point
 * for the four fork phases:
 *
 *   - Phase 15 Target C (BulkImportResolver)        — fires Twenty events at a controlled rate
 *   - Phase 15 Target A (GenericTargetResolver)     — polymorphic join for any object pair
 *   - Phase 15 Target B (TargetProvenanceResolver)  — source/confidence/evidence per edge
 *   - Phase 18          (SyncResolver, this file)   — CRM-Manager autonomy GraphQL API
 *
 * Each target ships independently. Phase 18's resolver is currently wired
 * with stub service methods (see services/sync.service.ts) so the GraphQL
 * schema compiles and the upstream test suite stays green while we wire
 * the actual DataSource lookups in a follow-up commit.
 */

import { Module } from '@nestjs/common';

import { SyncResolver } from './resolvers/sync.resolver';
import { SyncService } from './services/sync.service';

@Module({
  imports: [],
  providers: [SyncResolver, SyncService],
  exports: [SyncService],
})
export class PremaccessModule {}

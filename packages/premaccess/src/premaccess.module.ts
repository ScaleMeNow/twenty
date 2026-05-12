/**
 * Premaccess extension module for Twenty.
 *
 * Imported via a single line in upstream's app.module.ts — see
 * docs/TWENTY-FORK-PLAN.md §4. This module is the entry point for the three
 * fork targets:
 *
 *   - BulkImportResolver        (Target C — fires Twenty events at a controlled rate)
 *   - GenericTargetResolver     (Target A — polymorphic join for any object pair)
 *   - TargetProvenanceResolver  (Target B — source/confidence/evidence per edge)
 *
 * Each target ships independently. This file is intentionally minimal so the
 * "land the empty module in a green build" milestone is trivial.
 */

import { Module } from '@nestjs/common';

@Module({
  imports: [],
  providers: [],
  exports: [],
})
export class PremaccessModule {}

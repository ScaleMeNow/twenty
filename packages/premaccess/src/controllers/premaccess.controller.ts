import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { SyncService } from '../services/sync.service';
import { SyncModeEnum } from '../dto/connector.dto';

/**
 * Phase 18 REST surface — mirrors SyncResolver but accessible via standard
 * NestJS controller routes (Twenty's GraphQL uses code-first explicit resolver
 * registration we don't have access to without touching upstream files).
 *
 * Mounted at /_premaccess/* by Twenty's global Nest routing. Auth inherits
 * Twenty's existing middleware stack.
 */
@Controller('_premaccess')
export class PremaccessController {
  constructor(private readonly sync: SyncService) {}

  @Get('health')
  async health() {
    return { ok: true, module: 'premaccess', ts: new Date().toISOString() };
  }

  @Get('connectors')
  async connectors(@Query('workspaceId') workspaceId: string) {
    return this.sync.listConnectors(workspaceId);
  }

  @Get('connectors/:id')
  async connector(@Param('id') id: string) {
    return this.sync.getConnector(id);
  }

  @Get('syncs')
  async recentSyncs(@Query('connectorId') connectorId?: string, @Query('limit') limit?: string) {
    return this.sync.recentSyncs(connectorId ?? null, limit ? parseInt(limit, 10) : 50);
  }

  @Get('inferred-edges')
  async inferred(@Query('workspaceId') workspaceId: string, @Query('minConfidence') c?: string) {
    return this.sync.pendingInferredEdges(workspaceId, c ? parseFloat(c) : 0.7);
  }

  @Post('connectors')
  async connect(@Body() body: { source: string; displayName: string; workspaceId: string; credentialsSecretArn?: string }) {
    return this.sync.connect(body);
  }

  @Post('connectors/:id/field-mapping')
  async setField(@Param('id') id: string, @Body() body: { twentyObject: string; sourceProperty: string; action: string; twentyField?: string }) {
    return this.sync.setFieldMapping({ connectorId: id, ...body });
  }

  @Post('connectors/:id/association-mapping')
  async setAssoc(@Param('id') id: string, @Body() body: { nativePair: string; semanticName?: string }) {
    return this.sync.setAssociationMapping({ connectorId: id, ...body });
  }

  @Post('connectors/:id/sync')
  async trigger(@Param('id') id: string, @Body() body: { mode?: 'FULL' | 'DELTA'; dryRun?: boolean }) {
    return this.sync.triggerSync(id, (body.mode as SyncModeEnum) ?? SyncModeEnum.DELTA, body.dryRun ?? false);
  }

  @Post('inferred-edges/promote')
  async promote(@Body() body: { runId: string; semanticType: string; fromTwentyId: string; toTwentyId: string }) {
    return { ok: await this.sync.promoteInferredEdge(body) };
  }

  @Post('inferred-edges/reject-below')
  async rejectBelow(@Body() body: { runId: string; confidence: number }) {
    return { deleted: await this.sync.rejectInferredEdgesBelow(body.runId, body.confidence) };
  }
}

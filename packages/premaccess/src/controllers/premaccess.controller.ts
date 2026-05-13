import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from 'jsonwebtoken';

import { SyncService } from '../services/sync.service';
import { SyncModeEnum } from '../dto/connector.dto';
import { PremaccessAuthGuard } from '../guards/premaccess-auth.guard';

type AuthedRequest = Request & { premaccessAuth?: JwtPayload & { userId?: string } };

/**
 * Phase 18 REST surface — mirrors SyncResolver but accessible via standard
 * NestJS controller routes (Twenty's GraphQL uses code-first explicit resolver
 * registration we don't have access to without touching upstream files).
 *
 * Mounted at /_premaccess/* by Twenty's global Nest routing. Every route
 * except /_premaccess/health requires a valid Twenty access token —
 * PremaccessAuthGuard verifies HS256(APP_SECRET) against the Authorization
 * header or the tokenPair cookie. Anonymous probes get 401.
 */
@Controller('_premaccess')
@UseGuards(PremaccessAuthGuard)
export class PremaccessController {
  constructor(private readonly sync: SyncService) {}

  // /health stays anon — lets ALB target group + uptime probes reach it
  // without a Twenty session. No sensitive payload returned.
  @Get('health')
  @UseGuards()
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

  @Patch('connectors/:id')
  async update(
    @Param('id') id: string,
    @Body() body: { displayName?: string; status?: string; credentialsSecretArn?: string | null },
  ) {
    return this.sync.updateConnector(id, body);
  }

  @Delete('connectors/:id')
  async remove(@Param('id') id: string) {
    return this.sync.deleteConnector(id);
  }

  @Get('connectors/:id/field-mappings')
  async listField(@Param('id') id: string) {
    return this.sync.listFieldOverrides(id);
  }

  @Get('connectors/:id/association-mappings')
  async listAssoc(@Param('id') id: string) {
    return this.sync.listAssocOverrides(id);
  }

  @Post('connectors/:id/field-mapping')
  async setField(@Param('id') id: string, @Body() body: { twentyObject: string; sourceProperty: string; action: string; twentyField?: string }) {
    return this.sync.setFieldMapping({ connectorId: id, ...body });
  }

  @Post('connectors/:id/association-mapping')
  async setAssoc(@Param('id') id: string, @Body() body: { nativePair: string; semanticName?: string }) {
    return this.sync.setAssociationMapping({ connectorId: id, ...body });
  }

  @Delete('connectors/:id/field-mapping')
  async dropField(
    @Param('id') id: string,
    @Query('twentyObject') twentyObject: string,
    @Query('sourceProperty') sourceProperty: string,
  ) {
    return this.sync.deleteFieldOverride(id, twentyObject, sourceProperty);
  }

  @Delete('connectors/:id/association-mapping')
  async dropAssoc(@Param('id') id: string, @Query('nativePair') nativePair: string) {
    return this.sync.deleteAssocOverride(id, nativePair);
  }

  @Post('connectors/:id/sync')
  async trigger(
    @Param('id') id: string,
    @Body() body: { mode?: 'FULL' | 'DELTA'; dryRun?: boolean },
    @Req() req: AuthedRequest,
  ) {
    const userId = req.premaccessAuth?.userId ?? null;
    return this.sync.triggerSync(
      id,
      (body.mode as SyncModeEnum) ?? SyncModeEnum.DELTA,
      body.dryRun ?? false,
      { userId },
    );
  }

  @Post('inferred-edges/promote')
  async promote(@Body() body: { runId: string; semanticType: string; fromTwentyId: string; toTwentyId: string }) {
    return { ok: await this.sync.promoteInferredEdge(body) };
  }

  @Post('inferred-edges/reject-below')
  async rejectBelow(@Body() body: { runId: string; confidence: number }) {
    return { deleted: await this.sync.rejectInferredEdgesBelow(body.runId, body.confidence) };
  }

  @Post('connectors/:id/bulk-import')
  async bulkImport(
    @Param('id') id: string,
    @Body() body: { twentyObject: string; rows: Array<Record<string, unknown>> },
  ) {
    return this.sync.bulkImport({ connectorId: id, twentyObject: body.twentyObject, rows: body.rows });
  }
}

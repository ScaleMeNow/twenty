import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  ConnectConnectorInput,
  ConnectorDto,
  ConnectorsArgs,
  EdgeKeyInput,
  InferredEdgeDto,
  RecentSyncsArgs,
  SetAssociationMappingInput,
  SetFieldMappingInput,
  SyncDto,
  SyncModeEnum,
} from '../dto/connector.dto';
import { SyncService } from '../services/sync.service';

/**
 * Phase 18 — connector + sync GraphQL surface.
 *
 * This resolver is the API that the Phase 17 frontend extension calls. Every
 * mutation is workspace-scoped via Twenty's existing auth guard; query results
 * are filtered by the caller's workspace. Implementation lives in SyncService.
 */
@Resolver()
export class SyncResolver {
  constructor(private readonly syncService: SyncService) {}

  @Query(() => [ConnectorDto])
  async connectors(@Args() args: ConnectorsArgs): Promise<ConnectorDto[]> {
    return this.syncService.listConnectors(args.workspaceId);
  }

  @Query(() => ConnectorDto, { nullable: true })
  async connector(@Args('id') id: string): Promise<ConnectorDto | null> {
    return this.syncService.getConnector(id);
  }

  @Query(() => [SyncDto])
  async recentSyncs(@Args() args: RecentSyncsArgs): Promise<SyncDto[]> {
    return this.syncService.recentSyncs(args.connectorId ?? null, args.limit ?? 50);
  }

  @Query(() => [InferredEdgeDto])
  async inferredEdgesPending(
    @Args('workspaceId') workspaceId: string,
    @Args('minConfidence', { nullable: true }) minConfidence?: number,
  ): Promise<InferredEdgeDto[]> {
    return this.syncService.pendingInferredEdges(workspaceId, minConfidence ?? 0.7);
  }

  @Mutation(() => ConnectorDto)
  async connectConnector(@Args('input') input: ConnectConnectorInput): Promise<ConnectorDto> {
    return this.syncService.connect(input);
  }

  @Mutation(() => Boolean)
  async setFieldMapping(@Args('input') input: SetFieldMappingInput): Promise<boolean> {
    return this.syncService.setFieldMapping(input);
  }

  @Mutation(() => Boolean)
  async setAssociationMapping(@Args('input') input: SetAssociationMappingInput): Promise<boolean> {
    return this.syncService.setAssociationMapping(input);
  }

  @Mutation(() => SyncDto)
  async triggerSync(
    @Args('connectorId') connectorId: string,
    @Args('mode', { type: () => SyncModeEnum, nullable: true }) mode?: SyncModeEnum,
    @Args('dryRun', { nullable: true }) dryRun?: boolean,
  ): Promise<SyncDto> {
    return this.syncService.triggerSync(connectorId, mode ?? SyncModeEnum.DELTA, dryRun ?? false);
  }

  @Mutation(() => Boolean)
  async scheduleSync(
    @Args('connectorId') connectorId: string,
    @Args('cron', { nullable: true }) cron?: string,
  ): Promise<boolean> {
    return this.syncService.scheduleSync(connectorId, cron ?? null);
  }

  @Mutation(() => Boolean)
  async promoteInferredEdge(@Args('input') input: EdgeKeyInput): Promise<boolean> {
    return this.syncService.promoteInferredEdge(input);
  }

  @Mutation(() => Number)
  async rejectInferredEdgesBelow(
    @Args('runId') runId: string,
    @Args('confidence') confidence: number,
  ): Promise<number> {
    return this.syncService.rejectInferredEdgesBelow(runId, confidence);
  }
}

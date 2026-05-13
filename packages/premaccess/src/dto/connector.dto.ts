import { ArgsType, Field, ID, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';

/**
 * Phase 18 DTOs — surface for the CRM-Manager autonomy UI.
 *
 * Each type maps onto a row or aggregate of the `migration_staging` tables
 * Phase 16 introduces. The shape stays connector-agnostic on purpose: a
 * future Salesforce/Pipedrive connector is a new `source` string, nothing
 * else changes here.
 */

export enum SyncModeEnum {
  FULL = 'FULL',
  DELTA = 'DELTA',
}
registerEnumType(SyncModeEnum, { name: 'SyncMode' });

@ObjectType('Connector')
export class ConnectorDto {
  @Field(() => ID) id!: string;
  @Field() source!: string;
  @Field() displayName!: string;
  @Field() status!: string;
  @Field({ nullable: true }) lastSyncAt?: Date | null;
  @Field({ nullable: true }) lastSyncStatus?: string | null;
  @Field(() => Number) fieldOverrideCount!: number;
}

@ObjectType('Sync')
export class SyncDto {
  @Field(() => ID) id!: string;
  @Field(() => ID) connectorId!: string;
  @Field() startedAt!: Date;
  @Field({ nullable: true }) completedAt?: Date | null;
  @Field() status!: string;
  @Field(() => Number) rowsStaged!: number;
  @Field(() => Number) edgesStaged!: number;
  @Field({ nullable: true }) triggeredByEmail?: string | null;
  @Field({ nullable: true }) triggeredByName?: string | null;
  @Field({ nullable: true }) mode?: string | null;
  @Field({ nullable: true }) dryRun?: boolean | null;
  @Field({ nullable: true }) buildId?: string | null;
  @Field({ nullable: true }) errorMessage?: string | null;
  @Field({ nullable: true }) lastMarkerAt?: Date | null;
}

@ObjectType('InferredEdge')
export class InferredEdgeDto {
  @Field(() => ID) runId!: string;
  @Field() semanticType!: string;
  @Field() fromObject!: string;
  @Field(() => ID) fromTwentyId!: string;
  @Field() toObject!: string;
  @Field(() => ID) toTwentyId!: string;
  @Field(() => Number) confidence!: number;
  @Field({ nullable: true }) evidence?: string | null;
  @Field({ nullable: true }) parentTitle?: string | null;
}

@InputType()
export class ConnectConnectorInput {
  @Field() source!: string;
  @Field() displayName!: string;
  @Field(() => ID) workspaceId!: string;
  @Field({ nullable: true }) credentialsSecretArn?: string;
}

@InputType()
export class SetFieldMappingInput {
  @Field(() => ID) connectorId!: string;
  @Field() twentyObject!: string;
  @Field() sourceProperty!: string;
  @Field() action!: string;            // 'alias' | 'custom' | 'ignore'
  @Field({ nullable: true }) twentyField?: string;
}

@InputType()
export class SetAssociationMappingInput {
  @Field(() => ID) connectorId!: string;
  @Field() nativePair!: string;        // e.g. "contacts→companies"
  @Field({ nullable: true }) semanticName?: string;   // null = disable the pair
}

@InputType()
export class EdgeKeyInput {
  @Field(() => ID) runId!: string;
  @Field() semanticType!: string;
  @Field(() => ID) fromTwentyId!: string;
  @Field(() => ID) toTwentyId!: string;
}

@ArgsType()
export class ConnectorsArgs {
  @Field(() => ID) workspaceId!: string;
}

@ArgsType()
export class RecentSyncsArgs {
  @Field(() => ID, { nullable: true }) connectorId?: string;
  @Field(() => Number, { nullable: true }) limit?: number;
}

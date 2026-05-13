import { Injectable, Logger } from '@nestjs/common';
import { CodeBuildClient, StartBuildCommand } from '@aws-sdk/client-codebuild';

/**
 * Phase 19 (BAM-native) — kicks off the `codebuildindependant` migration
 * runner BAM provisions in dojo-config. Twenty's ECS task role has
 * codebuild:StartBuild on the project via the
 * infrastructure.application.resource.codebuildindependant binding.
 *
 * Project name comes from PREMACCESS_MIGRATION_PROJECT (set by BAM as an
 * environment variable on the dojo-server container). If unset the service
 * no-ops and logs a warning — sync rows stay in 'pending' and the UI
 * surfaces that.
 */
@Injectable()
export class RunnerClientService {
  private readonly logger = new Logger(RunnerClientService.name);
  private client: CodeBuildClient | null = null;

  private get projectName(): string | null {
    return process.env.PREMACCESS_MIGRATION_PROJECT ?? null;
  }

  private getClient(): CodeBuildClient {
    if (this.client === null) {
      this.client = new CodeBuildClient({ region: process.env.AWS_REGION ?? 'eu-west-1' });
    }
    return this.client;
  }

  async dispatchRun(input: {
    runId: string;
    connectorId: string;
    workspaceId: string;
    mode: string;
    dryRun: boolean;
  }): Promise<{ buildId: string | null; skipped: boolean }> {
    const project = this.projectName;
    if (project === null) {
      this.logger.warn(
        `PREMACCESS_MIGRATION_PROJECT not set — sync row ${input.runId} stays pending`,
      );
      return { buildId: null, skipped: true };
    }
    const out = await this.getClient().send(
      new StartBuildCommand({
        projectName: project,
        environmentVariablesOverride: [
          { name: 'RUN_ID', value: input.runId, type: 'PLAINTEXT' },
          { name: 'CONNECTOR_ID', value: input.connectorId, type: 'PLAINTEXT' },
          { name: 'WORKSPACE_ID', value: input.workspaceId, type: 'PLAINTEXT' },
          { name: 'MODE', value: input.mode, type: 'PLAINTEXT' },
          { name: 'DRY_RUN', value: String(input.dryRun), type: 'PLAINTEXT' },
        ],
      }),
    );
    return { buildId: out.build?.id ?? null, skipped: false };
  }
}

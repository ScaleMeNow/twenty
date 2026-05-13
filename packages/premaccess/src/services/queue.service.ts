import { Injectable, Logger } from '@nestjs/common';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';

/**
 * Phase 19 — SQS publisher.
 *
 * triggerSync inserts a row into migration_staging.runs and immediately
 * publishes a FIFO message here. An EventBridge Pipe drains the queue into
 * the Step Functions state machine which marks the row in_progress, starts
 * the CodeBuild migration build, then marks the row completed / failed.
 *
 * MessageGroupId = connectorId enforces per-connector serialisation so two
 * runs against the same source can't clobber each other's S3 hash store.
 *
 * The queue URL comes from PREMACCESS_RUNS_QUEUE_URL; if it is not set the
 * service no-ops and logs a warning. That keeps local dev (no AWS) working
 * and lets Phase 18 functionality continue if the Phase 19 stack is not
 * deployed yet.
 */
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private client: SQSClient | null = null;
  private get queueUrl(): string | null {
    return process.env.PREMACCESS_RUNS_QUEUE_URL ?? null;
  }

  private getClient(): SQSClient {
    if (this.client === null) {
      this.client = new SQSClient({ region: process.env.AWS_REGION ?? 'eu-west-1' });
    }
    return this.client;
  }

  isEnabled(): boolean {
    return this.queueUrl !== null;
  }

  async publishRun(input: {
    runId: string;
    connectorId: string;
    workspaceId: string;
    mode: string;
    dryRun: boolean;
  }): Promise<{ messageId: string | null; skipped: boolean }> {
    const url = this.queueUrl;
    if (url === null) {
      this.logger.warn(
        `PREMACCESS_RUNS_QUEUE_URL not set — sync row ${input.runId} stays pending (Phase 19 disabled)`,
      );
      return { messageId: null, skipped: true };
    }
    const body = JSON.stringify({
      runId: input.runId,
      connectorId: input.connectorId,
      workspaceId: input.workspaceId,
      mode: input.mode,
      dryRun: input.dryRun,
    });
    const out = await this.getClient().send(
      new SendMessageCommand({
        QueueUrl: url,
        MessageBody: body,
        MessageGroupId: input.connectorId,
        MessageDeduplicationId: input.runId,
      }),
    );
    return { messageId: out.MessageId ?? null, skipped: false };
  }
}

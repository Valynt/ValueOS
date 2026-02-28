import { logger } from '../../lib/logger.js';

import { ApprovalAction, NotificationActionSigner } from './NotificationActionSigner.js';

type NotificationChannel = 'slack' | 'teams';

export interface ApprovalNotificationRequest {
  checkpointId: string;
  approvalRequestId: string;
  tenantId: string;
  agentName: string;
  action: string;
  description: string;
  actorId?: string;
}

export interface ApprovalNotificationAdapterDeps {
  signer: NotificationActionSigner;
  callbackBaseUrl: string;
  slackWebhookUrl?: string;
  teamsWebhookUrl?: string;
  onAuditEvent?: (event: string, details: Record<string, unknown>) => Promise<void>;
}

export class NotificationAdapterService {
  constructor(private readonly deps: ApprovalNotificationAdapterDeps) {}

  async notifyApprovalRequested(input: ApprovalNotificationRequest): Promise<void> {
    const channels: NotificationChannel[] = [];
    if (this.deps.slackWebhookUrl) channels.push('slack');
    if (this.deps.teamsWebhookUrl) channels.push('teams');

    if (channels.length === 0) {
      logger.info('Approval notification skipped: no channels configured', {
        checkpointId: input.checkpointId,
      });
      return;
    }

    const approveToken = this.createActionToken(input, 'approve');
    const rejectToken = this.createActionToken(input, 'reject');

    await Promise.all(
      channels.map((channel) =>
        this.postToChannel(channel, {
          input,
          approveUrl: `${this.deps.callbackBaseUrl}/api/approvals/webhooks/${channel}/decision?token=${encodeURIComponent(approveToken)}`,
          rejectUrl: `${this.deps.callbackBaseUrl}/api/approvals/webhooks/${channel}/decision?token=${encodeURIComponent(rejectToken)}`,
        }),
      ),
    );

    if (this.deps.onAuditEvent) {
      await this.deps.onAuditEvent('approval_request_sent', {
        checkpointId: input.checkpointId,
        approvalRequestId: input.approvalRequestId,
        tenantId: input.tenantId,
        channels,
      });
    }
  }

  private createActionToken(input: ApprovalNotificationRequest, action: ApprovalAction): string {
    return this.deps.signer.signAction({
      checkpointId: input.checkpointId,
      approvalRequestId: input.approvalRequestId,
      tenantId: input.tenantId,
      action,
      actorId: input.actorId,
    });
  }

  private async postToChannel(
    channel: NotificationChannel,
    payload: { input: ApprovalNotificationRequest; approveUrl: string; rejectUrl: string },
  ): Promise<void> {
    const webhookUrl = channel === 'slack' ? this.deps.slackWebhookUrl : this.deps.teamsWebhookUrl;
    if (!webhookUrl) return;

    const body = {
      text: `Approval required: ${payload.input.agentName} / ${payload.input.action}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Approval required*\n${payload.input.description}`,
          },
        },
        {
          type: 'actions',
          elements: [
            { type: 'button', text: { type: 'plain_text', text: 'Approve' }, url: payload.approveUrl },
            { type: 'button', text: { type: 'plain_text', text: 'Reject' }, url: payload.rejectUrl },
          ],
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to send ${channel} approval notification: ${response.status}`);
    }
  }
}

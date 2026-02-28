import { createHmac, timingSafeEqual } from 'node:crypto';

import { nonceStore } from '../../middleware/nonceStore.js';
import { CheckpointMiddleware } from '../middleware/CheckpointMiddleware.js';

import { NotificationActionSigner } from './NotificationActionSigner.js';

export interface ApprovalWebhookContext {
  tenantId: string;
  actorId: string;
  reason?: string;
  signature: string;
  timestamp: string;
  nonce: string;
  actionToken: string;
}

export interface ApprovalWebhookResult {
  checkpointId: string;
  approvalRequestId: string;
  decision: 'approved' | 'rejected';
  workflowResumed: boolean;
}

export interface ApprovalWebhookDeps {
  signer: NotificationActionSigner;
  checkpointMiddleware: CheckpointMiddleware;
  webhookSigningSecret: string;
  transitionApprovalRequest: (args: {
    requestId: string;
    tenantId: string;
    approved: boolean;
    actorId: string;
    reason?: string;
  }) => Promise<void>;
  audit: (event: string, details: Record<string, unknown>) => Promise<void>;
}

export class ApprovalWebhookService {
  constructor(private readonly deps: ApprovalWebhookDeps) {}

  async applyDecision(context: ApprovalWebhookContext): Promise<ApprovalWebhookResult> {
    await this.validateInboundSignature(context);

    const payload = await this.deps.signer.verifyAndConsume(context.actionToken);
    if (payload.tenantId !== context.tenantId) {
      throw new Error('Tenant mismatch for approval action');
    }

    const approved = payload.action === 'approve';
    const decision = approved ? 'approved' : 'rejected';

    await this.deps.audit('approval_clicked', {
      checkpointId: payload.checkpointId,
      approvalRequestId: payload.approvalRequestId,
      tenantId: context.tenantId,
      actorId: context.actorId,
      decision,
    });

    await this.deps.transitionApprovalRequest({
      requestId: payload.approvalRequestId,
      tenantId: context.tenantId,
      approved,
      actorId: context.actorId,
      reason: context.reason,
    });

    await this.deps.audit('approval_decision_applied', {
      checkpointId: payload.checkpointId,
      approvalRequestId: payload.approvalRequestId,
      tenantId: context.tenantId,
      actorId: context.actorId,
      decision,
    });

    const workflowResumed = this.deps.checkpointMiddleware.resolveCheckpoint(payload.checkpointId, decision, {
      resolvedBy: context.actorId,
      reason: context.reason,
    });

    await this.deps.audit('workflow_resumed', {
      checkpointId: payload.checkpointId,
      approvalRequestId: payload.approvalRequestId,
      tenantId: context.tenantId,
      actorId: context.actorId,
      resumed: workflowResumed,
    });

    return {
      checkpointId: payload.checkpointId,
      approvalRequestId: payload.approvalRequestId,
      decision,
      workflowResumed,
    };
  }

  private async validateInboundSignature(context: ApprovalWebhookContext): Promise<void> {
    const timestampMs = Number(context.timestamp);
    if (!Number.isFinite(timestampMs)) {
      throw new Error('Invalid webhook timestamp');
    }

    const now = Date.now();
    if (Math.abs(now - timestampMs) > 5 * 60_000) {
      throw new Error('Webhook timestamp outside tolerance');
    }

    const replayAllowed = await nonceStore.consumeOnce('approval-webhook', context.nonce);
    if (!replayAllowed) {
      throw new Error('Webhook replay detected');
    }

    const signingPayload = `${context.timestamp}.${context.nonce}.${context.tenantId}.${context.actionToken}`;
    const expected = createHmac('sha256', this.deps.webhookSigningSecret).update(signingPayload).digest('hex');

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const receivedBuffer = Buffer.from(context.signature, 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
      throw new Error('Invalid webhook signature');
    }
  }
}

import { createHmac, randomUUID } from 'node:crypto';

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApprovalWebhookRouter } from '../approvalWebhooks.js';
import { ApprovalWebhookService } from '../../services/approvals/ApprovalWebhookService.js';
import { NotificationAdapterService } from '../../services/approvals/NotificationAdapterService.js';
import { NotificationActionSigner } from '../../services/approvals/NotificationActionSigner.js';
import type { AgentMiddlewareContext } from '../../services/UnifiedAgentOrchestrator.js';
import { CheckpointMiddleware } from '../../services/middleware/CheckpointMiddleware.js';

function buildContext(): AgentMiddlewareContext {
  return {
    envelope: {
      intent: 'financial_calculation',
      actor: { id: 'user-1' },
      organizationId: 'tenant-1',
      entryPoint: 'processQuery',
      reason: 'test',
      timestamps: { requestedAt: new Date().toISOString() },
    },
    query: 'run model',
    currentState: {
      currentStage: 'opportunity',
      status: 'in_progress',
      completedStages: [],
      context: {},
    } as never,
    userId: 'user-1',
    sessionId: 'session-1',
    traceId: 'trace-1',
    agentType: 'financial-modeling',
  };
}

describe('Approval webhook integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('pauses -> notifies -> approves via webhook -> resumes', async () => {
    const signer = new NotificationActionSigner({ secret: 'action-secret', ttlSeconds: 3600 });
    const auditEvents: string[] = [];

    const notifier = new NotificationAdapterService({
      signer,
      callbackBaseUrl: 'https://valueos.test',
      slackWebhookUrl: 'https://slack.test/hook',
      onAuditEvent: async (event) => {
        auditEvents.push(event);
      },
    });

    const checkpointMiddleware = new CheckpointMiddleware(
      {
        workspaceStateService: { updateState: vi.fn().mockResolvedValue({}) },
        realtimeUpdateService: { pushUpdate: vi.fn().mockResolvedValue(undefined) },
        approvalNotifier: notifier,
        onAuditEvent: async (event) => {
          auditEvents.push(event);
        },
      },
      { defaultTimeoutMs: 60_000 },
    );

    const transitionApprovalRequest = vi.fn().mockResolvedValue(undefined);
    const audit = vi.fn().mockResolvedValue(undefined);

    const webhookService = new ApprovalWebhookService({
      signer,
      checkpointMiddleware,
      webhookSigningSecret: 'webhook-secret',
      transitionApprovalRequest,
      audit,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/approvals/webhooks', createApprovalWebhookRouter(webhookService));

    const next = vi.fn().mockResolvedValue({ type: 'message', payload: { message: 'resumed' } });
    const executionPromise = checkpointMiddleware.execute(buildContext(), next);

    await vi.advanceTimersByTimeAsync(0);

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledOnce();

    const postedBody = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      blocks: Array<{ elements: Array<{ url: string }> }>;
    };
    const approveUrl = postedBody.blocks[1].elements[0].url;
    const token = new URL(approveUrl).searchParams.get('token');
    expect(token).toBeTruthy();

    const timestamp = Date.now().toString();
    const nonce = randomUUID();
    const signaturePayload = `${timestamp}.${nonce}.tenant-1.${token}`;
    const signature = createHmac('sha256', 'webhook-secret').update(signaturePayload).digest('hex');

    const webhookResponse = await request(app)
      .post('/api/approvals/webhooks/slack/decision')
      .query({ token })
      .set('x-vos-webhook-signature', signature)
      .set('x-vos-webhook-timestamp', timestamp)
      .set('x-vos-webhook-nonce', nonce)
      .send({ tenantId: 'tenant-1', actorId: 'approver-1' })
      .expect(200);

    expect(webhookResponse.body.ok).toBe(true);
    expect(webhookResponse.body.workflowResumed).toBe(true);

    const result = await executionPromise;
    expect(result.payload.message).toBe('resumed');
    expect(next).toHaveBeenCalledOnce();

    expect(transitionApprovalRequest).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: expect.any(String), tenantId: 'tenant-1', approved: true }),
    );
    expect(audit).toHaveBeenCalledTimes(3);
    expect(auditEvents).toContain('approval_request_sent');
  });
});

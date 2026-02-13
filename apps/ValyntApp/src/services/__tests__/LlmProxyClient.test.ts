import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

vi.mock('../SecurityLogger', () => ({
  securityLogger: {
    log: vi.fn(),
  },
}));

vi.mock('../WebSocketManager', () => ({
  webSocketManager: {
    on: vi.fn(),
    removeListener: vi.fn(),
    send: vi.fn(),
  },
}));

vi.mock('../LLMSanitizer', () => ({
  llmSanitizer: {
    sanitizePrompt: vi.fn().mockImplementation((content: string) => ({ content, violations: [] })),
    sanitizeResponse: vi.fn().mockImplementation((content: string) => ({
      content,
      violations: [],
      wasModified: false,
    })),
  },
}));

vi.mock('../../utils/security', () => ({
  sanitizeLLMContent: vi.fn().mockImplementation((content: string) => content),
}));

import { llmProxyClient } from '../LlmProxyClient';

describe('LlmProxyClient input guardrails', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    process.env.NODE_ENV = 'development';
  });

  it('blocks invalid alertDetails in complete before llm-proxy invocation', async () => {
    await expect(
      llmProxyClient.complete({
        messages: [{ role: 'user', content: 'analyze this alert' }],
        alertDetails: {
          alertId: 'alert-1',
          caseId: 'case-1',
          tenantId: 'tenant-1',
          title: 'Alert title',
          summary: 'Alert summary',
          severity: 'urgent',
          source: 'siem',
          detectedAt: 'not-a-date',
        },
        traceId: 'trace-abc-1234',
        tenantId: 'tenant-1',
        caseId: 'case-1',
      })
    ).rejects.toMatchObject({
      errorType: 'InputGuardrailTripwire',
      code: 'ALERT_DETAILS_VALIDATION_FAILED',
    });

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('blocks invalid alertDetails in completeWithTools before llm-proxy invocation', async () => {
    await expect(
      llmProxyClient.completeWithTools({
        messages: [{ role: 'user', content: 'use tools' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'lookupAlert',
              parameters: {},
            },
          },
        ],
        alertDetails: {
          alertId: '',
          caseId: 'case-1',
          tenantId: 'tenant-1',
          title: 'Alert title',
          summary: 'Alert summary',
          severity: 'high',
          source: 'siem',
          detectedAt: '2024-01-01T00:00:00Z',
        },
      })
    ).rejects.toMatchObject({
      errorType: 'InputGuardrailTripwire',
      code: 'ALERT_DETAILS_VALIDATION_FAILED',
    });

    expect(invokeMock).not.toHaveBeenCalled();
  });
});

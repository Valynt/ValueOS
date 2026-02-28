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
import { llmSanitizer } from '../LLMSanitizer';
import { securityLogger } from '../SecurityLogger';

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

describe('LlmProxyClient response sanitization parity', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    vi.mocked(llmSanitizer.sanitizeResponse).mockClear();
    vi.mocked(securityLogger.log).mockClear();
    process.env.NODE_ENV = 'development';
  });

  it('sanitizes script-bearing outputs identically for complete and completeWithTools', async () => {
    vi.mocked(llmSanitizer.sanitizeResponse).mockImplementation((content: string) => ({
      content: content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '[removed]'),
      violations: ['script-tag'],
      wasModified: true,
    }));

    invokeMock.mockResolvedValueOnce({
      data: {
        content: 'Hello <script>alert(1)</script> world',
        provider: 'provider-a',
        tokens_used: 10,
        latency_ms: 20,
        model: 'model-a',
      },
      error: null,
    });

    invokeMock.mockResolvedValueOnce({
      data: {
        content: 'Hello <script>alert(1)</script> world',
        provider: 'provider-a',
        tokens_used: 11,
        latency_ms: 21,
        model: 'model-a',
      },
      error: null,
    });

    const completeResponse = await llmProxyClient.complete({
      messages: [{ role: 'user', content: 'Hi' }],
    });

    const toolResponse = await llmProxyClient.completeWithTools({
      messages: [{ role: 'user', content: 'Hi with tools' }],
      tools: [{ type: 'function', function: { name: 'lookupAlert', parameters: {} } }],
    });

    expect(completeResponse.content).toBe('Hello [removed] world');
    expect(toolResponse.content).toBe('Hello [removed] world');
    expect(vi.mocked(llmSanitizer.sanitizeResponse)).toHaveBeenNthCalledWith(
      1,
      'Hello <script>alert(1)</script> world',
      { allowHtml: false }
    );
    expect(vi.mocked(llmSanitizer.sanitizeResponse)).toHaveBeenNthCalledWith(
      2,
      'Hello <script>alert(1)</script> world',
      { allowHtml: false }
    );
    expect(vi.mocked(securityLogger.log)).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'llm',
        action: 'response-sanitized',
        severity: 'warn',
        metadata: expect.objectContaining({
          violations: ['script-tag'],
          truncated: false,
        }),
      })
    );
  });

  it('applies the same 4000-character output bound in complete and completeWithTools', async () => {
    const oversized = 'x'.repeat(5000);

    invokeMock.mockResolvedValueOnce({
      data: {
        content: oversized,
        provider: 'provider-b',
        tokens_used: 10,
        latency_ms: 20,
        model: 'model-b',
      },
      error: null,
    });

    invokeMock.mockResolvedValueOnce({
      data: {
        content: oversized,
        provider: 'provider-b',
        tokens_used: 10,
        latency_ms: 20,
        model: 'model-b',
      },
      error: null,
    });

    const completeResponse = await llmProxyClient.complete({
      messages: [{ role: 'user', content: 'bound check' }],
    });

    const toolResponse = await llmProxyClient.completeWithTools({
      messages: [{ role: 'user', content: 'bound check with tools' }],
      tools: [{ type: 'function', function: { name: 'lookupAlert', parameters: {} } }],
    });

    expect(completeResponse.content).toHaveLength(4000);
    expect(toolResponse.content).toHaveLength(4000);
    expect(vi.mocked(securityLogger.log)).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'llm',
        action: 'response-sanitized',
        metadata: expect.objectContaining({
          truncated: true,
        }),
      })
    );
  });
});

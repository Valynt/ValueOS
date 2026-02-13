import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock, securityLogMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  securityLogMock: vi.fn(),
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
    log: securityLogMock,
  },
}));


vi.mock('../LLMSanitizer', () => ({
  llmSanitizer: {
    sanitizePrompt: (content: string) => ({ content, wasModified: false, violations: [] as string[] }),
    sanitizeResponse: (content: string) => {
      const violations: string[] = [];
      let sanitized = content;
      if (sanitized.includes('document.cookie')) {
        violations.push('Suspicious pattern: document\.cookie');
      }
      if (/<[^>]*>/.test(sanitized)) {
        sanitized = sanitized.replace(/<[^>]*>/g, '');
      }
      return {
        content: sanitized,
        wasModified: sanitized !== content,
        violations,
      };
    },
  },
}));

import { llmProxyClient } from '../LlmProxyClient';

describe('LlmProxyClient output sanitization parity', () => {
  const previousNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    invokeMock.mockReset();
    securityLogMock.mockReset();
  });

  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  it('sanitizes malicious tool outputs identically to standard chat outputs', async () => {
    const maliciousResponse = `<script>alert('pwned')</script><b>Hello</b> document.cookie ${'A'.repeat(5000)}`;

    invokeMock.mockImplementation((_fnName: string, { body }: { body: { type: string } }) => {
      if (body.type === 'chat') {
        return Promise.resolve({
          data: {
            content: maliciousResponse,
            provider: 'openai',
            tokens_used: 11,
            latency_ms: 10,
            model: 'x',
          },
          error: null,
        });
      }

      return Promise.resolve({
        data: {
          content: maliciousResponse,
          provider: 'openai',
          tokens_used: 12,
          latency_ms: 12,
          model: 'x',
          tool_calls: [],
          finish_reason: 'stop',
        },
        error: null,
      });
    });

    const baseMessages = [{ role: 'user', content: 'hello' }];

    const chatResponse = await llmProxyClient.complete({ messages: baseMessages });
    const toolsResponse = await llmProxyClient.completeWithTools({ messages: baseMessages, tools: [] });

    expect(chatResponse.content).toBe(toolsResponse.content);
    expect(chatResponse.content.length).toBe(4000);
    expect(chatResponse.content).not.toContain('<script>');
    expect(chatResponse.content).toContain('document.cookie');
  });

  it('emits violation telemetry for sanitized tool outputs', async () => {
    invokeMock.mockResolvedValue({
      data: {
        content: 'Leaked token via document.cookie and <script>alert(1)</script>',
        provider: 'openai',
        tokens_used: 1,
        latency_ms: 1,
        model: 'x',
        tool_calls: [],
        finish_reason: 'stop',
      },
      error: null,
    });

    await llmProxyClient.completeWithTools({
      messages: [{ role: 'user', content: 'hello' }],
      tools: [],
    });

    expect(securityLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'llm',
        action: 'response-tools-sanitized',
        severity: 'warn',
        metadata: expect.objectContaining({
          provider: 'openai',
          violations: expect.any(Array),
        }),
      })
    );
  });
});

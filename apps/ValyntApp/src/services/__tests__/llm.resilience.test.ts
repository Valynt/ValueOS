import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMService } from '../llm';

describe('LLMService backend-only transport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('routes chat requests through /api/llm/chat with session credentials', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          content: 'ok',
          provider: 'together_ai',
          model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
          usage: {
            promptTokens: 1,
            completionTokens: 2,
            totalTokens: 3,
          },
          cost: 0,
          latency: 123,
          cached: false,
        },
      }),
    });

    vi.stubGlobal('fetch', fetchSpy as typeof fetch);

    const service = new LLMService('/api');
    const result = await service.chat({ prompt: 'hello' });

    expect(result.content).toBe('ok');
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/llm/chat',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
  });

  it('routes stream requests through /api/llm/chat with session credentials', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"content":"hi","done":false}\n'));
        controller.enqueue(encoder.encode('data: {"content":"","done":true}\n'));
        controller.close();
      },
    });

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    });

    vi.stubGlobal('fetch', fetchSpy as typeof fetch);

    const service = new LLMService('/api');
    const chunks: string[] = [];

    for await (const chunk of service.streamChat({ prompt: 'stream me' })) {
      chunks.push(chunk.content);
      if (chunk.done) break;
    }

    expect(chunks).toEqual(['hi', '']);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/llm/chat',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
  });
});

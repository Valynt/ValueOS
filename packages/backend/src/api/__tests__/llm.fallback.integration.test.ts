import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Ensure logger/tenant middleware do not interfere
vi.mock('@shared/lib/logger');
vi.mock('../../middleware/tenantContext', () => ({
  tenantContextMiddleware: () => (_req: any, _res: any, next: any) => next(),
  tenantContextStorage: { getStore: vi.fn() },
  getCurrentTenantContext: vi.fn(),
}));

// Import the singleton to reset state between tests
import { llmFallback } from '../../services/llm/LLMFallback.js';

describe('LLM API integration — fallback behavior (Together)', () => {
  let app: typeof import('express').Application;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
    process.env.TCT_SECRET = process.env.TCT_SECRET || 'test-tct-secret';
    process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost';
    process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'anon-key';

    const serverModule = await import('../../server');
    app = serverModule.default;
  });

  beforeEach(() => {
    vi.resetAllMocks();
    // Reset LLMFallback circuit breaker/stats between tests
    llmFallback.reset();
  });

  function makeAuthToken() {
    return jwt.sign(
      { sub: 'user-1', email: 'user@example.com', tenant_id: 'tenant-1' },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' }
    );
  }


  it('POST /api/llm/chat - approved model passes allowlist validation', async () => {
    vi.stubEnv('TOGETHER_API_KEY', 'test-key');

    (globalThis as any).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'approved-response' } }],
          usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
        }),
      })
    );

    const token = makeAuthToken();

    const resp = await request(app)
      .post('/api/llm/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'hello', model: 'primary-model' });

    expect(resp.status).toBe(200);
    expect(resp.body.data.model).toBe('primary-model');
  });

  it('POST /api/llm/chat - denied model hard fails with MODEL_DENIED', async () => {
    const token = makeAuthToken();

    const resp = await request(app)
      .post('/api/llm/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'hello', model: 'totally-unknown-model' });

    expect(resp.status).toBe(403);
    expect(resp.body.code).toBe('MODEL_DENIED');
    expect(resp.body).toHaveProperty('policyVersion');
  });
  it('POST /api/llm/chat - primary 5xx -> fallback to secondary and returns secondary model', async () => {
    vi.stubEnv('TOGETHER_API_KEY', 'test-key');
    vi.stubEnv('TOGETHER_PRIMARY_MODEL_NAME', 'primary-model');
    vi.stubEnv('TOGETHER_SECONDARY_MODEL_NAME', 'secondary-model');
    vi.stubEnv('LLM_FALLBACK_ENABLED', 'true');
    vi.stubEnv('LLM_FALLBACK_MAX_ATTEMPTS', '1');
    vi.stubEnv('LLM_RETRY_BACKOFF_MS', '1');

    // Mock global.fetch to simulate Together responses
    (globalThis as any).fetch = vi.fn((url: string, opts: any) => {
      const body = opts?.body ? JSON.parse(opts.body) : {};
      if (body.model === 'primary-model') {
        return Promise.resolve({ ok: false, status: 500, text: async () => 'server error' });
      }
      // secondary success
      return Promise.resolve({ ok: true, json: async () => ({ choices: [{ message: { content: 'secondary-response' } }], usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } }) });
    });

    const token = makeAuthToken();

    const resp = await request(app)
      .post('/api/llm/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'hello', model: 'primary-model' });

    expect(resp.status).toBe(200);
    expect(resp.body).toHaveProperty('success', true);
    expect(resp.body.data.model).toBe('secondary-model');
    expect(resp.body.data.content).toContain('secondary-response');

    // Stats should reflect a fallback took place
    const statsResp = await request(app)
      .get('/api/llm/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(statsResp.status).toBe(200);
    expect(statsResp.body.data.togetherAI.fallbacks).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/llm/chat - primary 400 (non-transient) should NOT fallback', async () => {
    vi.stubEnv('TOGETHER_API_KEY', 'test-key');
    vi.stubEnv('TOGETHER_PRIMARY_MODEL_NAME', 'primary-model');
    vi.stubEnv('TOGETHER_SECONDARY_MODEL_NAME', 'secondary-model');
    vi.stubEnv('LLM_FALLBACK_ENABLED', 'true');
    vi.stubEnv('LLM_FALLBACK_MAX_ATTEMPTS', '1');

    (globalThis as any).fetch = vi.fn((url: string, opts: any) => {
      const body = opts?.body ? JSON.parse(opts.body) : {};
      if (body.model === 'primary-model') {
        // Non-transient 400 (should NOT trigger fallback)
        return Promise.resolve({ ok: false, status: 400, text: async () => 'bad request' });
      }
      // secondary would be success, but should not be used
      return Promise.resolve({ ok: true, json: async () => ({ choices: [{ message: { content: 'secondary-response' } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }) });
    });

    const token = makeAuthToken();

    const resp = await request(app)
      .post('/api/llm/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'hello', model: 'primary-model' });

    // Expect failure because primary produced a non-transient error and fallback must not occur
    expect(resp.status).toBeGreaterThanOrEqual(500);

    const statsResp = await request(app)
      .get('/api/llm/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(statsResp.status).toBe(200);
    // No fallback recorded
    expect(statsResp.body.data.togetherAI.fallbacks).toBe(0);
  });

  it('POST /api/llm/chat - fallback disabled should NOT attempt secondary', async () => {
    vi.stubEnv('TOGETHER_API_KEY', 'test-key');
    vi.stubEnv('TOGETHER_PRIMARY_MODEL_NAME', 'primary-model');
    vi.stubEnv('TOGETHER_SECONDARY_MODEL_NAME', 'secondary-model');
    vi.stubEnv('LLM_FALLBACK_ENABLED', 'false');
    vi.stubEnv('LLM_FALLBACK_MAX_ATTEMPTS', '1');

    (globalThis as any).fetch = vi.fn((url: string, opts: any) => {
      const body = opts?.body ? JSON.parse(opts.body) : {};
      if (body.model === 'primary-model') {
        return Promise.resolve({ ok: false, status: 500, text: async () => 'server error' });
      }
      return Promise.resolve({ ok: true, json: async () => ({ choices: [{ message: { content: 'secondary-response' } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }) });
    });

    const token = makeAuthToken();

    const resp = await request(app)
      .post('/api/llm/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'hello', model: 'primary-model' });

    expect(resp.status).toBeGreaterThanOrEqual(500);

    const statsResp = await request(app)
      .get('/api/llm/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(statsResp.status).toBe(200);
    expect(statsResp.body.data.togetherAI.fallbacks).toBe(0);
  });
});

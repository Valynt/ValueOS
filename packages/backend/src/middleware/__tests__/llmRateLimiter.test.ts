import { describe, expect, it, vi } from 'vitest';

const { rateLimitMiddleware } = vi.hoisted(() => ({
  rateLimitMiddleware: vi.fn(
    () => async (_req: unknown, _res: unknown, next: () => void) => next()
  ),
}));

vi.mock('express-rate-limit', () => ({
  default: rateLimitMiddleware,
}));

vi.mock('rate-limit-redis', () => ({
  default: vi.fn(),
}));

vi.mock('@shared/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../services/post-v1/RateLimitKeyService', () => ({
  RateLimitKeyService: {
    generateSecureKey: vi.fn().mockReturnValue('test-key'),
    generateUserKey: vi.fn().mockReturnValue('test-key'),
  },
}));

const { executeMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
}));

vi.mock('../services/post-v1/RedisCircuitBreaker', () => ({
  redisCircuitBreaker: {
    execute: executeMock,
  },
}));

vi.mock('@shared/lib/redisClient', () => ({
  getRedisClient: vi.fn(),
}));

import { llmRateLimiter, strictLlmRateLimiter } from '../llmRateLimiter';

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: 'user-1',
      subscription_tier: 'free',
      role: 'user',
    },
    ip: '127.0.0.1',
    path: '/api/llm/generate',
    method: 'POST',
    headers: {},
    get: () => '',
    ...overrides,
  } as any;
}

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    getHeader: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  } as any;
}

describe('LLM rate limiter degraded-mode policy', () => {
  it('fails closed for expensive write paths when Redis is unavailable', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    executeMock.mockResolvedValue(null);

    const req = makeReq({ path: '/api/llm/generate', method: 'POST' });
    const res = makeRes();
    const next = vi.fn();

    await llmRateLimiter(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'LLM_RATE_LIMIT_DEGRADED_PROTECTION' })
    );

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('allows low-risk reads to continue in degraded mode', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    executeMock.mockResolvedValue(null);

    const req = makeReq({ path: '/api/llm/status', method: 'GET' });
    const res = makeRes();
    const next = vi.fn();

    await llmRateLimiter(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalledWith(503);

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('fails closed for strict limiter when Redis is unavailable', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    executeMock.mockResolvedValue(null);

    const req = makeReq({ path: '/api/llm/generate', method: 'POST' });
    const res = makeRes();
    const next = vi.fn();

    await strictLlmRateLimiter(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);

    process.env.NODE_ENV = originalNodeEnv;
  });
});

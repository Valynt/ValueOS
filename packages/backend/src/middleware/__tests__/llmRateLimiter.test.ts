
import { NextFunction, Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { llmRateLimiter, strictLlmRateLimiter } from '../llmRateLimiter';

// Mock logger to avoid clutter
vi.mock('@shared/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }
}));

// Mock the dependencies
vi.mock('@shared/lib/redisClient', () => ({
  getRedisClient: vi.fn().mockResolvedValue(null)
}));

vi.mock('../services/agents/resilience/RedisCircuitBreaker', () => ({
  redisCircuitBreaker: {
    execute: vi.fn().mockImplementation(async ({ fallback }) => {
      return fallback();
    })
  }
}));

vi.mock('../services/llm/RateLimitKeyService', () => ({
  RateLimitKeyService: {
    generateSecureKey: vi.fn().mockReturnValue('test-key'),
    generateUserKey: vi.fn().mockReturnValue('test-key')
  }
}));

describe('LLM Rate Limiter Performance & Correctness', () => {
  const mockReq = {
    user: {
      id: 'user-1',
      subscription_tier: 'free',
      role: 'user'
    },
    ip: '127.0.0.1',
    path: '/api/llm/generate',
    headers: {},
    get: (name: string) => ''
  } as any;

  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    getHeader: vi.fn(),
    setHeader: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
  } as any;

  const mockNext = vi.fn();

  it('llmRateLimiter benchmark: execution time for 10 requests', async () => {
    console.log('Starting llmRateLimiter benchmark...');
    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      await llmRateLimiter(mockReq, mockRes, mockNext);
    }
    const end = performance.now();
    console.log(`Time taken for 10 requests: ${(end - start).toFixed(2)}ms`);
  });

  it('llmRateLimiter correctness: should enforce limits in memory fallback', async () => {
    console.log('Starting llmRateLimiter correctness test...');
    let blockedCount = 0;
    const res = {
      ...mockRes,
      status: vi.fn().mockImplementation((code) => {
        if (code === 429) blockedCount++;
        return res;
      })
    };

    // Free tier limit is 10.
    // 10 requests already sent in previous test (state preserved).
    // Send 15 more. All should be blocked.
    for (let i = 0; i < 15; i++) {
        await llmRateLimiter(mockReq, res, mockNext);
    }

    console.log(`Blocked requests: ${blockedCount}`);
    if (blockedCount === 0) {
        console.log('FAIL: No requests were blocked! In-memory fallback is resetting state every request.');
    } else {
        console.log('SUCCESS: Requests were blocked.');
    }
    expect(blockedCount).toBeGreaterThan(0);
  });

  it('strictLlmRateLimiter: should enforce limits (limit 5)', async () => {
    console.log('Starting strictLlmRateLimiter correctness test...');
    let blockedCount = 0;
    const res = {
      ...mockRes,
      status: vi.fn().mockImplementation((code) => {
        if (code === 429) blockedCount++;
        return res;
      })
    };

    // Strict limit is 5.
    // Send 10 requests. 5 should pass, 5 blocked.
    // Note: This is the first time strictLlmRateLimiter is called, so new instance.

    for (let i = 0; i < 10; i++) {
        await strictLlmRateLimiter(mockReq, res, mockNext);
    }

    console.log(`Strict Blocked requests: ${blockedCount}`);
    expect(blockedCount).toBe(5);
  });
});

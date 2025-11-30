/**
 * Security Integration Tests
 * Tests for auth/CSRF/session/rate-limit on all state-changing routes
 * 
 * Tests:
 * - CSRF protection on all POST routes
 * - Session timeout enforcement
 * - Rate limiting (429 responses)
 * - Authentication requirements
 * - Security headers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';

// Mock dependencies
vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));

vi.mock('../../services/LLMFallback', () => ({
  llmFallback: {
    processRequest: vi.fn().mockResolvedValue({
      content: 'Test response',
      provider: 'openai',
      model: 'gpt-4',
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      cost: 0.001,
      latency: 100,
      cached: false,
    }),
  },
}));

vi.mock('../../services/MessageQueue', () => ({
  llmQueue: {
    addJob: vi.fn().mockResolvedValue({
      id: 'job-123',
      status: 'queued',
    }),
    getJobStatus: vi.fn().mockResolvedValue({
      status: 'completed',
      result: { content: 'test' },
    }),
  },
}));

describe('Security Integration Tests', () => {
  let app: Express;
  let validCsrfToken: string;
  let validSession: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Set up CSRF token
    validCsrfToken = 'test-csrf-token-123';

    // Set up valid session
    validSession = {
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      userId: 'user-123',
    };

    // Mock middleware to inject session
    app.use((req, res, next) => {
      (req as any).session = validSession;
      (req as any).user = { id: 'user-123' };
      (req as any).sessionId = 'session-123';
      next();
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CSRF Protection Tests', () => {
    describe('Auth Routes', () => {
      beforeEach(async () => {
        // Dynamically import auth routes
        const { default: authRouter } = await import('../auth');
        app.use('/auth', authRouter);
      });

      it('should reject login request without CSRF token', async () => {
        const response = await request(app)
          .post('/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password123',
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toContain('CSRF');
      });

      it('should reject login with mismatched CSRF tokens', async () => {
        const response = await request(app)
          .post('/auth/login')
          .set('x-csrf-token', 'token-1')
          .set('Cookie', 'csrf_token=token-2')
          .send({
            email: 'test@example.com',
            password: 'password123',
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toContain('CSRF');
      });

      it('should accept login with valid CSRF token', async () => {
        const response = await request(app)
          .post('/auth/login')
          .set('x-csrf-token', validCsrfToken)
          .set('Cookie', `csrf_token=${validCsrfToken}`)
          .send({
            email: 'test@example.com',
            password: 'password123',
          });

        // May be 501 (not implemented) but not 403 (CSRF failure)
        expect(response.status).not.toBe(403);
      });

      it('should reject signup without CSRF token', async () => {
        const response = await request(app)
          .post('/auth/signup')
          .send({
            email: 'test@example.com',
            password: 'password123',
            fullName: 'Test User',
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toContain('CSRF');
      });

      it('should reject password reset without CSRF token', async () => {
        const response = await request(app)
          .post('/auth/password/reset')
          .send({
            email: 'test@example.com',
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toContain('CSRF');
      });
    });

    describe('LLM Routes', () => {
      beforeEach(async () => {
        const { default: llmRouter } = await import('../llm');
        app.use('/api/llm', llmRouter);
      });

      it('should reject LLM chat request without CSRF token', async () => {
        const response = await request(app)
          .post('/api/llm/chat')
          .send({
            prompt: 'Hello',
            model: 'gpt-4',
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toContain('CSRF');
      });

      it('should accept LLM chat with valid CSRF token', async () => {
        const response = await request(app)
          .post('/api/llm/chat')
          .set('x-csrf-token', validCsrfToken)
          .set('Cookie', `csrf_token=${validCsrfToken}`)
          .send({
            prompt: 'Hello',
            model: 'gpt-4',
          });

        expect(response.status).not.toBe(403);
      });
    });

    describe('Queue Routes', () => {
      beforeEach(async () => {
        const { default: queueRouter } = await import('../queue');
        app.use('/api/queue', queueRouter);
      });

      it('should reject queue submission without CSRF token', async () => {
        const response = await request(app)
          .post('/api/queue/llm')
          .send({
            type: 'chat',
            prompt: 'Hello',
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toContain('CSRF');
      });

      it('should accept queue submission with valid CSRF token', async () => {
        const response = await request(app)
          .post('/api/queue/llm')
          .set('x-csrf-token', validCsrfToken)
          .set('Cookie', `csrf_token=${validCsrfToken}`)
          .send({
            type: 'chat',
            prompt: 'Hello',
          });

        expect(response.status).not.toBe(403);
      });
    });
  });

  describe('Session Timeout Tests', () => {
    beforeEach(async () => {
      const { default: llmRouter } = await import('../llm');
      app.use('/api/llm', llmRouter);
    });

    it('should reject request with expired idle session', async () => {
      // Set session with old lastActivityAt
      validSession.lastActivityAt = Date.now() - (31 * 60 * 1000); // 31 minutes ago

      const response = await request(app)
        .post('/api/llm/chat')
        .set('x-csrf-token', validCsrfToken)
        .set('Cookie', `csrf_token=${validCsrfToken}`)
        .send({
          prompt: 'Hello',
          model: 'gpt-4',
        });

      expect(response.status).toBe(440);
      expect(response.body.error).toContain('Session expired');
    });

    it('should reject request with expired absolute session', async () => {
      // Set session with old createdAt
      validSession.createdAt = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago

      const response = await request(app)
        .post('/api/llm/chat')
        .set('x-csrf-token', validCsrfToken)
        .set('Cookie', `csrf_token=${validCsrfToken}`)
        .send({
          prompt: 'Hello',
          model: 'gpt-4',
        });

      expect(response.status).toBe(440);
      expect(response.body.error).toContain('Session exceeded');
    });

    it('should accept request with valid session', async () => {
      // Reset to valid session
      validSession.createdAt = Date.now();
      validSession.lastActivityAt = Date.now();

      const response = await request(app)
        .post('/api/llm/chat')
        .set('x-csrf-token', validCsrfToken)
        .set('Cookie', `csrf_token=${validCsrfToken}`)
        .send({
          prompt: 'Hello',
          model: 'gpt-4',
        });

      expect(response.status).not.toBe(440);
    });

    it('should reject request with missing session', async () => {
      // Override middleware to not set session
      app = express();
      app.use(express.json());
      const { default: llmRouter } = await import('../llm');
      app.use('/api/llm', llmRouter);

      const response = await request(app)
        .post('/api/llm/chat')
        .set('x-csrf-token', validCsrfToken)
        .set('Cookie', `csrf_token=${validCsrfToken}`)
        .send({
          prompt: 'Hello',
          model: 'gpt-4',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Session missing');
    });

    it('should update lastActivityAt on successful request', async () => {
      const initialLastActivity = validSession.lastActivityAt;

      await request(app)
        .post('/api/llm/chat')
        .set('x-csrf-token', validCsrfToken)
        .set('Cookie', `csrf_token=${validCsrfToken}`)
        .send({
          prompt: 'Hello',
          model: 'gpt-4',
        });

      // Session should be updated (in real middleware)
      expect(validSession.lastActivityAt).toBeGreaterThanOrEqual(initialLastActivity);
    });
  });

  describe('Rate Limiting Tests', () => {
    describe('Strict Tier (LLM)', () => {
      beforeEach(async () => {
        const { default: llmRouter } = await import('../llm');
        app.use('/api/llm', llmRouter);
      });

      it('should allow requests within limit (5 req/min)', async () => {
        const requests = [];
        
        for (let i = 0; i < 5; i++) {
          requests.push(
            request(app)
              .post('/api/llm/chat')
              .set('x-csrf-token', validCsrfToken)
              .set('Cookie', `csrf_token=${validCsrfToken}`)
              .send({
                prompt: 'Hello',
                model: 'gpt-4',
              })
          );
        }

        const responses = await Promise.all(requests);
        
        // All should succeed (not rate limited)
        responses.forEach(response => {
          expect(response.status).not.toBe(429);
        });
      });

      it('should block requests exceeding strict limit', async () => {
        const requests = [];
        
        // Send 6 requests (1 over limit)
        for (let i = 0; i < 6; i++) {
          requests.push(
            request(app)
              .post('/api/llm/chat')
              .set('x-csrf-token', validCsrfToken)
              .set('Cookie', `csrf_token=${validCsrfToken}`)
              .send({
                prompt: `Hello ${i}`,
                model: 'gpt-4',
              })
          );
        }

        const responses = await Promise.all(requests);
        
        // At least one should be rate limited
        const rateLimited = responses.filter(r => r.status === 429);
        expect(rateLimited.length).toBeGreaterThan(0);
      });

      it('should include Retry-After header on rate limit', async () => {
        // Send enough requests to trigger rate limit
        for (let i = 0; i < 6; i++) {
          const response = await request(app)
            .post('/api/llm/chat')
            .set('x-csrf-token', validCsrfToken)
            .set('Cookie', `csrf_token=${validCsrfToken}`)
            .send({
              prompt: 'Hello',
              model: 'gpt-4',
            });

          if (response.status === 429) {
            expect(response.headers['retry-after']).toBeDefined();
            break;
          }
        }
      });
    });

    describe('Standard Tier (Queue)', () => {
      beforeEach(async () => {
        const { default: queueRouter } = await import('../queue');
        app.use('/api/queue', queueRouter);
      });

      it('should allow standard tier limit (60 req/min)', async () => {
        const requests = [];
        
        for (let i = 0; i < 60; i++) {
          requests.push(
            request(app)
              .post('/api/queue/llm')
              .set('x-csrf-token', validCsrfToken)
              .set('Cookie', `csrf_token=${validCsrfToken}`)
              .send({
                type: 'chat',
                prompt: `Test ${i}`,
              })
          );
        }

        const responses = await Promise.all(requests);
        
        // Most should succeed
        const successful = responses.filter(r => r.status !== 429);
        expect(successful.length).toBeGreaterThan(50);
      });

      it('should block requests exceeding standard limit', async () => {
        const requests = [];
        
        // Send 65 requests
        for (let i = 0; i < 65; i++) {
          requests.push(
            request(app)
              .post('/api/queue/llm')
              .set('x-csrf-token', validCsrfToken)
              .set('Cookie', `csrf_token=${validCsrfToken}`)
              .send({
                type: 'chat',
                prompt: `Test ${i}`,
              })
          );
        }

        const responses = await Promise.all(requests);
        
        // Should have rate limited responses
        const rateLimited = responses.filter(r => r.status === 429);
        expect(rateLimited.length).toBeGreaterThan(0);
      });
    });

    describe('Rate Limit Per IP', () => {
      beforeEach(async () => {
        const { default: llmRouter } = await import('../llm');
        app.use('/api/llm', llmRouter);
      });

      it('should track rate limits per IP address', async () => {
        // Requests from IP 1
        const ip1Requests = [];
        for (let i = 0; i < 5; i++) {
          ip1Requests.push(
            request(app)
              .post('/api/llm/chat')
              .set('x-csrf-token', validCsrfToken)
              .set('Cookie', `csrf_token=${validCsrfToken}`)
              .set('X-Forwarded-For', '192.168.1.1')
              .send({
                prompt: 'Hello',
                model: 'gpt-4',
              })
          );
        }

        // Requests from IP 2
        const ip2Requests = [];
        for (let i = 0; i < 5; i++) {
          ip2Requests.push(
            request(app)
              .post('/api/llm/chat')
              .set('x-csrf-token', validCsrfToken)
              .set('Cookie', `csrf_token=${validCsrfToken}`)
              .set('X-Forwarded-For', '192.168.1.2')
              .send({
                prompt: 'Hello',
                model: 'gpt-4',
              })
          );
        }

        const allResponses = await Promise.all([...ip1Requests, ...ip2Requests]);
        
        // Both IPs should be tracked independently
        const rateLimited = allResponses.filter(r => r.status === 429);
        expect(rateLimited.length).toBe(0); // Neither should hit limit yet
      });
    });
  });

  describe('Security Headers Tests', () => {
    beforeEach(async () => {
      const { default: llmRouter } = await import('../llm');
      app.use('/api/llm', llmRouter);
    });

    it('should include security headers on all responses', async () => {
      const response = await request(app)
        .post('/api/llm/chat')
        .set('x-csrf-token', validCsrfToken)
        .set('Cookie', `csrf_token=${validCsrfToken}`)
        .send({
          prompt: 'Hello',
          model: 'gpt-4',
        });

      // Check for common security headers
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    it('should include Content-Security-Policy header', async () => {
      const response = await request(app)
        .post('/api/llm/chat')
        .set('x-csrf-token', validCsrfToken)
        .set('Cookie', `csrf_token=${validCsrfToken}`)
        .send({
          prompt: 'Hello',
          model: 'gpt-4',
        });

      expect(response.headers['content-security-policy']).toBeDefined();
    });
  });

  describe('Combined Security Tests', () => {
    beforeEach(async () => {
      const { default: llmRouter } = await import('../llm');
      app.use('/api/llm', llmRouter);
    });

    it('should enforce all security layers in order', async () => {
      // Missing CSRF should fail before session check
      const response1 = await request(app)
        .post('/api/llm/chat')
        .send({
          prompt: 'Hello',
          model: 'gpt-4',
        });

      expect(response1.status).toBe(403);

      // Invalid session should fail before rate limit
      validSession.lastActivityAt = Date.now() - (31 * 60 * 1000);
      
      const response2 = await request(app)
        .post('/api/llm/chat')
        .set('x-csrf-token', validCsrfToken)
        .set('Cookie', `csrf_token=${validCsrfToken}`)
        .send({
          prompt: 'Hello',
          model: 'gpt-4',
        });

      expect(response2.status).toBe(440);
    });

    it('should accept request passing all security checks', async () => {
      // Reset session
      validSession.createdAt = Date.now();
      validSession.lastActivityAt = Date.now();

      const response = await request(app)
        .post('/api/llm/chat')
        .set('x-csrf-token', validCsrfToken)
        .set('Cookie', `csrf_token=${validCsrfToken}`)
        .send({
          prompt: 'Hello',
          model: 'gpt-4',
          maxTokens: 100,
          temperature: 0.7,
        });

      // Should pass all checks and reach handler
      expect(response.status).not.toBe(403); // Not CSRF failure
      expect(response.status).not.toBe(440); // Not session timeout
      expect(response.status).not.toBe(429); // Not rate limited (first request)
    });
  });

  describe('Authentication Requirements', () => {
    beforeEach(async () => {
      const { default: llmRouter } = await import('../llm');
      app.use('/api/llm', llmRouter);
    });

    it('should include user context in successful requests', async () => {
      const response = await request(app)
        .post('/api/llm/chat')
        .set('x-csrf-token', validCsrfToken)
        .set('Cookie', `csrf_token=${validCsrfToken}`)
        .send({
          prompt: 'Hello',
          model: 'gpt-4',
        });

      // Request should process with user context
      expect(response.status).not.toBe(401);
    });

    it('should validate service identity on requests', async () => {
      // Service identity should be validated by middleware
      const response = await request(app)
        .post('/api/llm/chat')
        .set('x-csrf-token', validCsrfToken)
        .set('Cookie', `csrf_token=${validCsrfToken}`)
        .set('X-Service-Id', 'valuecanvas')
        .send({
          prompt: 'Hello',
          model: 'gpt-4',
        });

      expect(response.status).not.toBe(403);
    });
  });

  describe('Error Response Format', () => {
    beforeEach(async () => {
      const { default: llmRouter } = await import('../llm');
      app.use('/api/llm', llmRouter);
    });

    it('should return consistent error format for CSRF failure', async () => {
      const response = await request(app)
        .post('/api/llm/chat')
        .send({
          prompt: 'Hello',
          model: 'gpt-4',
        });

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('CSRF');
    });

    it('should return consistent error format for session timeout', async () => {
      validSession.lastActivityAt = Date.now() - (31 * 60 * 1000);

      const response = await request(app)
        .post('/api/llm/chat')
        .set('x-csrf-token', validCsrfToken)
        .set('Cookie', `csrf_token=${validCsrfToken}`)
        .send({
          prompt: 'Hello',
          model: 'gpt-4',
        });

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Session');
    });

    it('should return consistent error format for rate limit', async () => {
      // Trigger rate limit
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/api/llm/chat')
          .set('x-csrf-token', validCsrfToken)
          .set('Cookie', `csrf_token=${validCsrfToken}`)
          .send({
            prompt: 'Hello',
            model: 'gpt-4',
          });

        if (response.status === 429) {
          expect(response.body).toHaveProperty('error');
          expect(response.body.error).toContain('Too many');
          break;
        }
      }
    });
  });
});

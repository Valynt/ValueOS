import { describe, it, expect } from 'vitest';
import llmRouter from '../../api/llm';
import queueRouter from '../../api/queue';
import docsRouter from '../../api/docs';
import healthRouter from '../../api/health';
import authRouter from '../../api/auth';

function hasMiddleware(router: any, name: string): boolean {
  return router.stack?.some((layer: any) => (layer.name || '').includes(name));
}

describe('Security middleware coverage', () => {
  it('applies security headers + CSRF/session/rate limiting on LLM routes', () => {
    expect(hasMiddleware(llmRouter, 'securityHeadersMiddleware')).toBe(true);
    expect(hasMiddleware(llmRouter, 'csrfProtectionMiddleware')).toBe(true);
    expect(hasMiddleware(llmRouter, 'sessionTimeoutMiddleware')).toBe(true);
    expect(hasMiddleware(llmRouter, 'rateLimiter')).toBe(true);
  });

  it('applies security headers + CSRF/session/rate limiting on Queue routes', () => {
    expect(hasMiddleware(queueRouter, 'securityHeadersMiddleware')).toBe(true);
    expect(hasMiddleware(queueRouter, 'csrfProtectionMiddleware')).toBe(true);
    expect(hasMiddleware(queueRouter, 'sessionTimeoutMiddleware')).toBe(true);
    expect(hasMiddleware(queueRouter, 'rateLimiter')).toBe(true);
  });

  it('applies security headers on Docs routes', () => {
    expect(hasMiddleware(docsRouter, 'securityHeadersMiddleware')).toBe(true);
  });

  it('applies security headers on Health routes', () => {
    expect(hasMiddleware(healthRouter, 'securityHeadersMiddleware')).toBe(true);
  });

  it('applies full stack on Auth routes (template)', () => {
    expect(hasMiddleware(authRouter, 'securityHeadersMiddleware')).toBe(true);
    expect(hasMiddleware(authRouter, 'csrfProtectionMiddleware')).toBe(true);
    expect(hasMiddleware(authRouter, 'sessionTimeoutMiddleware')).toBe(true);
    expect(hasMiddleware(authRouter, 'rateLimiter')).toBe(true);
  });
});

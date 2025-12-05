import { describe, it, expect } from 'vitest';
import { createSecureRouter } from '../secureRouter';

function hasMiddleware(router: any, name: string): boolean {
  return router.stack?.some((layer: any) => (layer.name || '').includes(name));
}

describe('createSecureRouter', () => {
  it('adds standard security middlewares and rate limiter', () => {
    const router = createSecureRouter('standard');
    expect(hasMiddleware(router, 'securityHeadersMiddleware')).toBe(true);
    expect(hasMiddleware(router, 'serviceIdentityMiddleware')).toBe(true);
    expect(hasMiddleware(router, 'csrfProtectionMiddleware')).toBe(true);
    expect(hasMiddleware(router, 'sessionTimeoutMiddleware')).toBe(true);
    expect(hasMiddleware(router, 'rateLimiter')).toBe(true);
  });
});


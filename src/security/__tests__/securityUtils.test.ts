import { describe, expect, it } from 'vitest';
import { RateLimiter, sanitizeLLMContent, sanitizeUserInput, validatePassword, defaultPasswordPolicy } from '../../utils/security';

describe('sanitizeUserInput', () => {
  it('strips html and script tags', () => {
    const result = sanitizeUserInput('<script>alert(1)</script>Hello <b>World</b>');
    expect(result).toBe('Hello World');
  });

  it('enforces max length and trims whitespace', () => {
    const result = sanitizeUserInput('   hello '.repeat(50), 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.startsWith('hello')).toBe(true);
  });
});

describe('password policy', () => {
  it('enforces strong defaults', () => {
    const weak = validatePassword('short');
    expect(weak.valid).toBe(false);
    const strong = validatePassword('VeryStr0ng!Pass', defaultPasswordPolicy);
    expect(strong.valid).toBe(true);
  });
});

describe('RateLimiter', () => {
  it('blocks excessive attempts and returns retryAfter', () => {
    const limiter = new RateLimiter({ maxAttempts: 2, windowMs: 1000, lockoutMs: 2000 });
    const key = 'user@example.com';
    expect(limiter.canAttempt(key).allowed).toBe(true);
    limiter.recordFailure(key);
    limiter.recordFailure(key);
    const status = limiter.canAttempt(key);
    expect(status.allowed).toBe(false);
    expect(status.retryAfter).toBeGreaterThan(0);
  });
});

describe('sanitizeLLMContent', () => {
  it('escapes html entities', () => {
    const sanitized = sanitizeLLMContent('<div>test</div>');
    expect(sanitized).toContain('&lt;div&gt;');
  });
});

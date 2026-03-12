/**
 * secureLLMComplete — PII violation handling tests
 *
 * Covers:
 *  - high/critical violations throw and block the request
 *  - low/medium violations log a warning but allow the request through (Fix 3)
 *  - missing tenant identifier throws
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('../logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: vi.fn(),
  }),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { secureLLMComplete } from '../secureLLMWrapper.js';
import type { LLMCompletable } from '../secureLLMWrapper.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGateway(): LLMCompletable {
  return {
    complete: vi.fn().mockResolvedValue({ content: 'ok', usage: undefined }),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('secureLLMComplete — tenant guard', () => {
  it('throws when no tenant identifier is provided', async () => {
    const gw = makeGateway();
    await expect(
      secureLLMComplete(gw, [{ role: 'user', content: 'hello' }], {}),
    ).rejects.toThrow('requires a tenant identifier');
  });
});

describe('secureLLMComplete — PII violation handling', () => {
  beforeEach(() => {
    mockLoggerWarn.mockClear();
    mockLoggerError.mockClear();
  });

  it('throws for high/critical PII violations and does not call gateway', async () => {
    const gw = makeGateway();

    // SSN triggers a critical/high violation in SecureLLMWrapper.detectPII
    const ssnText = 'My SSN is 123-45-6789';

    await expect(
      secureLLMComplete(gw, [{ role: 'user', content: ssnText }], {
        organizationId: 'org-1',
        serviceName: 'TestService',
      }),
    ).rejects.toThrow(/blocked request/);

    expect(gw.complete).not.toHaveBeenCalled();
  });

  it('logs a warning for low/medium violations and still calls gateway (Fix 3)', async () => {
    const gw = makeGateway();

    // Email address triggers a medium violation in SecureLLMWrapper.detectPII
    const emailText = 'Contact user@example.com for details';

    const result = await secureLLMComplete(
      gw,
      [{ role: 'user', content: emailText }],
      { organizationId: 'org-1', serviceName: 'TestService', operation: 'test' },
    );

    // Request must proceed — gateway was called
    expect(gw.complete).toHaveBeenCalledOnce();
    expect(result.content).toBe('ok');

    // Warning must be emitted — previously the violation was silently ignored
    expect(mockLoggerWarn).toHaveBeenCalledOnce();
    const warnCall = mockLoggerWarn.mock.calls[0];
    expect(warnCall[0]).toMatch(/low\/medium PII/);
    expect(warnCall[1]).toMatchObject({
      tenantId: 'org-1',
      serviceName: 'TestService',
      operation: 'test',
    });
    expect(warnCall[1].violations).toBeInstanceOf(Array);
    expect(warnCall[1].violations.length).toBeGreaterThan(0);
  });

  it('does not warn when input is clean', async () => {
    const gw = makeGateway();

    await secureLLMComplete(
      gw,
      [{ role: 'user', content: 'What is the weather today?' }],
      { organizationId: 'org-1' },
    );

    expect(mockLoggerWarn).not.toHaveBeenCalled();
    expect(gw.complete).toHaveBeenCalledOnce();
  });
});

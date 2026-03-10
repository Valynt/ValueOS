/**
 * agentHealth — regression tests
 *
 * Covers the timer leak bug where clearTimeout was not called before
 * `continue` on a non-OK HTTP response.
 */

import { vi, describe, it, expect, afterEach } from 'vitest';
import { initializeAgents } from '../agentHealth.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('initializeAgents', () => {
  it('clears the abort timer when the response is non-OK', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    // First call returns 503, second returns 200 with healthy data
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: false, status: 503 });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ agents: { available: true } }),
      });
    }));

    await initializeAgents({ retryAttempts: 1, retryDelay: 0 });

    // clearTimeout must be called for both the non-OK attempt and the successful
    // attempt — at minimum 2 calls (one per fetch attempt that completes).
    expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('returns FALLBACK_HEALTH and calls onError after all retries fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const onError = vi.fn();
    const result = await initializeAgents({ retryAttempts: 1, retryDelay: 0, onError });

    expect(result.healthy).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('returns health on first successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ agents: { available: true } }),
    }));

    const onComplete = vi.fn();
    const result = await initializeAgents({ onComplete });

    expect(result.healthy).toBe(true);
    expect(onComplete).toHaveBeenCalledWith(result);
  });
});

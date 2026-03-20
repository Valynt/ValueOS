import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseModule } from '../BaseModule';
import { ConfidenceTier, ErrorCodes, GroundTruthError, ModuleRequest, ModuleResponse } from '../../types';

class TestModule extends BaseModule {
  name = 'test-module';
  tier = 'tier3' as ConfidenceTier;
  description = 'Test Module';

  async query(request: ModuleRequest): Promise<ModuleResponse> {
    return { success: true };
  }

  canHandle(request: ModuleRequest): boolean {
    return true;
  }

  public async testCheckRateLimit(domain: string, limit: number): Promise<void> {
    return this.checkRateLimit(domain, limit);
  }
}

describe('BaseModule.checkRateLimit', () => {
  let module: TestModule;

  beforeEach(async () => {
    vi.useFakeTimers();
    module = new TestModule();
    await module.initialize({});

    // Clear the underlying cache before each test
    // We can access it via the module's protected property (cast as any for tests)
    await (module as any).cache.clear();
  });

  afterEach(async () => {
    await (module as any).cache.clear();
    vi.restoreAllMocks();
  });

  it('allows requests under the limit', async () => {
    const domain = 'example.com';
    const limit = 3;

    await expect(module.testCheckRateLimit(domain, limit)).resolves.toBeUndefined();
    await expect(module.testCheckRateLimit(domain, limit)).resolves.toBeUndefined();

    // The third request should still succeed because it's strictly under the limit BEFORE pushing
    // Wait, the logic is: history.length >= limit -> throw.
    // First request: length = 0 < 3 (succeeds)
    // Second request: length = 1 < 3 (succeeds)
    // Third request: length = 2 < 3 (succeeds)
    await expect(module.testCheckRateLimit(domain, limit)).resolves.toBeUndefined();
  });

  it('throws RATE_LIMIT_EXCEEDED when limit is reached', async () => {
    const domain = 'example.com';
    const limit = 2;

    // 1st request (history length = 0)
    await module.testCheckRateLimit(domain, limit);
    // 2nd request (history length = 1)
    await module.testCheckRateLimit(domain, limit);

    // 3rd request (history length = 2 >= 2) -> throws
    await expect(module.testCheckRateLimit(domain, limit)).rejects.toThrowError(GroundTruthError);
    await expect(module.testCheckRateLimit(domain, limit)).rejects.toThrow(`Rate limit exceeded for ${domain}`);

    try {
      await module.testCheckRateLimit(domain, limit);
    } catch (e: any) {
      expect(e.code).toBe(ErrorCodes.RATE_LIMIT_EXCEEDED);
    }
  });

  it('expires older requests falling out of the window', async () => {
    const domain = 'example.com';
    const limit = 2;

    // Make 2 requests at t=0
    await module.testCheckRateLimit(domain, limit);
    await module.testCheckRateLimit(domain, limit);

    // The 3rd request would fail at t=0
    await expect(module.testCheckRateLimit(domain, limit)).rejects.toThrow();

    // Advance time by 60,001 ms (just over 1 minute)
    vi.advanceTimersByTime(60001);

    // Now the 3rd request should succeed, because the older requests are filtered out
    await expect(module.testCheckRateLimit(domain, limit)).resolves.toBeUndefined();
  });
});

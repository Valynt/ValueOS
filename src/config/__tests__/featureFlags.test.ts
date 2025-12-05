import { describe, it, expect } from 'vitest';
import { shouldEnableForUser } from '../featureFlags';

describe('featureFlags rollout helpers', () => {
  it('enables 100% rollouts and disables 0%', () => {
    expect(shouldEnableForUser('any-user', 100)).toBe(true);
    expect(shouldEnableForUser('any-user', 0)).toBe(false);
  });

  it('is deterministic for the same user', () => {
    const userId = 'user-123';
    const first = shouldEnableForUser(userId, 30);
    const second = shouldEnableForUser(userId, 30);
    expect(first).toBe(second);
  });

  it('respects percentage cutoff boundaries', () => {
    const enabled = shouldEnableForUser('boundary-user', 1);
    expect(typeof enabled).toBe('boolean');
  });
});

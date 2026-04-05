import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../services/core/FeatureFlags.js', () => ({
  featureFlags: {
    getVariant: vi.fn(),
    isEnabled: vi.fn(),
    trackEvaluation: vi.fn(),
    listFlags: vi.fn(),
  },
}));

const { featureFlagContext, withFeatureFlagVariant } = await import('../featureFlagMiddleware.js');
const { featureFlags } = await import('../../services/core/FeatureFlags.js');

describe('featureFlagMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('evaluates a flag once in withFeatureFlagVariant and reuses the result', async () => {
    (featureFlags.getVariant as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      variant: 'experiment-a',
      config: { rollout: 50 },
    });

    const req = {
      user: { id: 'user-123', tier: 'pro' },
      headers: { 'cf-ipcountry': 'US' },
    } as any;
    const res = {} as any;

    const setupNext = vi.fn();
    await featureFlagContext()(req, res, setupNext);

    const next = vi.fn();
    await withFeatureFlagVariant('new-dashboard')(req, res, next);

    expect(featureFlags.getVariant).toHaveBeenCalledTimes(1);
    expect(featureFlags.getVariant).toHaveBeenCalledWith('new-dashboard', {
      userId: 'user-123',
      userTier: 'pro',
      country: 'US',
    });
    expect(req.featureFlagVariant).toBe('experiment-a');
    expect(req.featureFlagConfig).toEqual({ rollout: 50 });
    expect(next).toHaveBeenCalled();
  });
});

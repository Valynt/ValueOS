/**
 * Webhook Service configuration tests
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { __getEnvSourceForTests, __setEnvSourceForTests } from '../../../lib/env';

const originalEnv = __getEnvSourceForTests();

describe('WebhookService configuration', () => {
  afterEach(() => {
    __setEnvSourceForTests(originalEnv);
    vi.resetModules();
  });

  it('should throw when processing events without Supabase config', async () => {
    __setEnvSourceForTests({});

    vi.resetModules();
    const { default: webhookService } = await import('../WebhookService');

    await expect(
      webhookService.processEvent({
        id: 'evt_missing_supabase',
        type: 'invoice.created',
        data: { object: {} },
      })
    ).rejects.toThrow('Supabase billing not configured');
  });
});

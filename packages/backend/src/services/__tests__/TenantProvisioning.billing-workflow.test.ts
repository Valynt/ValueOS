import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initializeBilling, mapTenantToPlan, type TenantConfig } from '../TenantProvisioning.js';

const mocks = vi.hoisted(() => {
  const rpc = vi.fn();
  const createCustomer = vi.fn();
  const updatePaymentMethod = vi.fn();
  const createSubscription = vi.fn();

  return {
    rpc,
    createCustomer,
    updatePaymentMethod,
    createSubscription,
  };
});

vi.mock('../../lib/supabase', () => ({
  createServerSupabaseClient: () => ({
    rpc: mocks.rpc,
  }),
  supabase: {},
}));

vi.mock('../billing/CustomerService', () => ({
  default: {
    createCustomer: mocks.createCustomer,
    updatePaymentMethod: mocks.updatePaymentMethod,
  },
}));

vi.mock('../billing/SubscriptionService', () => ({
  default: {
    createSubscription: mocks.createSubscription,
  },
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const baseConfig: TenantConfig = {
  organizationId: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Acme Org',
  tier: 'starter',
  ownerId: '550e8400-e29b-41d4-a716-446655440001',
  ownerEmail: 'owner@acme.test',
  provisioningRequestKey: 'req-tenant-provision-123',
};

describe('TenantProvisioning billing workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.createCustomer.mockResolvedValue({ id: 'cust-1' });
    mocks.createSubscription.mockResolvedValue({
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_123',
      status: 'active',
    });
    mocks.rpc.mockResolvedValue({
      data: {
        subscription_id: '1db4c509-595f-47ca-93dd-cd86268bca31',
        price_version_id: '81916b0d-4ad0-4d47-b329-4201fed0da55',
        entitlement_snapshot_id: 'eff53f4f-9c0d-4492-8c74-ffcae1420f8a',
      },
      error: null,
    });
  });

  it('maps Free/Standard/Enterprise tiers correctly', () => {
    expect(mapTenantToPlan('free')).toBe('free');
    expect(mapTenantToPlan('starter')).toBe('standard');
    expect(mapTenantToPlan('professional')).toBe('standard');
    expect(mapTenantToPlan('enterprise')).toBe('enterprise');
  });

  it('calls tenant_provisioning_workflow and pins selected plan tier via RPC', async () => {
    await initializeBilling(baseConfig);

    expect(mocks.rpc).toHaveBeenCalledWith(
      'tenant_provisioning_workflow',
      expect.objectContaining({
        p_tenant_id: baseConfig.organizationId,
        p_selected_tier: 'standard',
        p_request_key: baseConfig.provisioningRequestKey,
        p_stripe_customer_id: 'cus_123',
        p_stripe_subscription_id: 'sub_123',
      })
    );
  });

  it('migration enforces one current entitlement snapshot per tenant', () => {
    const migrationPath = resolve(
      process.cwd(),
      'infra/supabase/supabase/migrations/20260304000000_tenant_provisioning_workflow.sql'
    );
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('idx_entitlement_snapshots_one_current_per_tenant');
    expect(sql).toContain('WHERE superseded_at IS NULL');
    expect(sql).toContain('UPDATE public.entitlement_snapshots');
    expect(sql).toContain('SET superseded_at = v_now');
  });
});

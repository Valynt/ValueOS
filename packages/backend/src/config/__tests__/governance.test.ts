import { describe, expect, it } from 'vitest';
import { loadGovernanceConfig, validateGovernanceConfigEnv } from '../governance.js';

describe('governance config', () => {
  it('uses backward-compatible defaults when env vars are absent', () => {
    const config = loadGovernanceConfig({});

    expect(config.permissionCacheTtlMs).toBe(30_000);
    expect(config.permissionCacheMax).toBe(2_000);
    expect(config.destructiveActions.has('value_model.delete')).toBe(true);
    expect(config.elevatedRoles.has('admin')).toBe(true);
    expect(config.prodApprovalRequiredActions.has('proposal.publish')).toBe(true);
  });

  it('parses env overrides', () => {
    const config = loadGovernanceConfig({
      GOVERNANCE_PERMISSION_CACHE_TTL_MS: '45000',
      GOVERNANCE_PERMISSION_CACHE_MAX: '500',
      GOVERNANCE_DESTRUCTIVE_ACTIONS: 'foo.delete, bar.delete',
      GOVERNANCE_ELEVATED_ROLES: 'super-admin',
      GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS: 'foo.publish',
    });

    expect(config.permissionCacheTtlMs).toBe(45_000);
    expect(config.permissionCacheMax).toBe(500);
    expect(config.destructiveActions).toEqual(new Set(['foo.delete', 'bar.delete']));
    expect(config.elevatedRoles).toEqual(new Set(['super-admin']));
    expect(config.prodApprovalRequiredActions).toEqual(new Set(['foo.publish']));
  });

  it('reports schema errors for malformed env values', () => {
    const errors = validateGovernanceConfigEnv({
      GOVERNANCE_PERMISSION_CACHE_TTL_MS: '999',
      GOVERNANCE_PERMISSION_CACHE_MAX: '0',
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(' ')).toContain('GOVERNANCE_PERMISSION_CACHE_TTL_MS');
    expect(errors.join(' ')).toContain('GOVERNANCE_PERMISSION_CACHE_MAX');
  });
});

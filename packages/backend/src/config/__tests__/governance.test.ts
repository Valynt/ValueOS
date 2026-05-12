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
    expect(config.stageRequiredFields).toEqual({
      dev: [],
      staging: ['changeTicketId'],
      prod: ['changeTicketId', 'riskAcceptanceId'],
    });
  });

  it('parses env overrides', () => {
    const config = loadGovernanceConfig({
      GOVERNANCE_PERMISSION_CACHE_TTL_MS: '45000',
      GOVERNANCE_PERMISSION_CACHE_MAX: '500',
      GOVERNANCE_DESTRUCTIVE_ACTIONS: 'foo.delete, bar.delete',
      GOVERNANCE_ELEVATED_ROLES: 'super-admin',
      GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS: 'foo.publish',
      GOVERNANCE_STAGE_REQUIRED_FIELDS: JSON.stringify({
        dev: ['ticketId'],
        staging: ['changeTicketId', 'releaseId'],
        prod: ['changeTicketId', 'riskAcceptanceId', 'releaseId'],
      }),
    });

    expect(config.permissionCacheTtlMs).toBe(45_000);
    expect(config.permissionCacheMax).toBe(500);
    expect(config.destructiveActions).toEqual(new Set(['foo.delete', 'bar.delete']));
    expect(config.elevatedRoles).toEqual(new Set(['super-admin']));
    expect(config.prodApprovalRequiredActions).toEqual(new Set(['foo.publish']));
    expect(config.stageRequiredFields.prod).toEqual([
      'changeTicketId',
      'riskAcceptanceId',
      'releaseId',
    ]);
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

  it('reports schema errors for malformed stage required fields config', () => {
    const errors = validateGovernanceConfigEnv({
      GOVERNANCE_STAGE_REQUIRED_FIELDS: '{bad json}',
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(' ')).toContain('GOVERNANCE_STAGE_REQUIRED_FIELDS');
  });
});

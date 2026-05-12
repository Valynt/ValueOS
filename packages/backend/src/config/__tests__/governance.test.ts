import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../lib/logger.js';
import { loadGovernanceConfig, validateGovernanceConfigEnv } from '../governance.js';

describe('governance config', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses backward-compatible defaults when env vars are absent', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const config = loadGovernanceConfig({ NODE_ENV: 'development' });

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
    expect(warnSpy).toHaveBeenCalledWith(
      'governance.config.fallback_applied',
      expect.objectContaining({ event: 'governance_config_fallback' }),
    );
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
      GOVERNANCE_SCHEMA_HASH_EXPECTED: 'schema-v3',
      APP_MIGRATION_HEAD: '20260512000000_add_layer6',
      REQUIRED_PAYLOAD_CONTRACT_VERSION: '2.4.0',
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
    expect(config.schemaHashExpected).toBe('schema-v3');
    expect(config.appMigrationHead).toBe('20260512000000_add_layer6');
    expect(config.requiredPayloadContractVersion).toBe('2.4.0');
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

  it('fails validation in prod when stage required fields are missing', () => {
    const errors = validateGovernanceConfigEnv({
      NODE_ENV: 'production',
      GOVERNANCE_DESTRUCTIVE_ACTIONS: 'value_model.delete',
      GOVERNANCE_ELEVATED_ROLES: 'admin',
      GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS: 'proposal.publish',
    });
    expect(errors).toContain('Invalid GOVERNANCE_STAGE_REQUIRED_FIELDS: required in production/prod runtime stage');
  });

  it('fails validation in prod when layer-6 drift env vars are missing', () => {
    const errors = validateGovernanceConfigEnv({
      NODE_ENV: 'production',
      GOVERNANCE_DESTRUCTIVE_ACTIONS: 'value_model.delete',
      GOVERNANCE_ELEVATED_ROLES: 'admin',
      GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS: 'proposal.publish',
      GOVERNANCE_STAGE_REQUIRED_FIELDS: JSON.stringify({
        dev: [],
        staging: ['changeTicketId'],
        prod: ['changeTicketId', 'riskAcceptanceId'],
      }),
    });
    expect(errors).toContain('Invalid GOVERNANCE_SCHEMA_HASH_EXPECTED: required in production/prod runtime stage');
    expect(errors).toContain('Invalid APP_MIGRATION_HEAD: required in production/prod runtime stage');
    expect(errors).toContain('Invalid REQUIRED_PAYLOAD_CONTRACT_VERSION: required in production/prod runtime stage');
  });


  it('rejects fallback defaults in prod strict mode for critical governance env vars', () => {
    expect(() =>
      loadGovernanceConfig({
        NODE_ENV: 'production',
        GOVERNANCE_STAGE_REQUIRED_FIELDS: JSON.stringify({
          dev: [],
          staging: ['changeTicketId'],
          prod: ['changeTicketId', 'riskAcceptanceId'],
        }),
      }),
    ).toThrowError(/GOVERNANCE_DESTRUCTIVE_ACTIONS/);
  });

  it('reports deterministic malformed JSON error path', () => {
    const errors = validateGovernanceConfigEnv({
      GOVERNANCE_STAGE_REQUIRED_FIELDS: '{bad json}',
    });

    expect(errors).toEqual(['Invalid GOVERNANCE_STAGE_REQUIRED_FIELDS: malformed JSON']);
  });
});

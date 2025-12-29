/**
 * Agent Identity System Tests (VOS-SEC-001)
 * 
 * Comprehensive test suite for the Agent Identity and Token Service
 * 
 * @see /docs/PHASE4_PLUS_ENTERPRISE_TICKETS.md - VOS-SEC-001
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AgentRole,
  Permission,
  createAgentIdentity,
  hasPermission,
  requirePermission,
  requiresHITL,
  validateIdentity,
  toTokenClaims,
  fromTokenClaims,
  PermissionDeniedError,
  AGENT_PERMISSION_MATRIX,
  HITL_ACTION_REGISTRY,
} from '../AgentIdentity';
import {
  AgentTokenService,
  createAgentForRole,
  createCoordinatorAgent,
  createTargetAgent,
  createIntegrityAgent,
} from '../AgentTokenService';

// Mock the logger
vi.mock('../../logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('AgentIdentity', () => {
  describe('createAgentIdentity', () => {
    it('should create a valid agent identity with all required fields', () => {
      const identity = createAgentIdentity({
        role: AgentRole.COORDINATOR,
        organizationId: 'org_123',
      });

      expect(identity.id).toMatch(/^agent:coordinatoragent:/);
      expect(identity.type).toBe('agent');
      expect(identity.role).toBe(AgentRole.COORDINATOR);
      expect(identity.organizationId).toBe('org_123');
      expect(identity.auditToken).toMatch(/^audit:/);
      expect(identity.permissions).toContain('read:customers');
      expect(identity.permissions).toContain('execute:workflow');
    });

    it('should respect default permissions for each role', () => {
      const coordinatorIdentity = createAgentIdentity({
        role: AgentRole.COORDINATOR,
        organizationId: 'org_123',
      });
      expect(coordinatorIdentity.permissions).toContain('execute:workflow');
      expect(coordinatorIdentity.permissions).not.toContain('write:vmrt');

      const targetIdentity = createAgentIdentity({
        role: AgentRole.TARGET,
        organizationId: 'org_123',
      });
      expect(targetIdentity.permissions).toContain('write:vmrt');
      expect(targetIdentity.permissions).not.toContain('execute:workflow');
    });

    it('should set correct expiration time', () => {
      const beforeCreate = new Date();
      
      const identity = createAgentIdentity({
        role: AgentRole.TARGET,
        organizationId: 'org_123',
        expirationSeconds: 7200, // 2 hours
      });

      const expiresAt = new Date(identity.expiresAt);
      const expectedExpiry = new Date(beforeCreate.getTime() + 7200 * 1000);
      
      // Allow 1 second tolerance
      expect(Math.abs(expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
    });

    it('should include parent session and initiating user when provided', () => {
      const identity = createAgentIdentity({
        role: AgentRole.OPPORTUNITY,
        organizationId: 'org_123',
        parentSessionId: 'session_abc',
        initiatingUserId: 'user_xyz',
      });

      expect(identity.parentSessionId).toBe('session_abc');
      expect(identity.initiatingUserId).toBe('user_xyz');
    });

    it('should map role to correct lifecycle stage', () => {
      const coordinatorIdentity = createAgentIdentity({
        role: AgentRole.COORDINATOR,
        organizationId: 'org_123',
      });
      expect(coordinatorIdentity.lifecycleStage).toBe('orchestration');

      const targetIdentity = createAgentIdentity({
        role: AgentRole.TARGET,
        organizationId: 'org_123',
      });
      expect(targetIdentity.lifecycleStage).toBe('definition');

      const integrityIdentity = createAgentIdentity({
        role: AgentRole.INTEGRITY,
        organizationId: 'org_123',
      });
      expect(integrityIdentity.lifecycleStage).toBe('governance');
    });
  });

  describe('hasPermission', () => {
    it('should return true for granted permissions', () => {
      const identity = createAgentIdentity({
        role: AgentRole.COORDINATOR,
        organizationId: 'org_123',
      });

      expect(hasPermission(identity, 'read:customers')).toBe(true);
      expect(hasPermission(identity, 'execute:workflow')).toBe(true);
    });

    it('should return false for non-granted permissions (deny-by-default)', () => {
      const identity = createAgentIdentity({
        role: AgentRole.COORDINATOR,
        organizationId: 'org_123',
      });

      expect(hasPermission(identity, 'write:vmrt')).toBe(false);
      expect(hasPermission(identity, 'admin:system')).toBe(false);
    });

    it('should return false for expired identity', () => {
      const identity = createAgentIdentity({
        role: AgentRole.COORDINATOR,
        organizationId: 'org_123',
        expirationSeconds: -1, // Already expired
      });

      expect(hasPermission(identity, 'read:customers')).toBe(false);
    });
  });

  describe('requirePermission', () => {
    it('should not throw for granted permissions', () => {
      const identity = createAgentIdentity({
        role: AgentRole.TARGET,
        organizationId: 'org_123',
      });

      expect(() => requirePermission(identity, 'write:vmrt')).not.toThrow();
    });

    it('should throw PermissionDeniedError for non-granted permissions', () => {
      const identity = createAgentIdentity({
        role: AgentRole.COORDINATOR,
        organizationId: 'org_123',
      });

      expect(() => requirePermission(identity, 'admin:system')).toThrow(PermissionDeniedError);
    });

    it('should include agent ID and action in error', () => {
      const identity = createAgentIdentity({
        role: AgentRole.OPPORTUNITY,
        organizationId: 'org_123',
      });

      try {
        requirePermission(identity, 'write:crm');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PermissionDeniedError);
        expect((error as PermissionDeniedError).agentId).toBe(identity.id);
        expect((error as PermissionDeniedError).action).toBe('write:crm');
      }
    });
  });

  describe('requiresHITL', () => {
    it('should return HITL config for registered actions', () => {
      const crmSync = requiresHITL('crm:sync_contacts');
      expect(crmSync).toBeDefined();
      expect(crmSync?.riskLevel).toBe('medium');
      expect(crmSync?.requiredApprovers).toBe(1);

      const bulkDelete = requiresHITL('data:bulk_delete');
      expect(bulkDelete).toBeDefined();
      expect(bulkDelete?.riskLevel).toBe('critical');
      expect(bulkDelete?.requiredApprovers).toBe(2);
    });

    it('should return undefined for non-HITL actions', () => {
      const result = requiresHITL('read:benchmarks');
      expect(result).toBeUndefined();
    });
  });

  describe('validateIdentity', () => {
    it('should validate a correct identity', () => {
      const identity = createAgentIdentity({
        role: AgentRole.COORDINATOR,
        organizationId: 'org_123',
      });

      const result = validateIdentity(identity);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch missing required fields', () => {
      const invalidIdentity = {
        id: '',
        type: 'agent' as const,
        role: AgentRole.COORDINATOR,
        name: 'Test',
        version: '1.0.0',
        lifecycleStage: 'orchestration',
        permissions: [] as Permission[],
        organizationId: '',
        issuedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        auditToken: '',
        metadata: {},
      };

      const result = validateIdentity(invalidIdentity);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing agent ID');
      expect(result.errors).toContain('Missing organization ID');
      expect(result.errors).toContain('Missing audit token');
    });

    it('should detect expired identity', () => {
      const identity = createAgentIdentity({
        role: AgentRole.TARGET,
        organizationId: 'org_123',
        expirationSeconds: -1,
      });

      const result = validateIdentity(identity);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('expired'))).toBe(true);
    });
  });

  describe('Token Claims', () => {
    it('should convert identity to JWT claims', () => {
      const identity = createAgentIdentity({
        role: AgentRole.COORDINATOR,
        organizationId: 'org_123',
        parentSessionId: 'session_abc',
      });

      const claims = toTokenClaims(identity);

      expect(claims.sub).toBe(identity.id);
      expect(claims.iss).toBe('valueos-auth');
      expect(claims.aud).toBe('valueos-api');
      expect(claims.org_id).toBe('org_123');
      expect(claims.agent_role).toBe(AgentRole.COORDINATOR);
      expect(claims.trace_id).toBe(identity.auditToken);
      expect(claims.parent_session).toBe('session_abc');
      expect(claims.scope).toEqual(identity.permissions);
    });

    it('should reconstruct identity from claims', () => {
      const identity = createAgentIdentity({
        role: AgentRole.TARGET,
        organizationId: 'org_456',
      });

      const claims = toTokenClaims(identity);
      const reconstructed = fromTokenClaims(claims);

      expect(reconstructed.id).toBe(identity.id);
      expect(reconstructed.role).toBe(identity.role);
      expect(reconstructed.organizationId).toBe(identity.organizationId);
      expect(reconstructed.permissions).toEqual(identity.permissions);
      expect(reconstructed.auditToken).toBe(identity.auditToken);
    });
  });

  describe('Permission Matrix', () => {
    it('should have permissions defined for all agent roles', () => {
      const allRoles = Object.values(AgentRole);
      
      for (const role of allRoles) {
        expect(AGENT_PERMISSION_MATRIX[role]).toBeDefined();
        expect(Array.isArray(AGENT_PERMISSION_MATRIX[role])).toBe(true);
      }
    });

    it('should grant IntegrityAgent admin:system permission', () => {
      expect(AGENT_PERMISSION_MATRIX[AgentRole.INTEGRITY]).toContain('admin:system');
    });

    it('should not grant non-IntegrityAgent admin:system permission', () => {
      expect(AGENT_PERMISSION_MATRIX[AgentRole.COORDINATOR]).not.toContain('admin:system');
      expect(AGENT_PERMISSION_MATRIX[AgentRole.TARGET]).not.toContain('admin:system');
      expect(AGENT_PERMISSION_MATRIX[AgentRole.OPPORTUNITY]).not.toContain('admin:system');
    });

    it('should grant RealizationAgent write:crm permission', () => {
      expect(AGENT_PERMISSION_MATRIX[AgentRole.REALIZATION]).toContain('write:crm');
    });
  });
});

describe('AgentTokenService', () => {
  let service: AgentTokenService;

  beforeEach(() => {
    // Get a fresh instance (note: singleton may persist state)
    service = AgentTokenService.getInstance();
  });

  afterEach(() => {
    // Cleanup
    service.destroy();
  });

  describe('issueToken', () => {
    it('should issue a valid token', async () => {
      const { identity, token } = await service.issueToken({
        role: AgentRole.COORDINATOR,
        organizationId: 'org_test',
      });

      expect(identity).toBeDefined();
      expect(identity.role).toBe(AgentRole.COORDINATOR);
      expect(token).toBeDefined();
      expect(token.startsWith('vos.')).toBe(true);
    });

    it('should register the token for validation', async () => {
      const { token } = await service.issueToken({
        role: AgentRole.TARGET,
        organizationId: 'org_test',
      });

      const validation = await service.validateToken(token);
      expect(validation.valid).toBe(true);
      expect(validation.identity).toBeDefined();
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      const { token } = await service.issueToken({
        role: AgentRole.OPPORTUNITY,
        organizationId: 'org_test',
      });

      const result = await service.validateToken(token);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.identity?.role).toBe(AgentRole.OPPORTUNITY);
    });

    it('should reject unknown tokens', async () => {
      const result = await service.validateToken('invalid_token');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Token not found');
    });

    it('should detect tokens needing refresh', async () => {
      // Issue a token with short expiration
      const { token } = await service.issueToken({
        role: AgentRole.COORDINATOR,
        organizationId: 'org_test',
        expirationSeconds: 60, // 1 minute (within refresh buffer)
      });

      const result = await service.validateToken(token);
      
      // With only 60 seconds, it should need refresh (buffer is 300s)
      expect(result.needsRefresh).toBe(true);
    });
  });

  describe('refreshToken', () => {
    it('should refresh a valid token', async () => {
      const { token: originalToken, identity: originalIdentity } = await service.issueToken({
        role: AgentRole.TARGET,
        organizationId: 'org_test',
        expirationSeconds: 300,
      });

      const result = await service.refreshToken(originalToken);

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.token).not.toBe(originalToken);
      expect(result.identity?.id).toBe(originalIdentity.id);
    });

    it('should revoke the old token after refresh', async () => {
      const { token: originalToken } = await service.issueToken({
        role: AgentRole.EXPANSION,
        organizationId: 'org_test',
      });

      await service.refreshToken(originalToken);

      const validation = await service.validateToken(originalToken);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Token has been revoked');
    });
  });

  describe('revokeToken', () => {
    it('should revoke a token', async () => {
      const { token } = await service.issueToken({
        role: AgentRole.REALIZATION,
        organizationId: 'org_test',
      });

      await service.revokeToken(token, 'Test revocation');

      const validation = await service.validateToken(token);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Token has been revoked');
    });
  });

  describe('revokeAllForAgent', () => {
    it('should revoke all tokens for an agent', async () => {
      const { identity, token: token1 } = await service.issueToken({
        role: AgentRole.COMMUNICATOR,
        organizationId: 'org_test',
      });

      // Simulate multiple tokens (refresh creates new ones)
      const { token: token2 } = await service.refreshToken(token1);

      const revokedCount = await service.revokeAllForAgent(identity.id, 'Batch revocation');

      expect(revokedCount).toBeGreaterThan(0);
      
      const validation = await service.validateToken(token2!);
      expect(validation.valid).toBe(false);
    });
  });

  describe('Factory Functions', () => {
    it('createCoordinatorAgent should create with correct settings', async () => {
      const { identity } = await createCoordinatorAgent('org_factory', 'session_123', 'user_456');

      expect(identity.role).toBe(AgentRole.COORDINATOR);
      expect(identity.parentSessionId).toBe('session_123');
      expect(identity.initiatingUserId).toBe('user_456');
    });

    it('createTargetAgent should create with correct permissions', async () => {
      const { identity } = await createTargetAgent('org_factory', 'session_abc');

      expect(identity.role).toBe(AgentRole.TARGET);
      expect(identity.permissions).toContain('write:vmrt');
    });

    it('createIntegrityAgent should have extended expiration', async () => {
      const before = new Date();
      const { identity } = await createIntegrityAgent('org_factory');

      expect(identity.role).toBe(AgentRole.INTEGRITY);
      
      const expiresAt = new Date(identity.expiresAt);
      const expectedMinExpiry = new Date(before.getTime() + 23 * 60 * 60 * 1000); // At least 23 hours
      expect(expiresAt.getTime()).toBeGreaterThan(expectedMinExpiry.getTime());
    });
  });
});

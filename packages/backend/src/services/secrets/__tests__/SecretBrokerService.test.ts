import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SecretAccessDeniedError, SecretBrokerService, parseCapability } from '../SecretBrokerService.js';
import { getTenantSecretRepository } from '../TenantSecretRepository.js';
import type { SecretAccessRequest, TenantSecretRecord } from '../TenantSecretTypes.js';

// Mock encryption
vi.mock('../../../utils/encryption.js', () => ({
  encrypt: vi.fn((val) => `encrypted:${val}`),
  decrypt: vi.fn((val) => val.replace('encrypted:', '')),
}));

// Mock repository
vi.mock('../TenantSecretRepository.js', () => {
  const mockRepo = {
    findSecret: vi.fn(),
    upsertSecret: vi.fn(),
    appendAudit: vi.fn(),
    queryAudits: vi.fn(),
  };
  return {
    getTenantSecretRepository: () => mockRepo,
  };
});

describe('SecretBrokerService', () => {
  let broker: SecretBrokerService;
  let repo: ReturnType<typeof getTenantSecretRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    broker = new SecretBrokerService();
    repo = getTenantSecretRepository();
  });

  describe('parseCapability', () => {
    it('parses integration and secretName correctly', () => {
      expect(parseCapability('salesforce.read')).toEqual({
        integration: 'salesforce',
        secretName: 'read',
      });
      expect(parseCapability('openai.api_key')).toEqual({
        integration: 'openai',
        secretName: 'api_key',
      });
      expect(parseCapability('hubspot')).toEqual({
        integration: 'hubspot',
        secretName: 'default',
      });
    });
  });

  describe('resolve', () => {
    const baseRequest: SecretAccessRequest = {
      tenantId: 'tenant-123',
      agentId: 'agent-456',
      capability: 'salesforce.read',
      purpose: 'Fetch pipeline',
      toolName: 'salesforce_query',
      environment: 'production',
    };

    const baseRecord: TenantSecretRecord = {
      id: 'secret-1',
      organization_id: 'tenant-123',
      integration: 'salesforce',
      secret_name: 'read',
      encrypted_value: 'encrypted:my-secret-value',
      key_version: 1,
      environment: 'production',
      allowed_agents: ['agent-456'],
      allowed_tools: ['salesforce_query'],
      allowed_purposes: ['Fetch pipeline'],
      rotation_metadata: { rotation_count: 0 },
      created_by: 'admin',
      updated_by: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('denies access if tenantId is missing', async () => {
      const req = { ...baseRequest, tenantId: '' };
      const result = await broker.resolve(req);
      expect(result.decision).toBe('deny');
      if (result.decision === 'deny') {
        expect(result.reason).toBe('TENANT_MISMATCH');
      }
      expect(repo.appendAudit).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'deny', reason: expect.stringContaining('TENANT_MISMATCH') })
      );
    });

    it('denies access if secret is not found', async () => {
      vi.mocked(repo.findSecret).mockResolvedValue(null);
      const result = await broker.resolve(baseRequest);
      expect(result.decision).toBe('deny');
      if (result.decision === 'deny') {
        expect(result.reason).toBe('SECRET_NOT_FOUND');
      }
    });

    it('denies access if environment mismatches', async () => {
      vi.mocked(repo.findSecret).mockResolvedValue({ ...baseRecord, environment: 'staging' });
      const result = await broker.resolve(baseRequest);
      expect(result.decision).toBe('deny');
      if (result.decision === 'deny') {
        expect(result.reason).toBe('ENVIRONMENT_MISMATCH');
      }
    });

    it('denies access if agent is not allowed', async () => {
      vi.mocked(repo.findSecret).mockResolvedValue({ ...baseRecord, allowed_agents: ['other-agent'] });
      const result = await broker.resolve(baseRequest);
      expect(result.decision).toBe('deny');
      if (result.decision === 'deny') {
        expect(result.reason).toBe('AGENT_NOT_ALLOWED');
      }
    });

    it('denies access if tool is not allowed', async () => {
      vi.mocked(repo.findSecret).mockResolvedValue({ ...baseRecord, allowed_tools: ['other-tool'] });
      const result = await broker.resolve(baseRequest);
      expect(result.decision).toBe('deny');
      if (result.decision === 'deny') {
        expect(result.reason).toBe('TOOL_NOT_ALLOWED');
      }
    });

    it('denies access if purpose is not allowed', async () => {
      vi.mocked(repo.findSecret).mockResolvedValue({ ...baseRecord, allowed_purposes: ['other-purpose'] });
      const result = await broker.resolve(baseRequest);
      expect(result.decision).toBe('deny');
      if (result.decision === 'deny') {
        expect(result.reason).toBe('PURPOSE_NOT_ALLOWED');
      }
    });

    it('grants access and decrypts value if all policies pass', async () => {
      vi.mocked(repo.findSecret).mockResolvedValue(baseRecord);
      const result = await broker.resolve(baseRequest);
      expect(result.decision).toBe('allow');
      if (result.decision === 'allow') {
        expect(result.grant.decryptedValue).toBe('my-secret-value');
        expect(result.grant.tenantId).toBe('tenant-123');
        expect(result.grant.capability).toBe('salesforce.read');
      }
      expect(repo.appendAudit).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'allow' })
      );
    });
  });

  describe('upsertSecret', () => {
    it('encrypts plaintext before saving', async () => {
      vi.mocked(repo.findSecret).mockResolvedValue(null);
      vi.mocked(repo.upsertSecret).mockResolvedValue({} as any);

      await broker.upsertSecret({
        tenantId: 'tenant-123',
        integration: 'salesforce',
        secretName: 'read',
        plaintextValue: 'my-new-secret',
        environment: 'production',
        allowedAgents: [],
        allowedTools: [],
        allowedPurposes: [],
        actorId: 'admin',
      });

      expect(repo.upsertSecret).toHaveBeenCalledWith(
        expect.objectContaining({
          encrypted_value: 'encrypted:my-new-secret',
          key_version: 1,
        })
      );
    });
  });
});

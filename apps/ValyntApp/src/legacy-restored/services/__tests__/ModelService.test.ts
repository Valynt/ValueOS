
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelService } from '../ModelService';
import { auditLogService } from '../AuditLogService';
import { userSettingsService } from '../UserSettingsService';
import { LifecycleContext } from '../../types/agent';
import { TargetAgentOutput } from '../../types/vos';

// Mock dependencies
vi.mock('../AuditLogService', () => ({
  auditLogService: {
    log: vi.fn().mockResolvedValue({ id: 'audit-log-id' }),
  },
}));

vi.mock('../UserSettingsService', () => ({
  userSettingsService: {
    getProfile: vi.fn(),
  },
}));

// Mock repositories - define factory globally or inside mock to avoid hoisting issues
// We need to use vi.hoisted to make sure these are available
const { mockCreate, mockFindByNodeId } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindByNodeId: vi.fn(),
}));

// We must define the mock implementation inline.
// But we can return a class expression that uses the hoisted vars.

vi.mock('../../repositories/RoiModelRepository', () => ({ RoiModelRepository: class { create = mockCreate; findByNodeId = mockFindByNodeId; } }));
vi.mock('../../repositories/KpiTargetRepository', () => ({ KpiTargetRepository: class { create = mockCreate; findByNodeId = mockFindByNodeId; } }));
vi.mock('../../repositories/ValueTreeRepository', () => ({ ValueTreeRepository: class { create = mockCreate; findByNodeId = mockFindByNodeId; } }));
vi.mock('../../repositories/ValueTreeNodeRepository', () => ({ ValueTreeNodeRepository: class { create = mockCreate; findByNodeId = mockFindByNodeId; } }));
vi.mock('../../repositories/ValueTreeLinkRepository', () => ({ ValueTreeLinkRepository: class { create = mockCreate; findByNodeId = mockFindByNodeId; } }));
vi.mock('../../repositories/RoiModelCalculationRepository', () => ({ RoiModelCalculationRepository: class { create = mockCreate; findByNodeId = mockFindByNodeId; } }));
vi.mock('../../repositories/ValueCommitRepository', () => ({ ValueCommitRepository: class { create = mockCreate; findByNodeId = mockFindByNodeId; } }));

describe('ModelService', () => {
  let service: ModelService;
  const mockContext: LifecycleContext = {
    userId: 'user-123',
    organizationId: 'org-123',
    sessionId: 'session-123',
  };

  const mockOutput: TargetAgentOutput = {
    valueTree: { name: 'Test Tree' } as any,
    roiModel: { name: 'Test ROI Model' } as any,
    valueCommit: { notes: 'Test Commit' } as any,
    businessCase: {
      summary: 'Summary',
      nodes: [{ node_id: 'n1', label: 'Node 1', type: 'capability' }] as any,
      links: [],
      calculations: [
        { name: 'calc1', formula: '1+1' } as any,
        { name: 'calc2', formula: '2+2' } as any,
      ],
      kpi_targets: [],
      reasoning: 'reasoning',
      confidence_level: 'high',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup successful repo creates
    mockCreate.mockImplementation((data) => Promise.resolve({ data: { id: 'created-id', ...data }, error: null }));
    mockFindByNodeId.mockImplementation(() => Promise.resolve({ data: { id: 'node-id' } }));

    // Setup successful user profile fetch
    vi.mocked(userSettingsService.getProfile).mockResolvedValue({
      id: 'user-123',
      fullName: 'Test User',
      email: 'test@example.com',
    } as any);

    service = new ModelService(mockContext);
  });

  it('should create business case and log provenance', async () => {
    await service.persistBusinessCase(mockOutput, 'case-123');

    // Verify repositories were called
    expect(mockCreate).toHaveBeenCalled();

    // Verify Audit Logs
    // 1. Value Tree
    // 2. ROI Model
    // 3. Calc 1
    // 4. Calc 2
    // 5. Value Commit
    // Total 5 calls
    expect(auditLogService.log).toHaveBeenCalledTimes(5);

    // Check specific calls
    const logCalls = vi.mocked(auditLogService.log).mock.calls;

    // Verify user details
    expect(logCalls[0][0]).toMatchObject({
      userId: 'user-123',
      userName: 'Test User',
      userEmail: 'test@example.com',
    });

    // Verify resource types
    const resourceTypes = logCalls.map(call => call[0].resourceType);
    expect(resourceTypes).toContain('value_tree');
    expect(resourceTypes).toContain('roi_model');
    expect(resourceTypes).toContain('calculation');
    expect(resourceTypes).toContain('value_commit');
  });

  it('should use fallback user details if profile fetch fails', async () => {
    vi.mocked(userSettingsService.getProfile).mockRejectedValue(new Error('Fetch failed'));

    await service.persistBusinessCase(mockOutput, 'case-123');

    expect(auditLogService.log).toHaveBeenCalled();
    const logCall = vi.mocked(auditLogService.log).mock.calls[0][0];
    expect(logCall).toMatchObject({
      userName: 'Unknown User',
      userEmail: 'unknown@local',
    });
  });

  it('should continue if audit logging fails', async () => {
    vi.mocked(auditLogService.log).mockRejectedValue(new Error('Audit failed'));

    // Should not throw
    await expect(service.persistBusinessCase(mockOutput, 'case-123')).resolves.not.toThrow();
  });
});

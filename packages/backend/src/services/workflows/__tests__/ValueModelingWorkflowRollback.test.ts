import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  replaceNodesForCase,
  deleteNodesForCase,
  updateStatus,
  workflowExecutionUpdate,
  workflowExecutionEq,
  deleteEq,
  deleteOrganizationEq,
  deleteSourceEq,
  deleteScenarioRows,
} = vi.hoisted(() => ({
  replaceNodesForCase: vi.fn(),
  deleteNodesForCase: vi.fn(),
  updateStatus: vi.fn(),
  workflowExecutionUpdate: vi.fn(),
  workflowExecutionEq: vi.fn(),
  deleteEq: vi.fn(),
  deleteOrganizationEq: vi.fn(),
  deleteSourceEq: vi.fn(),
  deleteScenarioRows: vi.fn(),
}));

vi.mock('../../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../repositories/ValueTreeRepository.js', () => ({
  valueTreeRepository: {
    replaceNodesForCase,
    deleteNodesForCase,
  },
}));

vi.mock('../../../repositories/WorkflowStateRepository.js', () => ({
  workflowStateRepository: {
    updateStatus,
    update: vi.fn(),
  },
}));

vi.mock('../../../lib/supabase.js', () => ({
  assertNotTestEnv: vi.fn(),
  supabase: {
    from: vi.fn((table: string) => {
      if (table !== 'value_scenarios') {
        return {
          update: workflowExecutionUpdate,
          eq: workflowExecutionEq,
        };
      }

      return {
        delete: deleteScenarioRows,
      };
    }),
  },
}));

import { compensateValueModelingWorkflow } from '../WorkflowDAGDefinitions.js';

describe('Value modeling workflow compensation integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    workflowExecutionUpdate.mockReturnThis();
    workflowExecutionEq.mockReturnThis();

    deleteScenarioRows.mockReturnValue({
      eq: deleteEq,
    });
    deleteEq.mockReturnValue({
      eq: deleteOrganizationEq,
    });
    deleteOrganizationEq.mockReturnValue({
      eq: deleteSourceEq,
    });
    deleteSourceEq.mockResolvedValue({ error: null });

    replaceNodesForCase.mockResolvedValue([]);
    deleteNodesForCase.mockResolvedValue(undefined);
    updateStatus.mockResolvedValue(undefined);
  });

  it('restores pre-modeling snapshot and removes partial scenario rows when scenario stage fails', async () => {
    const preModelingSnapshot = [
      {
        node_key: 'root',
        label: 'Root',
        sort_order: 0,
        metadata: { seeded: true },
      },
      {
        node_key: 'child',
        label: 'Child',
        parent_node_key: 'root',
        sort_order: 1,
        metadata: {},
      },
    ];

    await compensateValueModelingWorkflow('scenario_building', {
      caseId: 'case-123',
      organizationId: 'org-123',
      workflowStateId: 'wf-123',
      preModelingSnapshot,
    });

    expect(replaceNodesForCase).toHaveBeenCalledWith('case-123', 'org-123', preModelingSnapshot);
    expect(deleteScenarioRows).toHaveBeenCalledTimes(1);
    expect(deleteEq).toHaveBeenCalledWith('case_id', 'case-123');
    expect(deleteOrganizationEq).toHaveBeenCalledWith('organization_id', 'org-123');
    expect(deleteSourceEq).toHaveBeenCalledWith('source', 'value_modeling');
    expect(updateStatus).toHaveBeenCalledWith('wf-123', 'org-123', 'rolled_back');
  });

  it('deletes value tree nodes when pre-modeling snapshot is unavailable and still removes partial scenarios', async () => {
    await compensateValueModelingWorkflow('scenario_building', {
      caseId: 'case-456',
      organizationId: 'org-456',
      workflowStateId: 'wf-456',
    });

    expect(deleteNodesForCase).toHaveBeenCalledWith('case-456', 'org-456');
    expect(deleteOrganizationEq).toHaveBeenCalledWith('organization_id', 'org-456');
    expect(deleteSourceEq).toHaveBeenCalledWith('source', 'value_modeling');
    expect(updateStatus).toHaveBeenCalledWith('wf-456', 'org-456', 'rolled_back');
  });
});

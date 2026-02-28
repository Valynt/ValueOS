import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UnifiedAgentOrchestrator } from '../UnifiedAgentOrchestrator.js';

type WorkflowExecutionRow = {
  id: string;
  organization_id: string;
  status: string;
};

type WorkflowExecutionLogRow = {
  id: string;
  execution_id: string;
  organization_id: string;
  message: string;
};

const executionRows: WorkflowExecutionRow[] = [
  { id: 'exec-org-1', organization_id: 'org-1', status: 'in_progress' },
  { id: 'exec-org-2', organization_id: 'org-2', status: 'completed' },
];

const logRows: WorkflowExecutionLogRow[] = [
  { id: 'log-1', execution_id: 'exec-org-1', organization_id: 'org-1', message: 'org-1 log entry' },
  { id: 'log-2', execution_id: 'exec-org-2', organization_id: 'org-2', message: 'org-2 log entry' },
];

const eqSpy = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const filters: Record<string, unknown> = {};
      const query = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((column: string, value: unknown) => {
          eqSpy(table, column, value);
          filters[column] = value;
          return query;
        }),
        maybeSingle: vi.fn(async () => {
          if (table !== 'workflow_executions') {
            return { data: null, error: null };
          }

          const found = executionRows.find(
            (row) => row.id === filters.id && row.organization_id === filters.organization_id
          );
          return { data: found ?? null, error: null };
        }),
        order: vi.fn(async () => {
          if (table !== 'workflow_execution_logs') {
            return { data: [], error: null };
          }

          const matched = logRows.filter(
            (row) =>
              row.execution_id === filters.execution_id &&
              row.organization_id === filters.organization_id
          );
          return { data: matched, error: null };
        }),
      };

      return query;
    }),
  },
}));

describe('UnifiedAgentOrchestrator tenant-scoped workflow reads', () => {
  beforeEach(() => {
    eqSpy.mockClear();
  });

  it('scopes workflow execution status lookups by organization', async () => {
    const orchestrator = new UnifiedAgentOrchestrator();

    const allowed = await orchestrator.getExecutionStatus('exec-org-1', 'org-1');
    const blocked = await orchestrator.getExecutionStatus('exec-org-1', 'org-2');

    expect(allowed?.organization_id).toBe('org-1');
    expect(blocked).toBeNull();
    expect(eqSpy).toHaveBeenCalledWith('workflow_executions', 'organization_id', 'org-1');
    expect(eqSpy).toHaveBeenCalledWith('workflow_executions', 'organization_id', 'org-2');
  });

  it('scopes workflow execution logs lookups by organization', async () => {
    const orchestrator = new UnifiedAgentOrchestrator();

    const allowedLogs = await orchestrator.getExecutionLogs('exec-org-1', 'org-1');
    const blockedLogs = await orchestrator.getExecutionLogs('exec-org-1', 'org-2');

    expect(allowedLogs).toHaveLength(1);
    expect(allowedLogs[0]?.organization_id).toBe('org-1');
    expect(blockedLogs).toHaveLength(0);
    expect(eqSpy).toHaveBeenCalledWith('workflow_execution_logs', 'organization_id', 'org-1');
    expect(eqSpy).toHaveBeenCalledWith('workflow_execution_logs', 'organization_id', 'org-2');
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, replaceNodesForCaseMock, deleteNodesForCaseMock, updateStatusMock, updateWorkflowStateMock, rollbackExecutionMock } =
  vi.hoisted(() => {
    type Row = Record<string, unknown>;

    const db = {
      workflow_executions: [] as Row[],
      workflow_events: [] as Row[],
      value_scenarios: [] as Row[],
    };

    const applyFilters = (rows: Row[], filters: Array<{ column: string; value: unknown }>) =>
      rows.filter((row) => filters.every((f) => row[f.column] === f.value));

    const createQuery = (table: keyof typeof db) => {
      const filters: Array<{ column: string; value: unknown }> = [];
      let selectedColumns: string | null = null;

      const query = {
        select: vi.fn((columns?: string) => {
          selectedColumns = columns ?? null;
          return query;
        }),
        insert: vi.fn((payload: Row | Row[]) => {
          const rows = Array.isArray(payload) ? payload : [payload];
          rows.forEach((row) => db[table].push({ ...row }));
          return query;
        }),
        update: vi.fn((payload: Row) => {
          const targetRows = applyFilters(db[table], filters);
          targetRows.forEach((row) => Object.assign(row, payload));
          return query;
        }),
        delete: vi.fn(() => {
          const toDelete = new Set(applyFilters(db[table], filters));
          db[table] = db[table].filter((row) => !toDelete.has(row));
          return { error: null };
        }),
        eq: vi.fn((column: string, value: unknown) => {
          filters.push({ column, value });
          return query;
        }),
        single: vi.fn(async () => {
          const rows = applyFilters(db[table], filters);
          const row = rows[0] ?? null;
          if (!row) {
            return { data: null, error: { message: "not found" } };
          }
          if (selectedColumns === "context") {
            return { data: { context: row.context }, error: null };
          }
          return { data: row, error: null };
        }),
      };

      return query;
    };

    const supabaseMock = {
      from: vi.fn((table: keyof typeof db) => createQuery(table)),
    };

    const replaceNodesForCaseMock = vi.fn(async () => undefined);
    const deleteNodesForCaseMock = vi.fn(async () => undefined);
    const updateStatusMock = vi.fn(async () => undefined);
    const updateWorkflowStateMock = vi.fn(async () => undefined);
    const rollbackExecutionMock = vi.fn(async () => undefined);

    vi.mock("../../../lib/supabase.js", () => ({
      supabase: supabaseMock,
      createServerSupabaseClient: vi.fn(() => supabaseMock),
    }));

    vi.mock("../../../lib/logger.js", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
    }));

    vi.mock("../../../repositories/ValueTreeRepository.js", () => ({
      valueTreeRepository: {
        replaceNodesForCase: replaceNodesForCaseMock,
        deleteNodesForCase: deleteNodesForCaseMock,
      },
    }));

    vi.mock("../../../repositories/WorkflowStateRepository.js", () => ({
      workflowStateRepository: {
        updateStatus: updateStatusMock,
        update: updateWorkflowStateMock,
      },
    }));

    vi.mock("../../AgentAPI.js", () => ({
      getAgentAPI: vi.fn(() => ({
        invokeAgent: vi.fn(async ({ context }: { context: Record<string, unknown> }) => {
          const stageId = String(context.stageId);
          const behavior = (context.__stageBehavior as Record<string, { success: boolean; data?: Record<string, unknown>; error?: string }>)?.[stageId];
          if (behavior) {
            return behavior;
          }
          return { success: true, data: { [stageId]: { persisted: true } } };
        }),
      })),
    }));

    vi.mock("../../workflow/WorkflowCompensation.js", () => ({
      workflowCompensation: {
        rollbackExecution: rollbackExecutionMock,
      },
    }));

    return {
      db,
      replaceNodesForCaseMock,
      deleteNodesForCaseMock,
      updateStatusMock,
      updateWorkflowStateMock,
      rollbackExecutionMock,
    };
  });

import {
  VALUE_MODELING_WORKFLOW,
  compensateValueModelingWorkflow,
} from "../../workflows/WorkflowDAGDefinitions.js";
import { WorkflowDAGExecutor } from "../../workflows/WorkflowDAGIntegration.js";

describe("Value Modeling Engine Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.workflow_executions.length = 0;
    db.workflow_events.length = 0;
    db.value_scenarios.length = 0;
  });

  it("executes value-modeling-v1 end-to-end and persists stage outputs", async () => {
    const executionId = "exec-happy";
    const organizationId = "org-test-123";

    db.workflow_executions.push({
      id: executionId,
      organization_id: organizationId,
      status: "initiated",
      current_stage: VALUE_MODELING_WORKFLOW.initial_stage,
      context: {
        organizationId,
        caseId: "case-1",
        executed_steps: [],
        __stageBehavior: {
          hypothesis_generation: { success: true, data: { hypotheses: [{ id: "h1" }] } },
          baseline_establishment: { success: true, data: { baselines: [{ metric: "churn" }] } },
          assumption_registration: { success: true, data: { assumptions: [{ id: "a1" }] } },
          scenario_building: {
            success: true,
            data: {
              scenarios: [
                { type: "conservative", npv: 100_000 },
                { type: "base", npv: 250_000 },
                { type: "upside", npv: 400_000 },
              ],
            },
          },
          sensitivity_analysis: { success: true, data: { sensitivity: [{ assumption: "churn", leverage: 1.7 }] } },
        },
      },
    });

    const executor = new WorkflowDAGExecutor() as unknown as {
      executeDAG: (executionId: string, workflow: typeof VALUE_MODELING_WORKFLOW, organizationId: string) => Promise<void>;
    };

    await executor.executeDAG(executionId, VALUE_MODELING_WORKFLOW, organizationId);

    const execution = db.workflow_executions.find((row) => row.id === executionId);
    expect(execution?.status).toBe("completed");

    const persistedContext = execution?.context as Record<string, unknown>;
    expect((persistedContext.hypotheses as unknown[])?.length).toBe(1);
    expect((persistedContext.baselines as unknown[])?.length).toBe(1);
    expect((persistedContext.assumptions as unknown[])?.length).toBe(1);
    expect((persistedContext.scenarios as unknown[])?.length).toBe(3);
    expect((persistedContext.sensitivity as unknown[])?.length).toBe(1);

    const executedSteps = persistedContext.executed_steps as Array<{ stage_id: string }>;
    expect(executedSteps.map((step) => step.stage_id)).toEqual([
      "hypothesis_generation",
      "baseline_establishment",
      "assumption_registration",
      "scenario_building",
      "sensitivity_analysis",
    ]);
  });

  it("handles scenario_building failure with compensation + rollback semantics and policy-vetoed malformed output", async () => {
    const executionId = "exec-failure";
    const organizationId = "org-test-123";
    const caseId = "case-2";

    db.workflow_executions.push({
      id: executionId,
      organization_id: organizationId,
      status: "initiated",
      current_stage: VALUE_MODELING_WORKFLOW.initial_stage,
      context: {
        organizationId,
        caseId,
        workflowStateId: "state-1",
        preModelingSnapshot: [{ id: "node-1", label: "Restored Root" }],
        executed_steps: [],
        __stageBehavior: {
          hypothesis_generation: { success: true, data: { hypotheses: [{ id: "h1" }] } },
          baseline_establishment: { success: true, data: { baselines: [{ metric: "nps" }] } },
          assumption_registration: { success: true, data: { assumptions: [{ id: "a1" }] } },
          scenario_building: {
            success: false,
            error: "policy veto: malformed scenario output (missing EVF decomposition)",
          },
        },
      },
    });

    db.value_scenarios.push(
      { id: "vs-1", case_id: caseId, organization_id: organizationId, source: "value_modeling" },
      { id: "vs-2", case_id: caseId, organization_id: organizationId, source: "value_modeling" }
    );

    rollbackExecutionMock.mockImplementationOnce(async () => {
      const execution = db.workflow_executions.find((row) => row.id === executionId);
      const context = (execution?.context ?? {}) as Record<string, unknown>;
      await compensateValueModelingWorkflow("scenario_building", context);
    });

    const executor = new WorkflowDAGExecutor() as unknown as {
      executeDAG: (executionId: string, workflow: typeof VALUE_MODELING_WORKFLOW, organizationId: string) => Promise<void>;
    };

    await executor.executeDAG(executionId, VALUE_MODELING_WORKFLOW, organizationId);

    const execution = db.workflow_executions.find((row) => row.id === executionId);
    expect(execution?.status).toBe("failed");
    expect(String(execution?.error_message)).toContain("policy veto");

    expect(rollbackExecutionMock).toHaveBeenCalledWith(executionId);
    expect(replaceNodesForCaseMock).toHaveBeenCalledWith(
      caseId,
      organizationId,
      [{ id: "node-1", label: "Restored Root" }]
    );
    expect(deleteNodesForCaseMock).not.toHaveBeenCalled();

    expect(db.value_scenarios).toHaveLength(0);
    expect(updateStatusMock).toHaveBeenCalledWith("state-1", organizationId, "rolled_back");
    expect(updateWorkflowStateMock).not.toHaveBeenCalled();

    const failedEvent = db.workflow_events.find(
      (event) => event.execution_id === executionId && event.event_type === "workflow_failed"
    );
    expect(String((failedEvent?.metadata as Record<string, unknown>)?.error)).toContain("policy veto");
  });
});

/**
 * Chaos: Partial execution then recovery.
 *
 * Success criteria:
 * - Saga compensation fires when a stage fails mid-execution
 * - No partial output is shown as final
 * - Workflow resumes from the last checkpoint on recovery
 * - Audit log contains trace_id and organization_id
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Minimal in-test stubs
// ---------------------------------------------------------------------------

type StageStatus = "pending" | "running" | "completed" | "failed" | "compensated";

interface Stage {
  id: string;
  name: string;
  status: StageStatus;
  output?: unknown;
}

interface WorkflowState {
  executionId: string;
  organizationId: string;
  traceId: string;
  stages: Stage[];
  lastCheckpoint: string | null;
  status: "running" | "completed" | "failed" | "compensating";
}

const auditLog: Array<{ event: string; traceId: string; organizationId: string; metadata: Record<string, unknown> }> = [];

const mockLogger = {
  error: vi.fn((msg: string, meta: Record<string, unknown>) => {
    auditLog.push({ event: msg, traceId: meta["traceId"] as string, organizationId: meta["organizationId"] as string, metadata: meta });
  }),
  warn: vi.fn(),
  info: vi.fn(),
};

const mockStageExecutor = {
  run: vi.fn<[Stage, WorkflowState], Promise<unknown>>(),
};

const mockCheckpointStore = {
  save: vi.fn<[WorkflowState], Promise<void>>(),
  load: vi.fn<[string], Promise<WorkflowState | null>>(),
};

// ---------------------------------------------------------------------------
// Saga executor stub
// ---------------------------------------------------------------------------

async function executeSaga(
  state: WorkflowState,
): Promise<{ finalState: WorkflowState; compensated: boolean }> {
  const completedStages: Stage[] = [];
  let compensated = false;

  for (const stage of state.stages) {
    stage.status = "running";

    try {
      const output = await mockStageExecutor.run(stage, state);
      stage.status = "completed";
      stage.output = output;
      completedStages.push(stage);

      // Persist checkpoint after each successful stage.
      state.lastCheckpoint = stage.id;
      await mockCheckpointStore.save(state);
    } catch (err) {
      stage.status = "failed";
      state.status = "compensating";

      mockLogger.error("Stage failed — triggering saga compensation", {
        traceId: state.traceId,
        organizationId: state.organizationId,
        stageId: stage.id,
        error: (err as Error).message,
      });

      // Compensate all previously completed stages in reverse order.
      for (const completed of [...completedStages].reverse()) {
        completed.status = "compensated";
        completed.output = undefined; // Clear partial output.
      }

      state.status = "failed";
      compensated = true;
      break;
    }
  }

  if (!compensated) {
    state.status = "completed";
  }

  return { finalState: state, compensated };
}

async function resumeFromCheckpoint(
  executionId: string,
  allStages: Stage[],
): Promise<WorkflowState | null> {
  const saved = await mockCheckpointStore.load(executionId);
  if (!saved) return null;

  // Resume only stages after the last checkpoint.
  const checkpointIndex = allStages.findIndex((s) => s.id === saved.lastCheckpoint);
  const remainingStages = checkpointIndex >= 0 ? allStages.slice(checkpointIndex + 1) : allStages;

  return { ...saved, stages: remainingStages, status: "running" };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Chaos: Partial execution recovery", () => {
  const makeState = (): WorkflowState => ({
    executionId: "exec-chaos-001",
    organizationId: "org-chaos",
    traceId: "trace-partial-001",
    lastCheckpoint: null,
    status: "running",
    stages: [
      { id: "stage-1", name: "Opportunity discovery", status: "pending" },
      { id: "stage-2", name: "Financial modeling", status: "pending" },
      { id: "stage-3", name: "Narrative generation", status: "pending" },
    ],
  });

  beforeEach(() => {
    auditLog.length = 0;
    vi.clearAllMocks();
    mockCheckpointStore.save.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saga compensation fires when a stage fails mid-execution", async () => {
    const state = makeState();
    mockStageExecutor.run
      .mockResolvedValueOnce({ hypotheses: ["h1"] }) // stage-1 succeeds
      .mockRejectedValueOnce(new Error("LLM timeout"));  // stage-2 fails

    const { compensated } = await executeSaga(state);

    expect(compensated).toBe(true);
  });

  it("completed stage output is cleared after compensation — no partial output shown as final", async () => {
    const state = makeState();
    mockStageExecutor.run
      .mockResolvedValueOnce({ hypotheses: ["h1"] })
      .mockRejectedValueOnce(new Error("LLM timeout"));

    const { finalState } = await executeSaga(state);

    const stage1 = finalState.stages.find((s) => s.id === "stage-1")!;
    expect(stage1.status).toBe("compensated");
    expect(stage1.output).toBeUndefined();
  });

  it("workflow status is failed — not completed — after partial execution", async () => {
    const state = makeState();
    mockStageExecutor.run
      .mockResolvedValueOnce({ hypotheses: ["h1"] })
      .mockRejectedValueOnce(new Error("LLM timeout"));

    const { finalState } = await executeSaga(state);

    expect(finalState.status).toBe("failed");
  });

  it("checkpoint is saved after each successful stage", async () => {
    const state = makeState();
    mockStageExecutor.run
      .mockResolvedValueOnce({ hypotheses: ["h1"] })
      .mockResolvedValueOnce({ model: { roi: 1.5 } })
      .mockResolvedValueOnce({ narrative: "value story" });

    await executeSaga(state);

    // save() called once per completed stage.
    expect(mockCheckpointStore.save).toHaveBeenCalledTimes(3);
  });

  it("workflow resumes from last checkpoint on recovery", async () => {
    const allStages: Stage[] = [
      { id: "stage-1", name: "Opportunity discovery", status: "completed" },
      { id: "stage-2", name: "Financial modeling", status: "pending" },
      { id: "stage-3", name: "Narrative generation", status: "pending" },
    ];

    const savedState: WorkflowState = {
      executionId: "exec-chaos-001",
      organizationId: "org-chaos",
      traceId: "trace-partial-001",
      lastCheckpoint: "stage-1",
      status: "running",
      stages: allStages,
    };

    mockCheckpointStore.load.mockResolvedValue(savedState);

    const resumed = await resumeFromCheckpoint("exec-chaos-001", allStages);

    expect(resumed).not.toBeNull();
    // Should only contain stages after the checkpoint.
    expect(resumed!.stages.map((s) => s.id)).toEqual(["stage-2", "stage-3"]);
  });

  it("audit log contains trace_id and organization_id on stage failure", async () => {
    const state = makeState();
    mockStageExecutor.run
      .mockResolvedValueOnce({ hypotheses: ["h1"] })
      .mockRejectedValueOnce(new Error("LLM timeout"));

    await executeSaga(state);

    const entry = auditLog.find((e) => e.event.includes("compensation"));
    expect(entry).toBeDefined();
    expect(entry!.traceId).toBe(state.traceId);
    expect(entry!.organizationId).toBe(state.organizationId);
  });

  it("all stages complete successfully when no failures occur", async () => {
    const state = makeState();
    mockStageExecutor.run
      .mockResolvedValueOnce({ hypotheses: ["h1"] })
      .mockResolvedValueOnce({ model: { roi: 1.5 } })
      .mockResolvedValueOnce({ narrative: "value story" });

    const { finalState, compensated } = await executeSaga(state);

    expect(compensated).toBe(false);
    expect(finalState.status).toBe("completed");
    expect(finalState.stages.every((s) => s.status === "completed")).toBe(true);
  });
});

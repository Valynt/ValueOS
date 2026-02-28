import { describe, expect, it, vi } from "vitest";

import { agentOrchestrator } from "../AgentOrchestratorAdapter";

describe("AgentOrchestratorAdapter shutdown drain", () => {
  it("awaits inflight executions before completing shutdown", async () => {
    let resolveExecution: ((value: unknown) => void) | undefined;
    const delayedExecution = new Promise((resolve) => {
      resolveExecution = resolve;
    });

    const orchestratorImpl = (agentOrchestrator as any).unifiedOrchestrator;
    const executeWorkflowSpy = vi
      .spyOn(orchestratorImpl, "executeWorkflow")
      .mockReturnValue(delayedExecution);

    const inFlight = agentOrchestrator.executeWorkflow("workflow-id", {}, "user-1");

    let shutdownCompleted = false;
    const shutdownPromise = agentOrchestrator.shutdown().then(() => {
      shutdownCompleted = true;
    });

    await Promise.resolve();
    expect(shutdownCompleted).toBe(false);

    resolveExecution?.({ ok: true });
    await inFlight;
    await shutdownPromise;

    expect(shutdownCompleted).toBe(true);
    expect(executeWorkflowSpy).toHaveBeenCalledTimes(1);
  });
});

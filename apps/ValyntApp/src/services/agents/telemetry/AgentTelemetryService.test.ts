import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentRequest, AgentResponse } from "../core/IAgent";

type CounterCall = { value: number; attributes?: Record<string, unknown> };
type HistogramCall = { value: number; attributes?: Record<string, unknown> };

describe("AgentTelemetryService", () => {
  const counterCalls = new Map<string, CounterCall[]>();
  const histogramCalls = new Map<string, HistogramCall[]>();

  beforeEach(() => {
    vi.resetModules();
    counterCalls.clear();
    histogramCalls.clear();

    vi.doMock("@opentelemetry/api", () => ({
      metrics: {
        getMeter: vi.fn(() => ({
          createCounter: (name: string) => ({
            add: (value: number, attributes?: Record<string, unknown>) => {
              const calls = counterCalls.get(name) || [];
              calls.push({ value, attributes });
              counterCalls.set(name, calls);
            },
          }),
          createHistogram: (name: string) => ({
            record: (value: number, attributes?: Record<string, unknown>) => {
              const calls = histogramCalls.get(name) || [];
              calls.push({ value, attributes });
              histogramCalls.set(name, calls);
            },
          }),
        })),
      },
    }));

    vi.doMock("../../../utils/logger", () => ({
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    }));

    vi.doMock("uuid", () => ({
      v4: () => `test-uuid-${Math.random()}`,
    }));
  });

  it("emits execution, token, cost, duration, and value counters", async () => {
    const { agentTelemetryService } = await import("./AgentTelemetryService");

    const request: AgentRequest = {
      agentType: "opportunity",
      query: "test query",
      organizationId: "org-1",
    };

    const traceId = agentTelemetryService.startExecutionTrace(request);

    const response: AgentResponse = {
      success: true,
      confidence: "high",
      data: {
        valueGenerated: 50,
      },
      metadata: {
        executionId: "exec-1",
        agentType: "opportunity",
        startTime: new Date(Date.now() - 200),
        endTime: new Date(),
        duration: 200,
        tokenUsage: {
          input: 100,
          output: 50,
          total: 150,
          cost: 0.05,
        },
        cacheHit: false,
        retryCount: 0,
        circuitBreakerTripped: false,
      },
    };

    agentTelemetryService.completeExecutionTrace(traceId, response);

    expect(counterCalls.get("agent_fabric_executions_total")?.[0]).toMatchObject({
      value: 1,
      attributes: { agent_type: "opportunity", organization_id: "org-1" },
    });
    expect(counterCalls.get("agent_fabric_execution_success_total")?.[0]?.value).toBe(1);
    expect(counterCalls.get("agent_fabric_token_usage_total")?.[0]?.value).toBe(150);
    expect(counterCalls.get("agent_fabric_cost_usd_total")?.[0]?.value).toBe(0.05);
    expect(counterCalls.get("agent_fabric_value_generated_usd_total")?.[0]?.value).toBe(50);
    expect(histogramCalls.get("agent_fabric_execution_duration_seconds")?.[0]?.value).toBeGreaterThan(0);
  });

  it("emits failure and security metrics", async () => {
    const { agentTelemetryService } = await import("./AgentTelemetryService");

    const traceId = agentTelemetryService.startExecutionTrace({
      agentType: "integrity",
      query: "check security",
    });

    agentTelemetryService.recordExecutionError(traceId, new Error("failure"));

    agentTelemetryService.recordTelemetryEvent({
      type: "agent_security_violation",
      agentType: "integrity",
      data: { reason: "policy violation" },
      severity: "error",
    });

    expect(counterCalls.get("agent_fabric_execution_failure_total")?.[0]?.value).toBe(1);
    expect(counterCalls.get("agent_fabric_security_events_total")?.[0]).toMatchObject({
      value: 1,
      attributes: { agent_type: "integrity", severity: "error" },
    });
  });
});

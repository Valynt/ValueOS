import { beforeEach, describe, expect, it, vi } from "vitest";

type CounterCall = { value: number; attributes?: Record<string, unknown> };
type HistogramCall = { value: number; attributes?: Record<string, unknown> };

const counterCalls = new Map<string, CounterCall[]>();
const histogramCalls = new Map<string, HistogramCall[]>();

vi.mock("@opentelemetry/api", () => ({
  metrics: {
    getMeter: () => ({
      createCounter: (name: string) => ({
        add: (value: number, attributes?: Record<string, unknown>) => {
          const calls = counterCalls.get(name) ?? [];
          calls.push({ value, attributes });
          counterCalls.set(name, calls);
        },
      }),
      createHistogram: (name: string) => ({
        record: (value: number, attributes?: Record<string, unknown>) => {
          const calls = histogramCalls.get(name) ?? [];
          calls.push({ value, attributes });
          histogramCalls.set(name, calls);
        },
      }),
    }),
  },
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { AgentTelemetryService } from "./AgentTelemetryService.js";

describe("AgentTelemetryService metrics labels", () => {
  beforeEach(() => {
    counterCalls.clear();
    histogramCalls.clear();
  });

  it("emits required telemetry attributes for metric writes", () => {
    const service = new AgentTelemetryService();

    service.recordTelemetryEvent({
      type: "agent_retry_success",
      agentType: "opportunity",
      severity: "info",
      data: {
        durationMs: 150,
        tokenUsage: 42,
        costUsd: 0.75,
        valueGeneratedUsd: 10,
        organizationId: "org-abc",
      },
    });

    const successCalls = counterCalls.get("agent_fabric_execution_success_total");
    expect(successCalls).toHaveLength(1);

    const attrs = successCalls?.[0].attributes;
    expect(attrs).toMatchObject({
      agent_type: "opportunity",
      event_type: "agent_retry_success",
      severity: "info",
      outcome: "success",
    });
    expect(attrs?.tenant_bucket).toMatch(/^tb_\d{2}$/);

    const durationCalls = histogramCalls.get("agent_fabric_execution_duration_seconds");
    expect(durationCalls).toHaveLength(1);
    expect(durationCalls?.[0].value).toBeCloseTo(0.15);
    expect(durationCalls?.[0].attributes).toEqual(attrs);
  });

  it("normalizes labels using strict allowlists to cap cardinality", () => {
    const service = new AgentTelemetryService();

    service.recordTelemetryEvent({
      type: "new_runtime_event_that_is_not_allowlisted",
      agentType: "custom-agent" as unknown as import("../../agent-types.js").AgentType,
      severity: "notice" as unknown as "info",
      data: { organizationId: "org-custom" },
    });

    service.recordTelemetryEvent({
      type: "new_runtime_event_that_is_not_allowlisted",
      agentType: "custom-agent" as unknown as import("../../agent-types.js").AgentType,
      severity: "notice" as unknown as "info",
      data: { organizationId: "org-custom" },
    });

    const bucketSet = new Set<string>();
    for (let index = 0; index < 200; index += 1) {
      service.recordTelemetryEvent({
        type: "agent_execution_error",
        agentType: "target",
        severity: "error",
        data: { organizationId: `org-${index}` },
      });

      const failureCalls = counterCalls.get("agent_fabric_execution_failure_total") ?? [];
      const latest = failureCalls[failureCalls.length - 1];
      const tenantBucket = latest.attributes?.tenant_bucket;
      if (typeof tenantBucket === "string") {
        bucketSet.add(tenantBucket);
      }
    }

    const tokenCalls = counterCalls.get("agent_fabric_token_usage_total") ?? [];
    expect(tokenCalls).toHaveLength(0);

    const failureCalls = counterCalls.get("agent_fabric_execution_failure_total") ?? [];
    expect(failureCalls.length).toBeGreaterThan(0);

    const firstAttrs = failureCalls[0].attributes;
    expect(firstAttrs).toMatchObject({
      agent_type: "target",
      event_type: "agent_execution_error",
      severity: "error",
      outcome: "failure",
    });

    const successCalls = counterCalls.get("agent_fabric_execution_success_total") ?? [];
    expect(successCalls[0]?.attributes).toMatchObject({
      agent_type: "other",
      event_type: "other",
      severity: "unknown",
      outcome: "neutral",
    });

    expect(successCalls[0]?.attributes?.tenant_bucket).toBe(successCalls[1]?.attributes?.tenant_bucket);
    expect(bucketSet.size).toBeLessThanOrEqual(64);
  });
});

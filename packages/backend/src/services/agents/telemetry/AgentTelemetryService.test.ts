import { beforeEach, describe, expect, it, vi } from "vitest";

type MetricRecord = {
  metric: string;
  value: number;
  attributes?: Record<string, string>;
};

const metricRecords: MetricRecord[] = [];

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    debug: vi.fn(),
  },
}));

vi.mock("@opentelemetry/api", () => ({
  metrics: {
    getMeter: () => ({
      createCounter: (name: string) => ({
        add: (value: number, attributes?: Record<string, string>) => {
          metricRecords.push({ metric: name, value, attributes });
        },
      }),
      createHistogram: (name: string) => ({
        record: (value: number, attributes?: Record<string, string>) => {
          metricRecords.push({ metric: name, value, attributes });
        },
      }),
    }),
  },
}));

describe("AgentTelemetryService", () => {
  beforeEach(() => {
    metricRecords.length = 0;
  });

  it("emits required labels including safe tenant bucket", async () => {
    const { AgentTelemetryService } = await import("./AgentTelemetryService");
    const service = new AgentTelemetryService();

    service.recordTelemetryEvent({
      type: "agent_execution_complete",
      agentType: "opportunity",
      severity: "info",
      organizationId: "org_primary",
      data: {
        durationMs: 200,
      },
    });

    const successMetric = metricRecords.find(
      (record) => record.metric === "agent_fabric_execution_success_total"
    );

    expect(successMetric?.attributes).toMatchObject({
      agent_type: "opportunity",
      event_type: "agent_execution_complete",
      severity: "info",
      outcome: "success",
    });
    expect(successMetric?.attributes?.tenant_bucket).toMatch(/^tb_\d{2}$/);
    expect(successMetric?.attributes?.organization_id).toBeUndefined();
  });

  it("constrains unknown label values to allowlist-safe buckets", async () => {
    const { AgentTelemetryService } = await import("./AgentTelemetryService");
    const service = new AgentTelemetryService();

    for (let i = 0; i < 12; i++) {
      service.recordTelemetryEvent({
        type: `custom_event_${i}`,
        agentType: "rogue-agent" as never,
        severity: "fatal" as never,
        data: { durationMs: 30 },
      });
    }

    const histogramAttributes = metricRecords
      .filter((record) => record.metric === "agent_fabric_execution_duration_seconds")
      .map((record) => record.attributes ?? {});

    const eventTypes = new Set(histogramAttributes.map((attributes) => attributes.event_type));
    const agentTypes = new Set(histogramAttributes.map((attributes) => attributes.agent_type));
    const severities = new Set(histogramAttributes.map((attributes) => attributes.severity));

    expect(eventTypes).toEqual(new Set(["other"]));
    expect(agentTypes).toEqual(new Set(["unknown"]));
    expect(severities).toEqual(new Set(["unknown"]));
  });

  it("allows controlled organization_id dimension only when explicitly requested", async () => {
    const { AgentTelemetryService } = await import("./AgentTelemetryService");
    const service = new AgentTelemetryService();

    service.recordTelemetryEvent({
      type: "agent_retry_failure",
      agentType: "target",
      severity: "error",
      organizationId: "unsafe org value with spaces",
      data: {
        allowOrgIdDimension: true,
      },
    });

    const failureMetric = metricRecords.find(
      (record) => record.metric === "agent_fabric_execution_failure_total"
    );

    expect(failureMetric?.attributes?.organization_id).toBe("redacted");
    expect(failureMetric?.attributes?.tenant_bucket).toBeUndefined();
  });
});

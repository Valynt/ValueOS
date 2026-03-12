import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loggerMock, publishMessageMock } = vi.hoisted(() => ({
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  publishMessageMock: vi.fn().mockResolvedValue("fallback-message-id"),
}));

vi.mock("../../lib/logger.js", () => ({
  logger: loggerMock,
}));

vi.mock("../AgentAuditLogger.js", () => ({
  getAuditLogger: () => ({
    query: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock("../SecureSharedContext.js", () => ({
  getSecureSharedContext: () => ({
    getOrganizationId: vi.fn().mockResolvedValue("test-org"),
  }),
}));

vi.mock("../realtime/MessageBus.js", () => ({
  MessageBus: class {
    createChannel(): void {
      // noop
    }

    publishMessage = publishMessageMock;
  },
}));

import { getSecurityMonitor, SecurityMonitor } from "../security/SecurityMonitor.js";

describe("SecurityMonitor alert channel delivery", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: "OK" });

    delete process.env.SECURITY_EMAIL_WEBHOOK_URL;
    delete process.env.SECURITY_SLACK_WEBHOOK_URL;
    delete process.env.SECURITY_PAGERDUTY_ROUTING_KEY;
    delete process.env.SECURITY_TEAM_WEBHOOK_URL;
    delete process.env.SECURITY_MANAGEMENT_WEBHOOK_URL;

    // @ts-ignore access singleton for reset in tests
    SecurityMonitor.instance = undefined;
  });

  afterEach(() => {
    // @ts-ignore access singleton for cleanup in tests
    const monitor = SecurityMonitor.instance as SecurityMonitor | undefined;
    monitor?.stop();
  });

  it("records skipped_missing_config and persists fallback when email channel config is absent", async () => {
    const monitor = getSecurityMonitor({
      escalationRules: { high_sensitivity_data_access: ["email_alert"] },
      severityRoutingRules: { high: [] },
    });

    monitor.recordEvent("high_sensitivity_data_access", "high", "unit-test", "email missing", {});
    await new Promise((resolve) => setTimeout(resolve, 5));

    const metrics = monitor.getAlertDeliveryMetrics();
    expect(metrics.email_alert.skipped_missing_config).toBe(1);
    expect(monitor.getFallbackQueue().length).toBeGreaterThanOrEqual(1);
    expect(publishMessageMock).toHaveBeenCalled();

    const unavailableLog = loggerMock.warn.mock.calls.find(
      ([message]) => message === "alert_delivery_unavailable",
    );
    expect(unavailableLog).toBeDefined();
  });

  it("sends to configured email channel and tracks sent metric", async () => {
    process.env.SECURITY_EMAIL_WEBHOOK_URL = "https://email.local/webhook";

    const monitor = getSecurityMonitor({
      escalationRules: { high_sensitivity_data_access: ["email_alert"] },
      severityRoutingRules: { high: [] },
    });

    monitor.recordEvent("high_sensitivity_data_access", "high", "unit-test", "email configured", {});
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://email.local/webhook",
      expect.objectContaining({ method: "POST" }),
    );
    const metrics = monitor.getAlertDeliveryMetrics();
    expect(metrics.email_alert.sent).toBeGreaterThanOrEqual(1);
    expect(metrics.email_alert.failed).toBe(0);
  });

  it("sends to configured slack channel and tracks sent metric", async () => {
    process.env.SECURITY_SLACK_WEBHOOK_URL = "https://slack.local/webhook";

    const monitor = getSecurityMonitor({
      escalationRules: { high_sensitivity_data_access: ["slack_notification"] },
      severityRoutingRules: { high: [] },
    });

    monitor.recordEvent("high_sensitivity_data_access", "high", "unit-test", "slack configured", {});
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://slack.local/webhook",
      expect.objectContaining({ method: "POST" }),
    );
    expect(monitor.getAlertDeliveryMetrics().slack_notification.sent).toBeGreaterThanOrEqual(1);
  });

  it("persists fallback when pagerduty routing key is absent", async () => {
    const monitor = getSecurityMonitor({
      escalationRules: { agent_compromised: ["pager_duty"] },
      severityRoutingRules: { critical: [] },
    });

    monitor.recordEvent("agent_compromised", "critical", "unit-test", "pagerduty missing", {});
    await new Promise((resolve) => setTimeout(resolve, 5));

    const metrics = monitor.getAlertDeliveryMetrics();
    expect(metrics.pager_duty.skipped_missing_config).toBe(1);
    expect(monitor.getFallbackQueue()[0]?.channel).toBe("pager_duty");
  });

  it("routes critical severity to management escalation and handles missing config with fallback", async () => {
    const monitor = getSecurityMonitor({
      escalationRules: { replay_attack_detected: [] },
      severityRoutingRules: { critical: ["management_escalation"] },
    });

    monitor.recordEvent("replay_attack_detected", "critical", "unit-test", "management missing", {});
    await new Promise((resolve) => setTimeout(resolve, 5));

    const metrics = monitor.getAlertDeliveryMetrics();
    expect(metrics.management_escalation.skipped_missing_config).toBe(1);
    expect(monitor.getFallbackQueue().some((entry) => entry.channel === "management_escalation")).toBe(true);
  });
});

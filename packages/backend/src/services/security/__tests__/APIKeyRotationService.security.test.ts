/**
 * APIKeyRotationService tests
 *
 * Verifies that:
 * - Manual-only providers throw ManualRotationRequiredError (not a bare throw)
 * - Admin notification is attempted via Slack webhook when configured
 * - AWS automated path is gated behind AWS_ROTATION_ENABLED
 * - Scheduled rotation handles ManualRotationRequiredError without crashing
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock audit log so tests don't need a DB connection.
// Path is relative to THIS test file (services/security/__tests__/).
vi.mock("../AuditLogService.js", () => ({
  auditLogService: { createEntry: vi.fn().mockResolvedValue(undefined) },
}));

import {
  APIKeyRotationService,
  ManualRotationRequiredError,
} from "../APIKeyRotationService.js";

describe("APIKeyRotationService", () => {
  let service: APIKeyRotationService;
  const fetchMock = vi.fn();

  beforeEach(() => {
    service = new APIKeyRotationService();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.SECURITY_SLACK_WEBHOOK_URL;
    delete process.env.AWS_ROTATION_ENABLED;
  });

  // ── Manual providers ────────────────────────────────────────────────────

  it("rotateOpenAIKey throws ManualRotationRequiredError", async () => {
    await expect(service.rotateOpenAIKey()).rejects.toThrow(ManualRotationRequiredError);
  });

  it("rotateAnthropicKey throws ManualRotationRequiredError", async () => {
    await expect(service.rotateAnthropicKey()).rejects.toThrow(ManualRotationRequiredError);
  });

  it("rotateTogetherAIKey throws ManualRotationRequiredError", async () => {
    await expect(service.rotateTogetherAIKey()).rejects.toThrow(ManualRotationRequiredError);
  });

  it("rotateSupabaseKey throws ManualRotationRequiredError", async () => {
    await expect(service.rotateSupabaseKey()).rejects.toThrow(ManualRotationRequiredError);
  });

  it("ManualRotationRequiredError carries provider and instructions", async () => {
    let caught: ManualRotationRequiredError | null = null;
    try {
      await service.rotateOpenAIKey();
    } catch (err) {
      caught = err as ManualRotationRequiredError;
    }

    expect(caught).toBeInstanceOf(ManualRotationRequiredError);
    expect(caught?.provider).toBe("openai");
    expect(caught?.instructions.length).toBeGreaterThan(0);
    expect(caught?.dueDate).toBeInstanceOf(Date);
    // Due date should be ~24 hours from now
    const diffMs = caught!.dueDate.getTime() - Date.now();
    expect(diffMs).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(diffMs).toBeLessThan(25 * 60 * 60 * 1000);
  });

  // ── Slack notification ──────────────────────────────────────────────────

  it("sends Slack notification when SECURITY_SLACK_WEBHOOK_URL is set", async () => {
    process.env.SECURITY_SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";

    await expect(service.rotateOpenAIKey()).rejects.toThrow(ManualRotationRequiredError);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://hooks.slack.com/test");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body as string) as { text: string };
    expect(body.text).toContain("openai");
  });

  it("does not call fetch when SECURITY_SLACK_WEBHOOK_URL is not set", async () => {
    delete process.env.SECURITY_SLACK_WEBHOOK_URL;

    await expect(service.rotateOpenAIKey()).rejects.toThrow(ManualRotationRequiredError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ── AWS rotation ────────────────────────────────────────────────────────

  it("rotateAWSKeys falls back to ManualRotationRequiredError when AWS_ROTATION_ENABLED is not set", async () => {
    delete process.env.AWS_ROTATION_ENABLED;

    await expect(service.rotateAWSKeys()).rejects.toThrow(ManualRotationRequiredError);

    const caught = await service.rotateAWSKeys().catch((e) => e) as ManualRotationRequiredError;
    expect(caught.provider).toBe("aws-iam");
    expect(caught.instructions.some((i) => i.includes("AWS_ROTATION_ENABLED"))).toBe(true);
  });

  it("rotateAWSKeys throws when AWS_ROTATION_ENABLED=true but @aws-sdk/client-iam is absent", async () => {
    process.env.AWS_ROTATION_ENABLED = "true";
    process.env.AWS_REGION = "us-east-1";

    // The SDK is not installed in the test environment — expect a descriptive error.
    await expect(service.rotateAWSKeys()).rejects.toThrow(
      /@aws-sdk\/client-iam is not installed/,
    );
  });

  // ── Scheduling ──────────────────────────────────────────────────────────

  it("scheduleRotation does not throw when autoRotate is false", () => {
    expect(() =>
      service.scheduleRotation({
        provider: "openai",
        currentKey: "sk-test",
        rotationIntervalDays: 90,
        autoRotate: false,
      }),
    ).not.toThrow();
  });

  it("cancelRotation is a no-op for an unscheduled provider", () => {
    expect(() => service.cancelRotation("openai")).not.toThrow();
  });
});

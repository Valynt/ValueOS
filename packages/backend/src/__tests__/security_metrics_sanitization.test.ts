import { beforeEach, describe, expect, it } from "vitest";

import { SecurityEvent, SecurityMetricsCollector } from "../security/enhancedSecurityLogger";

describe("SecurityMetricsCollector", () => {
  beforeEach(() => {
    SecurityMetricsCollector.getInstance().reset();
  });

  it("should sanitize sensitive metadata before storing", () => {
    const sensitiveEvent: SecurityEvent = {
      type: "AUTH_FAILURE",
      category: "authentication",
      severity: "medium",
      outcome: "blocked",
      reason: "Bad password",
      metadata: {
        password: "s3cretPassword!",
        nested: {
          apiKey: "sk_live_12345",
        },
      },
    };

    SecurityMetricsCollector.getInstance().recordEvent(sensitiveEvent);

    const events = SecurityMetricsCollector.getInstance().getRecentEvents();
    const storedEvent = events[0];

    // This assertion should FAIL currently, and PASS after fix
    expect(storedEvent.metadata?.password).toBe("[REDACTED]");
    expect((storedEvent.metadata?.nested as any).apiKey).toBe("[REDACTED]");
  });
});

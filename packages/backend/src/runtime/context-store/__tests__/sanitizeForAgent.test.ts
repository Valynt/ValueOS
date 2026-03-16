import { describe, expect, it } from "vitest";

import { sanitizeForAgent } from "../sanitizeForAgent.js";

describe("sanitizeForAgent (MEM-03)", () => {
  it("passes through non-PII fields unchanged", () => {
    const ctx = { organization_id: "org-1", case_id: "case-1", roi: 35 };
    expect(sanitizeForAgent(ctx)).toEqual(ctx);
  });

  it("redacts fields tagged with _meta: { pii: true }", () => {
    const ctx = {
      customer_name: "Alice Smith",
      customer_name_meta: { pii: true },
      roi: 35,
    };
    const result = sanitizeForAgent(ctx);
    expect(result.customer_name).toBe("[REDACTED]");
    expect(result.roi).toBe(35);
    expect(result.customer_name_meta).toBeUndefined();
  });

  it("redacts fields tagged with _meta: { secret: true }", () => {
    const ctx = {
      crm_token: "sk-live-abc123",
      crm_token_meta: { secret: true },
    };
    const result = sanitizeForAgent(ctx);
    expect(result.crm_token).toBe("[REDACTED]");
  });

  it("redacts known PII field names without explicit tagging", () => {
    const ctx = {
      ssn: "123-45-6789",
      date_of_birth: "1990-01-15",
      email: "user@example.com",
      phone_number: "555-867-5309",
    };
    const result = sanitizeForAgent(ctx);
    expect(result.ssn).toBe("[REDACTED]");
    expect(result.date_of_birth).toBe("[REDACTED]");
    expect(result.email).toBe("[REDACTED]");
    expect(result.phone_number).toBe("[REDACTED]");
  });

  it("redacts known secret field names without explicit tagging", () => {
    const ctx = {
      password: "hunter2",
      api_key: "sk-abc123",
      access_token: "tok-xyz",
    };
    const result = sanitizeForAgent(ctx);
    expect(result.password).toBe("[REDACTED]");
    expect(result.api_key).toBe("[REDACTED]");
    expect(result.access_token).toBe("[REDACTED]");
  });

  it("recursively sanitizes nested objects", () => {
    const ctx = {
      stakeholder: {
        name: "Bob",
        ssn: "987-65-4321",
        role: "CFO",
      },
    };
    const result = sanitizeForAgent(ctx);
    const stakeholder = result.stakeholder as Record<string, unknown>;
    expect(stakeholder.ssn).toBe("[REDACTED]");
    expect(stakeholder.name).toBe("Bob");
    expect(stakeholder.role).toBe("CFO");
  });

  it("does not forward _meta keys to output", () => {
    const ctx = {
      value: "safe",
      value_meta: { pii: false },
    };
    const result = sanitizeForAgent(ctx);
    expect(result.value).toBe("safe");
    expect("value_meta" in result).toBe(false);
  });

  it("passes arrays through without inspecting elements", () => {
    const ctx = { milestones: ["Q1", "Q2", "Q3"] };
    const result = sanitizeForAgent(ctx);
    expect(result.milestones).toEqual(["Q1", "Q2", "Q3"]);
  });
});

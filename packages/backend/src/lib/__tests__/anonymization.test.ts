import { describe, expect, it } from "vitest";

import {
  anonymizeNonProductionData,
  buildAnonymizedMetadata,
  buildDeletedPlaceholderEmail,
} from "../anonymization.js";

describe("non-production anonymization helpers", () => {
  it("creates deterministic placeholder emails", () => {
    expect(buildDeletedPlaceholderEmail("person@example.com")).toMatch(
      /^deleted\+[a-f0-9]{16}@redacted\.local$/,
    );
    expect(buildDeletedPlaceholderEmail("person@example.com")).toBe(
      buildDeletedPlaceholderEmail("person@example.com"),
    );
  });

  it("merges anonymization metadata", () => {
    expect(buildAnonymizedMetadata({ imported_from: "snapshot" }, "2026-03-19T00:00:00.000Z")).toEqual({
      imported_from: "snapshot",
      anonymized: true,
      anonymized_at: "2026-03-19T00:00:00.000Z",
      source: "non-prod-anonymization-pipeline",
    });
  });

  it("scrubs common PII-bearing fields for non-production datasets", () => {
    const result = anonymizeNonProductionData({
      id: "user-1",
      email: "customer@example.com",
      full_name: "Customer One",
      description: "Primary customer record",
      phone: "555-123-4567",
      metadata: {
        imported_from: "prod-snapshot-2026-03-18",
      },
      nested: {
        owner_email: "owner@example.com",
        api_token: "secret-token",
      },
    }, "2026-03-19T00:00:00.000Z");

    expect(result).toEqual({
      id: "user-1",
      email: expect.stringMatching(/^deleted\+[a-f0-9]{16}@redacted\.local$/),
      full_name: null,
      description: "[redacted]",
      phone: null,
      metadata: {
        imported_from: "prod-snapshot-2026-03-18",
        anonymized: true,
        anonymized_at: "2026-03-19T00:00:00.000Z",
        source: "non-prod-anonymization-pipeline",
      },
      nested: {
        owner_email: expect.stringMatching(/^deleted\+[a-f0-9]{16}@redacted\.local$/),
        api_token: "[REDACTED]",
      },
    });
  });
});

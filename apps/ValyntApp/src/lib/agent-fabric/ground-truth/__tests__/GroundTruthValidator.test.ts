import { describe, it, expect } from "vitest";
import {
  validateGroundTruthMetadata,
  assertHighConfidence,
  assertProvenance,
} from "../ground-truth/GroundTruthValidator";

const validMetadata = {
  provenance: {
    filing_type: "10-Q",
    accession_number: "0000320193-24-000010",
    source_tier: 1,
  },
  confidence: 0.97,
  cache_hit: true,
};

describe("GroundTruthValidator", () => {
  it("validates correct metadata", () => {
    expect(() => validateGroundTruthMetadata(validMetadata)).not.toThrow();
  });

  it("throws on low confidence", () => {
    const low = { ...validMetadata, confidence: 0.5 };
    expect(() => assertHighConfidence(low, 0.9)).toThrow();
  });

  it("throws on missing provenance", () => {
    const missing = {
      ...validMetadata,
      provenance: { filing_type: "", accession_number: "", source_tier: 1 },
    };
    expect(() => assertProvenance(missing)).toThrow();
  });
});

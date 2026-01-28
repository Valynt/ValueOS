import { describe, it, expect } from "vitest";
import {
  validateGroundTruthMetadata,
  assertHighConfidence,
  assertProvenance,
} from "../GroundTruthValidator";

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

  it("throws on partial provenance (missing accession_number)", () => {
    const partial = {
      ...validMetadata,
      provenance: { filing_type: "10-Q", accession_number: "", source_tier: 1 },
    };
    expect(() => assertProvenance(partial)).toThrow();
  });

  it("throws on missing confidence field", () => {
    const missing = { ...validMetadata };
    // @ts-expect-error
    delete missing.confidence;
    expect(() => validateGroundTruthMetadata(missing)).toThrow();
  });

  it("accepts and parses cache_hit field", () => {
    const withCache = { ...validMetadata, cache_hit: true };
    expect(() => validateGroundTruthMetadata(withCache)).not.toThrow();
    expect(validateGroundTruthMetadata(withCache).cache_hit).toBe(true);
  });

  it("throws on staleness: low confidence and cache_hit", () => {
    const stale = { ...validMetadata, confidence: 0.4, cache_hit: true };
    expect(() => assertHighConfidence(stale, 0.9)).toThrow();
  });

  it("throws on missing provenance object", () => {
    const missing = { ...validMetadata };
    // @ts-expect-error
    delete missing.provenance;
    expect(() => validateGroundTruthMetadata(missing)).toThrow();
  });
});

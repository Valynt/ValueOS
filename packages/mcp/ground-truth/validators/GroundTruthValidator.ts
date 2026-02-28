// GroundTruthValidator: Enforces schema and provenance/confidence checks for MCP ground truth responses

import { logger } from "@backend/lib/logger.js";
import { z } from "zod";

// Schema for ground truth metadata
export const GroundTruthMetadataSchema = z.object({
  provenance: z.object({
    filing_type: z.string(),
    accession_number: z.string(),
    source_tier: z.number().int(),
  }),
  confidence: z.number().min(0).max(1),
  cache_hit: z.boolean().optional(),
});

export type GroundTruthMetadata = z.infer<typeof GroundTruthMetadataSchema>;

// Validate the metadata schema
export function validateGroundTruthMetadata(metadata: unknown): GroundTruthMetadata {
  try {
    return GroundTruthMetadataSchema.parse(metadata);
  } catch (err) {
    logger.error("GroundTruthValidator: Metadata schema validation failed", {
      error: err instanceof Error ? err.message : err,
      metadata,
    });
    // Optionally, trigger alerting here
    throw err;
  }
}

// Assert confidence is above threshold
export function assertHighConfidence(metadata: GroundTruthMetadata, minConfidence = 0.9) {
  if (metadata.confidence < minConfidence) {
    logger.warn("GroundTruthValidator: Low confidence detected", {
      confidence: metadata.confidence,
      minConfidence,
      provenance: metadata.provenance,
    });
    // Optionally, trigger alerting here
    throw new Error(`Ground truth confidence too low: ${metadata.confidence}`);
  }
}

// Assert provenance fields are present
export function assertProvenance(metadata: GroundTruthMetadata) {
  if (!metadata.provenance?.filing_type || !metadata.provenance?.accession_number) {
    logger.error("GroundTruthValidator: Missing provenance fields", {
      provenance: metadata.provenance,
      metadata,
    });
    // Optionally, trigger alerting here
    throw new Error("Missing provenance fields in ground truth metadata");
  }
}

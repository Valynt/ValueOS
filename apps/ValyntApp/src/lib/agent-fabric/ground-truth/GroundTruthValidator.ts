// GroundTruthValidator: Enforces schema and provenance/confidence checks for MCP ground truth responses
import { z } from "zod";

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

export function validateGroundTruthMetadata(metadata: unknown): GroundTruthMetadata {
  return GroundTruthMetadataSchema.parse(metadata);
}

export function assertHighConfidence(metadata: GroundTruthMetadata, minConfidence = 0.9) {
  if (metadata.confidence < minConfidence) {
    throw new Error(`Ground truth confidence too low: ${metadata.confidence}`);
  }
}

export function assertProvenance(metadata: GroundTruthMetadata) {
  if (!metadata.provenance?.filing_type || !metadata.provenance?.accession_number) {
    throw new Error("Missing provenance fields in ground truth metadata");
  }
}

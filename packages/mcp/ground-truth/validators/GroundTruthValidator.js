"use strict";
// GroundTruthValidator: Enforces schema and provenance/confidence checks for MCP ground truth responses
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroundTruthMetadataSchema = void 0;
exports.validateGroundTruthMetadata = validateGroundTruthMetadata;
exports.assertHighConfidence = assertHighConfidence;
exports.assertProvenance = assertProvenance;
const zod_1 = require("zod");
const logger_js_1 = require("@backend/lib/logger.js");
// Schema for ground truth metadata
exports.GroundTruthMetadataSchema = zod_1.z.object({
    provenance: zod_1.z.object({
        filing_type: zod_1.z.string(),
        accession_number: zod_1.z.string(),
        source_tier: zod_1.z.number().int(),
    }),
    confidence: zod_1.z.number().min(0).max(1),
    cache_hit: zod_1.z.boolean().optional(),
});
// Validate the metadata schema
function validateGroundTruthMetadata(metadata) {
    try {
        return exports.GroundTruthMetadataSchema.parse(metadata);
    }
    catch (err) {
        logger_js_1.logger.error("GroundTruthValidator: Metadata schema validation failed", {
            error: err instanceof Error ? err.message : err,
            metadata,
        });
        // Optionally, trigger alerting here
        throw err;
    }
}
// Assert confidence is above threshold
function assertHighConfidence(metadata, minConfidence = 0.9) {
    if (metadata.confidence < minConfidence) {
        logger_js_1.logger.warn("GroundTruthValidator: Low confidence detected", {
            confidence: metadata.confidence,
            minConfidence,
            provenance: metadata.provenance,
        });
        // Optionally, trigger alerting here
        throw new Error(`Ground truth confidence too low: ${metadata.confidence}`);
    }
}
// Assert provenance fields are present
function assertProvenance(metadata) {
    if (!metadata.provenance?.filing_type || !metadata.provenance?.accession_number) {
        logger_js_1.logger.error("GroundTruthValidator: Missing provenance fields", {
            provenance: metadata.provenance,
            metadata,
        });
        // Optionally, trigger alerting here
        throw new Error("Missing provenance fields in ground truth metadata");
    }
}
//# sourceMappingURL=GroundTruthValidator.js.map
/**
 * Ground Truth Services Index
 *
 * Central export point for all ground truth integration services.
 *
 * Reference: openspec/changes/ground-truth-integration/design.md
 */

// SEC EDGAR Client
export {
  SECEdgarClient,
  SECFilingSchema,
  FilingContentSchema,
  type SECFiling,
  type FilingContent,
} from "./SECEdgarClient.js";

// XBRL Parser
export {
  XBRLParser,
  XBRLFactSchema,
  FinancialMetricsSchema,
  type XBRLFact,
  type FinancialMetrics,
} from "./XBRLParser.js";

// Benchmark Retrieval Service
export {
  BenchmarkRetrievalService,
  benchmarkRetrievalService,
  BenchmarkSchema,
  BenchmarkDistributionSchema,
  BenchmarkQuerySchema,
  type Benchmark,
  type BenchmarkDistribution,
  type BenchmarkQuery,
} from "./BenchmarkRetrievalService.js";

// Claim Verification Service
export {
  ClaimVerificationService,
  claimVerificationService,
  VerificationStatusSchema,
  VerificationSeveritySchema,
  VerificationResultSchema,
  type VerificationStatus,
  type VerificationSeverity,
  type VerificationResult,
  type Claim,
} from "./ClaimVerificationService.js";

// Feasibility Assessor
export {
  FeasibilityAssessor,
  feasibilityAssessor,
  FeasibilityClassificationSchema,
  FeasibilityAssessmentSchema,
  type FeasibilityClassification,
  type FeasibilityAssessment,
  type FeasibilityInput,
} from "./FeasibilityAssessor.js";

// Chunk and Embed Pipeline
export {
  ChunkEmbedPipeline,
  chunkEmbedPipeline,
  ChunkSchema,
  ChunkMetadataSchema,
  type Chunk,
  type ChunkMetadata,
  type ChunkConfig,
  type PipelineInput,
} from "./ChunkEmbedPipeline.js";

// Ground Truth Cache
export {
  GroundTruthCache,
  groundTruthCache,
  type CacheEntry,
  type CacheResult,
  type CacheTier,
} from "./GroundTruthCache.js";

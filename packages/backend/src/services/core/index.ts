// @valueos/backend/src/services/core — canonical service implementations
//
// Merged from @valueos/core-services in Sprint 43.
// These services are now part of the backend package.

export { securityLogger, configureSecurityLogger } from './SecurityLogger.js';
export type { SecurityEvent, SecurityLoggerBackend } from './SecurityLogger.js';

export { featureFlags, FeatureFlagsService } from './FeatureFlags.js';
export type { FeatureFlag, FeatureFlagEvaluation } from './FeatureFlags.js';

export { llmCache, initializeLLMCache, LLMCache } from './LLMCache.js';
export type { CacheConfig, LLMCacheEntry } from './LLMCache.js';

export { crmFieldMapper } from './CRMFieldMapper.js';
export type { CRMProvider, CRMDeal, CRMContact, MappedValueCase, MappedStakeholder } from './CRMFieldMapper.js';

export { layoutEngine } from './LayoutEngine.js';
export type { LayoutSuggestion, AlignmentInfo } from './LayoutEngine.js';

export { undoRedoManager } from './UndoRedoManager.js';
export type { HistoryState } from './UndoRedoManager.js';

export { suggestionEngine } from './SuggestionEngine.js';
export type { SuggestionContext } from './SuggestionEngine.js';

export { BenchmarkService } from './BenchmarkService.js';
export type { Benchmark, BenchmarkComparison, BenchmarkImportResult } from './BenchmarkService.js';

export type { CanvasComponent, Suggestion } from './CanvasTypes.js';

export { EntityGraph, EntityGraphError } from './EntityGraph.js';
export type {
  EntityNode,
  EntityNodeType,
  GraphEdge,
  EdgeType,
  PropagationType,
  KpiDependency,
  PropagationResult,
  CycleDetectionResult,
  EntityGraphStore,
} from './EntityGraph.js';
export { KpiDependencySchema, EntityGraphEdgeSchema } from './EntityGraph.js';

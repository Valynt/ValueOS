/**
 * Services Index
 *
 * Re-exports all service domains. Import from domain subdirectories for
 * better tree-shaking; use this barrel for backward compatibility.
 *
 * Domain layout (Phase 7 reorganization):
 *   agents/     — Agent invocation, routing, memory integration
 *   auth/       — Authentication, sessions, permissions, RBAC
 *   tenant/     — Tenant provisioning, isolation, membership
 *   workflow/   — Workflow state machine, saga, compensation
 *   security/   — Security middleware, audit, compliance
 *   llm/        — LLM fallback, cost tracking, model services
 *   billing/    — Metrics, usage persistence, alerting
 *   realtime/   — WebSocket, presence, message bus, events
 *   sdui/       — Canvas schema, SDUI cache, UI generation
 *   crm/        — CRM integration and OAuth
 *   memory/     — Memory pipeline, narrative engine
 *   post-v1/    — Deferred services (not imported at startup)
 */

// Base infrastructure
export * from "./errors.js";
export * from "./utils/BaseService.js";
export * from "./types.js";

// Domain barrels
export * from "./agents/index.js";
export * from "./auth/index.js";
export * from "./tenant/index.js";
export * from "./workflow/index.js";
export * from "./security/index.js";
export * from "./llm/index.js";
export * from "./billing/index.js";
export * from "./realtime/index.js";
export * from "./sdui/index.js";
export * from "./crm/index.js";

// Flat V1 services (not yet grouped)
export * from "./agent-types.js";
export * from "./agents/resilience/CircuitBreaker.js";
export * from "./agents/resilience/CircuitBreakerManager.js";
export * from "./CircuitBreakerManager.categorized.js";
export * from "./cache/ReadThroughCacheService.js";
export * from "./memory/SemanticMemory.js";
export * from "./tools/ToolRegistry.js";
export * from "./value/UnifiedAgentAPI.js";
export * from "./value/ValueKernel.js";
export * from "./value/ValueCaseService.js";
export * from "./value/ValueFabricService.js";
export * from "./value/ValueTreeWriteService.js";
export * from "./value/ValueMetricsTracker.js";
export * from "./value/ValuePredictionTracker.js";
export * from "./value/AssumptionService.js";
export * from "./value/HypothesisOutputService.js";
export * from "./reasoning/CalculationEngine.js";
export * from "./reasoning/ROIFormulaInterpreter.js";
export * from "./reasoning/CausalTruthService.js";
export * from "./reasoning/StructuralTruthModule.js";
export * from "./domain-packs/GroundTruthIntegrationService.js";
export * from "./domain-packs/GroundTruthMetrics.js";
export * from "./domain-packs/GroundtruthAPI.js";
export * from "./domain-packs/MCPGroundTruthService.js";
export * from "./domain-packs/MCPTools.js";
export * from "./reasoning/ConfidenceMonitor.js";
export * from "./reasoning/ContextOptimizer.js";
export * from "./value/ConversationHistoryService.js";
export * from "./domain-packs/DocumentParserService.js";
export * from "./messaging/EmailService.js";
export * from "./workflow/HumanCheckpointService.js";
export * from "./crm/IntegrationConnectionService.js";
export * from "./crm/IntegrationControlService.js";
export * from "./sdui/IntentRegistry.js";
export * from "./export/PdfExportService.js";
export * from "./workflow/PersistenceService.js";
export * from "./agents/resilience/RetryService.js";
export * from "./memory/VectorSearchService.js";
export * from "./auth/VersionHistoryService.js";
export * from "./workflow/WorkspaceStateService.js";
export * from "./agents/SandboxedExecutor.js";
export * from "./value/CaseValueTreeService.js";
export * from "./monitoring/DemoAnalyticsService.js";
export * from "./kafkaConfig.js";

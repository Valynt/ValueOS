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
export * from "./BaseService.js";
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
export * from "./CircuitBreaker.js";
export * from "./CircuitBreakerManager.js";
export * from "./CircuitBreakerManager.categorized.js";
export * from "./ReadThroughCacheService.js";
export * from "./SemanticMemory.js";
export * from "./ToolRegistry.js";
export * from "./UnifiedAgentAPI.js";
export * from "./ValueKernel.js";
export * from "./ValueCaseService.js";
export * from "./ValueFabricService.js";
export * from "./ValueTreeService.js";
export * from "./ValueMetricsTracker.js";
export * from "./ValuePredictionTracker.js";
export * from "./AssumptionService.js";
export * from "./HypothesisOutputService.js";
export * from "./CalculationEngine.js";
export * from "./ROIFormulaInterpreter.js";
export * from "./CausalTruthService.js";
export * from "./StructuralTruthModule.js";
export * from "./GroundTruthIntegrationService.js";
export * from "./GroundTruthMetrics.js";
export * from "./GroundtruthAPI.js";
export * from "./MCPGroundTruthService.js";
export * from "./MCPTools.js";
export * from "./ConfidenceMonitor.js";
export * from "./ContextOptimizer.js";
export * from "./ConversationHistoryService.js";
export * from "./DocumentParserService.js";
export * from "./EmailService.js";
export * from "./HumanCheckpointService.js";
export * from "./IntegrationConnectionService.js";
export * from "./IntegrationControlService.js";
export * from "./IntentRegistry.js";
export * from "./PdfExportService.js";
export * from "./PersistenceService.js";
export * from "./RetryService.js";
export * from "./VectorSearchService.js";
export * from "./VersionHistoryService.js";
export * from "./WorkspaceStateService.js";
export * from "./CaseValueTreeService.js";
export * from "./DemoAnalyticsService.js";
export * from "./kafkaConfig.js";

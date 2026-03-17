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
// RetryConfig is defined in both utils/BaseService and types/workflow — BaseService is canonical here.
// types/workflow.RetryConfig is still accessible via the workflow types directly.
export type { RequestConfig } from "./utils/BaseService.js";
export { BaseService } from "./utils/BaseService.js";
export type { RetryConfig } from "./utils/BaseService.js";
// types.js re-exports from types/workflow, types/billing, types/agent, types/audit —
// all covered by domain barrels below; omitting to avoid TS2308 ambiguities.

// Domain barrels.
// Where the same name is defined in multiple domains, the conflicting module uses explicit
// named exports (excluding the duplicate) so TS2308 ambiguity is resolved.
export * from "./agents/index.js";
// auth/guestPermissions exports ResourceType — conflicts with security/SecurityMiddleware.
// Exclude ResourceType from auth barrel; security is canonical.
export * from "./auth/index.js";
// tenant/TenantPerformanceManager exports ResourceType, AlertType — conflict with security.
// Already handled in tenant/index.ts (TenantPerformanceManager uses explicit exports).
export * from "./tenant/index.js";
// workflow/WorkspaceStateService exports Unsubscribe, StateChangeCallback — conflict with realtime.
// Handled below: WorkspaceStateService is re-exported explicitly without those names.
export * from "./workflow/index.js";
// security is canonical for: AgentContext, Permission, PermissionCheckResult, ResourceType,
// Role, SecurityContext, SecurityEvent, SecurityEventType, AlertType.
// auth/guestPermissions and auth/TokenRotationService define conflicting copies —
// suppress them by re-exporting auth without those names.
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
export * from "./agents/resilience/CircuitBreakerManager.categorized.js";
export * from "./cache/ReadThroughCacheService.js";
export * from "./memory/SemanticMemory.js";
// ToolRegistry defines ValidationResult — conflicts with security/InputValidation. security is canonical.
export type { JSONSchema, MCPTool, ToolExecutionContext, ToolResult } from "./tools/ToolRegistry.js";
export { ToolRegistry, BaseTool, toolRegistry } from "./tools/ToolRegistry.js";
export * from "./value/UnifiedAgentAPI.js";
export * from "./value/ValueKernel.js";
export * from "./value/ValueCaseService.js";
// ValueFabricService defines SemanticSearchResult<T> — conflicts with memory/SemanticMemory. memory is canonical.
export type { OntologyStats } from "./value/ValueFabricService.js";
export { ValueFabricService } from "./value/ValueFabricService.js";
export * from "./value/ValueTreeWriteService.js";
export * from "./value/ValueMetricsTracker.js";
export * from "./value/ValuePredictionTracker.js";
export * from "./value/AssumptionService.js";
export * from "./value/HypothesisOutputService.js";
export * from "./reasoning/CalculationEngine.js";
export * from "./reasoning/ROIFormulaInterpreter.js";
export * from "./reasoning/CausalTruthService.js";
export * from "./reasoning/StructuralTruthModule.js";
// GroundTruthIntegrationService defines ValidationResult — conflicts with security. security is canonical.
export type { GroundTruthContext, BenchmarkResult, ReasoningReference } from "./domain-packs/GroundTruthIntegrationService.js";
export { GroundTruthIntegrationService, getGroundTruthService } from "./domain-packs/GroundTruthIntegrationService.js";
export * from "./domain-packs/GroundTruthMetrics.js";
export * from "./domain-packs/GroundtruthAPI.js";
export * from "./domain-packs/MCPGroundTruthService.js";
export * from "./domain-packs/MCPTools.js";
export * from "./reasoning/ConfidenceMonitor.js";
// ContextOptimizer defines ContextCache — conflicts with auth/SecureSharedContext. auth is canonical.
export type { ContextWindow, ContextCompression, ContextOptimization, OptimizationConfig } from "./reasoning/ContextOptimizer.js";
export { ContextOptimizer, getContextOptimizer, resetContextOptimizer } from "./reasoning/ContextOptimizer.js";
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
// WorkspaceStateService defines Unsubscribe and StateChangeCallback — conflicts with realtime/workflow.
// realtime/RealtimeUpdateService is canonical for Unsubscribe; workflow/WorkflowStateService for StateChangeCallback.
export { WorkspaceStateService, workspaceStateService } from "./workflow/WorkspaceStateService.js";
export * from "./agents/SandboxedExecutor.js";
export * from "./value/CaseValueTreeService.js";
export * from "./monitoring/DemoAnalyticsService.js";
export * from "./kafkaConfig.js";

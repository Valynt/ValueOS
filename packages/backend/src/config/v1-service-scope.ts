/**
 * v1 Service Scope
 *
 * Categorizes backend services as v1 (required for launch) or post-v1
 * (deferred). Post-v1 services should not be imported at startup unless
 * their feature flag is explicitly enabled.
 *
 * Usage:
 *   import { isV1Service, isServiceEnabled } from '../config/v1-service-scope.js';
 *   if (!isServiceEnabled('ChaosEngineering')) return;
 */

/**
 * Services required for v1 launch. Everything not listed here is post-v1.
 */
export const V1_SERVICES = new Set([
  // Core auth & identity
  "AuthService",
  "AuthDirectoryService",
  "AuthPolicy",
  "MFAService",
  "TokenRotationService",
  "TrustedDeviceService",
  "SessionManager",
  "SessionTimeoutService",
  "PermissionService",
  "RbacService",
  "AdminUserService",
  "AdminRoleService",

  // Tenant management
  "TenantProvisioning",
  "TenantContextResolver",
  "TenantIsolationService",
  "TenantMembershipService",
  "TenantAwareService",

  // Agent fabric (core loop)
  "AgentAPI",
  "UnifiedAgentAPI",
  "AgentRegistry",
  "AgentFabricService",
  "AgentExecutorService",
  "AgentMemoryIntegration",
  "AgentMemoryService",
  "AgentAuditLogger",
  "AgentStateStore",
  "AgentChatService",
  "AgentInitializer",
  "AgentIntentConverter",
  "AgentQueryService",
  "AgentRoutingLayer",
  "AgentRoutingScorer",
  "AgentOutputListener",
  "AgentMessageBroker",
  "AgentMessageQueue",
  "AgentOrchestratorAdapter",
  "AgentSDUIAdapter",
  "UnifiedAgentOrchestrator",

  // Workflow engine
  "WorkflowStateMachine",
  "WorkflowStateService",
  "WorkflowExecutionStore",
  "WorkflowCompensation",
  "WorkflowEventListener",
  "WorkflowLifecycleIntegration",
  "WorkflowSDUIAdapter",
  "SagaCoordinator",
  "LifecycleCompensationHandlers",

  // LLM infrastructure
  "LLMCache",
  "LLMCostTracker",
  "LLMFallback",
  "LLMFallbackWithTracing",
  "LLMSanitizer",
  "FallbackAIService",
  "GeminiProxyService",
  "LlmProxyClient",

  // Value lifecycle (core product)
  "ValueCaseService",
  "ValueFabricService",
  "ValueKernel",
  "ValueLifecycleOrchestrator",
  "ValueMetricsTracker",
  "ValuePredictionTracker",
  "ValueTreeService",
  "ROIFormulaInterpreter",
  "FinancialCalculator",
  "CalculationEngine",
  "AssumptionService",

  // Security (required)
  "AuditLogService",
  "SecurityLogger",
  "SecurityMiddleware",
  "SecurityEnforcementService",
  "InputValidation",
  "CircuitBreaker",
  "CircuitBreakerManager",
  "CacheService",
  "RetryService",

  // Infrastructure
  "MessageBus",
  "MessageQueue",
  "EventConsumer",
  "EventProducer",
  "FeatureFlags",
  "SettingsService",
  "UserSettingsService",
  "UserProfileDirectoryService",
  "EmailService",
  "PersistenceService",
  "BaseService",
  "DependencyInjectionContainer",
  "ServiceRegistration",

  // Billing (core)
  "billing",

  // Realtime
  "RealtimeBroadcastService",
  "RealtimeUpdateService",
  "WebSocketBroadcastAdapter",
  "WebSocketManager",
  "PresenceService",

  // SDUI
  "LayoutEngine",
  "SDUISandboxService",
  "UIGenerationTracker",
  "UIRefinementLoop",
  "ComponentMutationService",
  "CanvasSchemaService",

  // Integrations (core)
  "IntegrationConnectionService",
  "IntegrationControlService",
  "CRMIntegrationService",
  "CRMFieldMapper",
  "CRMOAuthService",

  // Ground truth
  "GroundTruthIntegrationService",
  "GroundTruthMetrics",
  "GroundtruthAPI",
  "MCPGroundTruthService",
  "MCPTools",
  "StructuralTruthModule",
  "CausalTruthService",

  // Misc required
  "ActionRouter",
  "IntentRegistry",
  "ConfidenceMonitor",
  "ContextOptimizer",
  "ConversationHistoryService",
  "DocumentParserService",
  "HumanCheckpointService",
  "MetricsCollector",
  "SecureSharedContext",
  "ToolRegistry",
  "VectorSearchService",
  "SemanticMemory",
  "VersionHistoryService",
  "WorkspaceStateService",
  "UndoRedoManager",
  "TemplateLibrary",
  "SuggestionEngine",
  "ModelService",
  "ModelCardService",
  "CustomerAccessService",
  "GuestAccessService",
  "DemoAnalyticsService",
  "consentRegistry",
]);

/**
 * Post-v1 services. These are explicitly deferred and should be feature-flagged.
 */
export const POST_V1_SERVICES = new Set([
  "ChaosEngineering",
  "MLAnomalyDetectionService",
  "SOC2ComplianceService",
  "AdvancedThreatDetectionService",
  "DistributedAttackDetectionService",
  "NetworkSegmentation",
  "SecurityAnalyticsService",
  "SecurityAutomationService",
  "SecurityMonitoringService",
  "SecurityEventValidator",
  "SecurityAuditService",
  "CredentialStuffingDetectionService",
  "ContinuousAuthService",
  "DeviceFingerprintService",
  "WebAuthnService",
  "ComplianceValidator",
  "IntegrityAgentService",
  "IntegrityValidationService",
  "IntegrityWarningGenerator",
  "ManifestoEnforcer",
  "AdversarialValidator",
  "DynamicBaselineService",
  "SelfHealingManager",
  "ProblemMonitor",
  "OfflineEvaluation",
  "BenchmarkService",
  "PromptVersionControl",
  "ReflectionEngine",
  "RealizationFeedbackLoop",
  "IntelligentCoordinator",
  "EnhancedParallelExecutor",
  "AtomicActionExecutor",
  "BatchOperations",
  "CodeSandbox",
  "SandboxedExecutor",
  "WorkerSandbox",
  "EventSourcingService",
  "CostAwareRouter",
  "CostAwareRoutingService",
  "CostGovernanceService",
  "TelemetryGuardrailsService",
  "RateLimitEscalationService",
  "RateLimitKeyService",
  "RateLimitMetricsService",
  "RateLimitService",
  "ClientRateLimit",
  "RedisCircuitBreaker",
  "ExternalCircuitBreaker",
  "RobustConnectionManager",
  "SecretsService",
  "RotationService",
  "AcademyService",
  "ApprovalWorkflowService",
  "CallAnalysisService",
  "EmailAnalysisService",
  "WebScraperService",
  "PlaygroundAutoSave",
  "PlaygroundSessionService",
  "PlaygroundWorkflowAdapter",
  "AgentPrefetchService",
  "UsageTrackingService",
  "kafkaConfig",
]);

export function isV1Service(serviceName: string): boolean {
  return V1_SERVICES.has(serviceName);
}

/**
 * Check if a service should be enabled at runtime.
 * v1 services are always enabled. Post-v1 services require an explicit
 * env var: ENABLE_<SERVICE_NAME>=true (e.g., ENABLE_CHAOS_ENGINEERING=true).
 */
export function isServiceEnabled(serviceName: string): boolean {
  if (V1_SERVICES.has(serviceName)) return true;

  // Convert PascalCase to SCREAMING_SNAKE_CASE for env var lookup
  const envKey = `ENABLE_${serviceName
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toUpperCase()}`;

  return process.env[envKey] === "true";
}

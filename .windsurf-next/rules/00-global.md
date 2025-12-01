Global Repository Rules: Value Operating System (VOS)
1. Architecture & Design Patterns
1.1 Agent Orchestration
Pattern: Use a Directed Acyclic Graph (DAG) pattern for workflow orchestration. All agent workflows must be defined as DAGs to ensure deterministic execution paths and clear dependencies.

Hierarchical Structure: Implement the "Agent Fabric" with specialized agents (e.g., Opportunity, Target, Realization) coordinated by an Orchestrator. Agents must not bypass the Orchestrator for cross-lifecycle state changes.

Compensation Logic: Implement the Saga Pattern for distributed transactions. Every workflow stage must have a corresponding compensation handler to rollback state in reverse order upon failure.

1.2 Tool Definition & Integration
Registry Pattern: All tools must be registered in the ToolRegistry. Ad-hoc tool creation within agent logic is prohibited.

Schema Enforcement: Tools must define rigid JSON schemas for inputs and outputs using Zod. BaseAgent must validate all tool invocations against these schemas before execution.

Separation of Concerns:

Data Tools: Read-only access to internal systems (e.g., get_customer_profile).

Action Tools: Side-effect operations (e.g., send_email). These require explicit permissions defined in Local Rules.

Orchestration Tools: Meta-tools for controlling flow (e.g., delegate_to_agent). Only accessible by Coordinator agents.

1.3 Memory Management
Four-Part Memory System: Agents must utilize the standardized memory structure:

Episodic: Event stream of "what happened" (Immutable).

Semantic: Vector embeddings for "what we know" (pgvector).

Working: Current task state (Transient).

Procedural: Learned patterns for "how to do things".

Context Sharing: Cross-agent context must be passed via the ValueFabricService event bus, not direct memory access. Direct queries to another agent's working memory are forbidden to preserve isolation.

2. Agent Development Standards
2.1 Instruction & Persona
Persona Enforcement (LR-011): Agents must adhere to a strict professional persona. Forbidden patterns include first-person opinions ("I feel"), emotional language ("angry"), and meta-references ("as an AI").

Response Quality (LR-010): Responses must be substantive. Block patterns like "I don't know" or hyperbolic language ("revolutionary", "guaranteed"). If unsure, agents must explicitly flag uncertainty rather than hallucinating.

2.2 Output Validation & Security
Structured Outputs: All agent invocations must return structured JSON matching a typed schema. Raw text responses are prohibited for functional logic.

Confidence Scoring: Every output must include a multi-dimensional confidence score (0-1) calculated from Data Quality (30%), Assumption Confidence (30%), and Evidence Strength (40%).

Hallucination Detection: Agents must self-report potential hallucinations. If hallucination_check is true or confidence is < 0.5, the system must trigger a retry or human review.

2.3 Evaluation Metrics
18-Point Quality Rubric: All agent deliverables must be scored against six dimensions (Traceability, Relevance, Realism, Clarity, Actionability, Polish). A minimum score of 15/18 is required for auto-approval.

Reflection Engine: Agents must employ a reflection loop. If a quality score is below the threshold, the ReflectionEngine must iterate up to 3 times to refine the output.

3. Code Organization
3.1 Module Structure
Agent Definition Layer: Located in src/lib/agent-fabric/agents/. Each agent must extend BaseAgent and implement secureInvoke.

Service Layer: Business logic resides in src/services/. Agents must call services, not access the database directly.

Rules Configuration: Governance rules are defined declaratively in src/lib/rules/rules.config.yaml and implemented in src/lib/rules/.

3.2 Testing Frameworks
Simulation Mode: Use "Safe Simulation" principles to test agent behaviors without production side effects.

Unit Testing: Rules must be unit tested to ensure they block violations (e.g., GR-010: Tenant Isolation).

Integration Testing: Verify the full secureInvoke pipeline, including schema validation and confidence tracking.

4. Security & Governance
4.1 Global Rules (Constitution)
Systemic Safety (GR-001): Strictly block dangerous commands (e.g., DROP TABLE, rm -rf, sudo). This validation happens at the pre-execution layer.

Tenant Isolation (GR-010): Critical. Every database query and tool invocation must include tenant_id. Cross-tenant data transfer is strictly blocked.

Network Allowlist (GR-002): Agents may only communicate with explicitly allowlisted external domains.

4.2 Data Privacy
PII Protection (GR-020): Inputs and outputs must be scanned for PII (SSN, Credit Cards) before processing or logging. Redaction must occur at the edge.

Manifesto Enforcement: The Integrity Agent must validate all artifacts against the 12 VOS Manifesto principles (e.g., "Conservative Quantification") before they are committed.

4.3 Access Control
Row-Level Security (RLS): Database access must rely on PostgreSQL RLS policies. The application layer must not bypass RLS for data retrieval.

Scope of Authority (LR-001): Enforce strict Allow/Deny lists for tools per agent type (e.g., Communicator agent cannot use send_to_executives without approval).

5. Performance & Monitoring
5.1 Resource Limits
Cost Control (GR-031): Enforce session cost caps (e.g., $5 Dev / $25 Prod). Terminate sessions that exceed limits.

Execution Limits (GR-030/032): Cap reasoning loops at 10-20 steps and execution time at 30-60 seconds depending on the environment.

5.2 Observability
Audit Logging: Every agent decision, reasoning trace, and confidence score must be logged to agent_audit_log with the associated session_id.

Confidence Monitoring: Trigger alerts if average confidence scores drop below the threshold (0.7) or if high hallucination rates (>20%) are detected.

6. Development Workflow
6.1 Environment Progression
Development: Relaxed limits (Max 20 steps, $5 cost). Focus on capability exploration.

Production: Strict enforcement (Max 10 steps, $25 cost). Fail-safe defaults enabled. Errors escalate to human review immediately.

6.2 Version Control
Prompt Versioning: All system prompts and agent instructions must be version-controlled. Changes to prompt logic require a new version bump in the AgentRegistry.

Rules as Code: Policy changes (Global/Local rules) must be committed to rules.config.yaml and go through code review.

7. API & Integration Standards
7.1 Integration Patterns
Event-Driven Communication: Agents communicate via the Message Bus using specific topics (e.g., value.opportunity.created, manifesto.violation.detected).

LLM Gateway: All LLM calls must pass through the LLMGateway service to handle routing, rate limiting, and cost tracking. Direct API calls to providers are forbidden.

7.2 Error Handling
Graceful Degradation (LR-030): Define fallback behaviors for all service failures (e.g., if Calendar API fails, "notify_and_continue"). Do not crash the workflow.

Retry Policy (LR-031):

Non-retryable: 400, 401, 403, 404.

Max Retries: Dev=5, Prod=2.

Backoff: Exponential backoff with jitter.

8. Data Management
8.1 Database Standards
Schema Authority: The supabase/migrations/ directory is the single source of truth for the database schema.

Audit Trails: All core tables (value_cases, financial_models, etc.) must include created_at, updated_at, and created_by fields for full traceability.

8.2 Vector & Knowledge Management
Embeddings: Use pgvector within the agent_memory table for Semantic Memory. All knowledge ingestion must generate embeddings via the configured embedding model (default: togethercomputer/m2-bert-80M-8k-retrieval).

Prediction Tracking: Store all agent predictions in the agent_predictions table to enable accuracy analysis and retraining triggers.

9. Module-Specific Standards
9.1 AI Agent Modules (src/lib/agent-fabric/agents/* & src/agents/*)
File Structure: Each agent must be a single class in [AgentName]Agent.ts. MUST extend BaseAgent. Ad-hoc agent classes are strictly prohibited.

Location: Core infrastructure agents in src/lib/agent-fabric/agents/. Domain-specific workflow agents in src/agents/.

Prompt Engineering: All prompts must use handlebars syntax for variable injection. String concatenation for constructing prompts is FORBIDDEN. System prompts must define "Job Description" and "Constraints". Structured output via zod schemas: { thought: string, action: string, parameters: object }. BaseAgent.secureInvoke() auto-injects LLM_SECURITY_FRAMEWORK.

Execution: All LLM interactions via this.secureInvoke() ONLY. Direct instantiation of LLMGateway is PROHIBITED. Implement trimContext() for 32k/128k token limits. Use ConversationHistoryService for N=10 turn summaries. Implement ConfidenceThresholds: if confidence_score < 0.7 → self-correct or flag.

Testing: 100% coverage of execute() paths. Mock LLMGateway and MemorySystem. Live API calls in CI are BLOCKED. Each agent needs [AgentName].benchmark.test.ts against 18-point Quality Rubric.

9.2 Tool Libraries (src/tools/* & src/services/tools/*)
Interface Contract: All tools must implement Tool<TInput, TOutput> with name, description (with usage examples), schema (z.ZodType), and execute(input, context) method.

Registration: Tools must be registered in ToolRegistry.ts. Dynamic/runtime tool creation is DISALLOWED for security auditing.

Execution Safety: Action tools must be idempotent where possible. Check LocalRules (LR-001) before execution. Throw PermissionDeniedError if agent lacks authority. External API tools MUST implement RateLimiter middleware.

9.3 Orchestration Layer (src/services/WorkflowOrchestrator.ts & src/lib/orchestration/*)
Architecture: Workflows must be modeled as DAGs using WorkflowDAGDefinitions.ts. Cycles are FORBIDDEN. Hierarchical (default): OrchestratorAgent delegates to sub-agents. Diamond: Mandatory Synthesis node.

Routing: Static routing PREFERRED (defined in dags.ts). Dynamic routing ONLY via AgentRoutingLayer + AgentRoutingScorer.

Resilience: Saga Pattern - every state mutation needs compensation function in WorkflowCompensation.ts. Circuit breaker: 5 failures, 60s reset. Persist WorkflowState to Supabase after EVERY node transition.

9.4 Memory Management (src/lib/agent-fabric/MemorySystem.ts)
Vector Operations: All Semantic Memory insertions via togethercomputer/m2-bert-80M-8k-retrieval. CRITICAL SECURITY: All vector queries MUST filter { metadata: { tenant_id: string } }.

Context Protocols: NO direct agent-to-agent Working Memory access. Share via MessageBus events or SharedArtifacts table. agent_audit_log is append-only (NEVER update/delete).

Lifecycle: Working memory is ephemeral (session-scoped). SessionManager archives to Long-term Memory on completion.

9.5 Agent Communication (src/services/MessageBus.ts & src/types/CommunicationEvent.ts)
Protocol: CloudEvents-compliant JSON with id, source (Agent ID), type (e.g., 'value.opportunity.created'), data, traceid, time.

Communication Mode: Default Asynchronous. NO synchronous agent calls (except Orchestrator). Separate queues: High-priority (User Interactive) vs Background (Data Processing). trace_id MUST propagate across all async boundaries.

9.6 Frontend Components (src/sdui/* & src/components/Agent/*)
SDUI: Components rendered by agents must be in ui-registry.json and src/sdui/registry.tsx. Props strictly typed. Maintain backward compatibility or use versioned names (e.g., MetricCardV2).

Interaction Patterns: AI-generated content must be visually distinct (GhostPreview wrapper or "AI Generated" badges). Use useRealtimeUpdates hook for WebSocket subscriptions. UI must handle partial JSON chunks via StreamingRenderer. Optimistic UI for agent actions.

9.7 Backend Services (src/services/*)
Service Design: Services must NOT hold state between requests. Use SessionManager or WorkflowStateRepository. Dependencies (SupabaseClient) must be injected for RLS context switching.

Database Interactions: Always use supabase.auth.getUser() context. Bypassing RLS with service_role restricted to: AuthService, TenantProvisioning, CronJobs. Multi-table writes in SQL transactions (via RPC).

Error Handling: Throw specific errors (AppError, ValidationError) from src/services/errors.ts. Sanitize error messages of stack traces and internal IDs.
# ValueOS Codemap Workflows

Integration patterns for using Codemaps with Windsurf Rules.

## Workflow 1: Opportunity Analysis Flow

**Purpose**: Verify agent handoffs match architecture specs.

```bash
# Generate map
@{opportunity-flow-map}
```

**Trace Path**:

```
OpportunityAgent → TargetAgent → ValueMappingAgent
```

**Validation Prompt**:

> "Using @{opportunity-flow-map}, verify if the current implementation follows the rules defined in `.github/agent-prompts/master-orchestrator.md`. If there are any discrepancies in how the Opportunity Agent hands off data to the Target Agent, highlight them on the map."

**Key Files**:

- `src/lib/agent-fabric/agents/BaseAgent.ts`
- `src/lib/agent-fabric/SecureMessageBus.ts`
- `.github/agent-prompts/master-orchestrator.md`

---

## Workflow 2: Value Fabric Data Flow

**Purpose**: Ensure data integrity and provenance tracing.

```bash
# Generate map tracing data from frontend to database
@{value-fabric-map}
```

**Trace Path**:

```
Frontend Component → API Route → Service → MemorySystem → PostgreSQL
```

**Validation Prompt**:

> "Check this @{value-fabric-map} for data provenance. Highlight any path where data reaches `postgres_schema.sql` without passing through `MemorySystem.ts` provenance logging."

**Key Files**:

- `blueprint/value_fabric/postgres_schema.sql`
- `src/lib/agent-fabric/MemorySystem.ts`
- `blueprint/value_fabric/data_flow.md`

---

## Workflow 3: Infrastructure Map

**Purpose**: Validate DevContainer and environment configuration.

```bash
# Generate infrastructure dependency map
@{infra-map}
```

**Trace Path**:

```
devcontainer.json → .devcontainer/scripts/* → docker-compose files → environment files
```

**Validation Prompt**:

> "Using @{infra-map}, identify which script in `.devcontainer/scripts/` is failing to load environment variables. Cross-reference with `infra/environments/dev/`."

**Key Files**:

- `.devcontainer/devcontainer.json`
- `.devcontainer/scripts/post-create.sh`
- `infra/compose/compose.dev.yml`
- `config/ports.json`

---

## Workflow 4: Security & Compliance Map

**Purpose**: Audit PII handling and LLM invocations.

```bash
# Generate security audit map
@{security-map}
```

**Trace Path**:

```
User Input → API Handler → piiFilter.ts → LLMGateway.ts → BudgetTracker.ts → LLM Provider
```

**Validation Prompt**:

> "Check this @{security-map} for compliance with PII masking rules. Highlight any call path that reaches `LLMGateway.ts` without passing through `piiFilter.ts`."

**Key Files**:

- `src/lib/piiFilter.ts`
- `src/lib/agent-fabric/LLMGateway.ts`
- `src/lib/llm-gating/BudgetTracker.ts`
- `docs/compliance/`

---

## Workflow 5: Agent Communication Audit

**Purpose**: Verify all agent-to-agent communication is logged.

```bash
# Generate agent communication map
@{agent-comm-map}
```

**Validation Prompt**:

> "Using @{agent-comm-map}, verify all agent communications pass through `SecureMessageBus.ts`. Flag any direct agent-to-agent calls that bypass the message bus."

**Key Files**:

- `src/lib/agent-fabric/SecureMessageBus.ts`
- `src/services/MessageBus.ts`

---

## Workflow 6: Master System Map

**Purpose**: Link the Master Orchestrator specification to actual TypeScript implementations.

```bash
# Generate master system map
@{master-system-map}
```

**Trace Path**:

```
master-orchestrator.md → BaseAgent.ts → [OpportunityAgent, TargetAgent, ValueMappingAgent, ...] → SecureMessageBus.ts → LLMGateway.ts
```

**Validation Prompt**:

> "Using @{master-system-map}, verify that all agents in `src/lib/agent-fabric/agents/` follow the architectural mandate defined in `.github/agent-prompts/master-orchestrator.md`. Check that:
>
> 1. Each agent extends `BaseAgent` (Scaffolder Phase requirement)
> 2. All LLM calls use `secureInvoke()` (Security validation)
> 3. Agent-to-agent communication uses `SecureMessageBus` (Causal Truth schema)
> 4. Metrics are logged via `logMetric()` and `logPerformanceMetric()` (Telemetry hooks)
>    Highlight any agent that violates these quality gates."

**Key Files**:

- `.github/agent-prompts/master-orchestrator.md` - Architectural specification
- `src/lib/agent-fabric/agents/BaseAgent.ts` - Base class
- `src/lib/agent-fabric/agents/OpportunityAgent.ts` - VOS Opportunity stage
- `src/lib/agent-fabric/agents/TargetAgent.ts` - VOS Target stage
- `src/lib/agent-fabric/agents/ValueMappingAgent.ts` - Value mapping
- `src/lib/agent-fabric/SecureMessageBus.ts` - Inter-agent communication
- `src/lib/agent-fabric/LLMGateway.ts` - LLM invocation layer

**Quality Gates to Verify**:

| Phase      | Requirement              | Implementation Check             |
| ---------- | ------------------------ | -------------------------------- |
| Architect  | Semantic operations      | Agent has typed I/O schemas      |
| Scaffolder | Extends BaseSemanticTool | `extends BaseAgent`              |
| Scaffolder | Strict TypeScript        | No `any` types in public API     |
| Scaffolder | Telemetry integration    | `logMetric()` calls present      |
| Scaffolder | Security validation      | `secureInvoke()` for LLM calls   |
| Test       | 90%+ coverage            | Test files exist in `__tests__/` |

---

## Auto-Update Integration

To keep Codemaps in sync with deployments, add to `scripts/validate-deployment.sh`:

```bash
# After successful validation, trigger codemap refresh
if [ $? -eq 0 ]; then
  echo "Triggering codemap refresh..."
  # Extension will pick up file changes and regenerate maps
  touch .codemap-refresh-trigger
fi
```

Configure the extension to watch for this trigger in `.vscode/settings.json`:

```json
{
  "valueos.codemap.autoRefreshTrigger": ".codemap-refresh-trigger",
  "valueos.codemap.refreshOnTrigger": true
}
```

---

## Rule Enforcement

These workflows integrate with `.windsurfrules.md` at the repository root. When Windsurf analyzes a Codemap, it will:

1. Load rules from `.windsurfrules.md`
2. Apply file-specific rules from `.windsurf/rules/`
3. Flag violations on the map visualization
4. Suggest fixes based on architectural standards

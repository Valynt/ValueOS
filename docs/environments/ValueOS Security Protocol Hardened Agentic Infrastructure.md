# VALUEOS SECURITY PROTOCOL: HARDENED AGENTIC INFRASTRUCTURE [v2026.01.08]

This document establishes the mandatory security architecture for the ValueOS development environment. In an AI-native ecosystem where autonomous agents exercise tool-calling capabilities and manage sensitive sales data, traditional perimeter security is insufficient. This protocol enforces a **Zero-Trust Multi-Agent Architecture**, fusing deterministic environment isolation with real-time telemetry-based auditing.

---

### 1. ENVIRONMENT ISOLATION: THE NIX-CONTAINER FORTRESS
The ValueOS development environment is an immutable primitive. Any deviation from the defined Nix Flake hash is treated as a potential supply-chain compromise.

#### 1.1 Deterministic Toolchain Integrity
To eliminate "Environment Drift" attacks, all binary dependencies must be resolved via the `flake.lock`.
- **Enforcement**: The `vscode` user lacks `sudo` privileges for `apt-get` within the DevContainer.
- **Verification**: The `postCreateCommand` executes a checksum validation of the Nix Store.

| Component | Security Control | Purpose |
| :--- | :--- | :--- |
| **Nix Store** | Cryptographic Hashing | Ensures binary-level parity across all engineering nodes. |
| **Named Volume** | `valueos-nix-store` | Persists hardened binaries while isolating the host filesystem. |
| **Docker-in-Docker** | Moby Isolation | Encapsulates Supabase and OTel sidecars from the developer's host OS. |

---

### 2. IDENTITY & AUTHORITY: THE HUMAN-AGENT BOUNDARY
We differentiate between **Human Identity (MFA)** and **Agent Authority (Dynamic Scoping)**.

#### 2.1 Human Access (The Gateway)
Access to the ValueOS environment requires:
1.  **Hardware-backed MFA**: FIDO2/WebAuthn for all Supabase and Cloud provider access.
2.  **Short-lived Tokens**: SSH and API sessions are limited to 4 hours, requiring re-authentication via the `vault-agent`.

#### 2.2 Agent Authority Levels (AAL)
Agents are not granted static roles. They operate under a hierarchical authority model monitored via Prometheus.
- **AAL-1 (Observer)**: Read-only access to `ContextFabric.ts`.
- **AAL-2 (Operator)**: Authorized to call tools with side effects (e.g., CRM writes).
- **AAL-3 (Architect)**: Authorized to spawn sub-agents or modify `AgentFabric.ts` logic.

> **Mandatory Metric**: `sum(agent_authority_level) by (agent_id)` must be monitored in the Grafana Security Dashboard. Any unauthorized escalation triggers an immediate circuit breaker trip.

---

### 3. SECRETS ARCHITECTURE & LLM GATEWAY
Plaintext secrets in environment variables are prohibited. All LLM traffic is forced through the LiteLLM proxy.

#### 3.1 The LiteLLM Chokepoint
The `valueos-llm-gateway` serves as the single point of egress for model providers (TogetherAI, OpenAI, Ollama).
- **Redaction**: The OTel Collector's `redaction` processor strips PII from trace logs before they hit Jaeger.
- **Key Rotation**: Provider keys are injected into LiteLLM via `secrets.nix` and are never exposed to the `AgentFabric`.

```yaml
# Internal Gateway Configuration (Enforced via Docker Network)
litellm:
  image: ghcr.io/berriai/litellm:main-latest
  environment:
    - TOGETHERAI_API_KEY=${TOGETHERAI_API_KEY} # Injected at runtime
    - OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
  networks:
    - valueos-net # No host port mapping for production deployments
```

---

### 4. DATA SECURITY: ROW LEVEL SECURITY (RLS) & FABRIC CONTEXT
ValueOS utilizes Supabase (PostgreSQL) with a strict "Default Deny" RLS policy.

#### 4.1 RLS Enforcement Patterns
Every query executed by an agent must include the `trace_id` from the active OTel Span. This allows the database to audit the *reasoning* behind every data mutation.

```sql
-- Security Policy for Sales Context Data
ALTER TABLE sales_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_scoped_access ON sales_leads
FOR ALL
TO authenticated
USING (
  (auth.jwt() ->> 'agent_authority')::int >= required_authority_level
);
```

#### 4.2 Deep Trace Auditing
The `ContextFabric.ts` ensures that the "Short-term Memory" of an agent is immutable once a trace is started. 
- **Trace Correlation**: If a record in `audit_logs` is flagged, engineers must use the `trace_id` to reconstruct the `context_window` in Jaeger. This identifies if the breach was due to a **Prompt Injection** or a **Logic Flaw**.

---

### 5. AI-SPECIFIC GUARDRAILS: CIRCUIT BREAKERS & CONFIDENCE
Autonomous agents can enter "Hallucination Loops" that lead to resource exhaustion or data corruption.

#### 5.1 The Circuit Breaker Pattern
Monitored via the `agent_circuit_breaker_status` metric.
1.  **Logical Break**: If `agent_confidence_score < 0.6` for three consecutive steps, the execution is suspended.
2.  **Resource Break**: If an agent exceeds 5,000 tokens in a single `AgentFabric` loop, the `otel-collector` triggers an OOM-kill simulation on that specific agent thread.

#### 5.2 Confidence Thresholds
| Score | Action | Security Risk |
| :--- | :--- | :--- |
| **0.9 - 1.0** | Auto-execute | Low |
| **0.7 - 0.89** | Log & Execute | Medium (Monitor for drift) |
| **< 0.7** | **Human-in-the-loop (HITL) Required** | High (Potential Hallucination) |

---

### 6. OPERATIONAL SECURITY COMMANDS (TASKFILE)
The following commands are the only authorized methods for managing the security stack.

```bash
# Verify the integrity of the nix-store and dependencies
task security:audit-env

# Emergency Shutdown: Kills all LLM gateways and isolates the network
task security:kill-switch

# Rotate all local secrets and re-encrypt secrets.nix
task security:rotate-keys
```

---

### 7. STRATEGIC CONSIDERATIONS & THREAT MODELING
- **Prompt Injection**: Mitigated by LiteLLM system-prompt enforcement and RLS.
- **Telemetry Poisoning**: The OTel Collector is isolated on `valueos-net`; it only accepts gRPC traffic from trusted service containers.
- **Model Collapse/Poisoning**: Benchmark runs compare local Ollama outputs against TogetherAI outputs to detect "Behavioral Drift" in model providers.

> **Final Directive**: Security is not a feature; it is the substrate. Any PR that bypasses `ContextFabric.ts` instrumentation or attempts to introduce `dotenv` files outside of the Nix/Sops workflow will be automatically rejected by the CI/CD pipeline.
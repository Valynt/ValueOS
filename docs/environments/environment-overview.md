# Environment Overview

> **Note:** References to `pnpm run dx` and `pnpm run dx:*` in this document are design specifications, not implemented package.json scripts. Use `gitpod automations service start <id>` to start services. See `.ona/automations.yaml` for the canonical service list.

**Last Updated**: 2026-02-08

**Consolidated from 13 source documents**

---

## Table of Contents

1. [ValueOS Development Environment Engineering Specification (Current Guidance)](#valueos-development-environment-engineering-specification-(current-guidance))
2. [ValueOS Technical Governance Framework: The Maintainable Development Ecosystem](#valueos-technical-governance-framework:-the-maintainable-development-ecosystem)
3. [ValueOS DevContainer Configuration (Current Guidance)](#valueos-devcontainer-configuration-(current-guidance))
4. [ValueOS Development Lifecycle Commands (Current)](#valueos-development-lifecycle-commands-(current))
5. [ValueOS Development Environment Final Handover Report](#valueos-development-environment-final-handover-report)
6. [ValueOS: Multi-Agent Fabric Observability & Debugging Guide](#valueos:-multi-agent-fabric-observability-&-debugging-guide)
7. [ValueOS Environment Maintenance Suite (Current Guidance)](#valueos-environment-maintenance-suite-(current-guidance))
8. [Untitled](#untitled)
9. [VALUEOS SECURITY PROTOCOL: HARDENED AGENTIC INFRASTRUCTURE [v2026.01.08]](#valueos-security-protocol:-hardened-agentic-infrastructure-[v2026.01.08])
10. [Ground Truth Benchmark Layer: Maintenance & Data Integrity Guide](#ground-truth-benchmark-layer:-maintenance-&-data-integrity-guide)
11. [ValueOS Engineering Onboarding (Current Guidance)](#valueos-engineering-onboarding-(current-guidance))
12. [ValueOS Development Environment (Current Guidance)](#valueos-development-environment-(current-guidance))
13. [Environment Configuration](#environment-configuration)

---

## ValueOS Development Environment Engineering Specification (Current Guidance)

*Source: `environments/ValueOS Development Environment Engineering Specification.md`*

> **Status:** This specification referenced Taskfile and Nix tooling that are not present in the current repository. The canonical, runnable workflow is defined in the Local Dev Quickstart and Local Setup docs.

## Canonical Development Workflow

- [Local Dev Quickstart](../getting-started/quickstart.md)
- [Local Development Setup (Options A/B)](../getting-started/local-setup.md)
- [Environment Configuration](../ENVIRONMENT.md)

## Required Commands (Single Source of Truth)

```bash
# Generate environment files
pnpm run dx:env -- --mode local --force

# Start the full local stack
pnpm run dx

# Stop the stack
pnpm run dx:down

# Validate environment + health
pnpm run dx:env:validate
pnpm run dx:check
```

## Common Issues

See [Common Issues + Fixes](../getting-started/troubleshooting.md).

---

## ValueOS Technical Governance Framework: The Maintainable Development Ecosystem

*Source: `environments/ValueOS Technical Governance Framework_ Automated Development Ecosystem Management.md`*

This document outlines the strategic governance and engineering standards for the ValueOS development environment. It shifts the paradigm from manual oversight to **Automated Governance**, prioritizing long-term maintainability through "Zero-Drift" principles and a self-healing infrastructure lifecycle.

---

## 1. Core Governance Philosophy
To achieve a truly maintainable platform, ValueOS adheres to the **IDP (Internal Developer Platform) Maturity Model**, focusing on reducing cognitive load for developers while enforcing rigid structural standards.

| Principle | Strategic Objective | Implementation Method |
| :--- | :--- | :--- |
| **Declarative Sovereignty** | Eliminate "Snowflake" environments. | Everything-as-Code (EaC) via GitOps. |
| **Zero-Drift** | Ensure state consistency 24/7. | Continuous reconciliation loops. |
| **Ephemeral-First** | Prevent technical debt accumulation. | Automated TTL (Time-to-Live) for dev stacks. |
| **Policy-as-Code (PaC)** | Shift-left compliance and security. | OPA (Open Policy Agent) Gatekeepers. |

---

## 2. Zero-Drift Architecture & State Management
Zero-Drift is the technical foundation of maintainability. It ensures that the manual "quick fixes" performed in a development environment are automatically reverted or codified, preventing the divergence of dev, staging, and production.

### 2.1 The Reconciliation Loop
ValueOS utilizes a bi-directional sync mechanism to monitor the "Desired State" (Git) against the "Actual State" (Cloud/Cluster).

1.  **Detection:** A controller (e.g., ArgoCD or Crossplane) monitors the environment.
2.  **Analysis:** If a manual change is detected (Drift), the system flags a "Degraded" status.
3.  **Remediation:** The controller automatically overwrites the manual change with the Git-defined truth.

### 2.2 Configuration Versioning Standard
All environment configurations must follow semantic versioning.
- **Major:** Breaking infrastructure changes (e.g., Kubernetes API migration).
- **Minor:** New shared services (e.g., adding a Redis sidecar).
- **Patch:** Config tweaks (e.g., resource limit adjustments).

---

## 3. Automated Lifecycle Management (ALM)
Maintaining a development environment requires rigorous management of the resource lifecycle to prevent "Environment Sprawl."

### 3.1 Provisioning Workflow
Developer environments are treated as **Immutable Artifacts**.

1.  **Request:** Developer triggers a workspace via a Backstage-based Software Catalog.
2.  **Validation:** PaC engines verify resource quotas and naming conventions.
3.  **Bootstrap:** Crossplane provisions cloud resources; ArgoCD hydrates the K8s namespace.
4.  **Health Check:** Synthetic tests verify connectivity before handing over the endpoint.

### 3.2 Automated Decommissioning
To maintain fiscal and technical hygiene, ValueOS implements a strict TTL policy.

```yaml
# Example Environment Metadata for Lifecycle Management
apiVersion: valueos.io/v1alpha1
kind: DevEnvironment
metadata:
  name: feature-auth-refactor
  labels:
    owner: "identity-team"
    project: "valueos-core"
spec:
  lifecycle:
    ttl: 72h           # Automatic deletion after 72 hours
    autoShutdown:      # Scale to zero during non-working hours
      enabled: true
      schedule: "0 20 * * 1-5"
    retentionPolicy: "delete-all"
```

---

## 4. Policy-as-Code (PaC) Guardrails
Governance is enforced through automated gates rather than manual reviews. This ensures that only "maintainable" code enters the ecosystem.

### 4.1 Governance Guardrail Matrix
| Category | Policy Rule | Enforcement Level |
| :--- | :--- | :--- |
| **Resources** | Must have `CPU/Memory` requests/limits defined. | Deny on CI/CD |
| **Security** | No `Privileged` containers allowed in Dev namespaces. | Admission Controller |
| **Cost** | Workspace cost cannot exceed $50/month without approval. | Soft Warning |
| **Tagging** | Mandatory `Owner`, `CostCenter`, and `Project` tags. | Mutating Webhook |

---

## 5. Maintainability Metrics & Observability
Maintainability is measured through the **Environment Health Score (EHS)**. This composite metric provides the Platform Engineering team with a dashboard of technical debt.

### 5.1 Key Performance Indicators (KPIs)
*   **Mean Time to Provision (MTTP):** Time from request to a "Ready" status (Target: < 5 mins).
*   **Drift Frequency:** Number of manual interventions detected per week (Target: < 2).
*   **Zombie Ratio:** Percentage of environments with zero traffic in the last 48 hours.
*   **Dependency Age:** Delta between the current environment version and the latest stable manifest.

### 5.2 Automated Self-Healing
When an environment fails a health check (e.g., CrashLoopBackOff), the governance layer initiates:
1.  **Auto-Restart:** K8s-level pod cycling.
2.  **Auto-Rebase:** Re-syncing the environment with the `main` branch configuration.
3.  **Auto-Alert:** Notifying the owner if the environment remains unhealthy for > 30 minutes.

---

## 6. Strategic Implementation Roadmap

### Phase 1: Foundation (Months 1-2)
- Centralize all environment definitions into a single Git repository.
- Implement Crossplane for cloud resource abstraction.
- Standardize on `Kustomize` for environment-specific overlays.

### Phase 2: Automation (Months 3-4)
- Deploy GitOps controllers for continuous reconciliation.
- Enable automated TTLs for all "Feature Branch" environments.
- Integrate OPA/Gatekeeper for basic resource validation.

### Phase 3: Optimization (Months 5-6)
- Launch the Developer Self-Service Portal.
- Implement cost-attribution dashboards.
- Formalize the "Zero-Drift" enforcement (moving from 'Alerting' to 'Auto-Remediation').

---

> **Platform Engineering Mandate:**
> "The goal of ValueOS Governance is to make the right way the easy way. By automating the lifecycle and enforcing a Zero-Drift policy, we ensure that the platform evolves without accumulating the friction of legacy configurations."

---

## ValueOS DevContainer Configuration (Current Guidance)

*Source: `environments/Production-Grade DevContainer Configuration for ValueOS with Nix Integration.md`*

> **Status:** This document previously referenced Nix integration. The current repository does not include `flake.nix`, so those instructions are not runnable.

## Canonical Local Development Path

- [Local Dev Quickstart](../getting-started/quickstart.md)
- [Local Development Setup (Options A/B)](../getting-started/local-setup.md)
- [Environment Configuration](../ENVIRONMENT.md)

## DevContainer Reference

If you are using a DevContainer/Codespaces, refer to the repo configuration:

- `.devcontainer/devcontainer.json`
- `.devcontainer/README.md`

## Common Issues

See [Common Issues + Fixes](../getting-started/troubleshooting.md).

---

## ValueOS Development Lifecycle Commands (Current)

*Source: `environments/ValueOS Development Lifecycle Management Taskfile.md`*

> **Status:** The repository does not include a `Taskfile.yml`. The canonical lifecycle commands are the `pnpm run dx*` scripts documented below.

## Canonical Commands

```bash
# Generate environment files
pnpm run dx:env -- --mode local --force

# Start the full local stack
pnpm run dx

# Stop the stack
pnpm run dx:down

# Reset containers + volumes
pnpm run dx:reset

# Health checks
pnpm run dx:check

# Preflight checks
pnpm run dx:doctor
```

## Related Documentation

- [Local Dev Quickstart](../getting-started/quickstart.md)
- [Local Development Setup (Options A/B)](../getting-started/local-setup.md)
- [Environment Configuration](../ENVIRONMENT.md)
- [Common Issues + Fixes](../getting-started/troubleshooting.md)

---

## ValueOS Development Environment Final Handover Report

*Source: `environments/ValueOS Development Environment Final Handover Report.md`*

**To:** Engineering Leadership, ValueOS Steering Committee
**From:** Lead Systems Architect
**Date:** January 15, 2026
**Status:** FINAL / PRODUCTION-READY

---

## 1. Project Mission Success: "60 Seconds to First Commit"

The primary objective of this project was to eliminate "Configuration Hell" and provide a deterministic, repeatable environment for the ValueOS engineering team. We have successfully achieved the **60 Seconds to First Commit** workflow.

### The Success Metric
Previously, onboarding a new engineer to the Multi-Agent Fabric took approximately 4.5 hours of manual environment tuning. Today, the process is reduced to two commands:

1.  `git clone <valueos-repo>`
2.  `code .` (Triggering the DevContainer build)

### Core Achievement Pillars
*   **Total Determinism:** By utilizing **Nix flakes**, we have moved beyond "it works on my machine" to "it works because the hash matches." Every compiler, library, and system dependency is pinned at the binary level.
*   **Environment-as-Code:** The environment is no longer a set of instructions; it is a versioned asset that evolves with the codebase.
*   **Zero-Conf Tooling:** Automated bootstrapping of local databases (Postgres), caches (Redis), and the Multi-Agent message bus (RabbitMQ) occurs within the container lifecycle.

---

## 2. Architecture Mapping: Principles to Implementation

ValueOS is not a standard web application; it is a high-precision financial multi-agent system. The development environment reflects these specific architectural requirements.

| ValueOS Principle | Technical Implementation | Engineering Impact |
| :--- | :--- | :--- |
| **Multi-Agent Fabric** | **OTel Mesh + Tempo** | Enables tracing of asynchronous logic flows across autonomous agents in real-time. |
| **Ground Truth Benchmarking** | **Nix Pinned Toolchains** | Ensures that performance benchmarks are consistent across local, CI, and Production environments. |
| **Financial Precision** | **PostgreSQL (pg_stat_statements)** | Local environment includes high-fidelity database monitoring to catch sub-optimal queries before they hit the ledger. |
| **Security First** | **Pre-commit Hooks + SOPS** | Automated secret scanning and GPG-verified commits are enforced at the hardware level of the environment. |

---

## 3. Deliverable Inventory

The following assets have been integrated into the repository and are now under version control:

### Infrastructure & Configuration
*   `flake.nix` & `flake.lock`: The source of truth for all system dependencies.
*   `.devcontainer/devcontainer.json`: The orchestration layer for VS Code/Cursor integration.
*   `infra/docker/docker-compose.dev.yml`: Definitions for the Multi-Agent support services (Redis, Tempo, Postgres).

### Tooling & Scripts
*   `scripts/self-healing/check-health.sh`: Validates the state of the local fabric.
*   `scripts/self-healing/fix-ports.sh`: Automatically clears zombie processes blocking required ValueOS ports (e.g., 5432, 6379).
*   `scripts/setup/bootstrap-certs.sh`: Generates local SSL certificates for end-to-end encryption testing.

### Documentation & Visuals
*   `docs/arch/environment-4k-map.png`: High-fidelity visualization of the Dev-to-Prod parity.
*   `docs/guides/onboarding.md`: The "Fast Start" guide for new hires.
*   **Local Developer Portal**: An internal dashboard (accessible via `localhost:9000` when the environment is up) providing real-time links to Grafana and API docs.

---

## 4. Repeatability & Maintainability Verification

To ensure this environment does not degrade (Environment Drift), we have implemented a **Lifecycle Governance Plan**.

### Nix Pinning & Hash Integrity
The environment utilizes Nix Flakes to lock every dependency to a specific git revision of `nixpkgs`.
```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-23.11";
    # Ensures all developers use the exact same version of Go, Rust, and Node
  };
}
```

### Self-Healing Toolkit
The environment includes a "Self-Healing" layer that monitors for common failures:
1.  **Port Collisions:** If a local service (like a legacy Postgres install) occupies a port, the environment detects this and offers an automated `kill-and-restart` solution.
2.  **Volume Corruption:** Automated integrity checks for local Docker volumes ensure the "Ground Truth" data layer remains uncorrupted.

---

## 5. Observability & Debugging: The Multi-Agent Edge

The most significant hurdle in Multi-Agent development is "The Black Box Problem"—understanding why an agent made a specific decision.

### Tempo & Grafana Integration
The environment comes pre-configured with an **OpenTelemetry (OTel) Mesh**.
*   **Distributed Tracing:** Every agent request is tagged with a `trace_id`. Engineers can open Grafana → Explore → Tempo locally to see the entire waterfall of agent-to-agent communication.
*   **Metrics Visualization:** A local Grafana instance provides real-time CPU/Memory usage per agent, allowing engineers to identify memory leaks during the development phase.

> "The ability to visualize the 'thought process' of the ValueOS agents through Tempo traces transforms debugging from a guessing game into a surgical operation." — *Architecture Note*

---

## 6. Strategic Considerations & Risk Management

While the environment is robust, the following maintenance protocols are recommended:

1.  **Monthly Flake Updates:** Engineering leads should run `nix flake update` once a month to incorporate security patches.
2.  **Resource Allocation:** Ensure developer machines are allocated at least 16GB of RAM to the Docker/Colima engine to support the full Multi-Agent stack.
3.  **Credential Rotation:** The `SOPS` integration requires yearly rotation of the master age-key stored in the secure vault.

---

## 7. Conclusion: Declaration of Readiness

The ValueOS Development Environment is hereby declared **Production-Ready**.

It provides a high-fidelity, secure, and infinitely repeatable foundation for the engineering team. By bridging the gap between infrastructure and application logic, we have ensured that the engineering team can focus 100% of their cognitive load on building the **Multi-Agent Fabric**, rather than troubleshooting their tools.

**The system is live. The gates are open. Happy coding.**

---
*End of Report*

---

## ValueOS: Multi-Agent Fabric Observability & Debugging Guide

*Source: `environments/ValueOS Multi-Agent Fabric Observability and Debugging Guide.md`*

This guide provides a deep technical walkthrough of the **ValueOS Observability Stack**, designed for senior engineers managing complex autonomous agent interactions. In a multi-agent environment where non-deterministic LLM outputs are the norm, standard logging is insufficient. ValueOS employs a **Deep Trace Architecture** to provide bit-level visibility into agent reasoning, tool execution, and context propagation.

---

## 1. The Deep Trace Philosophy
Standard observability tracks request/response cycles. **ValueOS Deep Trace** treats every agent "thought process" as a parent Span and every subsequent tool call or sub-agent invocation as a child Span. This allows engineers to reconstruct the exact state of the `ContextFabric.ts` at any point in the agent's execution lifecycle.

### Core Telemetry Flow
> **Agent (OTel SDK)** → **OTel Collector** → **Tempo (Traces)** / **Prometheus (Metrics)** → **Grafana**

---

## 2. Infrastructure Configuration
The local environment is orchestrated via **Nix Flakes** and **DevContainers**, ensuring the observability sidecars are identical across all engineering workstations.

### 2.1 Service Map
| Service | Role | Access Port |
| :--- | :--- | :--- |
| **OTel Collector** | Central telemetry processor and batcher. | `4317` (gRPC), `4318` (HTTP) |
| **Tempo** | Distributed tracing backend. | `3200` |
| **Prometheus** | Time-series database for token usage and latency. | `9090` |
| **Grafana** | Mission Control: Unified dashboards. | `3000` |
| **Loki** | Log aggregation. | `3100` |
| **Promtail** | Docker log scraper → Loki. | — |
| **node-exporter** | Host resource metrics. | `9100` |
| **LiteLLM** | LLM Gateway with OTel instrumentation. | `4000` |

### 2.2 OTel Collector Implementation
The `infra/otel-collector-config.yaml` is configured to handle high-cardinality data produced during agent "loops." It utilizes the `batch` processor to prevent telemetry overhead from impacting agent latency.

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

exporters:
  otlp/tempo:
    endpoint: tempo:4317
    tls:
      insecure: true
  prometheus:
    endpoint: "0.0.0.0:8889"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp/tempo]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [prometheus]
```

---

## 3. Fabric Instrumentation
Tracing is baked into the core classes of the Multi-Agent Sales Enablement Platform.

### 3.1 AgentFabric.ts: The Orchestration Layer
The `AgentFabric.ts` manages agent lifecycle. Every time an agent is spawned, a new trace context is initialized.

```typescript
import { trace, SpanStatusCode } from "@opentelemetry/api";

export class AgentFabric {
  private tracer = trace.getTracer("valueos-agent-fabric");

  async runAgent(agentId: string, input: any) {
    return this.tracer.startActiveSpan(`agent_run:${agentId}`, async (span) => {
      try {
        span.setAttribute("agent.id", agentId);
        span.setAttribute("agent.input_length", JSON.stringify(input).length);

        const result = await this.executeLogic(input);

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
```

### 3.2 ContextFabric.ts: State Propagation
`ContextFabric.ts` ensures that the "Short-term Memory" of an agent is visible in Tempo. By attaching the `context_window` as a Span Event, we can see exactly what data was sent to the LLM during a specific tool call.

### 3.3 BenchmarkAgent: Performance Analysis
The `BenchmarkAgent` uses OTel metrics to track **Tokens Per Second (TPS)** and **Time To First Token (TTFT)**. These metrics are scraped by Prometheus and visualized in the Grafana "Agent Performance" dashboard.

---

## 4. Debugging & Observability Pro-Tips

### Identifying Hallucination Risks
In the ValueOS environment, agents are programmed to return a `confidence_score` (0.0 to 1.0) along with their reasoning. This score is automatically injected into OTel Span attributes.

> **Pro-Tip: Hallucination Detection**
>
> Open **Grafana → Explore → Tempo** and filter by tags: `confidence_score < 0.7`.
>
> Spans matching this filter represent high-risk outputs. Examine the `context.snippet` attribute in these traces to see if the agent had insufficient RAG (Retrieval-Augmented Generation) data, which is the primary driver of hallucinations in the Sales Enablement Platform.

### Monitoring Confidence Scores in Grafana
Use the following Prometheus query to create an alert for a "Hallucination Spike" across the entire `AgentFabric`:

```promql
avg(agent_confidence_score) by (agent_id) < 0.65
```

### Trace Correlation with Supabase
When an agent writes to the local Supabase instance, the `supabase_request_id` is linked to the OTel `trace_id`. If a database record looks corrupted, copy the `trace_id` from the Supabase `audit_logs` and paste it into Grafana → Explore → Tempo to see the thought process that led to that specific write.

---

## 5. Operational Commands
The current repository uses the DX scripts and Docker Compose for local observability workflows.

| Command | Purpose |
| :--- | :--- |
| `pnpm run dx:logs` | Follow logs for the local stack (including observability containers). |
| `pnpm run dx:check` | Validate health of local services. |
| `docker compose --env-file .env.ports -f infra/docker/docker-compose.dev.yml restart otel-collector` | Restart the OTel Collector if telemetry stalls. |

### Healthcheck Script Logic
If the OTel Collector stops receiving signals, the environment's internal daemon executes the following recovery logic:

```bash
#!/usr/bin/env bash
# .devcontainer/scripts/otel-check.sh

if ! curl -sf http://localhost:4318/v1/traces > /dev/null; then
  echo "Telemetry pipeline blocked. Resetting OTel Collector..."
  docker compose restart otel-collector
fi
```

---

## 6. Strategic Considerations
- **Data Volume**: High-frequency agents can generate gigabytes of trace data. The local `otel-collector-config.yaml` uses a `memory_limiter` to prevent host system crashes.
- **Privacy**: When working with sensitive sales data, the OTel Collector is configured with a `redaction` processor to strip PII (Personally Identifiable Information) before data hits the storage layer.
- **Offline Mode**: If `OFFLINE_MODE=true` is set in your `.env.local`, the stack routes all traffic to local Ollama instances while maintaining full OTel visibility.

---

## ValueOS Environment Maintenance Suite (Current Guidance)

*Source: `environments/ValueOS Environment Maintenance Suite.md`*

> **Status:** This document previously described standalone scripts (`setup.sh`, `healthcheck.sh`, `fix-ports.sh`) that are not part of the current repository. Use the DX scripts instead.

## Canonical Commands

```bash
# Preflight checks
pnpm run dx:doctor

# Full health check
pnpm run dx:check

# Start/stop the local stack
pnpm run dx
pnpm run dx:down
```

## Related Documentation

- [Local Dev Quickstart](../getting-started/quickstart.md)
- [Local Development Setup (Options A/B)](../getting-started/local-setup.md)
- [Environment Configuration](../ENVIRONMENT.md)
- [Common Issues + Fixes](../getting-started/troubleshooting.md)

---

## Untitled

*Source: `environments/ValueOS Observability Pillar Production-Grade Telemetry Stack.md`*

This document defines the **Observability Pillar** for ValueOS, providing a production-grade telemetry stack. This configuration implements the "Deep Trace" architecture, enabling granular monitoring of agent-to-agent communication, tool execution, and LLM costs through an OpenTelemetry-native pipeline.

### 1. Architectural Overview
The observability stack is designed to intercept all agent activity. The flow follows a structured path from ingestion to visualization:

1.  **Ingestion**: Agents and the LiteLLM proxy emit OTLP (OpenTelemetry Protocol) signals.
2.  **Processing**: The **OTel Collector** aggregates, batches, and processes these signals.
3.  **Storage**: Traces are sent to **Tempo**; Metrics are exposed to **Prometheus**; Logs aggregate in **Loki**.
4.  **Visualization**: **Grafana** provides a unified "Mission Control" interface.

---

### 2. Docker Compose Configuration
This `docker-compose.yml` establishes the service mesh and network isolation.

```yaml
services:
  # --- OpenTelemetry Collector: The Central Nervous System ---
  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.90.0
    container_name: valueos-otel-collector
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ./infra/otel-collector-config.yaml:/etc/otel-collector-config.yaml
    ports:
      - "4317:4317" # OTLP gRPC receiver
      - "4318:4318" # OTLP HTTP receiver
      - "8889:8889" # Prometheus exporter metrics
    networks:
      - valueos-net
    restart: unless-stopped

  # --- Tempo: Distributed Tracing ---
  tempo:
    image: grafana/tempo:2.3.0
    container_name: valueos-tempo
    command: -config.file=/etc/tempo/tempo-config.yaml
    volumes:
      - ./infra/observability/tempo/tempo-config.yaml:/etc/tempo/tempo-config.yaml
    ports:
      - "3200:3200"
    networks:
      - valueos-net
    restart: unless-stopped

  # --- Prometheus: Time-Series Metrics ---
  prometheus:
    image: prom/prometheus:v2.47.0
    container_name: valueos-prometheus
    volumes:
      - ./infra/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    ports:
      - "9090:9090"
    networks:
      - valueos-net
    restart: unless-stopped

  # --- Grafana: Mission Control Dashboard ---
  grafana:
    image: grafana/grafana:10.2.0
    container_name: valueos-grafana
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Admin
    volumes:
      - grafana-data:/var/lib/grafana
    ports:
      - "3000:3000"
    networks:
      - valueos-net
    depends_on:
      - prometheus
      - tempo
    restart: unless-stopped

  # --- LiteLLM: LLM Gateway & Cost Tracking ---
  litellm:
    image: ghcr.io/berriai/litellm:main-latest
    container_name: valueos-llm-gateway
    environment:
      - TOGETHERAI_API_KEY=${TOGETHERAI_API_KEY}
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
      - OTEL_SERVICE_NAME=litellm-proxy
    command: [ "--config", "/app/config.yaml" ] # Assumes config.yaml defines TogetherAI models
    ports:
      - "4000:4000"
    networks:
      - valueos-net
    restart: unless-stopped

networks:
  valueos-net:
    driver: bridge

volumes:
  prometheus-data:
  grafana-data:
```

---

### 3. OpenTelemetry Collector Configuration
The `infra/otel-collector-config.yaml` file defines how data is received, processed, and routed.

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 5s
    send_batch_size: 1024
  memory_limiter:
    check_interval: 1s
    limit_mib: 512
    spike_limit_mib: 128

exporters:
  otlp/tempo:
    endpoint: tempo:4317
    tls:
      insecure: true

  prometheus:
    endpoint: "0.0.0.0:8889"
    resource_to_telemetry_conversion:
      enabled: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp/tempo]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [prometheus]
```

---

### 4. Prometheus Configuration
The `infra/prometheus.yml` instructs Prometheus to scrape the OTel Collector for agent-specific metrics.

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'otel-collector'
    static_configs:
      - targets: ['otel-collector:8889']

  - job_name: 'valueos-agent-fabric'
    static_configs:
      - targets: ['otel-collector:8889']
    metrics_path: /metrics
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: 'agent_.*'
        action: keep
```

---

### 5. Grafana: ValueOS Operations Dashboard
The pre-configured dashboard leverages the OTLP metrics exported to Prometheus. Key visualizations and their underlying logic are detailed below:

| Panel | Metric Source / Query | Insight |
| :--- | :--- | :--- |
| **Agent Authority Levels** | `sum(agent_authority_level) by (agent_id)` | Monitors the hierarchical "clearance" of active autonomous agents. |
| **Circuit Breaker States** | `agent_circuit_breaker_status` | Visualizes safety cut-offs (0=Closed, 1=Open) preventing agent loops. |
| **LLM Token Usage** | `sum(increase(litellm_tokens_total[5m]))` | Real-time cost tracking of Together AI consumption via LiteLLM. |
| **Request Latency** | `histogram_quantile(0.95, sum(rate(otel_span_duration_seconds_bucket[5m])) by (le))` | P95 latency for agent "thought processes" and tool calls. |

### 6. Implementation Guidelines

1.  **Initialization**: Ensure the `infra/` directory exists before running `docker-compose up`.
2.  **LiteLLM Integration**: Point the ValueOS application's LLM client to `http://localhost:4000/v1`. This ensures all traffic is captured by the gateway.
3.  **Instrumentation**: Agents must use the OTel SDK with `OTEL_EXPORTER_OTLP_ENDPOINT` set to the collector's address.
4.  **Security**: The `valueos-net` bridge provides internal DNS and prevents external services from accessing the Prometheus/OTel ports unless explicitly mapped to the host.

> **Warning**: Never commit your `TOGETHERAI_API_KEY` to version control. Use the `secrets.nix` or `.env.local` patterns defined in the Environment Engineering Spec.

---

## VALUEOS SECURITY PROTOCOL: HARDENED AGENTIC INFRASTRUCTURE [v2026.01.08]

*Source: `environments/ValueOS Security Protocol Hardened Agentic Infrastructure.md`*

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
- **Redaction**: The OTel Collector's `redaction` processor strips PII from trace logs before they hit Tempo.
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
- **Trace Correlation**: If a record in `audit_logs` is flagged, engineers must use the `trace_id` to reconstruct the `context_window` in Grafana → Explore → Tempo. This identifies if the breach was due to a **Prompt Injection** or a **Logic Flaw**.

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

---

## Ground Truth Benchmark Layer: Maintenance & Data Integrity Guide

*Source: `environments/Ground Truth Benchmark Layer Maintenance and Data Integrity Guide.md`*

This document establishes the technical protocols for managing the **Ground Truth Benchmark Layer (GTBL)** within ValueOS. The GTBL serves as the immutable reference point for validating agent performance, ensuring that "Authority 3" (the BenchmarkAgent) operates against high-fidelity, version-controlled data.

---

## 1. The Role of the Proprietary Benchmark Layer

The proprietary benchmark layer is a protected abstraction within ValueOS that contains sensitive calibration data, golden response sets, and edge-case scenarios. Developers must interact with this layer through strictly defined interfaces to maintain the integrity of the "Ground Truth."

### 1.1 Developer

---

## ValueOS Engineering Onboarding (Current Guidance)

*Source: `environments/ValueOS Engineering Onboarding _ Architecture Manual.md`*

> **Status:** This onboarding document previously referenced Taskfile and Nix workflows that are not present in the current repository. Use the canonical quickstart instead.

## Canonical Onboarding Path

```bash
git clone https://github.com/valynt/valueos.git
cd valueos
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
pnpm run dx:env -- --mode local --force
pnpm run dx
```

**Expected outcome:** local environment files are generated, Docker dependencies + Supabase start, and the app is served at `http://localhost:5173`.

## Follow-on References

- [Local Development Setup (Options A/B)](../getting-started/local-setup.md)
- [Environment Configuration](../ENVIRONMENT.md)
- [Common Issues + Fixes](../getting-started/troubleshooting.md)

---

## ValueOS Development Environment (Current Guidance)

*Source: `environments/ValueOS Production-Grade Development Environment with Nix Flakes and direnv.md`*

> **Status:** This document previously described a Nix/direnv-based workflow. The current repository does **not** ship a `flake.nix` or Taskfile, so those instructions are no longer runnable.

## Canonical Local Development Path

Use the Local Dev Quickstart as the single source of truth:

- [Local Dev Quickstart](../getting-started/quickstart.md)
- [Local Development Setup (Options A/B)](../getting-started/local-setup.md)
- [Environment Configuration](../ENVIRONMENT.md)

## Common Issues

See the canonical list of symptoms → causes → fixes in [Common Issues + Fixes](../getting-started/troubleshooting.md).

---

## Environment Configuration

*Source: `ENVIRONMENT.md`*

ValueOS uses a single, standardized environment system to ensure reproducible builds and prevent configuration drift.

## Quick Start

```bash
# Generate environment for local development
pnpm run dx:env -- --mode local --force

# Start development (auto-generates env if needed)
pnpm run dx
```

For the full local dev flow, see [Local Dev Quickstart](getting-started/quickstart.md).

## The Single Source of Truth

All environment files are generated by **one script**: `scripts/dx/env-compiler.js`

This ensures:
- Same inputs → same env → same behavior
- Mode-specific URLs are always correct
- Contradictions are caught before they cause failures
- Contributors and CI use identical logic

## Modes

### Local Mode (default)
- Frontend and backend run on your host machine
- Docker runs only dependencies (Postgres, Redis, Supabase)
- URLs use `localhost`

```bash
pnpm run dx
```

### Docker Mode
- Everything runs in Docker containers
- Services communicate via Docker network DNS
- URLs use service names (e.g., `backend:3001`)
- Frontend dev server binds to `0.0.0.0` for container access
- HMR is exposed on a dedicated port (`VITE_HMR_PORT`, default `24678`)
- Polling-based watch is enabled by default for reliability on mounted volumes (`VITE_USE_POLLING=true`)

```bash
pnpm run dx:docker
```

> **Mode tradeoff note:** Docker mode prioritizes cross-platform reliability (especially Docker Desktop + WSL2 file mounts) over raw hot-reload speed. Polling-based watchers can consume more CPU and make reload latency slightly higher. If you want the fastest iteration loop on a stable host setup, switch back to local mode:
>
> ```bash
> pnpm run dx:env -- --mode local --force
> pnpm run dx
> ```

## Generated Files

| File | Purpose | Generated By |
|------|---------|--------------|
| `ops/env/.env.local` | Main environment file | `pnpm run dx:env` |
| `ops/env/.env.ports` | Port mappings for Docker Compose | `pnpm run dx:env` |
| `deploy/envs/.env.ports` | Legacy Docker Compose env file | `pnpm run dx:env` |

## Commands

```bash
# Generate environment files
pnpm run dx:env -- --mode local --force
pnpm run dx:env -- --mode docker --force

# Validate environment
pnpm run dx:env:validate

# Full development startup
pnpm run dx         # Local mode
pnpm run dx:docker  # Docker mode
```

## Troubleshooting
For a single, canonical list of symptoms → causes → fixes, see
[Common Issues + Fixes](getting-started/troubleshooting.md).

### Runtime mode quick triage
- **Symptom: UI changes do not reload**
  - Verify `VITE_HMR_PORT` is published and not blocked by another process.
  - In Docker mode, keep `VITE_HOST=0.0.0.0` so the dev server is reachable from outside the container.
- **Symptom: reload works intermittently / stale builds**
  - Enable polling watchers in Docker mode (`VITE_USE_POLLING=true`) and restart the frontend container.
  - If you do not need containerized app runtime, switch to local mode for direct host file watching.
- **Symptom: high CPU while editing files**
  - Polling watchers trade CPU for reliability on mounted volumes.
  - Prefer local mode for lower watcher overhead, or tune polling interval in frontend config if needed.

## For Contributors

### Never Edit `ops/env/.env.local` Manually

Always use the env-compiler:

```bash
pnpm run dx:env -- --mode local --force
```

Manual edits will be overwritten and may introduce contradictions.

### Adding New Environment Variables

1. Add to `scripts/dx/env-compiler.js` in the `generateEnvLocal()` function
2. Add validation in `validateEnvLocal()` if needed
3. Update `config/ports.json` if it's a port

### Testing Environment Changes

```bash
pnpm run dx:env -- --mode local --force
pnpm run dx:env:validate

pnpm run dx:env -- --mode docker --force
pnpm run dx:env:validate
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    env-compiler.js                          │
│                 (Single Source of Truth)                    │
├─────────────────────────────────────────────────────────────┤
│  Inputs:                                                    │
│  - config/ports.json (port definitions)                     │
│  - --mode flag (local or docker)                            │
│                                                             │
│  Outputs:                                                   │
│  - ops/env/.env.local (main env file)                       │
│  - ops/env/.env.ports (port mappings)                       │
│  - deploy/envs/.env.ports (legacy Docker Compose)           │
├─────────────────────────────────────────────────────────────┤
│  Validation:                                                │
│  - Mode consistency                                         │
│  - URL/DNS correctness for mode                             │
│  - No placeholder values                                    │
│  - Deprecated key warnings                                  │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Consumers                                │
├─────────────────────────────────────────────────────────────┤
│  - Vite (reads VITE_* at build time)                        │
│  - Node backend (reads at runtime)                          │
│  - Docker Compose (reads .env.ports)                        │
│  - Supabase CLI (reads SUPABASE_*)                          │
│  - CI workflows (validates before tests)                    │
└─────────────────────────────────────────────────────────────┘
```

## Related Commands

```bash
pnpm run dx:doctor   # Check all prerequisites
pnpm run db:verify   # Verify database schema
pnpm run health      # Check service health
```

---
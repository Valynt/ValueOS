# ValueOS: Multi-Agent Fabric Observability & Debugging Guide

This guide provides a deep technical walkthrough of the **ValueOS Observability Stack**, designed for senior engineers managing complex autonomous agent interactions. In a multi-agent environment where non-deterministic LLM outputs are the norm, standard logging is insufficient. ValueOS employs a **Deep Trace Architecture** to provide bit-level visibility into agent reasoning, tool execution, and context propagation.

---

## 1. The Deep Trace Philosophy
Standard observability tracks request/response cycles. **ValueOS Deep Trace** treats every agent "thought process" as a parent Span and every subsequent tool call or sub-agent invocation as a child Span. This allows engineers to reconstruct the exact state of the `ContextFabric.ts` at any point in the agent's execution lifecycle.

### Core Telemetry Flow
> **Agent (OTel SDK)** → **OTel Collector** → **Jaeger (Traces)** / **Prometheus (Metrics)** → **Grafana**

---

## 2. Infrastructure Configuration
The local environment is orchestrated via **Nix Flakes** and **DevContainers**, ensuring the observability sidecars are identical across all engineering workstations.

### 2.1 Service Map
| Service | Role | Access Port |
| :--- | :--- | :--- |
| **OTel Collector** | Central telemetry processor and batcher. | `4317` (gRPC), `4318` (HTTP) |
| **Jaeger** | Distributed tracing UI and backend. | `16686` |
| **Prometheus** | Time-series database for token usage and latency. | `9090` |
| **Grafana** | Mission Control: Unified dashboards. | `3000` |
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
  otlp/jaeger:
    endpoint: jaeger:4317
    tls:
      insecure: true
  prometheus:
    endpoint: "0.0.0.0:8889"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp/jaeger]
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
`ContextFabric.ts` ensures that the "Short-term Memory" of an agent is visible in Jaeger. By attaching the `context_window` as a Span Event, we can see exactly what data was sent to the LLM during a specific tool call.

### 3.3 BenchmarkAgent: Performance Analysis
The `BenchmarkAgent` uses OTel metrics to track **Tokens Per Second (TPS)** and **Time To First Token (TTFT)**. These metrics are scraped by Prometheus and visualized in the Grafana "Agent Performance" dashboard.

---

## 4. Debugging & Observability Pro-Tips

### Identifying Hallucination Risks
In the ValueOS environment, agents are programmed to return a `confidence_score` (0.0 to 1.0) along with their reasoning. This score is automatically injected into OTel Span attributes.

> **Pro-Tip: Hallucination Detection**
> 
> Open **Jaeger** and filter by tags: `confidence_score < 0.7`. 
> 
> Spans matching this filter represent high-risk outputs. Examine the `context.snippet` attribute in these traces to see if the agent had insufficient RAG (Retrieval-Augmented Generation) data, which is the primary driver of hallucinations in the Sales Enablement Platform.

### Monitoring Confidence Scores in Grafana
Use the following Prometheus query to create an alert for a "Hallucination Spike" across the entire `AgentFabric`:

```promql
avg(agent_confidence_score) by (agent_id) < 0.65
```

### Trace Correlation with Supabase
When an agent writes to the local Supabase instance, the `supabase_request_id` is linked to the OTel `trace_id`. If a database record looks corrupted, copy the `trace_id` from the Supabase `audit_logs` and paste it into Jaeger to see the thought process that led to that specific write.

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

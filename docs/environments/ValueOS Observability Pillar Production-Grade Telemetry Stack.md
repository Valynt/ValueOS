This document defines the **Observability Pillar** for ValueOS, providing a production-grade telemetry stack. This configuration implements the "Deep Trace" architecture, enabling granular monitoring of agent-to-agent communication, tool execution, and LLM costs through an OpenTelemetry-native pipeline.

### 1. Architectural Overview
The observability stack is designed to intercept all agent activity. The flow follows a structured path from ingestion to visualization:

1.  **Ingestion**: Agents and the LiteLLM proxy emit OTLP (OpenTelemetry Protocol) signals.
2.  **Processing**: The **OTel Collector** aggregates, batches, and processes these signals.
3.  **Storage**: Traces are sent to **Jaeger**; Metrics are exposed to **Prometheus**.
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

  # --- Jaeger: Distributed Tracing ---
  jaeger:
    image: jaegertracing/all-in-one:1.50
    container_name: valueos-jaeger
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    ports:
      - "16686:16686" # UI
      - "4317"        # OTLP gRPC (Internal)
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
      - jaeger
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
  otlp/jaeger:
    endpoint: jaeger:4317
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
      exporters: [otlp/jaeger]
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

1.  **Initialization**: Ensure the `infra/` directory exists before running `docker compose up`.
2.  **LiteLLM Integration**: Point the ValueOS application's LLM client to `http://localhost:4000/v1`. This ensures all traffic is captured by the gateway.
3.  **Instrumentation**: Agents must use the OTel SDK with `OTEL_EXPORTER_OTLP_ENDPOINT` set to the collector's address.
4.  **Security**: The `valueos-net` bridge provides internal DNS and prevents external services from accessing the Prometheus/OTel ports unless explicitly mapped to the host.

> **Warning**: Never commit your `TOGETHERAI_API_KEY` to version control. Use the `secrets.nix` or `.env.local` patterns defined in the Environment Engineering Spec.

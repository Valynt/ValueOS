# Agent-Specific Observability Guide

## Overview

This guide shows how to monitor multi-agent systems using the extended LGTM stack. It covers the two critical aspects of agentic system observability:

1. **Agent Behavior** - Reasoning, tool usage, memory, safety, context
2. **System Reliability** - Latency, cost, failures, dependencies

## Agent Behavior Monitoring

### Key Metrics

#### Reasoning Quality

```promql
# Reasoning success rate
rate(agent_reasoning_attempts_total[5m]) - rate(agent_reasoning_errors_total[5m])

# Average reasoning duration by agent
avg by(agent_id) (agent_reasoning_duration_seconds)

# Reasoning errors by type
rate(agent_reasoning_errors_total[5m]) by (agent_id, reasoning_type)
```

#### Tool Usage Correctness

```promql
# Tool invocation success rate
(rate(agent_tool_invocations_total[5m]) - rate(agent_tool_errors_total[5m])) / rate(agent_tool_invocations_total[5m])

# Most used tools
topk(10, sum by(tool) (rate(agent_tool_invocations_total[5m])))

# Tool error rate by tool
rate(agent_tool_errors_total[5m]) by (tool)
```

#### Memory Consistency

```promql
# Memory inconsistencies detected
rate(agent_memory_inconsistencies_total[5m]) by (agent_id, type)

# Memory operations per second
rate(agent_memory_retrievals_total[5m]) + rate(agent_memory_stores_total[5m])

# Memory retrieval vs store ratio
rate(agent_memory_retrievals_total[5m]) / rate(agent_memory_stores_total[5m])
```

#### Safety Boundaries

```promql
# Safety violations by severity
rate(agent_safety_violations_total[5m]) by (severity)

# Content filtering rate
rate(agent_content_filtered_total[5m]) by (check_type)

# Safety violation percentage
rate(agent_safety_violations_total[5m]) / rate(agent_reasoning_attempts_total[5m]) * 100
```

#### Context Handling

```promql
# Context switches per minute
rate(agent_context_switches_total[1m]) by (from_agent, to_agent)

# Average context size
avg(agent_context_size_bytes) by (from_agent, to_agent)

# Conversation turn distribution
histogram_quantile(0.95, sum by(le) (rate(agent_conversation_turns_bucket[5m])))
```

### LogQL Queries for Agent Logs

```logql
# All agent reasoning operations
{agent_id=~".+"} |= "reasoning"

# Failed tool invocations
{agent_id=~".+"} | json | level="error" | error_type=~".+"

# Safety violations
{agent_id=~".+"} | json | violation_type=~".+"

# Agent context switches
{from_agent=~".+"} |= "context switch"

# Memory inconsistencies
{agent_id=~".+"} |= "memory inconsistency"
```

## System Reliability Monitoring

### Key Metrics

#### LLM Performance & Cost

```promql
# Average LLM latency by provider
avg by(provider, model) (system_llm_latency_seconds)

# LLM tokens per minute
rate(system_llm_tokens_total[1m]) by (provider, model)

# LLM cost per hour
rate(system_llm_cost_usd_total[1h]) by (provider, model)

# LLM error rate
rate(system_dependency_errors_total{dependency="llm"}[5m]) by (provider)
```

#### Dependency Health

```promql
# Dependency latency by service
avg by(service) (system_dependency_latency_seconds)

# Dependency error rate
rate(system_dependency_errors_total[5m]) by (service)

# Unhealthy dependencies
sum by(service) (system_health_check_failures_total)
```

#### Failure Recovery

```promql
# System failure rate
rate(system_failures_total[5m]) by (component, severity)

# Recovery success rate
rate(system_recoveries_total[5m]) / rate(system_failures_total{recoverable="true"}[5m])

# Circuit breaker state changes
rate(system_circuit_breaker_state_changes_total[5m]) by (service, to_state)

# Retry attempts
rate(system_retry_attempts_total[5m]) by (operation, success)
```

#### Throughput & Availability

```promql
# Agent interactions per second
rate(system_agent_interactions_total[1m]) by (type)

# System requests per second
rate(system_requests_total[1m]) by (endpoint)

# Health check success rate
(rate(system_health_checks_total[5m]) - rate(system_health_check_failures_total[5m])) / rate(system_health_checks_total[5m])
```

## Alerting Rules

### Critical Agent Alerts

```yaml
# prometheus/alerts/agent-alerts.yml
groups:
  - name: agent_behavior
    interval: 30s
    rules:
      # High reasoning error rate
      - alert: HighAgentReasoningErrorRate
        expr: rate(agent_reasoning_errors_total[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High agent reasoning error rate ({{ $value }} errors/sec)"

      # Safety violations detected
      - alert: AgentSafetyViolations
        expr: rate(agent_safety_violations_total{severity=~"high|critical"}[5m]) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Agent safety violations detected"

      # Memory inconsistencies
      - alert: AgentMemoryInconsistencies
        expr: rate(agent_memory_inconsistencies_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Agent memory inconsistencies detected"

  - name: system_reliability
    interval: 30s
    rules:
      # High LLM latency
      - alert: HighLLMLatency
        expr: avg by(provider, model) (system_llm_latency_seconds) > 5
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "High LLM latency for {{ $labels.provider }}/{{ $labels.model }}"

      # LLM service unavailable
      - alert: LLMServiceDown
        expr: rate(system_dependency_errors_total{dependency="llm"}[5m]) > 0.5
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "LLM service experiencing high error rate"

      # Circuit breaker opened
      - alert: CircuitBreakerOpen
        expr: rate(system_circuit_breaker_state_changes_total{to_state="open"}[5m]) > 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Circuit breaker opened for {{ $labels.service }}"
```

## Trace Analysis

### Key Trace Patterns

#### Multi-Agent Workflow

```
Trace: user_request_12345
├─ Span: agent.reasoning (agent-1)
│  ├─ Span: agent.memory.retrieve
│  ├─ Span: llm.together.chat
│  └─ Span: agent.tool.ResearchCompanyTool
│     └─ Span: dependency.company-research-api
├─ Span: agent.context_switch (agent-1 → agent-2)
└─ Span: agent.reasoning (agent-2)
   ├─ Span: agent.memory.retrieve
   └─ Span: llm.together.completion
```

#### LLM Call Pattern

```
Span: llm.together.chat
├─ Attributes:
│  ├─ llm.provider: together
│  ├─ llm.model: Llama-3.3-70B-Instruct-Turbo
│  ├─ llm.input_tokens: 1500
│  ├─ llm.output_tokens: 300
│  └─ llm.cost: 0.0015
└─ Duration: 2.3s
```

## Usage Examples

### Instrumenting Agent Reasoning

```typescript
import { trackReasoning } from "./observability/agent-instrumentation";

const response = await trackReasoning(
  {
    agentId: "valueos-agent-1",
    conversationId: "conv-123",
    turnNumber: 5,
    reasoningType: "planning",
    inputTokens: 1500,
    outputTokens: 300,
  },
  async (span) => {
    // Your reasoning logic
    const result = await performReasoning();
    return result;
  }
);
```

### Instrumenting LLM Calls

```typescript
import { trackLLMCall } from "./observability/system-instrumentation";

const llmResponse = await trackLLMCall(
  {
    provider: "together",
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    operation: "chat",
    inputTokens: 1500,
    outputTokens: 300,
    estimatedCost: 0.0015,
  },
  async (span) => {
    // LLM API call
    return await llmClient.chat(messages);
  }
);
```

### Tracking Tool Usage

```typescript
import { trackToolInvocation } from "./observability/agent-instrumentation";

const toolResult = await trackToolInvocation(
  {
    agentId: "valueos-agent-1",
    toolName: "ResearchCompanyTool",
    conversationId: "conv-123",
    turnNumber: 5,
  },
  async (span) => {
    // Tool execution
    return await executeTool(input);
  }
);
```

## Dashboard Recommendations

### Agent Performance Dashboard

**Panels:**

1. Reasoning Success Rate (gauge)
2. Tool Invocation Success Rate (gauge)
3. Average Reasoning Duration (graph)
4. Safety Violations (counter)
5. Memory Inconsistencies (graph)
6. Context Switches (heatmap)

### LLM Cost & Performance Dashboard

**Panels:**

1. LLM Cost per Hour (graph)
2. Tokens per Minute (graph)
3. LLM Latency by Provider (graph)
4. LLM Error Rate (graph)
5. Top Models by Usage (table)
6. Cost per Model (pie chart)

### System Reliability Dashboard

**Panels:**

1. Dependency Health (status map)
2. Circuit Breaker States (status panel)
3. Failure Rate (graph)
4. Recovery Success Rate (gauge)
5. Request Throughput (graph)
6. System Availability (gauge)

## Best Practices

### 1. Agent Behavior

✅ **Track all reasoning operations** - Understand agent decision-making
✅ **Monitor tool usage patterns** - Detect incorrect tool selections
✅ **Validate memory consistency** - Prevent data corruption
✅ **Enforce safety boundaries** - Catch violations early
✅ **Track context switches** - Optimize multi-agent coordination

### 2. System Reliability

✅ **Monitor LLM latency & cost** - Control expenses and performance
✅ **Track dependency health** - Detect external service issues
✅ **Implement circuit breakers** - Prevent cascade failures
✅ **Log failure recovery** - Improve resilience strategies
✅ **Measure throughput** - Understand system capacity

### 3. Operational Guidelines

- Set up alerts for critical metrics (safety violations, high error rates)
- Review agent behavior dashboards daily
- Analyze cost trends weekly
- Investigate memory inconsistencies immediately
- Track reasoning accuracy over time
- Monitor multi-agent interaction patterns

## Troubleshooting Agent Issues

### High Reasoning Error Rate

1. Check LLM error logs: `{agent_id=~".+"} | json | level="error"`
2. Verify prompt quality
3. Check input context size
4. Review model temperature settings

### Memory Inconsistencies

1. Query memory operations: `{agent_id=~".+"} |= "memory inconsistency"`
2. Check database connection health
3. Verify concurrent access patterns
4. Review memory cleanup processes

### Excessive LLM Costs

1. Analyze token usage: `system_llm_tokens_total`
2. Check for retry loops
3. Review context window sizes
4. Consider model downgrading for simple tasks

## Next Steps

1. Import Grafana dashboards from `observability/grafana/dashboards/`
2. Configure alerting rules in Prometheus
3. Set up log aggregation for agent logs in Loki
4. Create custom dashboards for your specific agents
5. Establish baseline metrics for normal operation
6. Define SLOs for agent performance

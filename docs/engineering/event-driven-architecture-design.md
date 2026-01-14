# Event-Driven Architecture Design for ValueOS

## Overview

Migrate from monolithic synchronous backend to event-driven architecture using Kafka for agent communications, implementing saga patterns for workflow reliability, and event sourcing for audit trails.

## Current Bottlenecks

- Agent invocations are synchronous, blocking request threads
- Complex workflows with multiple agent calls cause timeouts
- No decoupling between services
- Limited horizontal scalability for agent orchestrations

## Architecture Components

### 1. Message Broker: Apache Kafka

**Rationale**: High-throughput, durable messaging for agent communications. Better than RabbitMQ for:

- High-volume agent orchestrations
- Event sourcing capabilities
- Horizontal scalability
- Fault tolerance

**Configuration**:

- Topics: `agent-requests`, `agent-responses`, `workflow-events`, `saga-commands`
- Partitions: Multiple partitions per topic for parallel processing
- Retention: 7 days for operational events, indefinite for audit trails

### 2. Event Schema Design

#### Core Event Types

```typescript
interface AgentRequestEvent {
  eventId: string;
  correlationId: string;
  agentId: string;
  userId: string;
  sessionId: string;
  query: string;
  context?: any;
  parameters?: Record<string, any>;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface AgentResponseEvent {
  eventId: string;
  correlationId: string;
  agentId: string;
  response: any;
  error?: string;
  latency: number;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  timestamp: Date;
}

interface WorkflowStepEvent {
  eventId: string;
  workflowId: string;
  stepId: string;
  stepType: "agent_call" | "data_processing" | "decision" | "end";
  status: "started" | "completed" | "failed";
  input: any;
  output?: any;
  error?: string;
  timestamp: Date;
}

interface SagaCommandEvent {
  eventId: string;
  sagaId: string;
  command: "start_saga" | "compensate" | "complete_saga";
  sagaType: string;
  payload: any;
  timestamp: Date;
}
```

### 3. Saga Pattern Implementation

**Purpose**: Ensure workflow reliability and error handling

**Saga Types**:

- Agent Orchestration Saga: Coordinates multiple agent calls
- Data Processing Saga: Handles complex data transformations
- Approval Workflow Saga: Manages multi-step approval processes

**Saga States**:

- STARTED
- AGENT_CALL_PENDING
- AGENT_RESPONSE_RECEIVED
- PROCESSING
- COMPENSATING (on failure)
- COMPLETED
- FAILED

### 4. Event Sourcing for Audit Trails

**Event Store**: Dedicated Kafka topics with long retention
**Projection**: Materialized views for:

- Agent performance metrics
- Workflow completion rates
- User activity logs
- System health monitoring

### 5. Service Decomposition

#### Agent Orchestrator Service

- Receives agent requests via REST API
- Publishes `AgentRequestEvent` to Kafka
- Subscribes to `AgentResponseEvent` for completion
- Manages saga coordination

#### Agent Executor Service (Multiple Instances)

- Subscribes to `AgentRequestEvent`
- Executes agent logic
- Publishes `AgentResponseEvent`
- Handles retries and circuit breaking

#### Workflow Engine Service

- Manages complex multi-step workflows
- Implements saga patterns
- Publishes workflow step events

#### Event Processor Service

- Consumes all events for audit logging
- Maintains event-sourced projections
- Provides query APIs for historical data

### 6. Data Flow

1. **Request Flow**:

   ```
   HTTP Request → Orchestrator → Kafka (AgentRequestEvent) → Agent Executor → Kafka (AgentResponseEvent) → Orchestrator → HTTP Response
   ```

2. **Workflow Flow**:

   ```
   HTTP Request → Workflow Engine → Saga Start → Multiple Agent Calls → Saga Completion → HTTP Response
   ```

3. **Audit Flow**:
   ```
   All Events → Event Processor → Event Store → Projections → Query APIs
   ```

### 7. Infrastructure Changes

#### Docker Compose Updates

- Add Kafka and Zookeeper services
- Add Schema Registry for event schema validation
- Configure topic replication and partitioning

#### Database Schema Extensions

- Event store tables (if not using Kafka for persistence)
- Saga state tables
- Projection tables for materialized views

### 8. Migration Strategy

#### Phase 1: Infrastructure Setup

- Deploy Kafka cluster
- Set up monitoring and observability
- Create initial topics and schemas

#### Phase 2: Event Infrastructure

- Implement event publishing/consuming base classes
- Add event schema validation
- Set up event processors

#### Phase 3: Agent Refactoring

- Convert synchronous agent calls to async event-driven
- Implement agent executor service
- Add saga coordination for complex workflows

#### Phase 4: Workflow Migration

- Migrate existing workflow logic to saga patterns
- Implement compensation logic for error handling
- Add event sourcing for audit trails

#### Phase 5: API Updates

- Update REST APIs to return job IDs for async operations
- Add status polling endpoints
- Implement webhook callbacks for completion

### 9. Benefits Expected

#### Scalability

- Horizontal scaling of agent executors
- Parallel processing of independent workflow steps
- Load balancing across multiple service instances

#### Reliability

- Fault tolerance through event persistence
- Saga compensation for partial failures
- Circuit breakers and retry mechanisms

#### Observability

- Complete audit trails via event sourcing
- Real-time monitoring of workflow progress
- Performance metrics for all agent interactions

#### Maintainability

- Loose coupling between services
- Easier testing through event isolation
- Clear separation of concerns

### 10. Risks and Mitigations

#### Complexity Increase

- **Risk**: Event-driven systems are more complex to debug
- **Mitigation**: Comprehensive logging, distributed tracing, event replay capabilities

#### Eventual Consistency

- **Risk**: Data consistency challenges
- **Mitigation**: Saga patterns, compensation logic, idempotent operations

#### Performance Overhead

- **Risk**: Message serialization/deserialization overhead
- **Mitigation**: Efficient serialization (Protocol Buffers), batch processing, optimized Kafka configuration

#### Operational Complexity

- **Risk**: Managing Kafka cluster in production
- **Mitigation**: Use managed Kafka (AWS MSK, Confluent Cloud), automated monitoring, runbooks

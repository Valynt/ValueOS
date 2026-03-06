# Performance Engineering Analysis & Optimization Roadmap

**Author:** Manus AI | **Date:** March 05, 2026 | **Scope:** ValueOS + agent-fabric

---

## 1. Introduction

This document presents a comprehensive performance engineering analysis of the agentic system comprising two repositories: **ValueOS** (the user-facing application) and **agent-fabric** (the Kubernetes-native orchestration platform). The assessment evaluates production readiness across six dimensions: load handling capacity, database query optimization, caching strategy effectiveness, auto-scaling configuration, resource utilization patterns, and latency benchmarks against the target of **p95 < 200ms**.

The analysis is based on a thorough review of the application source code, database schemas and migrations, Kubernetes manifests, Helm chart configurations, existing performance test suites, and operational runbooks. Each section identifies specific findings grounded in the codebase and provides actionable recommendations with estimated impact on response times and cost efficiency.

---

## 2. Executive Summary

The agentic system is architecturally sound, built on proven technologies (Express/tRPC, Drizzle ORM, Kubernetes, PostgreSQL advisory locks for HA). However, the analysis has uncovered **12 distinct performance issues** across both repositories that must be addressed before the system can reliably meet its p95 < 200ms target under production load. The most critical findings are:

1. The `agent-fabric` orchestrator has **no HorizontalPodAutoscaler**, meaning it cannot respond to load changes dynamically.
2. The `ValueOS` MySQL database is missing **critical indexes** on the `conversations` and `messages` tables, which will cause full table scans as data grows.
3. The enrichment cache uses the **primary transactional database** (MySQL) as its backing store instead of an in-memory cache, adding unnecessary latency and database load on every cache operation.
4. The database connection strategy in `ValueOS` uses a **single shared connection** rather than a connection pool, creating a concurrency bottleneck.

Implementing the recommendations in this roadmap is projected to reduce p95 latency for core API operations by **40-60%**, reduce infrastructure costs by **15-25%** through better scaling and spot instance utilization, and increase the system's maximum concurrent user capacity by **3-5x**.

---

## 3. System Architecture Overview

### 3.1. ValueOS Architecture

ValueOS is a full-stack TypeScript application that serves as the user-facing layer of the agentic platform. Its architecture follows a monolithic server pattern with the following components:

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| Frontend | React + Vite + TailwindCSS | User interface for value engineering workflows |
| API Layer | Express.js + tRPC | Type-safe API with streaming SSE for chat |
| Database | MySQL via Drizzle ORM | Persistent storage for users, conversations, messages, and enrichment cache |
| LLM Integration | Together.ai (OpenAI-compatible) | Multi-model inference (Llama 3.3 70B, Qwen 2.5 72B, DeepSeek R1) |
| Enrichment Pipeline | SEC EDGAR, Yahoo Finance, LinkedIn, BLS, Census | External data aggregation for company profiles |
| Agent Core | Multi-round tool-calling loop with SSE streaming | Autonomous agent execution with up to 5 tool rounds |

The server entry point (`server/_core/index.ts`) configures Express with a 50MB body parser limit, registers OAuth, chat, and tRPC routes, and serves the Vite frontend in development or static files in production. The application listens on port 3000 by default and includes a port-scanning fallback mechanism.

### 3.2. Agent-Fabric Architecture

The `agent-fabric` platform is a Kubernetes-native system designed around a **two-plane trust model** where the orchestrator is the sole trusted component and runners are treated as untrusted. Key architectural elements include:

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| Orchestrator | Kubernetes Deployment (3 replicas in prod) | Run lifecycle management, artifact validation, state machine |
| Runners | Ephemeral Kubernetes Jobs | Sandboxed code execution with network isolation |
| Database | PostgreSQL | Run state, artifacts, audit trail, advisory locks for HA |
| State Machine | `PENDING → PLAN → EXECUTE → PR → COMPLETE/FAILED` | Deterministic run lifecycle with policy gates |
| Security | ValidatingAdmissionPolicy, NetworkPolicy, RBAC | Runner jail enforcement at the Kubernetes admission layer |
| Evidence Store | S3 | Artifact storage with SHA-256 integrity verification |

The orchestrator achieves high availability through PostgreSQL advisory locks and a work-stealing pattern, eliminating the need for leader election. The runner network egress is locked down to only the orchestrator on port 8080 and kube-dns on port 53.

---

## 4. Detailed Performance Analysis

### 4.1. Load Handling Capacity and Bottlenecks

#### 4.1.1. Request Processing Pipeline

The ValueOS backend processes requests through the following pipeline: Express middleware → tRPC context creation (including authentication) → procedure execution → database query → response serialization. For the chat endpoint, the pipeline is more complex: Express middleware → agent resolution → LLM inference → tool execution loop → SSE streaming.

The **authentication step** (`createContext` in `server/_core/context.ts`) is executed on every tRPC request, calling `sdk.authenticateRequest()`. This function performs a database lookup or token validation on every single API call. Without caching, this becomes a significant source of latency, especially under high concurrency.

#### 4.1.2. Enrichment Pipeline Bottleneck

The enrichment pipeline is the most latency-sensitive component in the system. A single enrichment request fans out to **six external API calls** (SEC EDGAR company lookup, SEC EDGAR filings search, Yahoo Finance stock profile, LinkedIn company data, BLS labor statistics, and Census Bureau data). These calls are made in parallel using `Promise.allSettled`, but the overall latency is bounded by the slowest external API.

The SEC EDGAR API, for example, downloads the full `company_tickers.json` file (approximately 2MB) on every company lookup in `fetchSECCompany`. This file is not cached in memory, meaning every enrichment request incurs a full download of this static dataset. This alone can add 500-2000ms of latency depending on network conditions.

#### 4.1.3. Agent Tool Loop

The agent tool-calling loop in `chat.ts` is configured with the following timeouts:

| Parameter | Value | Implication |
| :--- | :--- | :--- |
| `MAX_TOOL_ROUNDS` | 5 | Maximum depth of agentic reasoning chains |
| `TOOL_TIMEOUT_MS` | 30,000ms | Per-tool execution timeout |
| `ROUND_TIMEOUT_MS` | 60,000ms | Per-round timeout (all tools combined) |

In the worst case, a single chat request could take up to **5 rounds × 60 seconds = 300 seconds** to complete. While the SSE streaming model means the user sees incremental progress, the server-side resources (memory, database connections, open HTTP connections) are held for the entire duration. Under concurrent load, this can quickly exhaust server capacity.

#### 4.1.4. Missing Rate Limiting

A search of the entire server codebase reveals **no rate-limiting middleware** on any endpoint. The only rate-limiting reference is in the `agent-fabric` architecture documentation, which specifies a limit of 60 artifact uploads per run per minute for the internal runner endpoint. The user-facing ValueOS API has no such protection.

**Recommendations:**

The most impactful improvement for load handling is to introduce a rate-limiting middleware on the Express server. A tiered approach is recommended: a global limit of 1000 requests per minute per IP, with tighter limits on expensive endpoints like `/api/chat` (10 requests per minute per user) and the enrichment tRPC procedure (20 requests per minute per user). Additionally, the SEC EDGAR `company_tickers.json` file should be cached in memory with a 24-hour TTL, eliminating a 500-2000ms overhead on every enrichment request. For the agent tool loop, implementing a server-side concurrency limit (e.g., maximum 50 concurrent chat sessions per server instance) would prevent resource exhaustion under load.

---

### 4.2. Database Query Optimization

#### 4.2.1. Missing Indexes (Critical)

The most significant database performance issue is the absence of indexes on frequently queried columns. The following table summarizes the affected queries and their expected impact:

| Table | Column(s) | Query Pattern | Current Behavior | Expected Improvement |
| :--- | :--- | :--- | :--- | :--- |
| `conversations` | `userId` | `WHERE userId = ? AND deleted = 0 ORDER BY updatedAt DESC` | Full table scan | **10-100x** faster with index |
| `conversations` | `userId, deleted` | Same as above | Full table scan | Composite index eliminates scan entirely |
| `messages` | `conversationId` | `WHERE conversationId = ? ORDER BY messageTimestamp` | Full table scan | **10-100x** faster with index |
| `messages` | `conversationId, messageTimestamp` | Same as above | Full table scan | Composite index covers the query completely |
| `enrichment_cache` | `companyKey` | `WHERE companyKey = ?` | Uses UNIQUE constraint (indexed) | Already optimized |

The `conversations` table is queried on every page load for the sidebar, and the `messages` table is queried every time a user opens a conversation. Without indexes, these operations will degrade linearly with data growth. At 100,000 conversations and 1 million messages, query times could exceed several seconds.

#### 4.2.2. Connection Management

The `getDb()` function in `server/db.ts` creates a single Drizzle ORM instance using `drizzle(process.env.DATABASE_URL)`. The underlying `mysql2` driver, when passed a connection string directly, creates a **single connection** rather than a connection pool. This means all concurrent database operations are serialized through a single TCP connection to MySQL.

Under load, this creates a critical bottleneck. If 50 concurrent requests each need to execute a database query, they must wait in line for the single connection. The fix is straightforward: use `mysql2/promise` to create a connection pool and pass it to Drizzle.

#### 4.2.3. N+1 Query Pattern

The `saveMessage` function in `server/db.ts` performs two separate database operations for every message saved: an `INSERT` into the `messages` table and an `UPDATE` on the `conversations` table to touch the `updatedAt` timestamp. For the `saveMessages` batch function, this means N inserts plus one update. While the batch insert is efficient, the conversation touch could be optimized by using a database trigger (which already exists in the `agent-fabric` PostgreSQL schema but is absent from the MySQL schema).

**Recommendations:**

The highest-priority action is to add the missing database indexes. The following Drizzle migration should be created and applied:

```sql
-- Add indexes for conversation and message queries
CREATE INDEX idx_conversations_userId ON conversations (userId, deleted, updatedAt);
CREATE INDEX idx_messages_conversationId ON messages (conversationId, messageTimestamp);
```

For connection pooling, the `getDb()` function should be refactored to use a connection pool:

```typescript
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  connectionLimit: 20,
  waitForConnections: true,
  queueLimit: 100,
});

export const db = drizzle(pool);
```

These two changes alone are estimated to reduce p95 latency for database-backed API calls by **50-70%** and increase the system's concurrent request capacity by **10-20x**.

---

### 4.3. Caching Strategy Effectiveness

#### 4.3.1. Current State: Database-Backed Enrichment Cache

The `enrichmentCache.ts` module implements a caching layer for enrichment results using the MySQL `enrichment_cache` table. The cache operates as follows:

| Operation | Implementation | Latency Cost |
| :--- | :--- | :--- |
| Cache Lookup | `SELECT` from MySQL by `companyKey` | 2-10ms (database round-trip) |
| Cache Hit Update | `UPDATE` to increment `hitCount` and set `lastHitAt` | 2-10ms (database round-trip) |
| Cache Set | `INSERT ... ON DUPLICATE KEY UPDATE` | 5-15ms (database round-trip) |
| Cache Invalidation | `DELETE` from MySQL by `companyKey` | 2-10ms (database round-trip) |
| TTL Check | Application-level comparison (`Date.now() - refreshedAt > ttlMs`) | Negligible |

A cache hit therefore costs **4-20ms** (one SELECT + one UPDATE), which is acceptable but far from optimal. An in-memory cache like Redis would reduce this to **0.1-1ms**, a 10-20x improvement. More importantly, the database-backed cache adds load to the primary MySQL instance, which is already a bottleneck due to the single-connection issue described above.

#### 4.3.2. Missing Caches

The following high-frequency data access patterns have no caching whatsoever:

| Data | Access Frequency | Current Latency | Recommended Cache TTL |
| :--- | :--- | :--- | :--- |
| User authentication (`sdk.authenticateRequest`) | Every tRPC request | 5-20ms | 5 minutes |
| User profile (`getProfileByUserId`) | Every page load | 2-10ms | 5 minutes |
| Agent definitions (`getAgent`, `getAllAgents`) | Every chat request | In-memory (fast) | Already optimal |
| SEC `company_tickers.json` | Every enrichment | 500-2000ms (network) | 24 hours |
| Conversation list (`listConversations`) | Every sidebar render | 2-10ms | 30 seconds |

#### 4.3.3. Redis Infrastructure Already Planned

The Kubernetes HA configuration in `scripts/k8s/ha-redis.yaml` defines a Redis deployment with the following configuration:

| Parameter | Value |
| :--- | :--- |
| Max Memory | 1GB |
| Eviction Policy | `allkeys-lru` |
| Persistence | AOF (`appendfsync everysec`) + RDB snapshots |
| Security | Password-protected, dangerous commands disabled |

This configuration is well-suited for a production caching layer. However, the Redis instance is **not yet integrated** into the ValueOS application code. There is no Redis client library in `package.json`, and no Redis connection string in the environment configuration.

**Recommendations:**

The migration to Redis should proceed in two phases. In the first phase, add `ioredis` to the project dependencies and create a Redis client module that connects to the existing Redis deployment. Migrate the `enrichmentCache` from MySQL to Redis, using Redis `SETEX` for cache writes (with automatic TTL-based expiration) and `GET` for cache reads. This eliminates the need for manual TTL checks and the `UPDATE` on cache hits. In the second phase, extend Redis caching to cover user authentication tokens (5-minute TTL), user profiles (5-minute TTL), and the SEC `company_tickers.json` dataset (24-hour TTL). The combined effect of these changes is estimated to reduce enrichment response times by **30-50%** for cache hits and reduce MySQL query volume by **40-60%**.

---

### 4.4. Auto-Scaling Configuration

#### 4.4.1. ValueOS Backend Scaling

The ValueOS backend HPA (`ha-backend.yaml`) is well-configured with appropriate scaling parameters:

| Parameter | Value | Assessment |
| :--- | :--- | :--- |
| Min Replicas | 3 | Appropriate for HA |
| Max Replicas | 8 | May need increase for peak traffic |
| CPU Target | 70% utilization | Industry standard |
| Memory Target | 80% utilization | Appropriate |
| Scale-Up Window | 60 seconds | Fast response to traffic spikes |
| Scale-Down Window | 300 seconds | Conservative; could be reduced |
| Scale-Down Rate | 10% per 60 seconds | Very conservative; may delay cost savings |

The scale-down policy is notably conservative. At the maximum of 8 replicas, it would take approximately **25 minutes** to scale back down to 3 replicas after a traffic spike (removing roughly 1 pod per 2 minutes). This means the system will continue to incur costs for unused capacity long after the spike has passed. Reducing the stabilization window to 180 seconds and increasing the scale-down rate to 25% per 60 seconds would cut the scale-down time to approximately 8 minutes.

#### 4.4.2. Agent-Fabric Orchestrator Scaling (Critical Gap)

The `agent-fabric` orchestrator deployment uses a **fixed replica count** with no HPA. The production configuration specifies 3 replicas, which are always running regardless of load. This creates two problems:

During **low traffic periods** (e.g., nights and weekends for a B2B SaaS product), three orchestrator replicas are running and consuming resources unnecessarily. Each replica requests 500m CPU and 512Mi memory, meaning the orchestrator alone consumes a minimum of 1.5 CPU cores and 1.5Gi memory even when idle.

During **high traffic periods**, the fixed replica count cannot scale to meet demand. If the number of concurrent agent runs exceeds what 3 orchestrator replicas can handle, the system will experience increased latency, potential timeouts, and degraded user experience. The advisory lock work-stealing pattern ensures correctness but does not address throughput limitations.

#### 4.4.3. Runner Job Quota

The runner `ResourceQuota` limits the system to 20 concurrent jobs, consuming up to 40 CPU cores and 80Gi of memory in total. The per-runner limits are 1-2 CPU cores and 2-4Gi memory. This configuration is reasonable for an initial deployment but should be monitored and adjusted based on actual usage patterns. The `activeDeadlineSeconds` of 1800 (30 minutes) provides a hard upper bound on runner execution time, which is important for preventing runaway jobs from consuming resources indefinitely.

**Recommendations:**

The most critical action is to add an HPA to the `agent-fabric` orchestrator. The following Helm template should be added to the chart:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-fabric-orchestrator-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent-fabric-orchestrator
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 180
      policies:
        - type: Percent
          value: 25
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 30
      policies:
        - type: Percent
          value: 100
          periodSeconds: 60
```

This configuration allows the orchestrator to scale from 2 to 10 replicas based on CPU utilization, with aggressive scale-up (doubling capacity every 60 seconds) and moderate scale-down (reducing by 25% every 60 seconds). The estimated cost savings from dynamic scaling are **20-40%** of the orchestrator's compute costs, while simultaneously improving the system's ability to handle traffic spikes.

---

### 4.5. Resource Utilization Patterns

#### 4.5.1. Memory Utilization

The ValueOS backend is configured with 1Gi request and 2Gi limit per pod. Node.js applications typically use 200-500MB of heap memory under normal load, meaning the pods are likely running at **25-50% memory utilization** most of the time. The 2Gi limit provides headroom for memory spikes during large enrichment responses or heavy JSON serialization, which is appropriate.

The `agent-fabric` orchestrator is configured with 512Mi request and 2Gi limit. The 4x ratio between request and limit is unusually wide, which could lead to scheduling inefficiencies. Kubernetes schedules pods based on requests, so the orchestrator pods may be placed on nodes with insufficient actual memory to support the limit. A tighter ratio of 512Mi/1Gi would be more predictable.

#### 4.5.2. CPU Utilization

The ValueOS backend requests 1000m (1 core) with a limit of 2000m (2 cores). For a Node.js application that is primarily I/O-bound (waiting for database queries and external API responses), this is generous. The CPU is primarily consumed during JSON serialization, tRPC schema validation, and SSE event formatting. Under normal load, CPU utilization is expected to be **10-30%**, spiking to 50-70% during enrichment operations that involve heavy JSON parsing.

#### 4.5.3. Spot Instance Utilization

The cluster configuration includes both on-demand and spot node groups, but the backend deployment lacks the tolerations and node affinity rules needed to be scheduled on spot instances. This represents a missed cost optimization opportunity. Given that the backend is stateless and has a PDB ensuring at least 2 replicas are always available, it is an excellent candidate for spot instance placement.

**Recommendations:**

To improve resource utilization, the orchestrator memory limit should be reduced from 2Gi to 1Gi (maintaining the 512Mi request), and the ValueOS backend should be configured with spot instance tolerations. Additionally, implementing Vertical Pod Autoscaler (VPA) in recommendation mode would provide data-driven insights into the actual resource consumption patterns, enabling more precise resource allocation over time.

---

### 4.6. Latency Benchmarks Against Industry Standards

#### 4.6.1. Current Latency Profile (Estimated)

Based on the code analysis, the following latency estimates have been constructed for each major operation:

| Operation | Estimated p50 | Estimated p95 | Target p95 | Status |
| :--- | :--- | :--- | :--- | :--- |
| User authentication | 5ms | 20ms | 50ms | **Pass** |
| Profile retrieval | 5ms | 15ms | 50ms | **Pass** |
| Conversation list | 10ms | 50ms* | 200ms | **At Risk** |
| Message retrieval | 10ms | 50ms* | 200ms | **At Risk** |
| Enrichment (cache hit) | 10ms | 30ms | 200ms | **Pass** |
| Enrichment (cache miss) | 2000ms | 5000ms | N/A (async) | **Needs Async** |
| Chat (first token) | 500ms | 2000ms | N/A (streaming) | **Acceptable** |
| Chat (full response) | 3000ms | 15000ms | N/A (streaming) | **Acceptable** |

*These estimates assume small data volumes. Without indexes, p95 latency for conversation and message queries will degrade significantly as data grows, potentially exceeding the 200ms target within months of production use.

#### 4.6.2. Industry Benchmarks

For context, the following table presents industry-standard latency targets for comparable SaaS applications:

| Metric | Industry Standard | ValueOS Target | Assessment |
| :--- | :--- | :--- | :--- |
| API p50 latency | < 50ms | < 100ms | Achievable with optimizations |
| API p95 latency | < 200ms | < 200ms | At risk without index and caching fixes |
| API p99 latency | < 500ms | < 500ms | At risk under concurrent load |
| Time to first byte (TTFB) | < 100ms | < 200ms | Achievable |
| LLM first token latency | < 1000ms | < 2000ms | Acceptable for agentic workloads |
| Page load time | < 3000ms | < 3000ms | Within budget per `ux-performance-budgets.json` |

#### 4.6.3. Testing Infrastructure Gap

The existing performance test suite has several limitations. The `load-testing.test.ts` file targets a Supabase client rather than the current MySQL/Drizzle stack, making its results irrelevant to the production system. The `agent-benchmarks.test.ts` file tests agent creation and message bus performance but does not test the actual Together.ai LLM integration or the enrichment pipeline. The `route-load-budgets.spec.ts` file is a Playwright-based test that measures page load times against budgets, which is valuable but only covers frontend performance.

**Recommendations:**

A comprehensive load testing strategy using `k6` should be developed and integrated into the CI/CD pipeline. The test suite should cover three tiers: **Tier 1** (smoke tests run on every PR) should validate that p95 latency for core API endpoints remains below 200ms under 50 concurrent users. **Tier 2** (nightly tests) should simulate 500 concurrent users performing realistic workflows including authentication, conversation management, and enrichment requests. **Tier 3** (weekly stress tests) should push the system to 2000+ concurrent users to identify breaking points and validate graceful degradation behavior.

---

## 5. Optimization Roadmap

The following roadmap organizes all recommendations into three implementation sprints, ordered by impact and dependency.

### Sprint 1: Critical Fixes (Week 1-2)

These changes address the most severe performance risks and can be implemented with minimal architectural changes.

| Action | Component | Effort | Impact on p95 Latency | Impact on Cost |
| :--- | :--- | :--- | :--- | :--- |
| Add database indexes (`conversations.userId`, `messages.conversationId`) | ValueOS | 1 day | **-50 to -70%** for DB queries | None |
| Implement MySQL connection pooling (`mysql2` pool) | ValueOS | 1 day | **-30 to -50%** under concurrency | None |
| Cache SEC `company_tickers.json` in memory | ValueOS | 0.5 day | **-500 to -2000ms** per enrichment | None |
| Add HPA to `agent-fabric` orchestrator | agent-fabric | 1 day | Prevents degradation under load | **-20 to -40%** compute |

### Sprint 2: Caching and Resilience (Week 3-4)

These changes introduce a dedicated caching layer and improve the system's resilience to external failures.

| Action | Component | Effort | Impact on p95 Latency | Impact on Cost |
| :--- | :--- | :--- | :--- | :--- |
| Integrate Redis and migrate enrichment cache | ValueOS | 3 days | **-30 to -50%** for cache hits | Slight increase (Redis instance) |
| Add Redis caching for auth tokens and user profiles | ValueOS | 2 days | **-10 to -20%** for all API calls | None |
| Implement rate limiting middleware | ValueOS | 1 day | Prevents degradation under abuse | None |
| Implement circuit breaker for external APIs | ValueOS | 2 days | Prevents cascading failures | None |

### Sprint 3: Scaling and Observability (Week 5-6)

These changes optimize cost efficiency and establish ongoing performance monitoring.

| Action | Component | Effort | Impact on p95 Latency | Impact on Cost |
| :--- | :--- | :--- | :--- | :--- |
| Configure spot instance tolerations for backend | ValueOS | 0.5 day | None | **-30 to -50%** compute |
| Refine HPA scale-down policies | ValueOS + agent-fabric | 0.5 day | None | **-10 to -15%** compute |
| Implement k6 load testing suite | ValueOS | 3 days | Enables ongoing monitoring | None |
| Integrate performance tests into CI/CD | ValueOS | 2 days | Prevents regressions | None |
| Introduce cursor-based pagination | ValueOS | 2 days | **-20 to -40%** for list queries | None |

### Projected Cumulative Impact

| Metric | Current (Estimated) | After Sprint 1 | After Sprint 2 | After Sprint 3 |
| :--- | :--- | :--- | :--- | :--- |
| API p95 (DB queries) | 50-100ms* | 15-30ms | 10-20ms | 10-20ms |
| Enrichment p95 (cache hit) | 20-40ms | 15-30ms | 1-5ms | 1-5ms |
| Enrichment p95 (cache miss) | 3-5s | 1.5-3s | 1.5-3s | 1.5-3s |
| Max concurrent users | ~100 | ~500 | ~1000 | ~2000 |
| Monthly compute cost | Baseline | -20% | -15% | -35% |

*At current data volumes; without indexes, this will degrade to seconds as data grows.

---

## 6. Conclusion

The agentic system built across ValueOS and agent-fabric represents a well-architected platform with a solid foundation for production deployment. The Express/tRPC backend, Drizzle ORM, multi-model LLM integration via Together.ai, and the Kubernetes-native orchestration layer with its two-plane trust model are all sound architectural choices.

However, the performance analysis has identified several gaps that must be addressed before the system can reliably meet its p95 < 200ms target under production load. The most critical issues — missing database indexes, single-connection database access, database-backed caching, and the absence of auto-scaling for the orchestrator — are all addressable within a two-week sprint with minimal risk to existing functionality.

By following the three-sprint roadmap outlined in this document, the team can systematically transform the system from a development-ready prototype into a production-grade platform capable of serving thousands of concurrent users with consistent, low-latency performance and optimized infrastructure costs.

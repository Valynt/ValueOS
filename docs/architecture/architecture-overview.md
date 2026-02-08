# Architecture Overview

**Last Updated**: 2026-02-08

**Consolidated from 8 source documents**

---

## Table of Contents

1. [Active Architectural Decisions](#active-architectural-decisions)
2. [ValueOS DX Architecture](#valueos-dx-architecture)
3. [Usage-Based Billing Strategic Blueprint](#usage-based-billing-strategic-blueprint)
4. [ValueOS Package Boundaries](#valueos-package-boundaries)
5. [Agent Containerization Architecture Design](#agent-containerization-architecture-design)
6. [ValueOS System Architecture Overview](#valueos-system-architecture-overview)
7. [Module Boundary Map](#module-boundary-map)
8. [System Invariants](#system-invariants)

---

## Active Architectural Decisions

*Source: `architecture/active-architectural-decisions.md`*

This document captures the key architectural decisions and security requirements extracted from the production readiness audit. These decisions guide the implementation and must be maintained for production stability.

## 1. Row Level Security (RLS) Policy Enforcement

**Decision:** Enforce strict tenant isolation at the database level using RLS policies.

**Rationale:** Prevent cross-tenant data leakage, which is a critical security risk.

**Implementation:**

- All tables must have RLS enabled
- Policies must check tenant_id explicitly
- NULL tenant_id values are rejected
- Audit triggers log suspicious access attempts

**Affected Tables:**

- agent_sessions
- agent_predictions
- workflow_executions
- canvas_data

**Status:** Requires implementation of migration script `20241213000000_fix_rls_tenant_isolation.sql`

## 2. Agent Error Handling and Circuit Breakers

**Decision:** All agent implementations must use secureInvoke() with circuit breaker protection.

**Rationale:** Prevent agent failures from crashing workflows and ensure cost controls on LLM calls.

**Implementation:**

- BaseAgent provides secureInvoke() method
- Circuit breaker integration for resilience
- Confidence scoring and validation
- Cost limits per call and timeout controls
- Structured error logging

**Status:** Requires refactoring all agents (OpportunityAgent, RealizationAgent, ExpansionAgent, IntegrityAgent) to use secureInvoke()

## 3. Logger Security - Secret Redaction

**Decision:** Implement automatic redaction of sensitive data in logs.

**Rationale:** Prevent exposure of secrets, API keys, passwords in CloudWatch/Datadog logs.

**Implementation:**

- Redact sensitive keys: password, token, secret, api_key, authorization, cookie
- Recursive redaction for nested objects
- Apply to all log levels and outputs
- Maintain log usability while protecting data

**Status:** Requires update to `src/lib/logger.ts` with redactSensitiveData function

## 4. SDUI Error Boundaries

**Decision:** Implement comprehensive error boundaries for Server-Driven UI components.

**Rationale:** Prevent single component failures from crashing the entire application.

**Implementation:**

- SDUIErrorBoundary component with graceful fallbacks
- Component-level isolation
- Error logging to monitoring systems
- Retry mechanisms for transient failures
- User-friendly error displays

**Status:** Requires implementation of `src/sdui/components/SDUIErrorBoundary.tsx` and integration into renderer

## 5. Deep Health Checks

**Decision:** Health checks must verify actual service connectivity, not just API responsiveness.

**Rationale:** Prevent routing traffic to broken instances with database or Redis failures.

**Implementation:**

- Check database connectivity with actual queries
- Verify Redis ping and operations
- Test agent service availability
- Return appropriate HTTP status codes (200/503)
- Include response times and error details

**Status:** Requires update to `src/api/health.ts` with deep dependency checks

## 6. Environment Variable Validation

**Decision:** Strict validation of environment variables at startup with clear error messages.

**Rationale:** Fail fast on configuration issues rather than runtime errors.

**Implementation:**

- Zod-based validation schema
- Required vs optional variables
- Pattern matching and custom validators
- Cross-dependency checks
- Security warnings for placeholder values

**Status:** Implemented in `scripts/env-validate.ts`

## 7. Secret Management in Environment Files

**Decision:** Never commit real secrets to version control; use placeholders and CI/CD secrets.

**Rationale:** Prevent credential exposure in repositories.

**Implementation:**

- Environment files contain placeholder values
- CI/CD pipelines inject real secrets
- Validation script warns on placeholder values
- Separate env files for different environments

**Status:** Environment files created with placeholders in `deploy/envs/`

## 8. Caddy Production Configuration

**Decision:** Use Caddy as production reverse proxy with automatic HTTPS and security headers.

**Rationale:** Simplify SSL management and provide security hardening.

**Implementation:**

- Automatic Let's Encrypt certificates
- Security headers (HSTS, CSP, etc.)
- Request body size limits
- Structured JSON logging
- Health check endpoints

**Status:** Configured in `infra/caddy/` with production-ready settings

## 9. Docker Compose Separation

**Decision:** Separate development dependencies from production deployment strategy.

**Rationale:** Development environments need flexibility; production needs optimization.

**Implementation:**

- `docker-compose.deps.yml` for dev services (postgres, redis)
- `infra/docker/docker-compose.prod.yml` for production deployment
- Optimized images and resource limits
- Secrets management via Docker secrets

**Status:** Separated configurations implemented

## Success Criteria

- 0 RLS bypass vulnerabilities verified
- 100% agent calls wrapped in circuit breakers
- 0 secrets in production logs
- SDUI components have error boundaries
- Health checks verify all dependencies
- Environment validation passes before deployment
- Secrets never committed to version control
- Production deployment uses optimized Docker images

## References

- PRODUCTION_READINESS_CRITICAL_GAPS.md (audit/)
- CADDY_IMPLEMENTATION_SUMMARY.md (caddy/)
- scripts/env-validate.ts

---

## ValueOS DX Architecture

*Source: `dx-architecture.md`*

## Overview

The ValueOS Developer Experience (DX) provides a reliable, deterministic way to set up and run the full development environment across different platforms (local, DevContainer, CI).

## Mental Model

```
DX Command Flow:
setup:local/ci → dx → orchestrator → [deps, supabase, migrations, backend, frontend]
```

### Environment Boundaries

- **Local Development**: Full DX with Docker dependencies, Supabase, and hot reloading
- **DevContainer**: Same as local, but with Docker socket mounting for Docker-in-Docker
- **CI**: No DX - use `setup:ci` + build commands only

### Supabase Lifecycle

1. **Detection**: Check `DX_FORCE_SUPABASE=1`, `DX_SKIP_SUPABASE=1`, or Docker availability
2. **Start**: If Docker works, start Supabase CLI
3. **Health Check**: Verify API availability (skip in containers due to port forwarding)
4. **Migrations**: Use Supabase DB URL with `?sslmode=disable` for local instances
5. **Fallback**: If Supabase fails, continue with dx postgres container

### Docker Socket Requirements

- **DevContainer**: Must mount `/var/run/docker.sock` for Docker access
- **Local**: Docker Desktop provides socket access
- **CI**: No Docker socket needed (DX banned in CI)

### Migration Flow

1. **Resolve DB URL**: Get from `supabase status` if running, else use postgres container
2. **Append SSL mode**: Always add `?sslmode=disable` for local Postgres
3. **Error Handling**:
   - "already applied" → Success
   - "connection failed" → Fatal (exit)
   - "schema error" → Fatal (exit)
   - Other → Warn (may be safe)

### Telemetry Control

- **Default**: Telemetry enabled for observability
- **Disable**: Set `ENABLE_TELEMETRY=false` for lightweight DX
- **Conditional Imports**: Backend loads telemetry modules only when enabled

## Troubleshooting

### Docker Socket Issues

```
Error: Docker socket not found
Fix: Add to .devcontainer/devcontainer.json:
"mounts": ["source=/var/run/docker.sock,target=/var/run/docker.sock,type=bind"]
```

### Supabase Not Starting

```
Check: DX_FORCE_SUPABASE=1 pnpm run dx
Or: DX_SKIP_SUPABASE=1 pnpm run dx (uses postgres container)
```

### Migration Failures

```
Connection errors: Check DATABASE_URL and Docker
Schema errors: Review migration files
Already applied: Safe to ignore
```

### CI DX Ban

```
Error: DX must not run in CI
Fix: Use setup:ci and build commands instead
```

## Commands

- `pnpm run setup:local` - Local environment setup
- `pnpm run setup:ci` - CI environment setup
- `pnpm run dx` - Start full development environment
- `pnpm run dx:doctor` - Diagnose environment issues
- `pnpm run dx:down` - Stop all services

## Environment Variables

- `DX_FORCE_SUPABASE=1` - Always start Supabase
- `DX_SKIP_SUPABASE=1` - Never start Supabase
- `ENABLE_TELEMETRY=false` - Disable observability
- `CI=true` - CI environment (bans DX)

---

## Usage-Based Billing Strategic Blueprint

*Source: `architecture/usage-based-billing-blueprint.md`*

**Version:** 1.0
**Date:** 2026-01-16
**Status:** Strategic Reference Document
**Audience:** Engineering, Product, Finance, Executive Leadership

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Strategic Assessment](#2-strategic-assessment)
3. [Technical Design](#3-technical-design)
4. [Implementation Roadmap](#4-implementation-roadmap)
5. [Risk Management](#5-risk-management)
6. [Concluding Insights](#6-concluding-insights)

---

## 1. Executive Summary

### What is Usage-Based Billing?

**Usage-based billing (UBB)** is a monetization model where customers are charged according to measurable consumption of a product's value-delivering units. Examples include:

- API calls
- GB processed
- Inference tokens
- Workflow runs
- Messages sent
- Compute seconds
- Dollars transacted

In contrast to purely access-based subscription pricing, UBB is designed to align price with realized value and scale revenue as customers scale adoption.

### Common UBB Structures

In practice, most successful SaaS implementations are not "pure usage," but one of these structures:

| Structure                 | Description                                                                              | Best For              |
| ------------------------- | ---------------------------------------------------------------------------------------- | --------------------- |
| **Hybrid (base + usage)** | Platform subscription for predictable access plus elastic variable usage                 | Most B2B SaaS         |
| **Commit + drawdown**     | Contracted minimum spend/credits that usage draws down; overages billed at defined rates | Enterprise deals      |
| **Tiered usage**          | Unit price decreases as usage increases, improving predictability and perceived fairness | High-volume customers |

### UBB's Role in Modern SaaS

UBB's role in modern SaaS is to:

- **Reduce adoption friction** through lower entry barriers
- **Increase expansion capture** through organic usage growth
- **Improve price-to-value alignment** provided that the usage signals chosen are credible proxies for customer outcomes

---

## 2. Strategic Assessment

### Industry Trends Driving UBB

UBB adoption has accelerated across cloud infrastructure, data platforms, AI/dev tools, communications, and security because:

| Trend                                    | Impact                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| **Workloads are elastic**                | Customer consumption fluctuates with demand and business cycles                     |
| **Cost-to-serve is variable**            | Infrastructure cost scales with usage, making unit economics central                |
| **Buyers want fairness and flexibility** | Procurement increasingly prefers spend that scales with growth and avoids shelfware |
| **Instrumentation is mature**            | Event pipelines and product analytics now support auditable metering                |

### Strategic Advantages Over Traditional Subscriptions

UBB creates advantage when three conditions hold:

1. **Usage is a high-fidelity value proxy** (higher usage correlates strongly with higher ROI)
2. **Marginal costs scale with usage** (compute, storage, third-party fees)
3. **Customer growth naturally increases usage** (expansion is built into adoption)

When these conditions are true, UBB can deliver:

| Advantage                                | Description                                                 |
| ---------------------------------------- | ----------------------------------------------------------- |
| **Lower adoption barrier**               | Customers can start smaller and scale without renegotiation |
| **Higher expansion capture / NRR**       | Revenue grows as usage grows                                |
| **Improved pricing fairness perception** | Pay for what you consume (especially with guardrails)       |
| **Better gross-margin control**          | Pricing can be engineered around unit costs                 |

### Where UBB Commonly Fails

UBB underperforms when:

| Failure Mode                                  | Consequence                                             |
| --------------------------------------------- | ------------------------------------------------------- |
| **Usage does not map to perceived value**     | Customers feel penalized for adoption                   |
| **Spend is unpredictable**                    | Finance cannot forecast; budget anxiety increases churn |
| **Metering is opaque or incorrect**           | Trust breaks, disputes rise                             |
| **Enterprise motion requires predictability** | Fixed contracts are preferred                           |

**Institutional best practice:** Start with **hybrid pricing** and bake in **predictability mechanisms** (allowances, tiered rates, commits, alerts, invoice previews).

### Revenue Impact Validation Metrics

To confirm UBB is working, measure outcomes, not just billing adoption:

| Metric                                  | Type           | Target                                        |
| --------------------------------------- | -------------- | --------------------------------------------- |
| **NRR / expansion rate**                | Primary        | > 110%                                        |
| **Gross margin per meter**              | Unit economics | Revenue per unit minus marginal cost per unit |
| **Trial to paid conversion**            | Adoption       | Time-to-first-value                           |
| **Churn / downgrade rate**              | Retention      | By segment                                    |
| **Disputes per 1,000 invoices**         | Trust          | < 5                                           |
| **Forecast-to-actual invoice variance** | Predictability | < 10%                                         |

---

## 3. Technical Design

A production UBB system is an auditable pipeline:

```
measure → validate → aggregate → rate → invoice → explain
```

### Core Architectural Elements

#### 3.1 Meter Definition Layer

| Component             | Description                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| **Clear definitions** | What counts, aggregation window, dimensions (region, workspace, feature), inclusion/exclusion rules |
| **Governance**        | Change control, versioning, backward-compatibility rules                                            |

**Example Meter Definition:**

```yaml
meter:
  name: llm_tokens
  version: 2.0
  description: "LLM inference tokens consumed"
  unit: tokens
  aggregation:
    window: billing_period
    method: sum
  dimensions:
    - tenant_id
    - model_id
    - region
  filters:
    exclude:
      - event_type: "test"
      - environment: "development"
```

#### 3.2 Usage Event Collection

- Instrument product services at the point of value delivery
- Reliability patterns: outbox + retries; avoid event loss on service failures

**Event Schema:**

```typescript
interface UsageEvent {
  event_id: string; // UUID, idempotency key
  event_type: string; // e.g., "llm_inference"
  tenant_id: string; // Organization/customer ID
  event_time: string; // ISO 8601, when value was delivered
  ingested_at?: string; // Set by ingestion service
  meter_name: string; // Reference to meter definition
  quantity: number; // Measured units
  dimensions: Record<string, string>;
  metadata?: Record<string, unknown>;
}
```

#### 3.3 Ingestion API (Contract-First)

| Requirement            | Implementation                                                |
| ---------------------- | ------------------------------------------------------------- |
| **Versioned endpoint** | `POST /v1/usage/events`                                       |
| **Authentication**     | mTLS/JWT                                                      |
| **Idempotency**        | Idempotency keys with Redis TTL                               |
| **Rate limits**        | Strict per-tenant limits                                      |
| **Validation**         | Schema validation on ingest                                   |
| **Time handling**      | Separation of `event_time` vs `ingested_at` for late arrivals |

#### 3.4 Durable Event Backbone

| Technology        | Use Case                                              |
| ----------------- | ----------------------------------------------------- |
| **Apache Kafka**  | Default choice for high-throughput, durable streaming |
| **Redpanda**      | Simpler ops, Kafka-compatible                         |
| **Apache Pulsar** | Multi-tenancy and geo-replication priorities          |

**Partition Strategy:** Typically by `customer_id`/`account_id` for ordered processing per tenant.

#### 3.5 Validation and Enrichment

| Stage             | Purpose                                                 |
| ----------------- | ------------------------------------------------------- |
| **Schema checks** | Validate event structure against contract               |
| **Deduplication** | Idempotency key lookup                                  |
| **Enrichment**    | Add entitlement context (plan, commit terms, discounts) |

#### 3.6 Aggregation

| Type               | Purpose                                              | Technology                       |
| ------------------ | ---------------------------------------------------- | -------------------------------- |
| **Near real-time** | Customer dashboards and alerts                       | Flink/Kafka Streams + ClickHouse |
| **Authoritative**  | Invoicing (batch or deterministic streaming rollups) | Iceberg + Trino/DuckDB           |

**Typical Stack:**

- OLAP store (ClickHouse) for fast queries
- Warehouse/lakehouse (Iceberg on object storage) for authoritative billing data

#### 3.7 Rating Engine

The rating engine applies pricing rules and produces rated line items:

| Rule Type      | Description                   |
| -------------- | ----------------------------- |
| **Tiers**      | Volume-based pricing brackets |
| **Allowances** | Free units included in plan   |
| **Commits**    | Prepaid credits with drawdown |
| **Minimums**   | Minimum spend requirements    |
| **Proration**  | Partial period calculations   |
| **Discounts**  | Contract-specific adjustments |

**Critical Properties:**

- **Deterministic:** Same inputs always produce same outputs
- **Reproducible:** Can re-rate historical periods for audit
- **Append-only ledger:** Adjustments are new entries, never overwrites

#### 3.8 Billing and Payments Integration

| Approach                  | Description                                                       |
| ------------------------- | ----------------------------------------------------------------- |
| **Option A (common)**     | Push rated line items to external invoicing system (Stripe, etc.) |
| **Option B (enterprise)** | Self-hosted invoicing (Invoice Ninja, Kill Bill)                  |

**Sync Requirements:**

- Customer/subscription state synchronization
- Rated usage push to invoicing system
- Many orgs outsource invoicing/tax/payment while keeping metering/rating internal

#### 3.9 Customer Transparency Layer

| Feature              | Purpose                          |
| -------------------- | -------------------------------- |
| **Usage dashboards** | Real-time consumption visibility |
| **Drill-down**       | Explore usage by dimension       |
| **Exports**          | CSV/JSON for customer analysis   |
| **Invoice previews** | Forecast next invoice            |
| **Alerts**           | Threshold notifications          |
| **Spend controls**   | Hard/soft caps                   |

### Role of APIs, Analytics, and Real-Time Monitoring

#### APIs

- Enforce a single contract across services
- Create stable integration boundaries (usage ingest, entitlements, billing sync)

#### Data Analytics

- Validates meter-value alignment
- Monitors expansion drivers
- Supports price optimization (tier thresholds, allowances)

#### Real-Time Monitoring

Essential metrics for trust:

| Metric                        | Purpose                   |
| ----------------------------- | ------------------------- |
| **Ingestion throughput/lag**  | Pipeline health           |
| **Dedup rate**                | Idempotency effectiveness |
| **Late-arrival rate**         | Event timing issues       |
| **Meter drift by service**    | Missing events detection  |
| **Anomaly detection**         | Spikes, regressions       |
| **Disputes, adjustments**     | Trust indicators          |
| **Reconciliation mismatches** | Data integrity            |

---

## 4. Implementation Roadmap

Timelines assume a hybrid pricing model and a mid-sized engineering org. Proprietary services are optional overlays, not dependencies.

### Phase 0 (Weeks 0-2): Strategic Readiness

**Primary work:** Conceptual, not technical. OSS impact is indirect.

#### Open-Source Support Tools (Optional but Useful)

| Tool                    | Purpose                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| **PostgreSQL**          | Store early meter definitions, pricing configs, and cohort rules        |
| **dbt Core**            | Prototype pricing math and shadow billing logic against historical data |
| **Metabase / Superset** | Exploratory analysis of historical usage vs. value correlation          |

#### Key Outputs

- [ ] Meter definitions (versioned, documented)
- [ ] Pricing rules expressed in machine-readable form (YAML/JSON)
- [ ] Rollout cohort definitions tied to account IDs

### Phase 1 (Weeks 2-6): Instrumentation and Ingestion Foundation

#### Canonical Usage Events

| Component           | Technology             |
| ------------------- | ---------------------- |
| **Event semantics** | OpenTelemetry (OTel)   |
| **Event contracts** | JSON Schema / Protobuf |

#### Ingestion API

| Component               | Technology                 |
| ----------------------- | -------------------------- |
| **API framework**       | FastAPI / Go / Rust (Axum) |
| **Authentication**      | JWT / mTLS                 |
| **Idempotency storage** | Redis (short TTL)          |

#### Event Backbone

| Option            | Use Case                       |
| ----------------- | ------------------------------ |
| **Apache Kafka**  | Default, battle-tested         |
| **Redpanda**      | Simpler ops                    |
| **Apache Pulsar** | Multi-tenancy, geo-replication |

#### Dead-Letter and Validation

- Kafka DLQ topics
- Schema Registry (Confluent-compatible OSS or Redpanda)

#### Ops and Data Quality

| Component        | Technology                |
| ---------------- | ------------------------- |
| **Metrics**      | Prometheus + Alertmanager |
| **Dashboards**   | Grafana                   |
| **Data quality** | Great Expectations        |

**Key Guarantee:** No event loss, deterministic replay.

### Phase 2 (Weeks 6-10): Aggregation and Customer Transparency (Pre-Billing)

#### Real-Time Aggregation

| Option            | Description                          |
| ----------------- | ------------------------------------ |
| **Apache Flink**  | True streaming, windowed aggregation |
| **Kafka Streams** | Simpler, embedded option             |

#### Fast Usage Queries

- **ClickHouse** for high-cardinality, low-latency usage analytics
- Partition by `account_id` + time

#### Authoritative Rollups

- **Apache Iceberg + Parquet** on object storage
- Queried via **Trino** or **DuckDB**

#### Customer Dashboards

- **Superset / Metabase** (embedded)
- Usage drill-down, CSV export

#### Forecasting and Alerts

| Component              | Approach                           |
| ---------------------- | ---------------------------------- |
| **Baseline forecasts** | dbt + SQL                          |
| **Threshold alerts**   | Prometheus alert rules             |
| **Anomaly detection**  | Rolling z-score / EWMA (no ML yet) |

#### Shadow Billing

- Rating logic executed but **not invoiced**
- Results stored in ledger tables for comparison

### Phase 3 (Weeks 10-14): Rating Engine and Billing Integration

#### Rating Engine (Core IP)

**Technology:** Custom service (Python/Go/Rust)

**Deterministic Pricing Rules:**

- Tiered pricing
- Free allowances
- Commits + drawdown
- Overages

**Inputs:** Aggregated usage + contract snapshot

#### Rated Usage Ledger

| Option            | Description                      |
| ----------------- | -------------------------------- |
| **PostgreSQL**    | Append-only tables               |
| **Event-sourced** | Kafka topic + materialized views |

**Non-Negotiable Properties:**

- Immutability
- Reproducibility
- Adjustment entries (never overwrite)

#### Billing / Invoicing

| Option                    | Description                                        |
| ------------------------- | -------------------------------------------------- |
| **Option A (common)**     | Push rated line items to external invoicing system |
| **Option B (enterprise)** | Invoice Ninja / Kill Bill (OSS) for invoicing      |

#### Finance Readiness

- Invoice previews generated from ledger
- Full trace: invoice → rated units → raw events

### Phase 4 (Weeks 14-20): Controlled Rollout and Iteration

#### Guardrails

| Component             | Technology                   |
| --------------------- | ---------------------------- |
| **Rate limiting**     | Envoy / NGINX                |
| **Spend alerts**      | Prometheus + Alertmanager    |
| **Caps / soft stops** | Enforced in product services |

#### Parallel Run

- Legacy billing = source of truth
- OSS pipeline runs side-by-side
- Automated reconciliation queries (dbt)

#### Iteration Focus

| Area                 | Goal                              |
| -------------------- | --------------------------------- |
| **Meters**           | Reduce ambiguity and dispute risk |
| **Tiers/allowances** | Stabilize invoice variance        |
| **Dashboards**       | Increase predictability and trust |

#### Internal Tooling

- **Retool OSS / Appsmith**
- Internal "billing ops" console for investigations

### Phase 5 (Weeks 20+): Scale and Enterprise Hardening

#### Advanced Pricing

- Multi-meter bundles (rating engine extensions)
- Annual commits + true-ups
- Contract-specific pricing snapshots

#### Backfills and Re-Rating

- Kafka replay + Flink reprocessing
- Iceberg time-travel for authoritative recomputation

#### Compliance and Audit

| Component               | Technology                  |
| ----------------------- | --------------------------- |
| **Data lineage**        | OpenLineage                 |
| **Governance metadata** | Apache Atlas                |
| **Audit tables**        | Immutable PostgreSQL tables |

#### Operating Model (Final State)

| Team            | Responsibility                                |
| --------------- | --------------------------------------------- |
| **Product**     | Meter ownership, value alignment              |
| **Engineering** | Correctness, reliability, replay safety       |
| **Finance**     | Ledger governance, audit, revenue recognition |
| **CS/Sales**    | Enablement, forecasting, customer education   |

### Summary: Why This Works

This OSS-first roadmap ensures:

- **Predictable unit economics** as usage scales
- **Full auditability** down to the raw event
- **No vendor-meter mismatch**
- **Re-rating and correction without revenue risk**
- **Enterprise credibility** (finance, procurement, auditors)

> You can outsource payments and tax.
> You should **never outsource truth** in a usage-based business.

---

## 5. Risk Management

### 5.1 Spend Anxiety and Procurement Resistance

**Risk:** Unpredictable invoices drive churn or block enterprise deals.

**Mitigation:**

- Hybrid pricing with base subscription
- Allowances and tiered rates
- Commits with predictable minimums
- Invoice previews and forecasting
- Alerts and optional spend caps/controls

### 5.2 Meter-Value Misalignment

**Risk:** Customers feel charged for "friction" rather than outcomes.

**Mitigation:**

- Choose outcome-proximate meters (transactions completed, workflows executed)
- Avoid taxing setup/maintenance activity
- Validate with shadow billing + customer interviews
- Regular meter-value correlation analysis

### 5.3 Data Correctness and Disputes

**Risk:** Inaccurate usage erodes trust and creates revenue leakage.

**Mitigation:**

- Idempotency + deduplication at ingestion
- Immutable rated ledger
- Drill-down transparency for customers
- Formal adjustment workflow with audit trail
- Strong reconciliation automation

### 5.4 Operational Overhead (Support and Finance Burden)

**Risk:** Ticket volume spikes and reconciliation becomes manual.

**Mitigation:**

- Investigation tooling (event traceability)
- Automated reconciliation/backfills
- Playbooks with SLAs
- Internal "billing ops" dashboards

### 5.5 Margin Erosion from Mispriced Units

**Risk:** Heavy users become unprofitable.

**Mitigation:**

- Track marginal cost per meter
- Set tiering to preserve unit margin
- Require commits/minimums for high-usage cohorts
- Monitor unit economics continuously

### 5.6 Security and Privacy Exposure

**Risk:** Usage events contain sensitive metadata.

**Mitigation:**

- Minimize PII in events
- Tokenization of sensitive identifiers
- Encryption in transit/at rest
- Retention controls
- Least-privilege access
- Comprehensive audit logs

---

## 6. Concluding Insights

### When UBB Succeeds

Usage-based billing is a durable advantage when:

1. **Usage is a defensible proxy for value**
2. **The system is engineered for correctness, transparency, and predictability**

### Recommended Pattern

The most consistently successful pattern in B2B SaaS is a **hybrid model** supported by:

- Enterprise-friendly commits/true-ups
- Customer-facing spend governance
- Transparent metering and invoice previews

### Expected Outcomes

When implemented with canonical events, deterministic rating, an immutable ledger, and strong customer transparency, UBB typically delivers:

| Outcome                            | Mechanism                                          |
| ---------------------------------- | -------------------------------------------------- |
| **Improved adoption**              | Lower entry friction                               |
| **Higher NRR**                     | Value-aligned expansion                            |
| **Better gross-margin governance** | Unit economics visibility                          |
| **Reduced pricing friction**       | Spend aligned with realized value                  |
| **Increased trust**                | Explainable metering and reliable invoice previews |

### ValueOS Implementation Status

ValueOS has implemented key components of this blueprint:

| Component                    | Status      | Reference                                                                                            |
| ---------------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| **Stripe integration**       | Implemented | [`src/services/billing/StripeService.ts`](../../src/services/billing/StripeService.ts)               |
| **Usage metering**           | Implemented | [`src/services/billing/UsageMeteringService.ts`](../../src/services/billing/UsageMeteringService.ts) |
| **Invoice preview**          | Implemented | [`src/services/billing/SubscriptionService.ts`](../../src/services/billing/SubscriptionService.ts)   |
| **Grace period enforcement** | Implemented | [`src/services/metering/GracePeriodService.ts`](../../src/services/metering/GracePeriodService.ts)   |
| **Webhook retry/DLQ**        | Implemented | [`src/services/billing/WebhookRetryService.ts`](../../src/services/billing/WebhookRetryService.ts)   |
| **Billing audit log**        | Implemented | Database migration                                                                                   |
| **Customer dashboards**      | Planned     | Phase 2 roadmap                                                                                      |
| **Advanced rating engine**   | Planned     | Phase 3 roadmap                                                                                      |

For implementation details, see [`docs/features/billing/IMPLEMENTATION.md`](../features/billing/IMPLEMENTATION.md).

---

## Appendix A: Glossary

| Term               | Definition                                                           |
| ------------------ | -------------------------------------------------------------------- |
| **Meter**          | A defined measurement of usage (e.g., API calls, tokens, GB)         |
| **Rating**         | The process of applying pricing rules to usage to produce charges    |
| **Ledger**         | Append-only record of rated usage and adjustments                    |
| **NRR**            | Net Revenue Retention: revenue from existing customers over time     |
| **DLQ**            | Dead Letter Queue: storage for failed events requiring manual review |
| **Idempotency**    | Property ensuring duplicate events produce the same result           |
| **Shadow billing** | Running billing logic without charging, for validation               |

## Appendix B: Technology Reference

### Open-Source Stack (Recommended)

| Layer                 | Technology                   | Purpose                |
| --------------------- | ---------------------------- | ---------------------- |
| **Event streaming**   | Apache Kafka / Redpanda      | Durable event backbone |
| **Stream processing** | Apache Flink / Kafka Streams | Real-time aggregation  |
| **OLAP**              | ClickHouse                   | Fast usage queries     |
| **Data lake**         | Apache Iceberg + Parquet     | Authoritative storage  |
| **Query engine**      | Trino / DuckDB               | Analytical queries     |
| **Observability**     | Prometheus + Grafana         | Metrics and dashboards |
| **Data quality**      | Great Expectations           | Validation             |
| **Lineage**           | OpenLineage                  | Audit trail            |
| **Invoicing**         | Invoice Ninja / Kill Bill    | Self-hosted billing    |

### Managed Alternatives (With Exit Strategy)

| Layer               | Managed Option   | Exit Strategy                               |
| ------------------- | ---------------- | ------------------------------------------- |
| **Event streaming** | Confluent Cloud  | Kafka-compatible, migrate to self-hosted    |
| **OLAP**            | ClickHouse Cloud | Standard SQL, migrate to self-hosted        |
| **Invoicing**       | Stripe Billing   | Export rated usage, switch to OSS invoicing |

---

## Document History

| Version | Date       | Author      | Changes                     |
| ------- | ---------- | ----------- | --------------------------- |
| 1.0     | 2026-01-16 | Engineering | Initial strategic blueprint |

---

_This document serves as the authoritative reference for usage-based billing strategy and architecture at ValueOS. For questions or updates, contact the Platform Engineering team._

---

## ValueOS Package Boundaries

*Source: `architecture/PACKAGE_BOUNDARIES.md`*

## Dependency Graph (INVARIANT)

```
apps (ValyntApp)
     ↓
packages/backend
     ↓
packages/agents → packages/memory → packages/infra
     ↓
packages/integrations
     ↓
packages/shared / packages/mcp / packages/sdui-types
```

**NEVER invert. NEVER shortcut.**

---

## End-to-End Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (ValyntApp)                           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   React UI   │───▶│  API Client  │───▶│   HTTP/WS    │                  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘                  │
└─────────────────────────────────────────────────│───────────────────────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (API Boundary)                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   Express    │───▶│  Middleware  │───▶│   Routes     │                  │
│  │   Server     │    │  (auth/rbac) │    │              │                  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘                  │
└─────────────────────────────────────────────────│───────────────────────────┘
                                                  │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    │                             │                             │
                    ▼                             ▼                             ▼
┌───────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────────┐
│         AGENTS            │  │         MEMORY            │  │      INTEGRATIONS         │
│  ┌─────────────────────┐  │  │  ┌─────────────────────┐  │  │  ┌─────────────────────┐  │
│  │  Agent Orchestrator │  │  │  │  Semantic Memory    │  │  │  │  HubSpot Adapter    │  │
│  │  (planning/reason)  │  │  │  │  Episodic Memory    │  │  │  │  Salesforce Adapter │  │
│  │  Tool Invocation    │  │  │  │  Vector Store       │  │  │  │  ServiceNow Adapter │  │
│  └──────────┬──────────┘  │  │  │  Provenance         │  │  │  │  SharePoint Adapter │  │
│             │             │  │  └──────────┬──────────┘  │  │  │  Slack Adapter      │  │
└─────────────│─────────────┘  └─────────────│─────────────┘  │  └─────────────────────┘  │
              │                              │                 └───────────────────────────┘
              │                              │
              │                              ▼
              │               ┌───────────────────────────┐
              │               │          INFRA            │
              │               │  ┌─────────────────────┐  │
              └──────────────▶│  │  Supabase (auth/db) │  │
                              │  │  Redis (queues)     │  │
                              │  │  Storage (blobs)    │  │
                              │  │  Observability      │  │
                              │  └─────────────────────┘  │
                              └───────────────────────────┘
```

---

## Package Responsibilities

### `packages/agents`
| Responsibility | ✅ Yes | ❌ No |
|----------------|--------|-------|
| Agent definitions | ✅ | |
| Planning & reasoning | ✅ | |
| Tool invocation | ✅ | |
| Evaluation & replay | ✅ | |
| HTTP servers | | ❌ |
| DB connections | | ❌ |
| Supabase imports | | ❌ |

**Can call:** `memory`, `integrations`, `shared`, `mcp`

### `packages/backend`
| Responsibility | ✅ Yes | ❌ No |
|----------------|--------|-------|
| API boundary | ✅ | |
| Auth & tenancy | ✅ | |
| Request orchestration | ✅ | |
| Billing/metering flows | ✅ | |
| Vendor SDKs directly | | ❌ |
| Agent logic | | ❌ |
| Memory internals | | ❌ |

**Can call:** `agents`, `memory`, `integrations`, `infra`, `shared`

### `packages/memory`
| Responsibility | ✅ Yes | ❌ No |
|----------------|--------|-------|
| Semantic memory | ✅ | |
| Episodic memory | ✅ | |
| Vector embeddings | ✅ | |
| Provenance tracking | ✅ | |
| HTTP routing | | ❌ |
| Agent logic | | ❌ |

**Can call:** `infra`, `shared`

### `packages/infra`
| Responsibility | ✅ Yes | ❌ No |
|----------------|--------|-------|
| Supabase client | ✅ | |
| Database adapters | ✅ | |
| Queue adapters | ✅ | |
| Storage adapters | ✅ | |
| Observability | ✅ | |
| Domain logic | | ❌ |
| Agents | | ❌ |

**Can call:** `shared`

### `packages/integrations`
| Responsibility | ✅ Yes | ❌ No |
|----------------|--------|-------|
| Enterprise adapters | ✅ | |
| Rate limiting | ✅ | |
| Data normalization | ✅ | |
| Auth refresh | ✅ | |
| UI | | ❌ |
| Express | | ❌ |
| DB writes | | ❌ |

**Can call:** `shared`

### `packages/components`
| Responsibility | ✅ Yes | ❌ No |
|----------------|--------|-------|
| UI primitives | ✅ | |
| Design system | ✅ | |
| Business logic | | ❌ |
| API calls | | ❌ |
| Routing | | ❌ |

**Can call:** `shared`, `sdui-types`

### `packages/shared`
| Responsibility | ✅ Yes | ❌ No |
|----------------|--------|-------|
| Types/schemas | ✅ | |
| Pure utilities | ✅ | |
| Constants | ✅ | |
| Any package imports | | ❌ |

**Can call:** Nothing (leaf package)

---

## Import Rules Enforcement

ESLint boundary rules are configured in `.config/configs/eslint.boundaries.js`.

Run `npm run lint` to check for violations.

---

## Adding a New Package

1. Create `packages/<name>/package.json`:
```json
{
  "name": "@valueos/<name>",
  "version": "1.0.0",
  "type": "module",
  "private": true
}
```

2. Create `packages/<name>/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

3. Add path alias to root `tsconfig.json`
4. Add boundary rules to `eslint.boundaries.js`
5. Document allowed consumers in `index.ts`

---

## Agent Containerization Architecture Design

*Source: `architecture/agent-containerization-architecture.md`*

## Overview

The ValueOS system currently has 18 distinct agent types that are invoked via HTTP calls from the backend AgentAPI service. To enhance scalability, fault isolation, resource management, and deployment flexibility, each agent type will be containerized and deployed as an independent microservice in Kubernetes.

## Current Architecture

- Agents are invoked synchronously via HTTP by the backend
- Agent types are defined in `packages/backend/src/services/agent-types.ts`
- Current infrastructure includes Kubernetes manifests in `infra/k8s/`
- Existing example: opportunity-agent deployment

## Agent Types

The following 18 agent types will each have their own container:

1. opportunity
2. target
3. realization
4. expansion
5. integrity
6. company-intelligence
7. financial-modeling
8. value-mapping
9. system-mapper
10. intervention-designer
11. outcome-engineer
12. coordinator
13. value-eval
14. communicator
15. research
16. benchmark
17. narrative
18. groundtruth

## Containerization Strategy

### Image Design

- **Base Image**: Node.js 20 Alpine for consistency with existing backend
- **Port Configuration**:
  - 8080: HTTP API endpoint
  - 9090: Prometheus metrics endpoint
- **Image Naming**: `${ECR_REGISTRY}/valuecanvas-{agent-type}:${IMAGE_TAG}`
- **Build Process**: Separate Dockerfile per agent type in dedicated directories

### Application Structure

Each agent container will:

- Implement the agent-specific logic
- Expose REST API endpoints for queries
- Include health check endpoint (`/health`)
- Provide metrics endpoint (`/metrics`)
- Handle graceful shutdown
- Log to stdout/stderr for centralized collection

## Kubernetes Architecture

### Namespace

All agent deployments will reside in the `valuecanvas-agents` namespace for logical separation.

### Per-Agent Resources

For each agent type, create:

#### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {agent-type}-agent
  labels:
    app: {agent-type}-agent
    component: agent
    tier: backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: {agent-type}-agent
  template:
    metadata:
      labels:
        app: {agent-type}-agent
        component: agent
        tier: backend
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: valuecanvas-agent
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
      - name: {agent-type}-agent
        image: ${ECR_REGISTRY}/valuecanvas-{agent-type}:${IMAGE_TAG}
        ports:
        - name: http
          containerPort: 8080
        - name: metrics
          containerPort: 9090
        env:
        - name: PORT
          value: "8080"
        - name: AGENT_TYPE
          value: "{agent-type}"
        # Additional env vars from ConfigMap/Secret
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 1Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: {agent-type}-agent
  labels:
    app: {agent-type}-agent
    component: agent
spec:
  selector:
    app: {agent-type}-agent
  ports:
  - name: http
    port: 8080
    targetPort: 8080
    protocol: TCP
  - name: metrics
    port: 9090
    targetPort: 9090
    protocol: TCP
  type: ClusterIP
```

#### HorizontalPodAutoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {agent-type}-agent-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {agent-type}-agent
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

#### PodDisruptionBudget

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {agent-type}-agent-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: {agent-type}-agent
```

### Shared Resources

#### ConfigMap

Shared configuration for all agents:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agent-config
data:
  environment: "production"
  log_level: "info"
  # Other shared configs
```

#### Secret

Agent-specific secrets managed via external-secrets operator.

#### ServiceAccount

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: valuecanvas-agent
  namespace: valuecanvas-agents
```

#### NetworkPolicy

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: agent-network-policy
  namespace: valuecanvas-agents
spec:
  podSelector:
    matchLabels:
      component: agent
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: valuecanvas-backend
      ports:
        - protocol: TCP
          port: 8080
    - from:
        - namespaceSelector:
            matchLabels:
              name: valuecanvas-monitoring
      ports:
        - protocol: TCP
          port: 9090
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: valuecanvas-database
      ports:
        - protocol: TCP
          port: 5432
    # Allow DNS resolution
    - to: []
      ports:
        - protocol: UDP
          port: 53
```

## Networking and Service Discovery

- **Internal Communication**: Backend discovers agents via Kubernetes DNS (`{agent-type}-agent.valuecanvas-agents.svc.cluster.local:8080`)
- **Inter-Agent Communication**: Agents can call each other using service names if needed
- **External Dependencies**: Agents access databases, external APIs via service mesh or direct connections
- **Load Balancing**: Kubernetes service provides load balancing across replicas

## Scaling and High Availability

- **Replica Count**: Minimum 2 replicas for HA
- **HPA**: Scales based on CPU/memory utilization
- **Pod Distribution**: Anti-affinity rules to spread across nodes
- **Rolling Updates**: Zero-downtime deployments with maxUnavailable: 25%

## Security Considerations

- **Container Security**: Non-root execution, minimal base image
- **RBAC**: Service accounts with least-privilege access
- **Secrets Management**: External-secrets operator for API keys, credentials
- **Network Isolation**: Network policies restrict traffic
- **Image Security**: Vulnerability scanning in CI/CD pipeline

## Observability

- **Metrics**: Prometheus exposition format on `/metrics`
- **Logs**: Structured JSON logs to stdout
- **Tracing**: OpenTelemetry integration if needed
- **Health Checks**: Liveness and readiness probes
- **Dashboards**: Grafana dashboards for agent performance

## CI/CD Integration

- **Build Pipelines**: Separate GitHub Actions workflows per agent
- **Image Tagging**: Use git commit SHA for immutable deployments
- **Deployment Strategy**: Blue/green or canary deployments for critical agents
- **Rollback**: Automated rollback on health check failures

## Migration Strategy

1. Containerize agents one by one
2. Deploy alongside existing monolithic agent service
3. Update backend AgentAPI to route to new services
4. Gradually increase traffic to containerized agents
5. Remove old agent service once all agents are migrated

## Benefits

- **Isolation**: Agent failures don't affect others
- **Scalability**: Scale individual agents based on load
- **Resource Efficiency**: Allocate resources per agent needs
- **Deployment Flexibility**: Update agents independently
- **Monitoring**: Granular visibility into each agent
- **Security**: Isolate agent-specific secrets and permissions

## Risks and Mitigations

- **Complexity**: Increased operational complexity
  - Mitigation: Use GitOps with ArgoCD for declarative deployments
- **Cost**: More resources for separate containers
  - Mitigation: Right-size resource requests/limits
- **Networking Latency**: Internal service calls
  - Mitigation: Optimize service mesh configuration
- **Development Overhead**: Maintain 18 separate codebases
  - Mitigation: Shared libraries for common functionality

---

## ValueOS System Architecture Overview

*Source: `architecture/overview.md`*

## Executive Summary

ValueOS is a modern, multi-tenant SaaS platform built with a microservices architecture, server-driven UI (SDUI), and AI-powered agent orchestration. The system provides comprehensive value discovery and business case generation capabilities with enterprise-grade security, scalability, and reliability.

## Core Architectural Principles

### Multi-Tenant SaaS Architecture

- **Tenant Isolation**: Complete data and application separation
- **Shared Infrastructure**: Cost-effective resource utilization
- **Scalable Design**: Horizontal scaling across all layers
- **Enterprise Security**: OWASP Top 10 compliance and data protection

### Agent-Driven Workflow System

- **AI Orchestration**: Multi-agent coordination for complex tasks
- **Server-Driven UI**: Dynamic, context-aware user interfaces
- **Event-Driven Processing**: Asynchronous workflows and real-time updates
- **State Management**: Immutable state stores with reconstruction capabilities

### Cloud-Native Design

- **Microservices**: Independent deployment and scaling
- **Container Orchestration**: Kubernetes-based infrastructure
- **Observability**: Comprehensive monitoring and tracing
- **Resilience**: Circuit breakers, retries, and graceful degradation

## System Components

### Frontend Layer

#### React + TypeScript Application

- **Framework**: React 18 with concurrent features
- **Language**: TypeScript for type safety
- **Build Tool**: Vite for fast development and HMR
- **Styling**: Tailwind CSS with design system
- **State Management**: React Query for server state

#### Server-Driven UI (SDUI)

- **Dynamic Rendering**: Schema-based component generation
- **Context Awareness**: Workflow-stage specific interfaces
- **Error Boundaries**: Graceful error handling and recovery
- **Performance Optimization**: Lazy loading and code splitting

### Backend Services

#### API Gateway

- **Request Routing**: Intelligent service discovery
- **Authentication**: JWT token validation
- **Rate Limiting**: Per-tenant and per-user limits
- **CORS Handling**: Secure cross-origin requests

#### Core Business Services

- **User Service**: Authentication, profiles, permissions
- **Tenant Service**: Multi-tenant management and provisioning
- **Workflow Service**: DAG-based process orchestration
- **Agent Service**: AI agent coordination and execution
- **Integration Service**: Third-party API connections

#### Agent System

- **Coordinator Agent**: Task planning and decomposition
- **Specialized Agents**: Domain-specific AI capabilities
- **Circuit Breakers**: Failure isolation and recovery
- **Health Monitoring**: Agent performance and reliability tracking

### Data Layer

#### PostgreSQL (Primary Database)

- **Schema Design**: Normalized relational structure
- **Row Level Security**: Tenant data isolation
- **Connection Pooling**: Efficient resource utilization
- **Replication**: High availability and read scaling

#### Redis (Caching & Sessions)

- **Application Cache**: Query result caching
- **Session Storage**: User session management
- **Rate Limiting**: Request throttling
- **Pub/Sub**: Real-time messaging

#### Elasticsearch (Search & Analytics)

- **Full-Text Search**: Document and content indexing
- **Analytics**: Usage patterns and insights
- **Performance**: Sub-second query responses

#### Object Storage

- **File Management**: Document and media storage
- **CDN Integration**: Global content distribution
- **Versioning**: File history and rollback capabilities

## Data Flow Architecture

### Request Processing Flow

1. **Client Request** → API Gateway
2. **Authentication** → JWT validation and tenant context
3. **Authorization** → RBAC permission checks
4. **Rate Limiting** → Request throttling and abuse prevention
5. **Service Routing** → Load balancing to appropriate service
6. **Business Logic** → Domain processing and validation
7. **Data Access** → Database operations with RLS
8. **Response** → Formatted response to client

### Agent Workflow Flow

1. **User Intent** → Natural language processing
2. **Task Decomposition** → Coordinator agent analysis
3. **Specialized Processing** → Domain-specific agent execution
4. **Result Synthesis** → Workflow state updates
5. **UI Generation** → SDUI rendering
6. **User Feedback** → Iterative refinement

### Event-Driven Processing

1. **Event Generation** → Business action triggers
2. **Event Routing** → Message queue distribution
3. **Async Processing** → Background job execution
4. **State Updates** → Database persistence
5. **Notifications** → Real-time user updates

## Multi-Tenant Implementation

### Tenant Isolation Strategy

#### Database Layer

- **Schema per Tenant**: Dedicated PostgreSQL schemas
- **Row Level Security**: Automatic tenant data filtering
- **Connection Routing**: Tenant-aware connection pooling
- **Migration Management**: Schema-specific migrations

#### Application Layer

- **Tenant Context**: Request-scoped tenant identification
- **Resource Pooling**: Shared infrastructure with tenant limits
- **Configuration**: Tenant-specific feature flags and settings
- **Audit Logging**: Comprehensive tenant activity tracking

#### Infrastructure Layer

- **Namespace Isolation**: Kubernetes namespace per tenant
- **Resource Quotas**: CPU/memory limits per tenant
- **Network Policies**: Traffic isolation between tenants
- **Monitoring**: Tenant-specific metrics and alerts

### Tenant Provisioning

#### Automated Onboarding

1. **Tenant Creation**: Database schema and configuration
2. **Resource Allocation**: Infrastructure provisioning
3. **Access Setup**: Authentication and authorization
4. **Initial Configuration**: Default settings and branding

#### Scaling Strategy

- **Shared Cluster**: Cost-effective for small tenants
- **Dedicated Resources**: Performance isolation for large tenants
- **Auto-scaling**: Demand-based resource adjustment
- **Resource Monitoring**: Usage tracking and optimization

## State Management Architecture

### State Store Responsibilities

| Store              | Purpose                  | Persistence  | Ephemeral | Source of Truth |
| ------------------ | ------------------------ | ------------ | --------- | --------------- |
| **Workflow State** | Business process state   | PostgreSQL   | No        | ✅ Primary      |
| **Canvas State**   | UI layout and components | LocalStorage | Yes       | ❌ Derived      |
| **SDUI State**     | Rendered page definition | Memory       | Yes       | ❌ Derived      |
| **Agent Memory**   | Long-term context        | Redis        | No        | ✅ Primary      |

### State Transition Rules

#### Workflow State → Canvas State

- Canvas state must be derivable from workflow stage
- Canvas mutations must validate against workflow constraints
- Stage transitions clear incompatible canvas state

#### SDUI State → Workflow State

- SDUI renders from current workflow context
- User interactions update workflow state
- SDUI state must be reconstructible from workflow

#### Agent Memory Integration

- All state stores can query agent memory
- Agent memory provides continuity across sessions
- Memory queries are read-only from state stores

### State Invariants

#### Reconstruction Invariant

- Workflow state must be reconstructible from persisted events
- No state loss during system failures
- Event sourcing enables audit trails

#### Consistency Invariant

- Canvas state never contradicts workflow stage
- SDUI renders are deterministic from workflow state
- Cross-session state isolation maintained

#### Integrity Invariant

- Agent memory provides consistent context
- State mutations are validated before persistence
- Concurrent access conflicts are resolved

## Agent Failure Mode Analysis

### Failure Classification

#### Deterministic Failures

- **Schema Mismatch**: Zod validation with fallback to text
- **Tool Validation**: Retry with clarification prompts
- **Network Timeouts**: Exponential backoff retry logic
- **Resource Limits**: Circuit breaker pattern implementation

#### Probabilistic Failures

- **LLM Drift**: Confidence threshold monitoring
- **Hallucinated Content**: Adversarial validation
- **Context Overload**: Smart summarization and chunking
- **Model Inconsistency**: Response caching and validation

#### Temporal Failures

- **Partial Streams**: Skeleton loaders and progress indicators
- **Race Conditions**: Event sourcing for conflict resolution
- **Session Expiration**: Automatic token refresh
- **Retry Storms**: Circuit breaker protection

#### Cross-Agent Conflicts

- **Authority Escalation**: RBAC for agent permissions
- **Resource Contention**: Locking and queuing mechanisms
- **Consensus Failure**: Voting and conflict resolution
- **State Mutation**: Optimistic locking and versioning

#### Integrity Failures

- **Confidence Mismatch**: Reasoning quality validation
- **Source Fabrication**: Citation verification
- **Logical Contradictions**: Consistency checking
- **Data Corruption**: Checksum validation

### Recovery Strategies

#### Automatic Recovery

- **Schema Mismatch**: Fallback to text response
- **Network Issues**: Exponential backoff retry
- **Partial Streams**: Skeleton UI with retry
- **Low Confidence**: Human checkpoint service

#### Manual Recovery

- **Hallucinations**: Adversarial agent challenge
- **Authority Violations**: Security incident response
- **Data Corruption**: Backup restoration
- **Consensus Failure**: Manual conflict resolution

#### Prevention Measures

- **Circuit Breakers**: Service degradation protection
- **Event Sourcing**: Race condition prevention
- **Smart Summarization**: Context overload handling
- **Confidence Monitoring**: Quality threshold enforcement

## Component Decomposition

### ChatCanvasLayout Refactoring

#### Current State

- 2127-line monolithic component
- 25+ useState hooks
- Mixed UI rendering and business logic
- 6+ modal render blocks inline

#### Target Architecture

- **CanvasController Hook**: Case and workflow state management
- **InteractionRouter Hook**: Command handling and user interactions
- **StreamingOrchestrator Hook**: Agent processing and real-time updates
- **ModalManager Hook**: Modal state coordination
- **Pure Presentation Component**: Focused UI rendering

#### Implementation Benefits

- **91% reduction** in component size
- **100% elimination** of useState in presentation layer
- **Improved testability** with isolated hooks
- **Enhanced maintainability** through separation of concerns

### Hook Interfaces

#### CanvasController

```typescript
interface CanvasControllerReturn {
  // Case management
  cases: ValueCase[];
  selectedCase: ValueCase | null;
  inProgressCases: ValueCase[];

  // Actions
  selectCase: (id: string) => void;
  createCase: (data: CaseInput) => void;
  updateCase: (id: string, updates: Partial<ValueCase>) => void;

  // Workflow state
  workflowState: WorkflowState | null;
  currentSessionId: string | null;
}
```

#### InteractionRouter

```typescript
interface InteractionRouterReturn {
  // Command handling
  isCommandBarOpen: boolean;
  handleCommand: (query: string) => Promise<void>;

  // Keyboard shortcuts
  keyboardBindings: KeyboardShortcutMap;

  // Starter actions
  handleStarterAction: (action: string, data?: any) => void;

  // Modal triggers
  modalTriggers: ModalTriggerMap;
}
```

## Technology Stack

### Frontend Technologies

- **React 18**: Concurrent features and suspense
- **TypeScript**: Type safety and developer experience
- **Vite**: Fast development server and build tool
- **Tailwind CSS**: Utility-first styling
- **React Query**: Server state management
- **Zustand**: Client state management

### Backend Technologies

- **Node.js**: Runtime environment
- **Express.js**: HTTP server framework
- **Prisma**: Database ORM
- **Redis**: Caching and sessions
- **JWT**: Authentication tokens
- **Zod**: Runtime type validation

### Infrastructure Technologies

- **Kubernetes**: Container orchestration
- **Docker**: Containerization
- **AWS**: Cloud infrastructure
- **Terraform**: Infrastructure as code
- **GitHub Actions**: CI/CD pipelines
- **Prometheus/Grafana**: Monitoring and alerting

### Data Technologies

- **PostgreSQL**: Primary relational database
- **Supabase**: Database service layer
- **Redis**: Caching and messaging
- **Elasticsearch**: Search and analytics
- **S3**: Object storage

## Deployment Architecture

### Environment Strategy

- **Development**: Local containers with hot reload
- **Staging**: Production-like environment for testing
- **Production**: Multi-AZ, auto-scaling deployment

### CI/CD Pipeline

1. **Code Quality**: Linting, type checking, testing
2. **Security Scanning**: Dependency and secret scanning
3. **Build**: Container image creation
4. **Deploy**: Environment-specific deployments
5. **Validation**: Automated testing and monitoring

### Infrastructure as Code

- **Terraform**: Cloud resource provisioning
- **Helm**: Kubernetes application packaging
- **Docker**: Container image definitions
- **GitOps**: Declarative infrastructure updates

## Security Architecture

### Authentication & Authorization

- **JWT-based authentication** with refresh tokens
- **Role-Based Access Control** with fine-grained permissions
- **Multi-Factor Authentication** for elevated access
- **OAuth 2.0** integration for third-party services

### Data Security

- **Encryption at rest** using AES-256
- **TLS 1.3** for data in transit
- **Row Level Security** for tenant isolation
- **Audit logging** for compliance

### Network Security

- **Zero-trust networking** with micro-segmentation
- **Web Application Firewall** protection
- **DDoS mitigation** with automatic scaling
- **VPN access** for administrative operations

## Monitoring & Observability

### Application Metrics

- **Response Times**: P50, P95, P99 latencies
- **Error Rates**: Application and API errors
- **Request Volume**: Throughput and concurrency
- **Resource Usage**: CPU, memory, disk utilization

### Business Metrics

- **User Activity**: Session duration, feature usage
- **Conversion Rates**: Goal completion tracking
- **Performance KPIs**: Business-specific metrics
- **Tenant Analytics**: Multi-tenant usage patterns

### Distributed Tracing

- **Request Correlation**: End-to-end request tracking
- **Service Dependencies**: Call graph visualization
- **Performance Analysis**: Bottleneck identification
- **Error Propagation**: Failure root cause analysis

### Alerting Strategy

- **Service Health**: Availability and performance alerts
- **Security Events**: Suspicious activity detection
- **Business Metrics**: SLA breach notifications
- **Infrastructure**: Resource utilization warnings

## Scalability Patterns

### Horizontal Scaling

- **Stateless Services**: Independent scaling units
- **Load Balancing**: Traffic distribution
- **Auto-scaling**: Demand-based scaling
- **Service Mesh**: Inter-service communication

### Database Scaling

- **Read Replicas**: Query load distribution
- **Sharding**: Data partitioning strategies
- **Connection Pooling**: Resource optimization
- **Caching Layers**: Performance optimization

### Caching Strategy

- **Multi-level Caching**: Browser, CDN, application, database
- **Cache Invalidation**: Event-driven cache updates
- **Cache Warming**: Proactive cache population
- **Cache Monitoring**: Hit rate and performance tracking

## Future Architecture Considerations

### Technology Evolution

- **Serverless Migration**: Appropriate service decomposition
- **GraphQL Adoption**: Flexible API evolution
- **Event Sourcing**: Enhanced audit capabilities
- **Micro-frontend Architecture**: UI modularity improvements

### Scalability Enhancements

- **Global Distribution**: Multi-region deployment
- **Edge Computing**: Reduced latency for users
- **Advanced Caching**: Intelligent cache strategies
- **Machine Learning**: Predictive scaling and optimization

### Security Advancements

- **Zero-trust Refinement**: Continuous authentication
- **Advanced Threat Detection**: AI-powered security
- **Privacy by Design**: Enhanced data protection
- **Compliance Automation**: Regulatory requirement management

## Architecture & Scalability Assessment

**Score:** 3 (Established)

### Strengths

- Row-level security is used to enforce tenant isolation, with audit evidence noting RLS enabled for all tables.
- CI/CD supports containerized deployments with digest-based promotion to EKS, indicating scalable deploy patterns.
- DR/backup runbook defines PITR and multi-environment RPO/RTO targets, supporting resilience planning.

### Gaps

- No explicit documentation of horizontal scaling policies, autoscaling thresholds, or multi-region failover.
- API versioning and backward compatibility practices are not described in the reviewed sources.

### Recommendations (to move to 4)

- Document and automate scaling policies (HPA, queue backpressure thresholds, autoscale triggers).
- Define API versioning and deprecation policies with backward compatibility guarantees.

---

**Document Status**: ✅ **Production Ready**
**Last Updated**: January 14, 2026
**Version**: 1.0
**Review Frequency**: Quarterly
**Maintained By**: Architecture Team

---

## Module Boundary Map

*Source: `architecture/MODULE_BOUNDARY_MAP.md`*

## Intended Layering (authoritative)

```text
apps/*
  -> @valueos/backend (API boundary)
  -> @valueos/sdui (rendering + registry)
  -> @valueos/components (design system)

@valueos/backend
  -> @valueos/agents (agent framework)
  -> @valueos/memory
  -> @valueos/infra
  -> @valueos/integrations
  -> @valueos/shared | @valueos/mcp | @valueos/sdui-types

@valueos/agents
  -> @valueos/memory
  -> @valueos/infra
```

## SDUI Registry Boundary

- Registry definition and component-tool contracts live in `packages/sdui/src/registry.tsx` and `packages/sdui/src/ComponentToolRegistry.ts`.
- Consumers should import SDUI via `@valueos/sdui` (or documented subpaths), not `packages/sdui/src/*` internals.

## Agent Framework Boundary

- Agent public entrypoints are `@valueos/agents`, `@valueos/agents/core`, `@valueos/agents/orchestration`, `@valueos/agents/tools`, and `@valueos/agents/evaluation`.
- Frontends should never deep-import per-agent internals.

## Enforcement in this change

- ESLint blocks:
  - cross-package relative imports (`../packages/*`)
  - deep imports into package internals (`@valueos/*/src/*`)
- TS path aliases now prefer package-level public APIs (`@valueos/<package>`).

## Incremental Migration Plan

1. **Freeze new debt**: keep boundary lint rules at `error` in CI.
2. **Fix highest-risk imports first**:
   - imports into `@valueos/*/src/*`
   - relative hops into `packages/*`
3. **Replace each violation with a public API import** (`@valueos/<pkg>` or approved subpath export).
4. **If a needed symbol is internal**, add it to that package `index.ts` (small, explicit export).
5. **Track progress** with `eslint` output trend; fail PRs that increase violations.

## Local validation commands

- `pnpm eslint apps packages --max-warnings=0`
- `pnpm tsc --noEmit -p tsconfig.app.json`
- `pnpm --filter @valueos/sdui typecheck`
- `pnpm --filter @valueos/agents typecheck`

---

## System Invariants

*Source: `SYSTEM_INVARIANTS.md`*

**These values MUST NEVER change. Breaking these breaks reproducibility.**

## Demo User (Development Only)

```
UUID:     00000000-0000-0000-0000-000000000001
Email:    demouser@valynt.com
Password: passw0rd
Role:     admin
```

**Contract:** This user must always exist after running seed scripts. Login with these credentials must always succeed in development.

## Pinned Versions

```
Node:     18.19.0 (see .nvmrc)
npm:      9.2.0 (see package.json packageManager)
Postgres: 15.1.0.117 (see docker-compose, CI)
```

**Contract:** These versions are locked. Changing them requires migration testing.

## Required Environment Variables

**Must exist at startup (fail-fast if missing):**

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

**Contract:** App crashes immediately if these are undefined.

## Database Reset Behavior

**Idempotent operations:**

- Seed scripts use UPSERT, not INSERT
- Running seed twice produces identical state
- No random UUIDs or timestamps in seed data

**Contract:** `npm run seed` can be run multiple times safely.

## Auth Contract

**Login flow:**

1. POST to `/auth/v1/token` with demo credentials
2. Receive `access_token` and `refresh_token`
3. Token must be valid for protected routes

**Contract:** If demo user exists, login must succeed.

## Health Check Contract

**Endpoint:** `GET /api/health`

**Expected response:**

```json
{
  "status": "ok",
  "timestamp": "<ISO8601>"
}
```

**Contract:** Returns 200 if app is operational.

## Build Reproducibility

**Deterministic outputs:**

- Same source → same build artifacts
- No timestamps in build output
- No hostname/username in artifacts

**Contract:** Two builds from same commit produce byte-identical results (excluding source maps).

---

**Violation Policy:**

If any invariant is violated, it is a **breaking change** requiring:

1. Migration guide
2. CI test updates
3. Documentation updates
4. Team notification

---
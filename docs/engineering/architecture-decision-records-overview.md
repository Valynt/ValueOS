# ValueOS Architecture Decision Records Overview

## Executive Summary

This document provides comprehensive documentation of ValueOS Architecture Decision Records (ADRs), covering the ADR process, conventions, and all accepted architectural decisions that shape the platform's design and implementation. ADRs serve as the authoritative record of architectural choices, trade-offs, and rationales for the ValueOS platform.

## ADR Process & Conventions

### Repository Structure

Architecture Decision Records are maintained in `docs/engineering/adr/` following a structured, sequential numbering pattern.

### Numbering and Naming Conventions

- **Filenames**: Follow the pattern `NNNN-short-title.md` where `NNNN` is a zero-padded integer
- **Sequential Reservation**: Reserve the next sequential number when opening new ADRs to avoid collisions
- **Title Constraints**: Keep titles concise (under 60 characters) and scoped to one architectural decision

### Status Lifecycle

- **Proposed**: Drafted and under review
- **Accepted**: Approved and the decision is in effect
- **Deprecated**: Decision is superseded but still referenced by implementations
- **Superseded**: Replaced by a newer ADR (must link to successor)

### ADR Template Structure

```markdown
# ADR NNNN: Title

- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Date**: YYYY-MM-DD
- **Scope**: Systems or domains affected
- **Supersedes**: ADR number(s) if applicable

## Context

Summarize the problem, constraints, and why a decision is required. Include stakeholders and relevant compliance or reliability requirements.

## Decision

List the decisions made, including technology selections, patterns, and key configuration choices. Keep scope tight and actionable.

## Alternatives Considered

Outline at least two alternatives with rationale for rejection.

## Consequences

Describe positive and negative follow-on effects, operational impacts, and any migration steps required.
```

### Review Cadence

- **Quarterly Review**: Perform comprehensive review of all ADRs to confirm they still reflect current system architecture
- **Alignment Maintenance**: Keep C4 diagrams and schema/service changes synchronized with ADR updates to prevent documentation drift

---

## Accepted Architecture Decisions

### ADR 0001: Orchestration Layer Design Decisions

**Status**: Accepted | **Date**: 2025-11-17 | **Scope**: Workflow orchestrator covering `workflows`, `workflow_executions`, and `task_queue` plus Reflection Engine and Task Router

#### Context

The platform coordinates multiple autonomous agents with deterministic workflows, backpressure controls, and traceability requirements. A pluggable orchestration layer supporting DAG execution, retries, guardrails, and staged rollout was needed.

#### Decision

- **Postgres-backed DAG Orchestrator**: Explicit workflow definitions in `workflows` table with runtime progress in `workflow_executions`
- **Task Router**: Classifies steps by capability (LLM, data fetch, compliance check) with idempotency keys and worker dispatch
- **Reflection Engine**: Scores outputs against 18-point rubric, triggers up to 3 refinements when below threshold
- **Feature Flags**: Gate all orchestration features (`ORCHESTRATOR_ENABLED`, `REFLECTION_ENGINE_ENABLED`) for gradual rollout and rollback
- **Observability Hooks**: Metrics and audit logs for each transition supporting runbook-driven recovery

#### Alternatives Considered

- **External workflow engines (Temporal)**: Rejected to avoid operational overhead and keep orchestration co-located with Supabase data models
- **Pure queue-based sequencing**: Rejected due to lack of DAG awareness, making recovery and retries coarse-grained

#### Consequences

- **Positive**: DAG awareness enables sophisticated workflows, reflection engine improves output quality, feature flags provide safe rollbacks
- **Negative**: Postgres becomes system of record requiring migration discipline, extra configuration surface from feature flags
- **Operational**: Task router isolation enables targeted throttling, reflection engine adds latency but reduces manual QA

---

### ADR 0002: SDUI Architecture and Component Registry Patterns

**Status**: Accepted | **Date**: 2025-11-17 | **Scope**: Server-Driven UI renderer, component registry, and schema versioning for canvas experiences

#### Context

The platform serves dynamic canvases and workflows requiring evolution without frequent frontend redeploys. A consistent schema for SDUI payloads, governed component registry, and backwards-compatible rendering paths were needed.

#### Decision

- **Versioned Component Registry**: Each component definition includes schema version, props contract, and validation rules published alongside SDUI manifests
- **JSON Schema Validation**: Renderer rejects malformed payloads with actionable errors for missing props or deprecated variants
- **Graceful Degradation**: Unknown components render as placeholders with telemetry, optional props use documented fallbacks
- **Deterministic Rendering**: Avoid runtime `eval`, whitelist allowed interactions, prefer declarative actions over arbitrary code
- **Edge Caching**: SDUI manifests cached with short TTLs and ETags, paired with migration notes for rolling upgrades

#### Alternatives Considered

- **Static UI bundles per experience**: Rejected due to deployment friction and slowed experimentation
- **Unversioned component JSON**: Rejected due to high breaking change risk and limited traceability

#### Consequences

- **Positive**: Enables dynamic UI evolution without redeploys, backwards compatibility supports gradual rollouts
- **Negative**: Schema versioning adds maintenance overhead, cache busting required during rollouts
- **Operational**: Component authors must increment versions for breaking changes, manifest validation becomes critical dependency

---

### ADR 0003: Compliance Metadata Schema Choices

**Status**: Accepted | **Date**: 2025-11-17 | **Scope**: Compliance metadata captured across value cases, agent outputs, and policy evaluations

#### Context

The Integrity Agent enforces manifesto rules and auditability requirements. A schema preserving provenance, explaining assumptions, and supporting downstream attestations without bloating operational tables was needed.

#### Decision

- **Dedicated JSONB Columns**: Store compliance metadata in `compliance_metadata` columns on key domain tables with indexes on frequently queried attributes (`source`, `control_id`, `confidence`)
- **Provenance Links**: Tie each assumption/KPI to evidence artifacts using stable `evidence_id` references
- **Rule Evaluation Outcomes**: Capture pass/fail status, severity, and remediation hints per manifesto rule
- **Chain-of-Custody Hashes**: Maintain hashes for formulas and deliverables to validate integrity during rollbacks
- **Read-Only Compliance Views**: Expose auditor views excluding sensitive keys while retaining lineage

#### Alternatives Considered

- **Separate compliance microservice**: Rejected to avoid domain model duplication and keep RLS policies centralized
- **Flat columns per rule**: Rejected due to schema churn as policies evolve

#### Consequences

- **Positive**: Flexible metadata storage without schema changes, comprehensive audit trails, provenance tracking
- **Negative**: JSONB indexing requires curation to prevent performance regressions, provenance enforcement adds validation overhead
- **Operational**: GIN indexes needed on common paths, auditor views must sync with schema changes

---

### ADR 0004: Performance Optimization Trade-offs

**Status**: Accepted | **Date**: 2025-11-17 | **Scope**: Runtime performance improvements across Agent Fabric, SDUI rendering, and Supabase interactions

#### Context

The platform must maintain low interactive latency while orchestrating multi-agent workflows and rendering SDUI payloads. Multiple optimization opportunities exist but each introduces operational or architectural trade-offs.

#### Decision

- **Response Caching**: Enable for read-mostly endpoints and SDUI manifests with short TTLs, bypass for authenticated mutations
- **Batching and Concurrency Controls**: Task Router minimizes LLM round-trips while respecting provider rate limits
- **Lazy-Loading**: Non-critical SDUI components and documentation assets prioritize above-the-fold rendering
- **Vector Index Tuning**: Apply `ivfflat` parameters only after baseline metrics, maintain sequential scan fallbacks
- **Runtime Telemetry**: Collect latency, token counts, cache hit rates for SLO dashboards and optimization guidance

#### Alternatives Considered

- **Aggressive client-side caching**: Rejected to avoid serving stale governance-sensitive manifests
- **Unbounded parallelism**: Rejected due to LLM throttling and shared state race conditions

#### Consequences

- **Positive**: Improved latency and throughput, data-driven optimization capabilities
- **Negative**: Caching requires explicit invalidation, batching can delay individual tasks
- **Operational**: Cache invalidation hooks needed for releases, telemetry introduces slight overhead but enables optimization

---

### ADR 0001: Repository Architecture Cleanup

**Status**: Accepted | **Date**: Not specified | **Scope**: Repository structure, code organization, and technical debt reduction

#### Context

The ValueOS repository had grown to 370,000+ lines of TypeScript code with significant technical debt: 21 "God Files" exceeding 1,000 lines, mixed architectural patterns, weak type safety, complex dependencies, and scattered API layers.

#### Decision

Implement comprehensive repository cleanup:

1. **Migrate to feature-based architecture** from folder-by-type organization
2. **Decompose God Files** into focused, maintainable modules
3. **Implement strict type safety** eliminating 'any' usage
4. **Consolidate API layer** with consistent patterns
5. **Standardize state management** across the application
6. **Create comprehensive documentation** for all changes

#### Rationale

- **Maintainability**: Feature-based architecture improves code organization and navigation
- **Scalability**: Smaller, focused modules are easier to maintain and test
- **Developer Experience**: Better onboarding and reduced cognitive load
- **Code Quality**: Strict typing reduces runtime errors and improves IDE support
- **Performance**: Optimized dependency management improves build times

#### Consequences

**Positive:**

- 20% increase in development velocity
- 40% reduction in code duplication
- Onboarding time reduced from weeks to days
- Enhanced code maintainability and type safety

**Negative:**

- 2-3 month migration period with temporary development disruption
- Learning curve for new architectural patterns
- Initial complexity during transition phase

**Implementation:**

- **Phase 1**: Audit and analysis (2 weeks)
- **Phase 2**: Structural refactoring (4 weeks)
- **Phase 3**: Dependency cleanup (2 weeks)
- **Phase 4**: Core modernization (4 weeks)
- **Phase 5**: Documentation (2 weeks)

**Success Metrics:**

- Build time reduced by 20-40%
- Type coverage reaches 95%+
- Code review time reduced by 30%
- Bug rate reduced by 25%
- Improved developer satisfaction

---

## ADR Status Summary

| ADR  | Title                                    | Status      | Date          | Scope                  |
| ---- | ---------------------------------------- | ----------- | ------------- | ---------------------- |
| 0001 | Orchestration Layer Design Decisions     | ✅ Accepted | 2025-11-17    | Workflow orchestration |
| 0002 | SDUI Architecture and Component Registry | ✅ Accepted | 2025-11-17    | UI rendering system    |
| 0003 | Compliance Metadata Schema Choices       | ✅ Accepted | 2025-11-17    | Audit and compliance   |
| 0004 | Performance Optimization Trade-offs      | ✅ Accepted | 2025-11-17    | System performance     |
| 0001 | Repository Architecture Cleanup          | ✅ Accepted | Not specified | Code organization      |

## ADR Maintenance Guidelines

### Quarterly Review Process

1. **Audit Current State**: Verify all ADRs still reflect implemented architecture
2. **Update Status**: Mark deprecated decisions and link superseded records
3. **Align Documentation**: Ensure C4 diagrams match ADR specifications
4. **Identify Gaps**: Document new architectural decisions requiring ADRs

### Creating New ADRs

1. **Reserve Number**: Take next sequential ADR number to avoid conflicts
2. **Use Template**: Copy `template.md` and fill in all sections
3. **Stakeholder Review**: Present to architecture review board
4. **Implementation**: Update status to "Accepted" upon approval

### ADR Quality Standards

- **Single Decision**: Each ADR addresses exactly one architectural choice
- **Actionable Decisions**: Include specific technology selections and patterns
- **Comprehensive Alternatives**: Document at least two rejected options with rationale
- **Impact Assessment**: Detail operational and migration consequences
- **Future-Proof**: Include scope and supersession information

---

**Last Updated**: January 14, 2026
**Version**: 1.0
**Maintained By**: Architecture Team
**Review Frequency**: Quarterly

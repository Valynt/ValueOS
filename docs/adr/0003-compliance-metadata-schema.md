# ADR 0003: Compliance Metadata Schema Choices

- **Status**: Accepted
- **Date**: 2025-11-17
- **Scope**: Compliance metadata captured across value cases, agent outputs, and policy evaluations.

## Context
The Integrity Agent enforces manifesto rules and auditability requirements. We need a schema that preserves provenance, explains assumptions, and supports downstream attestations without bloating operational tables.

## Decision
- Store compliance metadata in **dedicated JSONB columns** (e.g., `compliance_metadata`) on key domain tables, with indexes on frequently queried attributes such as `source`, `control_id`, and `confidence`.
- Record **provenance links** that tie each assumption or KPI to evidence artifacts (documents, benchmarks, telemetry) using stable `evidence_id` references.
- Capture **rule evaluation outcomes** (pass/fail, severity, remediation hints) per manifesto rule to enable targeted enforcement and user-facing explanations.
- Maintain **chain-of-custody hashes** for formulas and generated deliverables so rollback/restore workflows can validate integrity.
- Expose a **read-only compliance view** for auditors that excludes sensitive keys while retaining lineage.

## Alternatives Considered
- **Separate compliance microservice**: Rejected to avoid duplication of domain models and to keep RLS policies centralized in Supabase.
- **Flat columns per rule**: Rejected due to schema churn as policies evolve; JSONB keeps flexibility while allowing selective indexing.

## Consequences
- JSONB indexing must be curated to prevent performance regressions; include `GIN` indexes on the most common paths.
- Provenance enforcement requires consistent `evidence_id` generation and validation at write time.
- Auditor views must be kept in sync with schema changes to avoid leaking sensitive remediation details.

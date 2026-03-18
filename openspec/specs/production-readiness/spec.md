# Production Readiness Specification

## Purpose

Operational readiness requirements for enterprise B2B launch, covering API versioning, code quality thresholds, observability, deployment safety, and compliance evidence. These are the minimum bars that must be met before production traffic.

Consolidated from: `docs/specs/spec-production-readiness.md`

## Requirements

### Requirement: API versioning enforcement

The system MUST enforce API version validation and return appropriate errors for unsupported versions.

#### Scenario: Unsupported API version

- GIVEN a client sends a request with an unsupported API version
- WHEN the versioning middleware processes the request
- THEN it returns HTTP 426 with `error: "unsupported_version"`

#### Scenario: Supported API version

- GIVEN a client sends a request with a supported API version
- WHEN the versioning middleware processes the request
- THEN the `API-Version` response header is set correctly
- AND the request proceeds to the handler

#### Scenario: Deprecated version warning

- GIVEN deprecated API versions exist
- WHEN any request is processed
- THEN the `API-Deprecated-Versions` header lists the deprecated versions

### Requirement: TypeScript type safety thresholds

The system SHOULD maintain TypeScript `any` usage below defined thresholds.

#### Scenario: Any count within threshold

- GIVEN the codebase has a measured `any` count
- WHEN CI runs the type safety check
- THEN the count MUST be at or below the configured threshold
- AND the threshold is tracked in `ts-any-dashboard.md`

### Requirement: Test coverage thresholds

The system MUST maintain minimum test coverage levels.

#### Scenario: Coverage gate in CI

- GIVEN test coverage is measured during CI
- WHEN coverage falls below configured thresholds (lines=75%, functions=70%, branches=70%)
- THEN the CI pipeline fails
- AND the failure identifies which metrics are below threshold

### Requirement: Service deduplication

The system SHOULD NOT contain duplicate service implementations.

#### Scenario: Duplicate service detected

- GIVEN two files with the same service name exist
- WHEN they are audited
- THEN either they serve distinct concerns (documented in file headers)
- OR the duplicate is removed with imports redirected to the canonical location

### Requirement: Structured logging

The system MUST use structured logging instead of console.log in backend services.

#### Scenario: No console.log in backend

- GIVEN the backend codebase
- WHEN ESLint runs with `no-console` enabled
- THEN no `console.log` calls exist in production backend code
- AND all logging uses the structured logger

### Requirement: DAST gate enforcement

The system MUST fail CI on high-severity DAST findings.

#### Scenario: High-severity DAST finding

- GIVEN the DAST scan (OWASP ZAP) produces a high-severity finding
- WHEN CI evaluates the DAST results
- THEN the pipeline fails
- AND the finding is reported with remediation guidance

### Requirement: OpenAPI specification coverage

The system SHOULD document all API endpoints in the OpenAPI specification.

#### Scenario: Undocumented endpoint detected

- GIVEN a route exists in the Express router
- WHEN compared against the OpenAPI spec
- THEN any undocumented endpoints are flagged
- AND the gap is tracked for remediation

### Requirement: SLO/SLI documentation

The system SHOULD define Service Level Objectives for key user journeys.

#### Scenario: SLO document exists

- GIVEN the observability infrastructure is deployed
- WHEN an engineer checks operational readiness
- THEN `infra/observability/SLOs.md` defines measurable SLOs for: case creation latency, agent execution latency, API availability, and error rates

### Requirement: Release waiver tracking

The system SHALL track any skipped tests or known issues with explicit waivers.

#### Scenario: Waiver with expiry

- GIVEN a test is skipped for a legitimate reason
- WHEN the waiver is created
- THEN it includes: owner, reason, expiry date, and ticket reference
- AND CI fails if a waiver is expired without resolution

### Requirement: Legacy code removal

The system SHOULD NOT contain legacy root directories or dead scaffolding.

#### Scenario: Legacy directory detection

- GIVEN the repository root
- WHEN checked for legacy directories (`client/`, `server/`, `shared/`)
- THEN none exist
- AND ESLint rules ban imports from legacy paths

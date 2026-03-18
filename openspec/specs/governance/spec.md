# Governance Specification

## Purpose

Governance ensures that ValueOS operates with strict tenant isolation, role-based access control, comprehensive audit logging, policy-based constraints, and enterprise-grade security — making it safe for environments where business cases, financial assumptions, and customer-sensitive deal data require strong controls.

Reference: [V1 Product Design Brief](../v1-product-vision/spec.md) §20–§21

## Requirements

### Requirement: Tenant isolation

The system MUST enforce strict data isolation between tenants at both the application and database layers.

#### Scenario: Database query isolation

- GIVEN a user belongs to tenant A
- WHEN any database query executes on a tenant-scoped table
- THEN the query MUST include the tenant's organization_id filter
- AND RLS policies enforce isolation as defense-in-depth

#### Scenario: Cross-tenant access blocked

- GIVEN a user from tenant A attempts to access data belonging to tenant B
- WHEN the request is processed
- THEN the system blocks the access
- AND logs the attempt

#### Scenario: Memory and vector query isolation

- GIVEN an agent queries vector memory or semantic search
- WHEN the query executes
- THEN it MUST filter on the requesting tenant's tenant_id in metadata
- AND no cross-tenant results are returned

### Requirement: Role-based access control

The system SHALL enforce role-based access control for all operations.

#### Scenario: User role enforcement

- GIVEN a user with a specific role (e.g., viewer, editor, admin)
- WHEN they attempt an operation exceeding their permissions
- THEN the operation is denied
- AND the denial is logged

### Requirement: Audit logging

The system MUST log all sensitive operations with sufficient detail for compliance review.

#### Scenario: Create/update/delete audit trail

- GIVEN a user or agent performs a create, update, delete, export, approve, reject, grant, or revoke action
- WHEN the action completes
- THEN an audit entry is created with: actor_id, organization_id, action type, resource_id, timestamp, and change detail
- AND audit entries are append-only (no updates or deletes)

#### Scenario: Agent action logging

- GIVEN an agent performs an action during workflow execution
- WHEN the action completes
- THEN the audit log records: agent type, action performed, inputs consumed, outputs produced, and correlation_id

#### Scenario: User override logging

- GIVEN a user overrides a system-generated value (assumption, baseline, narrative)
- WHEN the override is saved
- THEN the audit log records: original value, new value, override reason if provided, and actor

### Requirement: Source auditability

The system SHALL log all sources consulted, benchmark sets used, and external data retrieved during case assembly.

#### Scenario: Source consultation log

- GIVEN the system retrieves benchmark data or external research during case assembly
- WHEN the retrieval completes
- THEN the source, retrieval timestamp, and data summary are logged
- AND the log is queryable by tenant admins

### Requirement: Policy-based constraints

The system SHALL allow policy-based constraints on allowable sources, benchmark usage, human approval thresholds, output sharing, and model override behavior.

#### Scenario: Human approval threshold

- GIVEN a tenant policy requires human approval for cases above a certain deal size
- WHEN a value case exceeds the threshold
- THEN the system blocks output generation until human approval is recorded

#### Scenario: Source allowlist enforcement

- GIVEN a tenant policy restricts allowable benchmark sources
- WHEN the system retrieves benchmarks
- THEN only sources on the tenant's allowlist are used

### Requirement: Encryption and data protection

The system MUST encrypt data in transit and at rest.

#### Scenario: Data in transit

- GIVEN any client-server communication
- WHEN data is transmitted
- THEN it is encrypted via TLS

#### Scenario: Data at rest

- GIVEN tenant data is stored in the database
- WHEN data is persisted
- THEN it is encrypted at rest

### Requirement: Data retention and deletion

The system SHALL support data retention policies and deletion capabilities.

#### Scenario: Tenant data deletion

- GIVEN a tenant requests data deletion
- WHEN the deletion is processed
- THEN all tenant-scoped data is removed
- AND the deletion is logged in the audit trail

### Requirement: Controlled external data acquisition

The system SHALL control and log all external browsing and data acquisition performed by agents.

#### Scenario: External data retrieval logged

- GIVEN an agent fetches data from an external source (SEC filings, benchmark API, web research)
- WHEN the fetch completes
- THEN the URL, timestamp, data hash, and retrieval context are logged

### Requirement: Sensitive input redaction

The system SHOULD support redaction of sensitive customer inputs in logs and outputs.

#### Scenario: PII detection in inputs

- GIVEN a user provides input containing PII (SSN, credit card, email lists, phone numbers)
- WHEN the input is processed
- THEN PII is detected and redacted before logging
- AND PII is never stored in plain text in audit logs

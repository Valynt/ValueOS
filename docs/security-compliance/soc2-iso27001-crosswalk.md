---
title: SOC 2 TSC ↔ ISO 27001:2022 Annex A Control Crosswalk
owner: compliance-lead
system: valueos-platform
status: active
review_cadence: quarterly
machine_readable_companion: docs/security-compliance/control-registry.json
---

# SOC 2 TSC ↔ ISO 27001:2022 Annex A Control Crosswalk

Maps every in-scope SOC 2 Trust Services Criteria to its ISO 27001:2022 Annex A counterpart(s). Each row includes the control owner, evidence source, test cadence, and whether evidence is produced automatically by CI.

This document is the human-readable companion to `control-registry.json`, which is the machine-readable source of truth evaluated by CI gates.

## How to use this document

- **Adding a new control**: add a row here and a corresponding entry in `control-registry.json` with `"status": "mapped"`.
- **Removing a control**: mark it `"status": "exception"` in `control-registry.json` with justification and expiry; do not delete the row here.
- **Changing evidence source**: update both this document and `control-registry.json` in the same PR.

---

## CC1 — Control Environment

| SOC 2 Control | ISO 27001:2022 Annex A | Control Title | Control Owner | Evidence Source | Test Cadence | Automated |
|---|---|---|---|---|---|---|
| CC1.1 | A.5.1, A.5.2 | Security policies and management commitment | Compliance Lead | `docs/security-compliance/security-overview.md`, `docs/security-compliance/production-contract.md` | quarterly | false |
| CC1.2 | A.6.1, A.6.2 | Organizational roles and responsibilities | Compliance Lead | `docs/security-compliance/control-ownership-matrix.md`, `catalog-info.yaml` | quarterly | false |
| CC1.3 | A.5.4 | Management oversight of controls | Compliance Lead | `docs/security-compliance/compliance-guide.md` | quarterly | false |
| CC1.4 | A.6.3 | Workforce competence and training | Compliance Lead | `docs/security-compliance/compliance-guide.md` | quarterly | false |
| CC1.5 | A.5.10, A.5.11 | Accountability and enforcement | Security Architect | `docs/security-compliance/audit-logging.md`, `packages/backend/src/services/security/AuditLogService.ts` | continuous | true |

---

## CC2 — Communication and Information

| SOC 2 Control | ISO 27001:2022 Annex A | Control Title | Control Owner | Evidence Source | Test Cadence | Automated |
|---|---|---|---|---|---|---|
| CC2.1 | A.5.1, A.5.37 | Internal communication of security policies | Compliance Lead | `docs/security-compliance/security-overview.md`, `AGENTS.md` | quarterly | false |
| CC2.2 | A.5.6 | External communication of security commitments | Product/Customer Trust Lead | `docs/security-compliance/trust-center.md`, `docs/security-compliance/control-summaries.md` | quarterly | false |
| CC2.3 | A.6.8 | Reporting security events | SRE Lead | `packages/backend/src/services/security/SecurityMonitor.ts`, `docs/operations/incident-response.md` | continuous | true |

---

## CC3 — Risk Assessment

| SOC 2 Control | ISO 27001:2022 Annex A | Control Title | Control Owner | Evidence Source | Test Cadence | Automated |
|---|---|---|---|---|---|---|
| CC3.1 | A.5.7, A.8.8 | Risk identification and threat intelligence | Security Architect | `docs/security-compliance/threat-model.md` | quarterly | false |
| CC3.2 | A.5.7 | Risk analysis and evaluation | Security Architect | `docs/security-compliance/threat-model.md`, `SECURITY_AUDIT_REPORT.md` | quarterly | false |
| CC3.3 | A.5.7 | Risk treatment and response | Security Architect | `docs/security-compliance/audit-exceptions-policy.md` | quarterly | false |
| CC3.4 | A.8.8 | Vulnerability management | Security Architect | `evidence/security-scans/pnpm-audit.json`, `evidence/security-scans/semgrep.sarif` | continuous | true |

---

## CC4 — Monitoring Activities

| SOC 2 Control | ISO 27001:2022 Annex A | Control Title | Control Owner | Evidence Source | Test Cadence | Automated |
|---|---|---|---|---|---|---|
| CC4.1 | A.8.16 | Continuous monitoring of controls | SRE Lead | `packages/backend/src/services/security/ComplianceControlCheckService.ts`, `compliance_control_audit` table | continuous | true |
| CC4.2 | A.5.35, A.5.36 | Internal audit and self-assessment | Compliance Lead | `docs/security-compliance/compliance-guide.md`, quarterly evidence bundle | quarterly | false |

---

## CC5 — Control Activities

| SOC 2 Control | ISO 27001:2022 Annex A | Control Title | Control Owner | Evidence Source | Test Cadence | Automated |
|---|---|---|---|---|---|---|
| CC5.1 | A.5.15, A.8.2 | Selection and development of controls | Security Architect | `docs/security-compliance/control-ownership-matrix.md` | quarterly | false |
| CC5.2 | A.8.9 | Technology controls — configuration management | Platform Lead | `infra/k8s/`, `.github/workflows/deploy.yml` | continuous | true |
| CC5.3 | A.8.32 | Change management controls | Platform Lead | `packages/backend/src/services/security/AuditLogService.ts`, `public.approval_requests` | continuous | true |

---

## CC6 — Logical and Physical Access Controls

| SOC 2 Control | ISO 27001:2022 Annex A | Control Title | Control Owner | Evidence Source | Test Cadence | Automated |
|---|---|---|---|---|---|---|
| CC6.1 | A.8.3, A.8.4 | Logical access security — tenant isolation (RLS) | Security Architect | `tests/security/rls-tenant-isolation.test.ts`, `evidence/rls/rls-validation.json` | continuous | true |
| CC6.2 | A.8.5 | Authentication and MFA enforcement | Security Architect | `ComplianceControlCheckService` MFA check, `audit_logs.action=compliance:automated_control_checks_ran` | continuous | true |
| CC6.3 | A.5.15, A.8.2 | Role-based access and least privilege | Security Architect | `docs/security-compliance/rbac-role-taxonomy.md`, `packages/backend/src/services/auth/` | continuous | true |
| CC6.4 | A.8.18 | Privileged access management (service-role) | Security Architect | `scripts/check-service-role-usage.sh`, `packages/backend/src/lib/supabase/privileged/` | continuous | true |
| CC6.5 | A.5.16, A.5.17 | User provisioning and de-provisioning | Platform Lead | `packages/backend/src/services/tenant/`, `packages/backend/src/services/auth/` | monthly | false |
| CC6.6 | A.8.20, A.8.21 | Network access controls | Security Architect | `infra/k8s/security/network-policies.yaml`, `infra/k8s/security/zero-trust-network-policies.yaml` | continuous | true |
| CC6.7 | A.8.24 | Encryption in transit (mTLS / TLS) | Security Architect | `infra/k8s/security/mesh-authentication.yaml`, `infra/tls/` | continuous | true |
| CC6.8 | A.8.15, A.8.17 | Audit log integrity and immutability | Security Architect | `tests/compliance/audit/audit-log-immutability.test.ts`, `evidence/metadata/run-metadata.json` | continuous | true |

---

## CC7 — System Operations

| SOC 2 Control | ISO 27001:2022 Annex A | Control Title | Control Owner | Evidence Source | Test Cadence | Automated |
|---|---|---|---|---|---|---|
| CC7.1 | A.8.16 | Security monitoring and anomaly detection | SRE Lead | `packages/backend/src/services/security/SecurityMonitor.ts`, `SecurityAnomalyService.ts` | continuous | true |
| CC7.2 | A.8.16 | SIEM and event streaming | SRE Lead | `SiemExportForwarderService.ts`, `SecurityEventStreamingService.ts` | continuous | true |
| CC7.3 | A.5.26, A.5.27 | Incident identification and response | SRE Lead | `docs/operations/incident-response.md`, `docs/runbooks/emergency-procedures.md` | monthly | false |
| CC7.4 | A.5.26 | Incident containment and recovery | SRE Lead | `docs/runbooks/disaster-recovery.md` | monthly | false |
| CC7.5 | A.5.27 | Post-incident review and lessons learned | Compliance Lead | `docs/operations/incident-response.md` | monthly | false |

---

## CC8 — Change Management

| SOC 2 Control | ISO 27001:2022 Annex A | Control Title | Control Owner | Evidence Source | Test Cadence | Automated |
|---|---|---|---|---|---|---|
| CC8.1 | A.8.32 | Authorized change management and deployment approvals | Platform Lead | `.github/workflows/deploy.yml`, `public.approval_requests`, `public.approvals` | continuous | true |

---

## CC9 — Risk Mitigation

| SOC 2 Control | ISO 27001:2022 Annex A | Control Title | Control Owner | Evidence Source | Test Cadence | Automated |
|---|---|---|---|---|---|---|
| CC9.1 | A.5.29, A.5.30 | Business continuity and disaster recovery | SRE Lead | `docs/runbooks/disaster-recovery.md` | quarterly | false |
| CC9.2 | A.5.19, A.5.20 | Vendor and subprocessor risk management | Compliance Lead | `docs/security-compliance/subprocessor-list.md`, `docs/security-compliance/vendor-risk-review-workflow.md` | quarterly | false |

---

## A — Availability

| SOC 2 Control | ISO 27001:2022 Annex A | Control Title | Control Owner | Evidence Source | Test Cadence | Automated |
|---|---|---|---|---|---|---|
| A1.1 | A.5.29, A.8.14 | Availability commitments and capacity management | SRE Lead | `infra/observability/`, `infra/prometheus.yml` | continuous | true |
| A1.2 | A.8.14 | Environmental and infrastructure redundancy | Platform Lead | `infra/k8s/`, `docs/runbooks/disaster-recovery.md` | quarterly | false |
| A1.3 | A.5.30 | Recovery testing | SRE Lead | `docs/runbooks/disaster-recovery.md` | quarterly | false |

---

## C — Confidentiality

| SOC 2 Control | ISO 27001:2022 Annex A | Control Title | Control Owner | Evidence Source | Test Cadence | Automated |
|---|---|---|---|---|---|---|
| C1.1 | A.5.12, A.5.13 | Data classification and handling | Compliance Lead | `docs/security-compliance/data-ownership-statement.md` | quarterly | false |
| C1.2 | A.8.24, A.8.26 | Encryption at rest and in transit | Security Architect | `infra/k8s/security/`, `packages/backend/src/config/secrets/` | continuous | true |

---

## PI — Processing Integrity

| SOC 2 Control | ISO 27001:2022 Annex A | Control Title | Control Owner | Evidence Source | Test Cadence | Automated |
|---|---|---|---|---|---|---|
| PI1.1 | A.8.9, A.8.32 | Complete and accurate processing | Platform Lead | `packages/backend/src/services/security/ComplianceEvidenceService.ts`, hash-chain in `audit_logs` | continuous | true |
| PI1.2 | A.8.15 | Processing integrity monitoring | SRE Lead | `ComplianceControlStatusService.ts`, `compliance_control_evidence` | continuous | true |

---

## P — Privacy (where applicable)

| SOC 2 Control | ISO 27001:2022 Annex A | Control Title | Control Owner | Evidence Source | Test Cadence | Automated |
|---|---|---|---|---|---|---|
| P1.1 | A.5.34 | Privacy notice and consent | Compliance Lead | `docs/security-compliance/public-telemetry-retention-and-privacy.md` | quarterly | false |
| P4.1 | A.5.34 | Data subject rights (access, erasure) | Compliance Lead | `tests/compliance/dsr-workflow.test.ts`, `evidence/privacy/dsr-workflow.json` | continuous | true |
| P8.1 | A.5.34 | Privacy incident response | Compliance Lead | `docs/operations/incident-response.md` | monthly | false |

---

## Workload Identity Controls (Phase 1 additions)

| SOC 2 Control | ISO 27001:2022 Annex A | Control Title | Control Owner | Evidence Source | Test Cadence | Automated |
|---|---|---|---|---|---|---|
| CC6.1-WI | A.5.15, A.8.2 | Agent workload identity (SPIFFE/SPIRE) | Security Architect | `infra/k8s/security/spire-workload-registrations.yaml`, `docs/security-compliance/agent-identity-contract.md` | continuous | true |
| CC6.6-WI | A.8.20, A.8.22 | Deny-by-default service mesh authorization | Security Architect | `infra/k8s/security/deny-by-default-policy.yaml`, `infra/k8s/security/agent-pairwise-authorization-policies.yaml` | continuous | true |
| CC6.7-WI | A.8.24 | mTLS enforcement (STRICT mode) | Security Architect | `infra/k8s/security/mesh-authentication.yaml` | continuous | true |

---

## Related documents

- Machine-readable registry: `docs/security-compliance/control-registry.json`
- Evidence index: `docs/security-compliance/evidence-index.md`
- FedRAMP mapping: `docs/security-compliance/fedramp-control-mapping.md`
- Control ownership: `docs/security-compliance/control-ownership-matrix.md`
- Audit exceptions: `docs/security-compliance/audit-exceptions-policy.md`

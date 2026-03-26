---
title: Immutable Evidence Schema
owner: compliance-lead
system: valueos-platform
status: active
review_cadence: quarterly
related_controls: CC6.8, PI1.1, PI1.2
---

# Immutable Evidence Schema

Defines the canonical schema for all compliance evidence records written to the `compliance_control_evidence` table. Every evidence record must conform to this schema. Records are append-only — no updates or deletes are permitted outside of legal hold expiry processing.

## Record Schema

```typescript
interface EvidenceRecord {
  /** UUID v4. Primary key. */
  id: string;

  /** Organization/tenant UUID. All evidence is tenant-scoped. */
  tenant_id: string;

  /**
   * Control identifier from control-registry.json.
   * Examples: "CC6.1", "A.8.3", "CC6.1-WI"
   */
  control_id: string;

  /** Compliance framework this evidence satisfies. */
  framework: "SOC2" | "ISO27001" | "FedRAMP" | "GDPR" | "HIPAA";

  /**
   * Event type describing what happened.
   * Format: "{domain}:{event}" e.g. "rls:tenant-isolation-test-passed"
   */
  event_type: string;

  /** Structured event payload. Schema varies by event_type. */
  payload: Record<string, unknown>;

  /** ISO 8601 timestamp when the evidence was collected. */
  collected_at: string;

  /**
   * SPIFFE ID of the workload that collected this evidence.
   * e.g. "spiffe://valueos.internal/ns/valynt/agents/compliance-auditor"
   * For CI-collected evidence, use "ci:{workflow_name}:{run_id}".
   */
  collected_by: string;

  /**
   * SHA-256 hash of the previous record in the chain for this (tenant_id, control_id) pair.
   * Set to SHA-256("genesis:valueos.internal") for the first record in a chain.
   */
  previous_hash: string;

  /**
   * SHA-256 hash of this record's canonical fields:
   *   id + tenant_id + control_id + framework + event_type + collected_at + collected_by + previous_hash
   * Computed server-side before insert. Used to detect tampering.
   */
  integrity_hash: string;

  /**
   * RFC 3161 timestamp token (base64-encoded DER) from a trusted TSA, or a TSA URL
   * for deferred verification. Required for records with legal_hold: true.
   * For high-volume routine records, use null and rely on the periodic anchor record.
   */
  trusted_timestamp: string | null;

  /**
   * When true, this record is excluded from automated retention cleanup and
   * cannot be deleted without explicit legal hold release by a Compliance Lead.
   */
  legal_hold: boolean;

  /**
   * ISO 8601 timestamp after which this record may be deleted by retention cleanup.
   * Null if legal_hold is true (retention is indefinite until hold is released).
   * See evidence-retention-policy.md for class-based retention periods.
   */
  retention_expires_at: string | null;
}
```

## Hash Chain Construction

The `previous_hash` and `integrity_hash` fields form a tamper-evident chain per `(tenant_id, control_id)` pair.

**Canonical fields for `integrity_hash`** (concatenated with `|` separator, UTF-8 encoded):
```
{id}|{tenant_id}|{control_id}|{framework}|{event_type}|{collected_at}|{collected_by}|{previous_hash}
```

**Genesis record**: The first record in a chain sets `previous_hash` to:
```
SHA-256("genesis:valueos.internal")
```

**Verification**: Run `scripts/compliance/verify-evidence-chain.mjs` to validate chain integrity for a time-bounded set of records.

## Trusted Timestamp Strategy

Two tiers based on legal defensibility requirements:

| Tier | When to use | Implementation |
|---|---|---|
| **Full RFC 3161** | Records with `legal_hold: true`; incident forensic bundles; quarterly audit anchors | Request a timestamp token from a public TSA (Sectigo, DigiCert, or equivalent). Store the base64-encoded DER token in `trusted_timestamp`. |
| **Periodic anchor** | High-volume routine evidence (continuous monitoring, automated control checks) | Use server-side `NOW()` for `collected_at`. Every 24 hours, write one anchor record with a real RFC 3161 token covering the batch. The anchor's `payload` includes the hash of the last record in the batch. |

## Append-Only Enforcement

The `compliance_control_evidence` table enforces append-only semantics via:

1. **RLS policy**: `UPDATE` and `DELETE` are denied for all roles except `service_role` with explicit justification.
2. **Application layer**: `ComplianceJanitorAgent` and evidence ingestion endpoints use `INSERT` only.
3. **Legal hold**: Records with `legal_hold: true` are excluded from all retention cleanup jobs.

## Event Type Registry

Registered `event_type` values. New types must be added here before use.

| Event Type | Framework | Description |
|---|---|---|
| `rls:tenant-isolation-test-passed` | SOC2, ISO27001 | RLS test suite passed for a tenant |
| `rls:tenant-isolation-test-failed` | SOC2, ISO27001 | RLS test suite failed — P0 alert |
| `audit:immutability-check-passed` | SOC2, ISO27001 | Audit log immutability test passed |
| `audit:immutability-check-failed` | SOC2, ISO27001 | Audit log immutability test failed |
| `mfa:enforcement-verified` | SOC2 | Production MFA enforcement confirmed |
| `secret:rotation-completed` | SOC2, ISO27001 | Secret rotation job completed successfully |
| `secret:rotation-failed` | SOC2, ISO27001 | Secret rotation job failed |
| `policy:drift-detected` | SOC2, ISO27001 | Istio policy drift detected vs declared state |
| `policy:drift-resolved` | SOC2, ISO27001 | Policy drift resolved |
| `identity:spiffe-registration-verified` | SOC2, ISO27001 | All agent SPIFFE registrations verified |
| `dsr:erasure-completed` | GDPR | Data subject erasure request completed |
| `dsr:access-export-completed` | GDPR | Data subject access request export completed |
| `incident:forensic-bundle-created` | SOC2, ISO27001 | Incident forensic bundle generated |
| `control:check-passed` | SOC2 | Automated control check passed |
| `control:check-failed` | SOC2 | Automated control check failed |
| `key:rotation-completed` | SOC2, ISO27001 | Encryption key rotation completed |
| `chaos:scenario-passed` | SOC2 | Chaos scenario passed (tenant isolation, billing, scale) |
| `chaos:scenario-failed` | SOC2 | Chaos scenario failed |

## Related Files

| File | Purpose |
|---|---|
| `docs/security-compliance/evidence-retention-policy.md` | Retention periods by evidence class |
| `docs/security-compliance/control-registry.json` | Control IDs referenced in evidence records |
| `scripts/compliance/verify-evidence-chain.mjs` | Hash chain validation script |
| `packages/backend/src/services/security/ComplianceEvidenceService.ts` | Evidence write service |
| `infra/supabase/supabase/migrations/` | `compliance_control_evidence` table schema |

# Logging retention and rotation

## Versioned retention policy source of truth
- Retention windows are defined in `infra/retention/security-audit-retention-policy.v1.json` and consumed by `/api/admin/compliance/retention`.
- Policy includes per-data-class controls for:
  - Security audit events
  - Security alert evidence
  - Compliance control evidence
- Each class has framework-specific operational windows (SOC2/GDPR/HIPAA/ISO27001/NIST/PCI-DSS), long-term archive years, legal-hold requirement, and WORM lock mode.

## Database rotation + staged archive
- Migration `infra/supabase/supabase/migrations/20260804000000_security_audit_worm_archive.sql` introduces:
  - `security_audit_archive_batch` (batch metadata)
  - `security_audit_archive_segment` (immutable payload + hash chain)
  - `security_audit_archive_alert` (integrity alerts)
  - `rotate_security_audit_logs(retention_policy, max_rows)`
  - `verify_security_audit_archive_integrity(lookback_days)`
- Rotation copies old rows from `security_audit_log` into archive segments and deletes only beyond the operational window so primary DB remains queryable for active operations.

## Cloud object-storage archival (WORM)
- `infra/scripts/export-security-audit-archive.sh` performs:
  1. DB rotation call
  2. NDJSON segment export
  3. SHA-256 manifest generation per batch
  4. Upload to object storage with object-lock mode `COMPLIANCE`
  5. Legal-hold set on `manifest.json`
  6. Batch metadata update + integrity verification
- Immutable bucket controls are captured in `infra/security/audit-archive-bucket-policy.json` (deny delete/overwrite, enforce object lock, block governance bypass).

## Kubernetes jobs
- `infra/k8s/security-audit-retention-cronjob.yaml`
  - `security-audit-retention` daily archival/export run.
  - `security-audit-archive-integrity` six-hour integrity verification run.
- Job environments expose framework windows for SOC2/GDPR/HIPAA and reference policy version `security-audit-retention-v1`.

## Alerting
- `infra/prometheus/alerts/security-audit-archive-alerts.yml` raises critical alerts for:
  - Retention pipeline failures
  - Integrity verification failures (hash-chain or manifest gaps)

## Auditor restore and discovery workflow
1. **Find batch metadata:** query `security_audit_archive_batch` by time range/policy.
2. **Locate immutable objects:** use `object_store_uri` path (`segments.ndjson`, `manifest.json`).
3. **Verify integrity before restore:**
   - Compare manifest checksum with DB `export_checksum_sha256`.
   - Run `SELECT public.verify_security_audit_archive_integrity(45);`.
4. **Retrieve scoped evidence:** pull only required segments and filter by tenant/event window in SQL or downstream tooling.
5. **Prepare evidence package:** include `manifest.json`, checksum outputs, and query transcript for auditor traceability.
6. **Legal hold handling:** if a case is under hold, preserve objects and reference hold records in the audit workbook before any lifecycle updates.

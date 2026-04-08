# Supabase Rotation Status Verification Evidence (2026-04-08)

- **Verification timestamp (UTC):** 2026-04-08T17:05:09Z
- **Verified by:** Security automation agent (owner handoff: Security On-Call)
- **Projects:** `wfhdrrpijqygytvoaafc`, `bxaiabnqalurloblfwua`

## Commands executed

1. `rg -n "wfhdrrpijqygytvoaafc|bxaiabnqalurloblfwua|Status|Rotation completed evidence link|Closure date" docs/security-compliance/secret-rotation-log.md`
   - Confirms both project refs still appear in open incidents, with pending rotation evidence/closure fields.
2. `python - <<'PY' ...` (environment presence check)
   - `SUPABASE_ACCESS_TOKEN=unset`
   - `SUPABASE_URL=unset`
   - `SUPABASE_ANON_KEY=unset`
   - `SUPABASE_SERVICE_ROLE_KEY=unset`
3. `node scripts/ci/check-secret-rotation-action-required-sla.mjs`
   - Current log contains one unresolved `ACTION REQUIRED` entry and it is future-dated in the heading, so SLA age enforcement is skipped by design.

## Verification outcome

- **Rotation state:** Not verified as completed for either project.
- **Revocation state (old keys no longer accepted):** Not yet verifiable from this runtime due missing Supabase operator/API credentials and missing known-compromised key material for active revocation tests.
- **Current disposition:** Remains open and requires human operator execution in Supabase dashboard/API, followed by attached proof (ticket + console/audit-log evidence).

## Required follow-up to close

1. Rotate keys in Supabase dashboard:
   - `wfhdrrpijqygytvoaafc`: `anon` + `service_role`
   - `bxaiabnqalurloblfwua`: `anon`
2. Update CI/runtime secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
3. Attach dashboard/API evidence and access-log review results to `SEC-2026-1184`.
4. Re-run revocation verification using old keys against project endpoints and record explicit `401/403` evidence.

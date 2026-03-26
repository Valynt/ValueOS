# Frontend API Key Governance (Vite `VITE_*`)

This document defines the browser API-key inventory, provider restrictions, rotation workflow, and abuse-response playbook for frontend apps.

## 1) Inventory of `VITE_*_API_KEY` usages in frontend apps

| App | File | Env key | Classification | Rationale |
|---|---|---|---|---|
| `agentic-ui-pro` | `apps/agentic-ui-pro/client/src/components/Map.tsx` | `VITE_FRONTEND_FORGE_API_KEY` | `public-key-safe` | Used by browser to call a managed maps proxy; value is intentionally public but must be heavily restricted server-side. |

### Explicitly blocked as misuse

Any browser env var matching sensitive providers/secrets (for example `VITE_TOGETHER_API_KEY`, `VITE_OPENAI_API_KEY`, `VITE_ANTHROPIC_API_KEY`, `VITE_SUPABASE_SERVICE_ROLE_KEY`, `VITE_*SECRET*`) is treated as **secret misuse** and fails CI/build validation.

## 2) Required provider restrictions for browser-safe keys

Browser-safe keys in `config/security/browser-key-policy.json` must include all of the following:

1. **Exact allowed origins**
   - Fully-qualified `https://` origins only (no wildcards, no suffix patterns).
2. **Endpoint restrictions**
   - Explicit endpoint allowlist; key cannot be accepted for non-listed paths.
3. **Quotas**
   - Per-minute and per-day hard limits.
4. **Anomaly alerts**
   - Burst traffic detection.
   - Origin mismatch detection.
   - Geo-anomalous traffic detection.

The policy is validated by `scripts/security/validate-browser-api-key-governance.mjs` during frontend builds and CI gates.

## 3) Build/startup validation controls

We enforce guardrails at build/startup time:

- Frontend build commands call `scripts/security/validate-browser-api-key-governance.mjs` before Vite builds.
- Validation fails when:
  - A `VITE_*_API_KEY` usage has no policy entry.
  - A key is classified as `secret-misuse`.
  - Required restrictions (origins/endpoints/quotas/alerts) are missing.
  - Sensitive keys are incorrectly prefixed with `VITE_`.

## 4) Key rotation playbook

### Rotation triggers

- Scheduled rotation every 30 days (or stricter provider policy).
- Immediate rotation after suspected leak, abuse alert, or origin bypass event.

### Procedure

1. Create a new provider/browser key with identical restrictions.
2. Validate policy entry in `config/security/browser-key-policy.json`.
3. Update environment secret in deployment platform.
4. Deploy to staging, validate map/provider call success and quota telemetry.
5. Deploy to production.
6. Revoke previous key after post-deploy smoke checks pass.
7. Record evidence (who rotated, when, ticket/incident reference).

## 5) Abuse response playbook

### Detection channels

- Provider quota alerts.
- Origin mismatch alerts.
- SIEM anomaly alerts.

### Response steps (P0/P1)

1. **Contain**
   - Temporarily restrict or disable key at provider.
   - Block offending origin(s) and IP ranges if available.
2. **Rotate**
   - Execute key rotation procedure immediately.
3. **Investigate**
   - Determine exposure path (bundle, logs, third-party script, source control).
   - Confirm whether calls respected origin/endpoint constraints.
4. **Recover**
   - Restore service with newly restricted key.
   - Tighten quotas and anomaly thresholds if needed.
5. **Post-incident hardening**
   - Add missing restrictions/tests.
   - Attach incident evidence to security review artifacts.

## 6) CI secret scanning for client bundles

`pnpm check:frontend-bundle-service-role` now builds ValyntApp and fails if generated client artifacts contain known private key/token patterns (OpenAI, Anthropic, Google server keys, AWS access keys, Stripe secret keys, or generic private env-key identifiers).

---
title: Secret Rotation Policy
owner: security@valueos
review_date: 2027-05-24
status: active
---

# Secret Rotation Policy

Defines the authority split, rotation frequencies, propagation paths, and evidence requirements for all secrets managed by ValueOS.

---

## Authority split

ValueOS uses a two-layer secrets architecture:

| Layer | System | Role | Scope |
|---|---|---|---|
| **Source of truth + rotation authority** | AWS KMS + AWS Secrets Manager | Owns production secrets; executes automated rotation via Lambda rotation functions | Infrastructure secrets, service credentials, database passwords, signing keys |
| **Distribution + access control** | Infisical | Distributes secrets to workloads; manages developer and app-layer secrets; enforces access policies | App config, environment variable injection, local/dev/staging secrets |

**Key design rule:** AWS Secrets Manager is the rotation authority. Infisical distributes but does not own rotation for production-critical secrets. When a secret is rotated in AWS, the updated value must propagate to Infisical (or be injected directly via ExternalSecret) before the old value is invalidated.

---

## Secret classes and rotation policy

| Class | Examples | Owner | Rotation frequency | Rotation method | Propagation path |
|---|---|---|---|---|---|
| **Database credentials** | Supabase service role key, RDS password | AWS Secrets Manager | 30 days | AWS Secrets Manager rotation Lambda | ExternalSecret → k8s Secret → pod env |
| **External API keys** | Stripe secret key, OpenAI API key, Together AI key | AWS Secrets Manager | 90 days | Manual rotation + AWS Secrets Manager update | ExternalSecret → k8s Secret → pod env |
| **JWT signing keys** | `TCT_SECRET`, Supabase JWT secret | AWS Secrets Manager | 180 days or on compromise | Manual rotation with zero-downtime key rollover | ExternalSecret → k8s Secret → pod env |
| **OAuth client secrets** | HubSpot, Salesforce OAuth secrets | AWS Secrets Manager | 90 days or on provider rotation | Manual rotation | ExternalSecret → k8s Secret → pod env |
| **Encryption keys** | `WEB_SCRAPER_ENCRYPTION_KEY` | AWS Secrets Manager | 180 days or on compromise | Manual rotation with data re-encryption | ExternalSecret → k8s Secret → pod env |
| **CI/CD secrets** | GitHub Actions secrets (SUPABASE_SERVICE_ROLE_KEY, etc.) | GitHub Secrets (sourced from AWS) | On AWS rotation | Automated sync from AWS via `secrets-sync.yml` workflow | GitHub Actions secret store |
| **Developer / staging secrets** | Local `.env` values, staging Infisical secrets | Infisical | 90 days or on team member offboarding | Infisical scheduled rotation or manual | Infisical → developer workstation / staging env |
| **Canary tokens** | Red-team detection tokens | Security team | On trigger (detection event) | Manual replacement | `scripts/red-team-canary-tokens.ts` |

---

## Propagation path detail

```
AWS Secrets Manager (rotation authority)
    │
    ├── ExternalSecret (infra/k8s/base/external-secrets.yaml)
    │       │
    │       └── k8s Secret (mounted as pod env vars)
    │               │
    │               └── Running service (reads from env at startup)
    │
    └── GitHub Actions secret sync (secrets-sync.yml)
            │
            └── CI/CD pipelines
```

For Infisical-owned secrets (dev/staging):
```
Infisical (distribution layer)
    │
    ├── CLI injection (pnpm exec infisical run -- ...)
    │       └── Local developer environment
    │
    └── Infisical Kubernetes operator
            └── k8s Secret → pod env (staging only)
```

---

## Automated rotation

### AWS Secrets Manager (production)

Rotation is automated via AWS Lambda rotation functions for secrets that support it:

- **Database credentials:** Use the Secrets Manager native RDS rotation Lambda. Rotation updates the secret value and triggers a rolling restart of affected deployments via the ExternalSecret controller.
- **API keys that support programmatic rotation:** Use a custom Lambda that calls the provider's key rotation API, updates the secret, and emits a rotation event to the audit log.

For secrets that cannot be rotated programmatically (e.g., third-party API keys with no rotation API), rotation is manual but scheduled. The `secret-rotation-verification.yml` workflow checks that no secret has exceeded its rotation window.

### Infisical (dev/staging)

Infisical's built-in secret rotation scheduler is used for developer and staging secrets. Rotation events are logged in Infisical's audit trail.

---

## Manual rotation runbook

When a secret must be rotated manually:

1. **Generate new value** — use the appropriate method (e.g., `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` for 32-byte keys).
2. **Update AWS Secrets Manager** — update the secret value in the AWS console or via CLI: `aws secretsmanager put-secret-value --secret-id <name> --secret-string <value>`.
3. **Trigger ExternalSecret refresh** — annotate the ExternalSecret to force a sync: `kubectl annotate externalsecret <name> force-sync=$(date +%s) --overwrite`.
4. **Verify propagation** — confirm the new value is live in the running pod: `kubectl exec <pod> -- env | grep <SECRET_NAME>`.
5. **Update CI secrets** — update the corresponding GitHub Actions secret if applicable.
6. **Invalidate old value** — revoke the old credential at the source (e.g., Supabase dashboard → Regenerate keys).
7. **Log the rotation** — add an entry to `docs/security-compliance/secret-rotation-log.md` with the rotation date, secret class, and evidence link.

For JWT signing key rotation (zero-downtime):
1. Add the new key alongside the old key (dual-key acceptance window).
2. Deploy the new key as the signing key.
3. Wait for all existing tokens to expire (or force re-authentication).
4. Remove the old key from the acceptance list.

---

## Rotation verification

The `secret-rotation-verification.yml` GitHub Actions workflow runs on a weekly schedule and:

1. Queries AWS Secrets Manager for the `LastRotatedDate` of each tracked secret.
2. Compares against the rotation window defined in this policy.
3. Emits a CI failure if any secret is overdue.
4. Writes a verification event to `docs/security-compliance/secret-rotation-log.md` on success.

Tracked secrets are listed in `scripts/ci/secret-rotation-manifest.json`.

---

## On-compromise rotation

If a secret is suspected or confirmed compromised:

1. **Rotate immediately** — do not wait for the scheduled window.
2. **Audit access logs** — check AWS CloudTrail and Supabase access logs for unauthorized use since the last rotation.
3. **Revoke all active sessions** — force re-authentication for all users if an auth secret is compromised.
4. **Log the incident** — add a Critical entry to `docs/security-compliance/secret-rotation-log.md`.
5. **Notify security team** — follow the incident response process in `docs/security-compliance/bug-bounty-cvd-program.md`.

---

## Evidence requirements

For each rotation event, the following must be recorded in `docs/security-compliance/secret-rotation-log.md`:

- Date of rotation
- Secret class and identifier (not the value)
- Rotation method (automated / manual)
- Evidence link (AWS CloudTrail event, Infisical audit log, or rotation ticket)
- Operator who performed the rotation (for manual rotations)

---

## References

- `docs/security-compliance/secret-rotation-log.md` — rotation event log
- `docs/security-compliance/infisical-secrets-management.md` — Infisical integration details
- `infra/k8s/base/external-secrets.yaml` — ExternalSecret definitions
- `.github/workflows/secret-rotation-verification.yml` — automated rotation verification
- `scripts/ci/secret-rotation-manifest.json` — list of tracked secrets and their rotation windows

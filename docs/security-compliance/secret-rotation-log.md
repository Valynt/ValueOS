# Secret Rotation Log

Tracks every confirmed or suspected secret exposure, its classification, and the rotation/remediation action taken. Maintained by the security team. New entries go at the top.

---

## Format

```
### [DATE] [RULE-ID] — [SHORT DESCRIPTION]
- **Structured metadata:**
  - **Owner:** <team-email or team slug>
  - **rotated_at (UTC):** <YYYY-MM-DDTHH:MM:SSZ | PENDING>
  - **Secret class:** <provider + key class>
  - **Ticket:** <incident/change/security ticket id>
  - **Hash/Fingerprint reference:** <secret fingerprint, key-id, commit-sha, or artifact path>
- **Status:** Rotated | False positive | Pending
- **Severity:** Critical | High | Medium | Low
- **Exposure:** Working tree | Git history | Both
- **Files/commits:** <file or commit SHA>
- **Classification:** <why it is or isn't a real secret>
- **Action taken:** <rotation, history purge, allowlist entry, or none required>
- **Evidence:** <link to rotation ticket, Infisical audit log, or PR>
```

---

## Entries

### 2026-04-08 supabase-service-role-jwt — Rotation status verification for exposed Supabase projects

- **Status:** ⚠️ ACTION REQUIRED — rotation/revocation still unverified; operator execution required
- **Severity:** Critical
- **Exposure:** Git history (public repository)
- **Projects in scope:**
  - `wfhdrrpijqygytvoaafc` (`anon` + `service_role`)
  - `bxaiabnqalurloblfwua` (`anon`)
- **Rotation verification timestamp (UTC):** 2026-04-08T17:05:09Z
- **Owner:** Security On-Call (automated verification run + human operator handoff)
- **Verification evidence:** `docs/security-compliance/evidence/secret-rotation/2026-04-08-supabase-rotation-status-verification.md`
- **Evidence ticket:** `SEC-2026-1184` (tracking), `PLAT-2026-447` (propagation)
- **Operator log:** `docs/security-compliance/evidence/secret-rotation/2026-04-08-supabase-rotation-status-verification.md` and workflow artifacts from `.github/workflows/secret-rotation-verification.yml`
- **Evidence timestamp (UTC):** 2026-04-08T17:05:09Z
- **Revocation verification (old keys rejected):** ⚠️ BLOCKED in this runtime — Supabase operator/API credentials and known-compromised key values are unavailable, so active negative-auth checks could not be executed yet.
- **Action required to close:** Rotate affected project keys in Supabase dashboard/API, propagate replacements to all environments, verify old keys return auth failures, and attach ticketed audit evidence.

---

### 2026-04-02 supabase-service-role-jwt — Remediation execution attempt (source incidents: 2026-05-24 + 2026-03-26)

- **Structured metadata:**
  - **Owner:** team-security@valueos
  - **rotated_at (UTC):** PENDING
  - **Secret class:** Supabase JWT (`service_role`, `anon`)
  - **Ticket:** SEC-2026-1184 / PLAT-2026-447
  - **Hash/Fingerprint reference:** Projects `wfhdrrpijqygytvoaafc`, `bxaiabnqalurloblfwua`; commits `aca8a162`, `76f85346`, `6d4d6f15`
- **Status:** ⚠️ BLOCKED — operator-only rotation + Supabase audit-log access required
- **Severity:** Critical
- **Exposure:** Git history (per 2026-05-24 and 2026-03-26 incident records)
- **Incident references (source of truth):**
  - `2026-05-24 supabase-service-role-jwt — Production key rotation required (production-readiness spec)`
  - `2026-03-26 supabase-service-role-jwt — ⚠️ REAL Supabase project keys in git history — ROTATION REQUIRED`
- **Projects in scope:**
  - `wfhdrrpijqygytvoaafc` (rotate `anon` + `service_role`)
  - `bxaiabnqalurloblfwua` (rotate `anon`)
- **Execution notes (this run):**
  1. Rotation in Supabase dashboard could not be executed from this runtime because operator credentials/session are unavailable (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_URL` all unset).
  2. CI/Kubernetes/runtime/local-runbook secret updates are pending on issuance of replacement keys.
  3. Supabase access-log audit (first-exposure commit date → rotation completion) is blocked pending Supabase org/project audit-log access. No suspicious-access determination can be made yet.
  4. Git history purge (`git filter-repo` + force-push + collaborator re-clone notice) is blocked pending Security approval and coordinated maintenance window.
  5. Secret-scan reruns completed; evidence linked below.
- **Scan evidence (2026-04-02 UTC):**
  - Full history scan (local): `artifacts/secret-scan/gitleaks-history-2026-04-02.json` (1 finding, `generic-api-key`, test fixture)
  - Working tree scan (local): `artifacts/secret-scan/gitleaks-workingtree-2026-04-02.json` (1 finding, same test fixture)
  - Related workflow: `.github/workflows/secret-scan.yml`
- **Rotation completed evidence link:** _PENDING — add Security ticket/console evidence URL after dashboard rotation_.
- **Evidence ticket:** `SEC-2026-1184` (tracking), `PLAT-2026-447` (propagation)
- **Operator log:** `docs/security-compliance/evidence/secret-rotation/2026-04-02-supabase-rotation-followup.md` and workflow artifacts from `.github/workflows/secret-rotation-verification.yml`
- **Evidence timestamp (UTC):** 2026-04-02T11:40:00Z
- **Closure date:** _PENDING — set to actual UTC completion date after rotation + history purge + access-log audit are complete_.

---

### 2026-05-24 supabase-service-role-jwt — Production key rotation required (production-readiness spec)

- **Structured metadata:**
  - **Owner:** team-security@valueos
  - **rotated_at (UTC):** PENDING
  - **Secret class:** Supabase JWT (`service_role`, `anon`)
  - **Ticket:** SEC-2026-1184 / PLAT-2026-447
  - **Hash/Fingerprint reference:** Projects `wfhdrrpijqygytvoaafc`, `bxaiabnqalurloblfwua`; commits `aca8a162`, `76f85346`, `6d4d6f15`
- **Status:** ⚠️ ACTION REQUIRED — rotate keys immediately via Supabase dashboard
- **Severity:** Critical
- **Exposure:** Git history (public repository — treat as fully compromised)
- **Projects:**
  - `wfhdrrpijqygytvoaafc` — `anon` + `service_role` keys in commits `aca8a162`, `76f85346`
  - `bxaiabnqalurloblfwua` — `anon` key in commit `6d4d6f15`
- **Classification:** Real Supabase project JWTs confirmed in prior triage (2026-03-26 entry below). The `service_role` key for `wfhdrrpijqygytvoaafc` bypasses all RLS policies.
- **Required actions:**
  1. Rotate both API keys for `wfhdrrpijqygytvoaafc` via Supabase dashboard → Project Settings → API → Regenerate keys.
  2. Rotate `anon` key for `bxaiabnqalurloblfwua` via the same path.
  3. Update all environments (CI secrets, staging, production) with new keys.
  4. Audit Supabase access logs for both projects for unauthorized access since first commit date.
  5. Run `git filter-repo` to purge non-demo keys from history, then force-push and notify all collaborators to re-clone.
  6. After purge, update `.gitleaks.toml` allowlist entries for any residual commit SHAs.
  7. Link rotation ticket below once complete.
- **Evidence:** See `docs/security-compliance/evidence/secret-rotation/2026-04-02-supabase-rotation-followup.md`.
- **Evidence ticket:** `SEC-2026-1184` (tracking), `PLAT-2026-447` (propagation)
- **Operator log:** `docs/security-compliance/evidence/secret-rotation/2026-04-02-supabase-rotation-followup.md` and workflow artifacts from `.github/workflows/secret-rotation-verification.yml`
- **Evidence timestamp (UTC):** 2026-04-02T11:40:00Z
- **Execution log (2026-03-27 UTC):**
  - Attempted in-repo rotation follow-through from this environment, but no Supabase operator credentials/session are available in the runtime (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_URL` all unset).
  - Local evidence command: `python - <<'PY' ...` (env presence check only; no secret values printed).
  - Result: **blocked pending Security/Platform operator dashboard access**. Status remains action-required until dashboard/API rotation evidence is attached.
- **Rotation policy reference:** `docs/security-compliance/secret-rotation-policy.md` (AWS KMS / Infisical split)

---

### 2026-03-26 — Deep-history scan baseline (gitleaks v8.21.2)

Full-history scan run as part of security hardening (see PR adding `secret-scan.yml`).
414 raw findings across 5,334 commits. Triaged below.

Local verification rerun on **2026-03-27** (working tree) using:

```bash
/tmp/gitleaks detect --config=.gitleaks.toml --source . --redact \
  --report-format json --report-path artifacts/secret-scan/gitleaks-workingtree.json --exit-code 1
```

Result: 3 findings, triaged as non-production credentials/test fixtures/placeholders; no newly discovered real production credential beyond the known pending Supabase rotations. Evidence artifact: `artifacts/secret-scan/gitleaks-workingtree.json`.

---

### 2026-03-26 supabase-service-role-jwt — ⚠️ REAL Supabase project keys in git history — ROTATION REQUIRED

- **Structured metadata:**
  - **Owner:** team-security@valueos
  - **rotated_at (UTC):** PENDING
  - **Secret class:** Supabase JWT (`service_role`, `anon`)
  - **Ticket:** SEC-2026-1184 / PLAT-2026-447
  - **Hash/Fingerprint reference:** Projects `wfhdrrpijqygytvoaafc`, `bxaiabnqalurloblfwua`; commits `aca8a162`, `76f85346`, `6d4d6f15`
- **Status:** ⚠️ PENDING ROTATION — keys must be rotated immediately
- **Severity:** Critical
- **Exposure:** Git history (public repository — treat as fully compromised)
- **Projects exposed:**
  - `wfhdrrpijqygytvoaafc` — both `anon` and `service_role` keys committed (commits include `aca8a162`, `76f85346`)
  - `bxaiabnqalurloblfwua` — `anon` key committed (commit `6d4d6f15`)
- **Files:** `.devcontainer/devcontainer.json`, `.env` (historical), `.env.dev`, `.env.local.bak`
- **Classification:** Real Supabase project JWTs. JWT payloads decode to `"iss":"supabase"` with real project `ref` values. The `service_role` key for project `wfhdrrpijqygytvoaafc` bypasses all RLS policies.
- **Action required:**
  1. **Immediately** rotate both API keys for projects `wfhdrrpijqygytvoaafc` and `bxaiabnqalurloblfwua` via the Supabase dashboard → Project Settings → API → Regenerate keys.
  2. Update all environments (staging, production, CI secrets) with the new keys.
  3. Audit Supabase access logs for both projects for unauthorized access since the first commit date.
  4. Run `git filter-repo --path .env --invert-paths` (and equivalent for other files) to purge from history, then force-push and notify all collaborators to re-clone.
  5. After purge, add a `[allowlist]` commit entry in `.gitleaks.toml` for the specific commit SHAs if any residual hits remain.
- **Evidence:** See `docs/security-compliance/evidence/secret-rotation/2026-04-02-supabase-rotation-followup.md`.
- **Evidence ticket:** `SEC-2026-1184` (tracking), `PLAT-2026-447` (propagation)
- **Operator log:** `docs/security-compliance/evidence/secret-rotation/2026-04-02-supabase-rotation-followup.md` and workflow artifacts from `.github/workflows/secret-rotation-verification.yml`
- **Evidence timestamp (UTC):** 2026-04-02T11:40:00Z

---

### 2026-03-26 supabase-service-role-jwt — Supabase demo keys in devcontainer history

- **Status:** False positive (no rotation required)
- **Severity:** Low
- **Exposure:** Git history only (commits `969bb015`, `aca8a162`, `42249a0e`, `8c1cfd2a`, `1374fcca`, `b38bd12d`, `a259e2f7`, `f305fb9d`, `b4180379`)
- **Files:** `.devcontainer/docker-compose.devcontainer.yml`, `.devcontainer/docker-compose.yml`, `.devcontainer/devcontainer.json`, `compose.yml`, `archive/`, `_valueos-dev-setup/`
- **Classification:** All JWT values match the well-known Supabase local-dev demo keys (`eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24i` / `service_role` variant). These are public, non-secret keys published by Supabase for local development. They grant access only to a local Supabase instance with no real data.
- **Action taken:** Added both demo-key prefixes to the `supabase-service-role-jwt` rule allowlist in `.gitleaks.toml`. No rotation required.
- **Evidence:** Supabase docs — https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys

---

### 2026-03-26 supabase-service-role-jwt — JWT in `.env.test`, `tests/setup.ts`, `test/setup.ts`

- **Status:** False positive (no rotation required)
- **Severity:** Low
- **Exposure:** Git history (commits `d59f7ac6`, `67268e50`, `310519391`, `d4616031`, `086c3703`, `a376e08b`, `8d322bc9`, `8929d35f`)
- **Files:** `.env.test`, `tests/setup.ts`, `test/setup.ts`, `tests/test/setup.ts`
- **Classification:** Test setup files use the well-known Supabase demo anon key as a fallback when `VITE_SUPABASE_ANON_KEY` is not set. This is the same public demo key as above.
- **Action taken:** Files added to global path allowlist. No rotation required.

---

### 2026-03-26 stripe-access-token — `sk_live_abc123def456` in SettingsPage.tsx

- **Status:** False positive (no rotation required)
- **Severity:** Low
- **Exposure:** Working tree + git history (commit `57a0512b`)
- **Files:** `apps/ValyntApp/src/views/SettingsPage.tsx:132`
- **Classification:** This is a UI display placeholder rendered as `${k.prefix}sk_live_abc123def456` in a masked API key display component. It is not a real Stripe key — it is a hardcoded example string shown when the user toggles key visibility. The `sk_live_` prefix is 8 chars shorter than any real Stripe key.
- **Action taken:** File added to path allowlist. Consider replacing with a clearly fake string like `sk_live_EXAMPLE_PLACEHOLDER` to reduce future false-positive noise.

---

### 2026-03-26 stripe-access-token — `sk_live_abcdef123456` in MemorySystem.test.ts

- **Status:** False positive (no rotation required)
- **Severity:** Low
- **Exposure:** Working tree + git history (commit `4d7c0f46`)
- **Files:** `packages/backend/src/lib/agent-fabric/__tests__/MemorySystem.test.ts:645,652`
- **Classification:** Test input used to assert that the MemorySystem redacts `sk_live_` patterns from stored content. The test explicitly asserts `expect(stored.content).not.toContain("sk_live_abcdef123456")`.
- **Action taken:** File added to path allowlist. No rotation required.

---

### 2026-03-26 aws-access-token — `AKIACANARYTEST123456` in red-team-canary-tokens.ts

- **Status:** False positive (no rotation required)
- **Severity:** Low
- **Exposure:** Working tree + git history
- **Files:** `scripts/red-team-canary-tokens.ts:16`
- **Classification:** Intentional canary token. The file is a red-team test harness that verifies the secret detection and redaction pipeline catches known-bad patterns. `AKIACANARYTEST123456` is not a valid AWS access key (fails AWS key format validation).
- **Action taken:** File added to path allowlist with a rotation notice comment. No rotation required.

---

### 2026-03-26 hashicorp-tf-password — Terraform dev RDS password

- **Status:** False positive (no rotation required)
- **Severity:** Medium
- **Exposure:** Git history (commits `67268e50`, `3594d35957`, `a3793ad8`, `b41803792`)
- **Files:** `infra/environments/dev/terraform/main.tf:267`, `infrastructure/environments/dev/terraform/main.tf:267`
- **Classification:** Dev-environment Terraform RDS instance. The password is a placeholder for a non-production, non-internet-accessible dev database. Production credentials are managed via AWS Secrets Manager and injected via ExternalSecret (see `infra/k8s/base/external-secrets.yaml`).
- **Action taken:** Files added to path allowlist. **Recommended follow-up:** Replace the hardcoded dev password with a `random_password` Terraform resource and store it in AWS Secrets Manager even for dev, to eliminate the pattern entirely.

---

### 2026-03-26 github-pat / slack-bot-token — PrivacyScrubber.test.ts

- **Status:** False positive (no rotation required)
- **Severity:** Low
- **Exposure:** Working tree + git history (commit `0c32e48d`)
- **Files:** `packages/backend/src/services/middleware/__tests__/PrivacyScrubber.test.ts:31,69`
- **Classification:** Test inputs to the `PrivacyScrubber.scrubText()` function. The GitHub PAT (`ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ...`) and Slack bot token (`xoxb-123456789012-...`) are synthetic strings used to assert that the scrubber replaces them with `[API_KEY]`. Neither has ever been a real credential.
- **Action taken:** File added to path allowlist. No rotation required.

---

### 2026-03-26 kubernetes-secret-yaml — secrets-sync.yml

- **Status:** False positive (no rotation required)
- **Severity:** Low
- **Exposure:** Git history (commit `0d52806d`)
- **Files:** `.github/workflows/secrets-sync.yml:188`
- **Classification:** A Kubernetes Secret manifest template inside a GitHub Actions workflow. The manifest contains no real secret values — it is a template that references GitHub Actions secrets via `${{ secrets.* }}` expressions.
- **Action taken:** File added to path allowlist. No rotation required.

---

## Pending items requiring follow-up

| Item | Owner | Due |
|------|-------|-----|
| Replace `sk_live_abc123def456` placeholder in SettingsPage.tsx with `sk_live_EXAMPLE_PLACEHOLDER` | Frontend team | Next sprint |
| Replace hardcoded dev Terraform RDS password with `random_password` resource | Platform team | Next sprint |
| Run `git filter-repo` to purge any non-demo Supabase JWTs from history (if any are found on closer inspection) | Security team | Before next external audit |
| Confirm all Supabase project keys in `.env.dev` (commit `6d4d6f15`) were local-dev demo keys | Security team | This sprint |

---

## How to add a new entry

1. Run `gitleaks detect --config=.gitleaks.toml` locally.
2. For each finding, determine: real credential, test fixture, or documentation example.
3. If real: rotate immediately, then add an entry here with rotation evidence.
4. If false positive: add to `.gitleaks.toml` allowlist with a justification comment, then add an entry here.
5. Open a PR with both the allowlist update and the log entry.

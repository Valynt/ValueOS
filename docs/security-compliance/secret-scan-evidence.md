# Secret Scan Evidence

**Scan date:** 2026-03-26  
**Tool:** gitleaks v8.21.2  
**Config:** `.gitleaks.toml` (extends gitleaks default ruleset)  
**Scope:** Full git history — all commits, all branches, all tags (5,409 commits)  
**Status:** ⚠️ TRUE POSITIVES FOUND — rotation required before production promotion

---

## Summary

| Category | Count |
|----------|-------|
| Total raw findings | 226 |
| True positives (active/rotatable credentials) | 5 |
| Revoked/expired or already-removed | 3 |
| False positives (demo keys, test fixtures, doc examples) | 218 |

---

## True Positives — Rotation Required

### TP-1: Supabase Project `wfhdrrpijqygytvoaafc` — Full Credential Set

**Severity:** CRITICAL  
**Committed in:** `.env ` (note: trailing space in filename) — commit `76f85346e121`  
**Date committed:** 2026-02-15  
**Credentials exposed:**
- `SUPABASE_URL`: `https://wfhdrrpijqygytvoaafc.supabase.co`
- `SUPABASE_ANON_KEY`: JWT with `ref: wfhdrrpijqygytvoaafc`, role `anon`
- `SUPABASE_SERVICE_ROLE_KEY`: JWT with `ref: wfhdrrpijqygytvoaafc`, role `service_role`
- `DATABASE_URL`: `postgresql://postgres:ZqD8dvJih0JXahU6@db.wfhdrrpijqygytvoaafc.supabase.co:5432/postgres`

**Also committed in:** `.devcontainer/devcontainer.json` — commit `aca8a1627b66` (same project, same keys)

**Required actions:**
- [ ] Rotate Supabase anon key for project `wfhdrrpijqygytvoaafc`
- [ ] Rotate Supabase service role key for project `wfhdrrpijqygytvoaafc`
- [ ] Rotate database password (`ZqD8dvJih0JXahU6`) via Supabase dashboard → Database → Reset password
- [ ] Audit Supabase access logs for unauthorized use since 2026-02-15
- [ ] Purge commits `76f85346e121` and `aca8a1627b66` from history with `git filter-repo`

---

### TP-2: Supabase Project `bxaiabnqalurloblfwua` — Anon + Service Role Keys

**Severity:** HIGH  
**Committed in:** `.env.test`, `.env.dev` — multiple commits (`d4616031aac7`, `6d4d6f157341`, `d205383fd1bc`, `310519391719`)  
**Date range:** 2025-12-31 to 2026-01-04  
**Credentials exposed:**
- `VITE_SUPABASE_URL`: `https://bxaiabnqalurloblfwua.supabase.co`
- `VITE_SUPABASE_ANON_KEY`: JWT with `ref: bxaiabnqalurloblfwua`, role `anon`
- `SUPABASE_SERVICE_KEY`: JWT with `ref: bxaiabnqalurloblfwua`, role `service_role`

**Required actions:**
- [ ] Rotate Supabase anon key for project `bxaiabnqalurloblfwua`
- [ ] Rotate Supabase service role key for project `bxaiabnqalurloblfwua`
- [ ] Audit Supabase access logs for unauthorized use since 2025-12-31
- [ ] Purge affected commits from history with `git filter-repo`

---

### TP-3: Together AI API Key

**Severity:** HIGH  
**Committed in:** `.env.dev` — commit `6d4d6f157341`  
**Date committed:** early 2026  
**Credential exposed:** `VITE_LLM_API_KEY=tgp_v1_jxFhlcyLLtjE0-FSSnzwIIHAv9DimgEhFoGsUV3OvkA`

**Required actions:**
- [ ] Revoke this Together AI API key immediately at [api.together.ai](https://api.together.ai)
- [ ] Issue a new key and store in secrets manager only
- [ ] Audit Together AI usage logs for unauthorized calls
- [ ] Purge commit `6d4d6f157341` from history

---

### TP-4: Supabase Access Token (Personal/Service)

**Severity:** CRITICAL  
**Committed in:** `.devcontainer/scripts/remove-secrets.sh` and `.devcontainer/SECURITY_INCIDENT_REPORT.md` — commit `b50778cffbac`  
**Credential exposed:** `sbp_4d0537d35652d74db73f08ea849883070e8e9a21`  
**Context:** This token was identified in a prior security incident report within the repo itself. The incident report states it was "verified as valid by TruffleHog" at time of discovery.

**Required actions:**
- [ ] Revoke token `sbp_4d0537d35652d74db73f08ea849883070e8e9a21` at Supabase dashboard → Account → Access Tokens
- [ ] Verify token is no longer active (attempt API call should return 401)
- [ ] Purge commit `b50778cffbac` from history
- [ ] Remove `.devcontainer/SECURITY_INCIDENT_REPORT.md` and `.devcontainer/scripts/remove-secrets.sh` from history (they contain the token value)

---

### TP-5: Fake AWS Access Key in Hook Test (False Positive — Confirmed Safe)

**Rule triggered:** `aws-access-token`  
**Committed in:** `.devcontainer/scripts/install-git-hooks.sh` — commit `32c6d99f9d7f`  
**Value:** `AKIA1234567890ABCDEF`  
**Classification:** FALSE POSITIVE — this is a synthetic test value used to verify the pre-commit hook detects secrets. It is not a real AWS credential.  
**Action:** Add to `.gitleaks.toml` allowlist with justification comment.

---

## False Positives — Confirmed Safe

All 218 remaining findings fall into one of these categories:

| Category | Examples | Count |
|----------|----------|-------|
| Well-known Supabase local-dev demo keys | `eyJpc3MiOiJzdXBhYmFzZS1kZW1vIi...` in `.env.test`, `supabase-factory.ts` | ~74 |
| Curl examples in documentation | `Authorization: Bearer <placeholder>` in `QUICKSTART.md`, `PRE_PRODUCTION_CHECKLIST.md` | ~96 |
| Test fixture JWTs | Synthetic JWTs in `InputSanitization.test.ts`, `webhook-security.test.ts` | ~24 |
| Well-known local compose defaults | `super-secret-jwt-token-with-at-least-32-characters-long` in `compose.yml` | ~24 |

These are already covered by `.gitleaks.toml` allowlist patterns for demo keys. The curl-auth-header findings in documentation files should be added to the allowlist path patterns.

---

## History Purge Plan

Once all credentials above are rotated, purge history using `git filter-repo`:

```bash
# Install git-filter-repo
pip install git-filter-repo

# Create a replacements file
cat > /tmp/secret-replacements.txt <<'EOF'
# TP-1: wfhdrrpijqygytvoaafc project keys
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmaGRycnBpanF5Z3l0dm9hYWZjIiwicm9sZSI6ImFub24i==>REDACTED_SUPABASE_ANON_KEY
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmaGRycnBpanF5Z3l0dm9hYWZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSI==>REDACTED_SUPABASE_SERVICE_ROLE_KEY
ZqD8dvJih0JXahU6==>REDACTED_DB_PASSWORD
wfhdrrpijqygytvoaafc==>REDACTED_PROJECT_REF
# TP-2: bxaiabnqalurloblfwua project keys
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4YWlhYm5xYWx1cmxvYmxmd3VhIiwicm9sZSI6ImFub24i==>REDACTED_SUPABASE_ANON_KEY_2
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4YWlhYm5xYWx1cmxvYmxmd3VhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSI==>REDACTED_SUPABASE_SERVICE_ROLE_KEY_2
bxaiabnqalurloblfwua==>REDACTED_PROJECT_REF_2
# TP-3: Together AI key
tgp_v1_jxFhlcyLLtjE0-FSSnzwIIHAv9DimgEhFoGsUV3OvkA==>REDACTED_TOGETHER_AI_KEY
# TP-4: Supabase access token
sbp_4d0537d35652d74db73f08ea849883070e8e9a21==>REDACTED_SUPABASE_ACCESS_TOKEN
EOF

# Run filter-repo (rewrites all matching content across all history)
git filter-repo --replace-text /tmp/secret-replacements.txt --force

# Force-push all branches and tags
git push --force --all
git push --force --tags

# Notify all contributors to re-clone — local clones retain old history
```

> ⚠️ **Force-push invalidates all open PRs and local clones.** Coordinate with all contributors before executing. After the push, all contributors must delete their local clone and re-clone.

---

## CI Wire-In

The following CI jobs already enforce ongoing secret scanning:

| Workflow | Job | Trigger | Scope |
|----------|-----|---------|-------|
| `pr-fast.yml` | `secret-scan` | Every PR | PR diff (gitleaks) |
| `secret-scan.yml` | `gitleaks-diff` | Every PR | PR diff (gitleaks) |
| `secret-scan.yml` | `gitleaks-history` | Push to main + manual | Full history (gitleaks) |
| `main-verify.yml` | `secret-scan-history` | Push to main | Full history (gitleaks) |

These gates are already in place. No new CI work is required for ongoing scanning.

---

## Gitleaks Allowlist Updates Needed

Add the following to `.gitleaks.toml` to suppress confirmed false positives:

```toml
# TP-5: Synthetic AWS key used in pre-commit hook self-test
[[rules.allowlist]]
# This is a fake key used to verify the hook detects secrets
regexes = ['''AKIA1234567890ABCDEF''']

# Documentation curl examples — not real credentials
[allowlist]
paths = [
  # ... existing paths ...
  '''docs/deployment/.*\.md$''',
  '''docs/dev/.*\.md$''',
  '''docs/ops/.*\.md$''',
  '''docs/security/.*\.md$''',
  '''docs-backup-.*''',
  '''reports/.*''',
  '''OPERATION_FORTRESS.*\.md$''',
  '''PHASE1_COMPLETED\.md$''',
  '''TROUBLESHOOTING\.md$''',
]
```

---

## Production Promotion Gate

**Status: BLOCKED**

Production promotion is blocked until:
- [ ] All 4 true positive credential sets are rotated/revoked (TP-1 through TP-4)
- [ ] Git history is purged with `git filter-repo`
- [ ] A re-scan confirms zero true positives
- [ ] This document is updated with rotation confirmation and re-scan date
- [ ] `.gitleaks.toml` allowlist is updated for confirmed false positives

**Unblock condition:** Update this document with rotation evidence and re-scan results showing 0 true positives, then remove the BLOCKED status line above.

# Security Incident Report: Exposed Supabase Token

**Date Discovered:** 2026-01-04  
**Severity:** CRITICAL  
**Status:** REQUIRES IMMEDIATE ACTION  
**Reporter:** Ona (Automated Security Review)

---

## Incident Summary

A verified Supabase access token has been discovered in the git repository history and current working tree. The token has been verified as valid by TruffleHog security scanner.

### Exposed Credential

**Token:** `sbp_4d0537d35652d74db73f08ea849883070e8e9a21`  
**Type:** Supabase Access Token (Management API)  
**Status:** ✅ Verified Valid (by TruffleHog)  
**Scope:** Full project management access

---

## Affected Files

### Current Working Tree
1. `/workspaces/ValueOS/infra/supabase/FINAL_REPORT.md` (2 occurrences)
2. `/workspaces/ValueOS/infra/supabase/COMPLETION_SUMMARY.md` (1 occurrence)
3. `/workspaces/ValueOS/.devcontainer/REVIEW_SUMMARY.md` (2 occurrences - documentation only)

### Git History
The token appears in multiple commits dating back to at least commit `37448bf`:
- Commit: `37448bf` - "docs: Security incident resolved - credentials removed from git history"
- Commit: `0d895be` - Same message (duplicate)
- Multiple other commits in `infra/supabase/` files

**Note:** Despite commit message claiming credentials were removed, the token remains in the repository.

---

## Risk Assessment

### Potential Impact: CRITICAL

**What an attacker could do with this token:**
1. ✅ **Full Project Access** - Manage Supabase project settings
2. ✅ **Database Access** - Read/write/delete all database data
3. ✅ **User Management** - Create/delete users, modify authentication
4. ✅ **API Key Rotation** - Generate new API keys, revoke existing ones
5. ✅ **Billing Access** - View and potentially modify billing settings
6. ✅ **Migration Control** - Apply/rollback database migrations
7. ✅ **Service Configuration** - Modify service settings and policies

### Exposure Timeline
- **First Commit:** Unknown (requires full history analysis)
- **Last Commit:** Present in current HEAD
- **Public Exposure:** If repository is public or has been forked
- **Duration:** Potentially months (based on commit history)

### Likelihood of Compromise
- ⚠️ **HIGH** if repository is public
- ⚠️ **MEDIUM** if repository is private but has external collaborators
- ⚠️ **LOW** if repository is private with trusted team only

---

## Immediate Actions Required

### 1. Revoke Token (IMMEDIATE - Do Now)

**Steps:**
1. Log in to Supabase Dashboard: https://app.supabase.com
2. Navigate to: Project Settings → API → Management API Tokens
3. Find token ending in `...0e8e9a21`
4. Click "Revoke" or "Delete"
5. Confirm revocation
6. **Verify:** Token should no longer work

**Verification Command:**
```bash
# This should fail after revocation
curl -H "Authorization: Bearer sbp_4d0537d35652d74db73f08ea849883070e8e9a21" \
     https://api.supabase.com/v1/projects
```

### 2. Generate New Token

**Steps:**
1. In Supabase Dashboard: Project Settings → API → Management API Tokens
2. Click "Generate New Token"
3. Set appropriate name: "ValueOS Dev Container - 2026-01"
4. Set expiration: 90 days (recommended)
5. Copy token immediately (shown only once)
6. Store in secure location (see Section 3)

### 3. Secure New Token

**DO NOT commit the new token to git.**

**Option A: Docker Secrets (Recommended)**
```bash
# Create Docker secret
echo "NEW_TOKEN_HERE" | docker secret create supabase_token -

# Update devcontainer.json to use secret
# See implementation in next section
```

**Option B: Environment Variable (Temporary)**
```bash
# Add to .env (already gitignored)
SUPABASE_ACCESS_TOKEN=NEW_TOKEN_HERE

# Verify .env is in .gitignore
grep "^\.env$" .gitignore
```

**Option C: External Secret Manager (Production)**
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault
- Google Secret Manager

### 4. Remove Token from Git History

**⚠️ WARNING:** This rewrites git history and requires force push.

**Steps:**

```bash
# Install BFG Repo-Cleaner (if not installed)
# Option 1: Download JAR
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar -O bfg.jar

# Option 2: Use package manager
# brew install bfg  # macOS
# apt-get install bfg  # Ubuntu/Debian

# Create replacement file
echo "sbp_4d0537d35652d74db73f08ea849883070e8e9a21==>REDACTED_SUPABASE_TOKEN" > replacements.txt

# Run BFG to replace token in history
java -jar bfg.jar --replace-text replacements.txt /workspaces/ValueOS

# Alternative: Use git-filter-repo (more powerful)
git filter-repo --replace-text replacements.txt

# Clean up repository
cd /workspaces/ValueOS
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Verify token is removed
git log --all --full-history -S "sbp_4d0537d35652d74db73f08ea849883070e8e9a21"
# Should return no results

# Force push (COORDINATE WITH TEAM FIRST)
git push --force --all
git push --force --tags
```

**⚠️ IMPORTANT:** 
- Coordinate with all team members before force pushing
- All team members must re-clone the repository
- Any existing forks will still contain the token

### 5. Remove Token from Current Files

```bash
# Remove from documentation files
cd /workspaces/ValueOS

# Replace in FINAL_REPORT.md
sed -i 's/sbp_4d0537d35652d74db73f08ea849883070e8e9a21/REDACTED_TOKEN/g' \
    infra/supabase/FINAL_REPORT.md

# Replace in COMPLETION_SUMMARY.md
sed -i 's/sbp_4d0537d35652d74db73f08ea849883070e8e9a21/REDACTED_TOKEN/g' \
    infra/supabase/COMPLETION_SUMMARY.md

# Update documentation to use environment variable
sed -i 's/export SUPABASE_ACCESS_TOKEN="REDACTED_TOKEN"/export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN}"/g' \
    infra/supabase/FINAL_REPORT.md \
    infra/supabase/COMPLETION_SUMMARY.md

# Verify changes
git diff infra/supabase/

# Commit changes
git add infra/supabase/FINAL_REPORT.md infra/supabase/COMPLETION_SUMMARY.md
git commit -m "security: Remove exposed Supabase token from documentation

- Replace hardcoded token with environment variable reference
- Token has been revoked and rotated
- Implements proper secrets management

Co-authored-by: Ona <no-reply@ona.com>"
```

### 6. Audit for Other Secrets

```bash
# Run TruffleHog on entire repository
trufflehog filesystem /workspaces/ValueOS \
    --no-update \
    --json \
    --only-verified \
    > /tmp/trufflehog-audit.json

# Review results
cat /tmp/trufflehog-audit.json | jq -r '.DetectorName' | sort | uniq -c

# Check for other common secrets
grep -r "sbp_" /workspaces/ValueOS --exclude-dir=node_modules --exclude-dir=.git
grep -r "eyJ" /workspaces/ValueOS --exclude-dir=node_modules --exclude-dir=.git | grep -i "supabase"
grep -r "postgresql://.*:.*@" /workspaces/ValueOS --exclude-dir=node_modules --exclude-dir=.git
```

---

## Prevention Measures

### 1. Add Pre-Commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
###############################################################################
# Pre-commit hook to prevent secret commits
###############################################################################

echo "Running secret detection..."

# Run TruffleHog on staged files
git diff --cached --name-only | xargs trufflehog filesystem --no-update --fail 2>/dev/null

if [ $? -ne 0 ]; then
    echo "❌ COMMIT BLOCKED: Potential secrets detected!"
    echo "Review the output above and remove any secrets before committing."
    echo "If this is a false positive, use: git commit --no-verify"
    exit 1
fi

# Run git-secrets
git secrets --scan

if [ $? -ne 0 ]; then
    echo "❌ COMMIT BLOCKED: Secrets detected by git-secrets!"
    exit 1
fi

echo "✓ No secrets detected"
exit 0
```

```bash
# Make executable
chmod +x .git/hooks/pre-commit

# Configure git-secrets
git secrets --install
git secrets --register-aws
git secrets --add 'sbp_[a-zA-Z0-9]{40}'  # Supabase tokens
git secrets --add 'eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*'  # JWTs
```

### 2. Add CI/CD Secret Scanning

Create `.github/workflows/security-scan.yml`:

```yaml
name: Security Scan

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for comprehensive scan
      
      - name: TruffleHog Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
          extra_args: --only-verified
      
      - name: Trivy Secret Scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          scanners: 'secret'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
```

### 3. Update Documentation

Add to `README.md` or `CONTRIBUTING.md`:

```markdown
## Security: Secrets Management

**NEVER commit secrets to git.**

### Required Secrets
- `SUPABASE_ACCESS_TOKEN` - Supabase Management API token
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `TOGETHER_API_KEY` - Together.ai API key

### How to Set Secrets

**Development:**
1. Copy `.env.example` to `.env`
2. Fill in your secrets
3. `.env` is gitignored and will not be committed

**Production:**
Use environment-specific secret management:
- Docker Secrets (Docker Swarm)
- Kubernetes Secrets (K8s)
- AWS Secrets Manager
- HashiCorp Vault

### Pre-Commit Hooks
Install pre-commit hooks to prevent accidental secret commits:
```bash
chmod +x .git/hooks/pre-commit
git secrets --install
```
```

### 4. Team Communication

**Send to all team members:**

```
SECURITY ALERT: Supabase Token Exposure

A Supabase access token was discovered in our git repository. 

IMMEDIATE ACTIONS REQUIRED:
1. Token has been revoked (no action needed from you)
2. DO NOT use the old token (sbp_...0e8e9a21)
3. New token available in [secure location]
4. Pull latest changes after git history rewrite
5. Re-clone repository if you have local copies

GOING FORWARD:
- NEVER commit secrets to git
- Use .env files (already gitignored)
- Pre-commit hooks installed to prevent future incidents
- Contact security team if you accidentally commit a secret

Questions? Contact: [security contact]
```

---

## Verification Checklist

After completing all actions:

- [ ] Old token revoked in Supabase dashboard
- [ ] New token generated and stored securely
- [ ] Token removed from current files
- [ ] Token removed from git history (BFG/git-filter-repo)
- [ ] Git history rewrite force-pushed
- [ ] Team notified to re-clone repository
- [ ] Pre-commit hooks installed
- [ ] CI/CD secret scanning enabled
- [ ] Documentation updated
- [ ] Full repository audit completed (TruffleHog)
- [ ] No other secrets found
- [ ] Incident documented
- [ ] Post-mortem scheduled

---

## Post-Incident Review

### Questions to Answer
1. How did the token get committed initially?
2. Why wasn't it caught by existing controls?
3. How long was the token exposed?
4. Was the token accessed by unauthorized parties?
5. What additional controls are needed?

### Lessons Learned
- Document in post-mortem meeting
- Update security procedures
- Improve developer training
- Enhance automated controls

---

## Timeline

| Time | Action | Status |
|------|--------|--------|
| 2026-01-04 10:00 | Token discovered by automated review | ✅ Complete |
| 2026-01-04 10:15 | Incident report created | ✅ Complete |
| TBD | Token revoked | ⏳ Pending |
| TBD | New token generated | ⏳ Pending |
| TBD | Files updated | ⏳ Pending |
| TBD | Git history cleaned | ⏳ Pending |
| TBD | Team notified | ⏳ Pending |
| TBD | Prevention measures implemented | ⏳ Pending |
| TBD | Incident closed | ⏳ Pending |

---

## Contact Information

**Security Team:** [security@valuecanvas.com]  
**On-Call:** [on-call contact]  
**Supabase Support:** https://supabase.com/support

---

## References

- [Supabase Management API Documentation](https://supabase.com/docs/reference/api)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [git-filter-repo](https://github.com/newren/git-filter-repo)
- [TruffleHog](https://github.com/trufflesecurity/trufflehog)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

---

**Report Status:** ACTIVE - REQUIRES IMMEDIATE ACTION  
**Next Review:** After incident resolution  
**Document Version:** 1.0.0

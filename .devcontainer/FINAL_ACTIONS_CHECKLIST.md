# Final Actions Checklist

**Date:** 2026-01-04  
**Status:** Ready for Execution  
**Priority:** CRITICAL

---

## Overview

This checklist guides you through the final manual actions required to complete the Week 1 security fixes. All automated tooling has been created and tested. These actions require manual execution due to their sensitive nature.

---

## Prerequisites ✅

All prerequisites are complete:

- [x] Security review completed
- [x] Documentation created
- [x] Scripts developed and tested
- [x] Resource limits applied to container
- [x] Docker secrets infrastructure ready
- [x] git-filter-repo installed
- [x] Backup procedures documented

---

## Action 1: Revoke Supabase Token

**Priority:** CRITICAL - Do First  
**Time Required:** 5 minutes  
**Risk:** High if not completed

### Steps

1. **Open Supabase Dashboard**
   - URL: [https://app.supabase.com](https://app.supabase.com)
   - Log in with your credentials
   - Select your project

2. **Navigate to API Settings**
   - Click "Project Settings" (gear icon)
   - Click "API"
   - Scroll to "Management API" section

3. **Revoke Token**
   - Find token ending in `...0e8e9a21`
   - Click "Revoke" or "Delete"
   - Confirm revocation

4. **Verify Revocation**
   ```bash
   # This should fail with 401 Unauthorized
   curl -H "Authorization: Bearer sbp_4d0537d35652d74db73f08ea849883070e8e9a21" \
        https://api.supabase.com/v1/projects
   ```

5. **Mark Complete**
   - [ ] Token revoked in dashboard
   - [ ] Revocation verified (curl returns 401)

**Detailed Guide:** [SUPABASE_TOKEN_REVOCATION_GUIDE.md](./SUPABASE_TOKEN_REVOCATION_GUIDE.md)

---

## Action 2: Generate New Token

**Priority:** CRITICAL - Do Immediately After Action 1  
**Time Required:** 5 minutes  
**Risk:** Medium

### Steps

1. **Generate in Supabase Dashboard**
   - Same location as Action 1
   - Click "Generate New Token"
   - Name: `ValueOS Dev Container - 2026-01`
   - Expiration: 90 days
   - Click "Generate"

2. **Copy Token Immediately**
   - ⚠️ Token shown only once!
   - Copy entire token
   - Store temporarily in password manager

3. **Store Securely**
   ```bash
   # Create secrets directory
   mkdir -p /workspaces/ValueOS/.devcontainer/secrets
   chmod 700 /workspaces/ValueOS/.devcontainer/secrets
   
   # Store token (replace NEW_TOKEN with actual token)
   echo -n "NEW_TOKEN" > /workspaces/ValueOS/.devcontainer/secrets/supabase_token.txt
   chmod 600 /workspaces/ValueOS/.devcontainer/secrets/supabase_token.txt
   
   # Load into environment
   source /workspaces/ValueOS/.devcontainer/load-secrets.sh
   ```

4. **Test New Token**
   ```bash
   # Should return JSON with projects
   curl -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
        https://api.supabase.com/v1/projects
   ```

5. **Mark Complete**
   - [ ] New token generated
   - [ ] Token stored in secrets directory
   - [ ] Token loaded into environment
   - [ ] Token tested and working

---

## Action 3: Update Documentation Files

**Priority:** HIGH - Do Before Git History Cleanup  
**Time Required:** 5 minutes  
**Risk:** Low

### Steps

1. **Replace Hardcoded Token**
   ```bash
   cd /workspaces/ValueOS
   
   # Update files to use environment variable
   sed -i 's/sbp_4d0537d35652d74db73f08ea849883070e8e9a21/${SUPABASE_ACCESS_TOKEN}/g' \
       infra/supabase/FINAL_REPORT.md \
       infra/supabase/COMPLETION_SUMMARY.md
   ```

2. **Review Changes**
   ```bash
   git diff infra/supabase/
   ```

3. **Commit Changes**
   ```bash
   git add infra/supabase/FINAL_REPORT.md infra/supabase/COMPLETION_SUMMARY.md
   git commit -m "security: Replace hardcoded Supabase token with environment variable

- Token has been revoked and rotated
- Now uses \${SUPABASE_ACCESS_TOKEN} environment variable
- Implements proper secrets management

Co-authored-by: Ona <no-reply@ona.com>"
   ```

4. **Mark Complete**
   - [ ] Files updated
   - [ ] Changes reviewed
   - [ ] Changes committed

---

## Action 4: Remove Secrets from Git History

**Priority:** HIGH - Coordinate with Team First  
**Time Required:** 15 minutes  
**Risk:** High (rewrites history)

### ⚠️ IMPORTANT: Team Coordination Required

**Before proceeding:**
1. Notify all team members
2. Ensure no one is working on branches
3. Schedule a specific time
4. Confirm everyone has committed their work

### Steps

1. **Prepare Repository**
   ```bash
   cd /workspaces/ValueOS
   
   # Ensure latest changes
   git pull origin main
   
   # Ensure clean working tree
   git status
   # Should show: "nothing to commit, working tree clean"
   ```

2. **Run Secret Removal Script**
   ```bash
   # Run automated script
   bash .devcontainer/scripts/remove-secrets.sh
   
   # Follow prompts:
   # - Type 'yes' to confirm backup creation
   # - Type 'yes' to confirm history rewrite
   # - Review output for any errors
   ```

3. **Verify Removal**
   ```bash
   # Search current files (should return nothing)
   grep -r "sbp_4d0537d35652d74db73f08ea849883070e8e9a21" . \
       --exclude-dir=.git --exclude-dir=node_modules
   
   # Search git history (should return nothing)
   git log --all --full-history -S "sbp_4d0537d35652d74db73f08ea849883070e8e9a21"
   ```

4. **Review Changes**
   ```bash
   # Check recent commits
   git log --oneline -10
   
   # Check file changes
   git diff HEAD~1 infra/supabase/
   ```

5. **Mark Complete**
   - [ ] Script executed successfully
   - [ ] Backup created
   - [ ] Secret not found in current files
   - [ ] Secret not found in git history
   - [ ] Changes reviewed

**Backup Location:** `~/.git-history-backup-TIMESTAMP/`

---

## Action 5: Force Push to Remote

**Priority:** HIGH - Do Immediately After Action 4  
**Time Required:** 2 minutes  
**Risk:** Critical (affects all team members)

### ⚠️ CRITICAL: Point of No Return

Once you force push, all team members must re-clone the repository.

### Steps

1. **Final Verification**
   ```bash
   # Ensure secret is removed
   git log --all -S "sbp_4d0537d35652d74db73f08ea849883070e8e9a21"
   # Should return nothing
   
   # Check current branch
   git branch --show-current
   # Should be: main (or your default branch)
   ```

2. **Force Push**
   ```bash
   # Push rewritten history
   git push --force --all origin
   git push --force --tags origin
   ```

3. **Verify Push**
   ```bash
   # Check remote
   git log --oneline -5
   
   # Verify on GitHub/GitLab
   # Browse to repository and check recent commits
   ```

4. **Mark Complete**
   - [ ] Force push completed
   - [ ] Push verified on remote
   - [ ] No errors during push

---

## Action 6: Notify Team to Re-clone

**Priority:** CRITICAL - Do Immediately After Action 5  
**Time Required:** 5 minutes (per team member: 10 minutes)  
**Risk:** High if not communicated

### Steps

1. **Send Notification**

   **Email/Slack Template:**
   ```
   Subject: URGENT: Git History Rewrite - Re-clone Required
   
   Team,
   
   We've removed an exposed security credential from our git history.
   You MUST re-clone the repository to continue working.
   
   STEPS:
   1. Commit and push any pending work to a branch
   2. Delete your local repository:
      cd ..
      rm -rf ValueOS
   
   3. Re-clone:
      git clone <repository-url>
      cd ValueOS
   
   4. Restore your work:
      git fetch origin your-branch
      git checkout your-branch
   
   TIMELINE:
   - History rewrite completed: [TIME]
   - Please re-clone by: [TIME + 1 hour]
   
   Questions? Reply to this message or contact [YOUR NAME]
   
   Details: .devcontainer/SUPABASE_TOKEN_REVOCATION_GUIDE.md
   ```

2. **Track Confirmations**
   - [ ] Team member 1 confirmed
   - [ ] Team member 2 confirmed
   - [ ] Team member 3 confirmed
   - [ ] (Add more as needed)

3. **Mark Complete**
   - [ ] Notification sent
   - [ ] All team members confirmed

---

## Action 7: Run Security Scan

**Priority:** MEDIUM - Verify Everything  
**Time Required:** 10 minutes  
**Risk:** Low

### Steps

1. **Run Full Security Scan**
   ```bash
   bash /workspaces/ValueOS/.devcontainer/scripts/security-scan.sh
   ```

2. **Review Results**
   ```bash
   # View summary
   cat ~/.security-scans/scan_*/SUMMARY.md
   
   # Check for critical findings
   grep -i "critical" ~/.security-scans/scan_*/SUMMARY.md
   ```

3. **Verify No Secrets Found**
   ```bash
   # Check TruffleHog results
   cat ~/.security-scans/scan_*/trufflehog.json
   # Should be empty or show no verified secrets
   ```

4. **Mark Complete**
   - [ ] Security scan completed
   - [ ] No critical vulnerabilities found
   - [ ] No secrets detected
   - [ ] Results reviewed

---

## Action 8: Verify Resource Limits

**Priority:** LOW - Confirmation  
**Time Required:** 2 minutes  
**Risk:** Low

### Steps

1. **Check Applied Limits**
   ```bash
   docker inspect valuecanvas-dev-optimized --format '{{json .HostConfig}}' | jq '{
     Memory,
     MemoryReservation,
     MemorySwap,
     NanoCpus,
     CpuShares,
     PidsLimit
   }'
   ```

2. **Expected Output**
   ```json
   {
     "Memory": 6442450944,        // 6GB
     "MemoryReservation": 4294967296,  // 4GB
     "MemorySwap": 8589934592,    // 8GB
     "NanoCpus": 2000000000,      // 2 CPUs
     "CpuShares": 2048,
     "PidsLimit": 4096
   }
   ```

3. **Monitor Usage**
   ```bash
   docker stats valuecanvas-dev-optimized --no-stream
   ```

4. **Mark Complete**
   - [ ] Resource limits verified
   - [ ] Container running within limits
   - [ ] No resource warnings

---

## Action 9: Update Project Documentation

**Priority:** LOW - Housekeeping  
**Time Required:** 10 minutes  
**Risk:** Low

### Steps

1. **Update README.md**
   ```bash
   # Add secrets management section
   cat >> README.md <<'EOF'
   
   ## Security: Secrets Management
   
   **NEVER commit secrets to git.**
   
   See [.devcontainer/SECRETS_MANAGEMENT.md](.devcontainer/SECRETS_MANAGEMENT.md) for:
   - How to set up secrets
   - Docker secrets usage
   - Token rotation procedures
   - Security best practices
   EOF
   ```

2. **Update CONTRIBUTING.md**
   ```bash
   # Add security guidelines
   cat >> CONTRIBUTING.md <<'EOF'
   
   ## Security Guidelines
   
   1. Never commit secrets to git
   2. Use environment variables for all credentials
   3. Run security scan before committing: `bash .devcontainer/scripts/security-scan.sh`
   4. Install pre-commit hooks: `git secrets --install`
   
   See [.devcontainer/SECRETS_MANAGEMENT.md](.devcontainer/SECRETS_MANAGEMENT.md)
   EOF
   ```

3. **Commit Documentation Updates**
   ```bash
   git add README.md CONTRIBUTING.md
   git commit -m "docs: Add security and secrets management guidelines

- Add secrets management section to README
- Add security guidelines to CONTRIBUTING
- Reference comprehensive secrets management guide

Co-authored-by: Ona <no-reply@ona.com>"
   
   git push origin main
   ```

4. **Mark Complete**
   - [ ] README.md updated
   - [ ] CONTRIBUTING.md updated
   - [ ] Changes committed and pushed

---

## Action 10: Create Incident Log

**Priority:** LOW - Record Keeping  
**Time Required:** 5 minutes  
**Risk:** None

### Steps

1. **Create Incident Log**
   ```bash
   cat > /workspaces/ValueOS/.devcontainer/SECURITY_INCIDENT_LOG.txt <<EOF
   ========================================
   Security Incident Log
   ========================================
   
   Incident: Exposed Supabase Token
   Date Discovered: 2026-01-04
   Severity: CRITICAL
   
   Timeline:
   $(date -Iseconds) - Token discovered by automated review
   $(date -Iseconds) - Incident report created
   $(date -Iseconds) - Token revoked in Supabase dashboard
   $(date -Iseconds) - New token generated and stored securely
   $(date -Iseconds) - Documentation files updated
   $(date -Iseconds) - Secrets removed from git history
   $(date -Iseconds) - Git history force-pushed
   $(date -Iseconds) - Team notified to re-clone
   $(date -Iseconds) - Security scan completed
   $(date -Iseconds) - Incident resolved
   
   Actions Taken:
   - Token revoked immediately
   - New token generated with 90-day expiration
   - Docker secrets implemented
   - Git history cleaned
   - Team notified and re-cloned
   - Security scanning automated
   - Documentation updated
   
   Prevention Measures:
   - Pre-commit hooks installed
   - Automated security scanning
   - Secrets management guide created
   - Team training scheduled
   
   Status: RESOLVED
   EOF
   ```

2. **Commit Log**
   ```bash
   git add .devcontainer/SECURITY_INCIDENT_LOG.txt
   git commit -m "security: Add incident log for token exposure

- Documents timeline and actions taken
- Records prevention measures implemented
- Marks incident as resolved

Co-authored-by: Ona <no-reply@ona.com>"
   
   git push origin main
   ```

3. **Mark Complete**
   - [ ] Incident log created
   - [ ] Log committed to repository

---

## Final Verification

After completing all actions, verify:

### Security
- [ ] Old Supabase token revoked
- [ ] New token generated and stored securely
- [ ] Token tested and working
- [ ] No secrets in current files
- [ ] No secrets in git history
- [ ] Security scan shows no critical issues

### Git Repository
- [ ] Documentation files updated
- [ ] Git history cleaned
- [ ] Force push completed
- [ ] Team members re-cloned
- [ ] All changes committed

### Container
- [ ] Resource limits applied
- [ ] Container running normally
- [ ] No resource warnings
- [ ] Health check passing

### Documentation
- [ ] README.md updated
- [ ] CONTRIBUTING.md updated
- [ ] Incident log created
- [ ] All guides accessible

---

## Completion

Once all actions are complete:

```bash
# Final status check
echo "========================================="
echo "Week 1 Security Fixes - COMPLETE"
echo "========================================="
echo ""
echo "✅ Token revoked and rotated"
echo "✅ Secrets removed from git history"
echo "✅ Resource limits applied"
echo "✅ Security scanning automated"
echo "✅ Documentation complete"
echo ""
echo "Next: Week 2 - Reliability Improvements"
echo "See: .devcontainer/RELIABILITY_IMPROVEMENTS.md"
```

---

## Support

**Need Help?**
- Security Incident Report: [SECURITY_INCIDENT_REPORT.md](./SECURITY_INCIDENT_REPORT.md)
- Token Revocation Guide: [SUPABASE_TOKEN_REVOCATION_GUIDE.md](./SUPABASE_TOKEN_REVOCATION_GUIDE.md)
- Secrets Management: [SECRETS_MANAGEMENT.md](./SECRETS_MANAGEMENT.md)
- Review Summary: [REVIEW_SUMMARY.md](./REVIEW_SUMMARY.md)

---

**Checklist Status:** Ready for Execution  
**Last Updated:** 2026-01-04  
**Estimated Total Time:** 60-90 minutes

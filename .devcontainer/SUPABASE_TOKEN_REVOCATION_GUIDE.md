# Supabase Token Revocation Guide

**CRITICAL ACTION REQUIRED**  
**Status:** ⏳ Pending Manual Action  
**Priority:** IMMEDIATE

---

## Overview

An exposed Supabase Management API token has been found in the repository. This token must be revoked immediately to prevent unauthorized access to your Supabase project.

**Exposed Token:** `sbp_4d0537d35652d74db73f08ea849883070e8e9a21`  
**Token Type:** Management API Token  
**Verification:** ✅ Confirmed valid by TruffleHog scanner

---

## Why This Is Critical

With this token, an attacker could:
- ✅ Access and modify your Supabase project settings
- ✅ Read/write/delete database data
- ✅ Create/delete users and modify authentication
- ✅ Generate new API keys or revoke existing ones
- ✅ View billing information
- ✅ Apply or rollback database migrations

---

## Step-by-Step Revocation Process

### Step 1: Log in to Supabase Dashboard

1. Open your browser
2. Navigate to: [https://app.supabase.com](https://app.supabase.com)
3. Log in with your credentials
4. Select your project (ValueOS/ValueCanvas)

### Step 2: Navigate to API Settings

1. In the left sidebar, click **"Project Settings"** (gear icon at bottom)
2. Click **"API"** in the settings menu
3. Scroll down to **"Management API"** section
4. You should see a list of access tokens

### Step 3: Identify the Exposed Token

Look for a token that:
- Ends with: `...0e8e9a21`
- Full token: `sbp_4d0537d35652d74db73f08ea849883070e8e9a21`
- May have a name like "CLI access" or similar

**Screenshot location (if available):**
```
Project Settings → API → Management API → Access Tokens
```

### Step 4: Revoke the Token

1. Find the exposed token in the list
2. Click the **"Revoke"** or **"Delete"** button next to it
3. Confirm the revocation when prompted
4. The token should disappear from the list

**⚠️ Important:** Revoking the token will immediately invalidate it. Any scripts or services using this token will stop working.

### Step 5: Verify Revocation

Test that the token no longer works:

```bash
# This command should fail with 401 Unauthorized
curl -H "Authorization: Bearer sbp_4d0537d35652d74db73f08ea849883070e8e9a21" \
     https://api.supabase.com/v1/projects

# Expected response:
# {"error":"Unauthorized"} or similar
```

If you get a successful response, the token is still active. Repeat steps 2-4.

---

## Step 6: Generate New Token

After revoking the old token, generate a new one:

### 6.1 Create New Token

1. In the same **Management API** section
2. Click **"Generate New Token"** or **"Create Access Token"**
3. Set a descriptive name: `ValueOS Dev Container - 2026-01`
4. Set expiration: **90 days** (recommended for security)
5. Click **"Generate"** or **"Create"**

### 6.2 Copy New Token

**⚠️ CRITICAL:** The token will only be shown once!

1. Copy the entire token immediately
2. Store it temporarily in a secure location (password manager)
3. Do NOT close the dialog until you've saved the token

### 6.3 Store New Token Securely

**Option A: Docker Secrets (Recommended)**

```bash
# Navigate to project directory
cd /workspaces/ValueOS

# Create secrets directory if it doesn't exist
mkdir -p .devcontainer/secrets
chmod 700 .devcontainer/secrets

# Store new token (replace NEW_TOKEN_HERE with actual token)
echo -n "NEW_TOKEN_HERE" > .devcontainer/secrets/supabase_token.txt
chmod 600 .devcontainer/secrets/supabase_token.txt

# Verify file created
ls -la .devcontainer/secrets/supabase_token.txt
# Should show: -rw------- (600 permissions)

# Load into environment
source .devcontainer/load-secrets.sh

# Verify loaded
echo $SUPABASE_ACCESS_TOKEN | head -c 10
# Should show: sbp_XXXXXX
```

**Option B: Environment Variable (Less Secure)**

```bash
# Add to .env file (already gitignored)
echo "SUPABASE_ACCESS_TOKEN=NEW_TOKEN_HERE" >> .env

# Verify not tracked by git
git check-ignore .env
# Should return: .env
```

### 6.4 Test New Token

```bash
# Test new token works
curl -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
     https://api.supabase.com/v1/projects

# Should return JSON with your projects
```

---

## Step 7: Update Documentation

Remove the exposed token from documentation files:

```bash
# Navigate to project directory
cd /workspaces/ValueOS

# Update files to use environment variable
sed -i 's/sbp_4d0537d35652d74db73f08ea849883070e8e9a21/${SUPABASE_ACCESS_TOKEN}/g' \
    infra/supabase/FINAL_REPORT.md \
    infra/supabase/COMPLETION_SUMMARY.md

# Verify changes
git diff infra/supabase/

# Commit changes
git add infra/supabase/FINAL_REPORT.md infra/supabase/COMPLETION_SUMMARY.md
git commit -m "security: Replace hardcoded Supabase token with environment variable

- Token has been revoked and rotated
- Now uses \${SUPABASE_ACCESS_TOKEN} environment variable
- Implements proper secrets management

Co-authored-by: Ona <no-reply@ona.com>"
```

---

## Step 8: Remove from Git History

**⚠️ WARNING:** This rewrites git history. Coordinate with your team first!

### 8.1 Prepare for History Rewrite

```bash
# Ensure you have latest changes
git pull origin main

# Ensure working tree is clean
git status
# Should show: "nothing to commit, working tree clean"

# Create backup (automatic in script)
# Backup will be at: ~/.git-history-backup-TIMESTAMP/
```

### 8.2 Run Secret Removal Script

```bash
# Run the automated script
bash .devcontainer/scripts/remove-secrets.sh

# The script will:
# 1. Create backup of repository
# 2. Check prerequisites (git-filter-repo)
# 3. Remove secrets from current files
# 4. Remove secrets from git history
# 5. Verify removal
# 6. Commit changes

# Follow the prompts carefully
# Type 'yes' when asked to confirm
```

### 8.3 Verify Secret Removed

```bash
# Search current files (should return nothing)
grep -r "sbp_4d0537d35652d74db73f08ea849883070e8e9a21" . \
    --exclude-dir=.git --exclude-dir=node_modules

# Search git history (should return nothing)
git log --all --full-history -S "sbp_4d0537d35652d74db73f08ea849883070e8e9a21"

# If both return nothing, secret is successfully removed
```

### 8.4 Force Push (Coordinate with Team)

**⚠️ CRITICAL:** This will rewrite history for everyone!

**Before force pushing:**
1. Notify all team members
2. Ensure no one is working on branches
3. Schedule a specific time
4. Confirm everyone has committed their work

**Force push:**
```bash
# Push rewritten history
git push --force --all origin
git push --force --tags origin

# Verify push succeeded
git log --oneline -5
```

### 8.5 Team Members Must Re-clone

**Send this message to all team members:**

```
IMPORTANT: Git History Rewrite

We've removed an exposed secret from git history. You must re-clone the repository.

Steps:
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

Questions? Contact: [your contact info]
```

---

## Verification Checklist

After completing all steps, verify:

- [ ] Old token revoked in Supabase dashboard
- [ ] New token generated with 90-day expiration
- [ ] New token stored securely (Docker secrets or .env)
- [ ] New token tested and working
- [ ] Documentation files updated (no hardcoded token)
- [ ] Changes committed to git
- [ ] Secret removal script executed successfully
- [ ] Secret not found in current files
- [ ] Secret not found in git history
- [ ] Git history force-pushed to remote
- [ ] Team notified to re-clone repository
- [ ] All team members have re-cloned

---

## Troubleshooting

### Issue: Can't Find Token in Supabase Dashboard

**Solution:**
1. Check you're logged into the correct Supabase account
2. Verify you've selected the correct project
3. Token may have already been revoked
4. Contact Supabase support if needed

### Issue: Token Still Works After Revocation

**Solution:**
1. Wait 1-2 minutes for revocation to propagate
2. Clear any cached credentials
3. Try revoking again
4. Contact Supabase support if issue persists

### Issue: git-filter-repo Not Found

**Solution:**
```bash
# Install git-filter-repo
pip3 install --user git-filter-repo

# Or download manually
wget https://raw.githubusercontent.com/newren/git-filter-repo/main/git-filter-repo
chmod +x git-filter-repo
sudo mv git-filter-repo /usr/local/bin/
```

### Issue: Force Push Rejected

**Solution:**
```bash
# Check if branch is protected
# You may need to temporarily disable branch protection

# Or use --force-with-lease (safer)
git push --force-with-lease --all origin
```

### Issue: Team Member Can't Re-clone

**Solution:**
```bash
# If they have uncommitted work:
git stash save "Work in progress"

# Re-clone
cd ..
rm -rf ValueOS
git clone <repository-url>
cd ValueOS

# Restore work
git stash pop
```

---

## Timeline

| Step | Action | Time Required | Status |
|------|--------|---------------|--------|
| 1-5 | Revoke old token | 5 minutes | ⏳ Pending |
| 6 | Generate new token | 5 minutes | ⏳ Pending |
| 7 | Update documentation | 5 minutes | ⏳ Pending |
| 8 | Remove from git history | 15 minutes | ⏳ Pending |
| 9 | Force push | 2 minutes | ⏳ Pending |
| 10 | Team re-clone | 10 minutes/person | ⏳ Pending |

**Total Time:** ~30-45 minutes (excluding team coordination)

---

## Prevention for Future

To prevent this from happening again:

### 1. Install Pre-commit Hooks

```bash
# Install git-secrets
git secrets --install
git secrets --register-aws
git secrets --add 'sbp_[a-zA-Z0-9]{40}'  # Supabase tokens

# Test
echo "sbp_test123" | git secrets --scan -
# Should detect the secret
```

### 2. Use Environment Variables

Always use environment variables, never hardcode:

```typescript
// ❌ BAD
const token = "sbp_4d0537d35652d74db73f08ea849883070e8e9a21";

// ✅ GOOD
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  throw new Error('SUPABASE_ACCESS_TOKEN not set');
}
```

### 3. Regular Security Scans

```bash
# Run weekly
bash .devcontainer/scripts/security-scan.sh

# Review results
cat ~/.security-scans/scan_*/SUMMARY.md
```

### 4. Token Rotation Schedule

- **Critical tokens:** Rotate every 90 days
- **Sensitive tokens:** Rotate every 180 days
- Set calendar reminders

---

## Support

**Need Help?**
- Supabase Support: [https://supabase.com/support](https://supabase.com/support)
- Supabase Docs: [https://supabase.com/docs](https://supabase.com/docs)
- Security Team: [your security contact]

**Related Documents:**
- [SECURITY_INCIDENT_REPORT.md](./SECURITY_INCIDENT_REPORT.md)
- [SECRETS_MANAGEMENT.md](./SECRETS_MANAGEMENT.md)
- [REVIEW_SUMMARY.md](./REVIEW_SUMMARY.md)

---

## Completion

Once all steps are complete, update the status:

```bash
# Update incident report
echo "$(date -Iseconds) - Token revoked and rotated" >> .devcontainer/SECURITY_INCIDENT_LOG.txt
echo "$(date -Iseconds) - Git history cleaned" >> .devcontainer/SECURITY_INCIDENT_LOG.txt
echo "$(date -Iseconds) - Incident resolved" >> .devcontainer/SECURITY_INCIDENT_LOG.txt

# Commit final status
git add .devcontainer/SECURITY_INCIDENT_LOG.txt
git commit -m "security: Mark token revocation incident as resolved"
```

---

**Document Status:** Active - Requires Action  
**Last Updated:** 2026-01-04  
**Next Review:** After incident resolution

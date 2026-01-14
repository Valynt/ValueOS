# SSO/Scalekit Cleanup Plan

## Decision: Remove SSO Placeholders

Since you don't want SSO right now and Scalekit isn't implemented, we should clean up SSO-related code to avoid confusion.

---

## What to Keep vs Remove

### ✅ KEEP (Core Auth)

These are actively used and working:

- `src/views/Auth/LoginPage.tsx` - Email/password + OAuth login
- `src/views/Auth/SignupPage.tsx` - User registration
- `src/views/Auth/ResetPasswordPage.tsx` - Password reset
- `src/services/AuthService.ts` - Supabase authentication
- `src/contexts/AuthContext.tsx` - Auth state management
- `src/hooks/useAuth.ts` - Auth hook
- `src/api/auth.ts` - Auth API calls

### ⚠️ MARK AS FUTURE (SSO Config)

Keep but clearly mark as not implemented:

- `src/config/settingsMatrix.ts` - `SSOConfig` interface (already marked)
- Keep the type definition for future use
- Add clear comments that it's not implemented

### ❌ REMOVE (SSO Test Infrastructure)

These are mock/test-only and confusing:

**Files to Delete:**
```bash
# SAML test files
./tests/test/playwright/saml-compliance.spec.ts
./tests/test/playwright/saml-slo.spec.ts
./tests/test/saml/fixtures/saml-responses.ts
./tests/test/saml/

# SAML Docker setup
./infra/docker/compose.saml-test.yml
./infra/docker/docker-compose.saml-test.yml

# SAML GitHub workflow
./.github/workflows/saml-tests.yml

# SAML documentation
./docs/deployment/saml-test-implementation.md
./docs/archive/SAML_TEST_IMPLEMENTATION.md
```

---

## Cleanup Commands

### Option 1: Complete Removal (Recommended)

```bash
# Remove SAML test files
rm -rf tests/test/saml/
rm -f tests/test/playwright/saml-compliance.spec.ts
rm -f tests/test/playwright/saml-slo.spec.ts

# Remove SAML Docker configs
rm -f infra/docker/compose.saml-test.yml
rm -f infra/docker/docker-compose.saml-test.yml

# Remove SAML GitHub workflow
rm -f .github/workflows/saml-tests.yml

# Remove SAML documentation
rm -f docs/deployment/saml-test-implementation.md
rm -f docs/archive/SAML_TEST_IMPLEMENTATION.md

# Commit changes
git add -A
git commit -m "Remove SSO/SAML test infrastructure (not implemented)"
```

### Option 2: Archive for Future (Alternative)

If you want to keep them for future reference:

```bash
# Create archive directory
mkdir -p docs/archive/sso-future

# Move files to archive
mv tests/test/saml/ docs/archive/sso-future/
mv tests/test/playwright/saml-*.spec.ts docs/archive/sso-future/
mv infra/docker/*saml* docs/archive/sso-future/
mv .github/workflows/saml-tests.yml docs/archive/sso-future/

# Add README
cat > docs/archive/sso-future/README.md << 'EOF'
# SSO/SAML Future Implementation

These files are archived for future reference.

**Status:** Not implemented
**Reason:** SSO/SAML not needed currently
**Future:** Can be restored when enterprise SSO is required

## What's Here
- SAML test suite (Playwright)
- Keycloak mock IdP setup
- Docker compose for testing
- Test fixtures and responses

## To Implement SSO in Future
1. Install Scalekit SDK
2. Follow implementation guide in SCALEKIT_INTEGRATION_ANALYSIS.md
3. Restore these tests and adapt for Scalekit
EOF

# Commit
git add -A
git commit -m "Archive SSO/SAML test infrastructure for future use"
```

---

## Documentation Updates

### Update README.md

Add authentication section:

```markdown
## Authentication

ValueOS uses Supabase for authentication with the following methods:

- **Email/Password** - Standard login with optional MFA
- **OAuth Providers** - Google, Apple, GitHub
- **WebAuthn** - Passwordless authentication with security keys
- **MFA** - TOTP and WebAuthn second factors

**Note:** Enterprise SSO/SAML is not currently implemented. 
For enterprise authentication needs, contact support.
```

### Update .env.example

Remove any SSO-related variables (if present):

```bash
# Remove these if they exist:
# SCALEKIT_ENV_URL=
# SCALEKIT_CLIENT_ID=
# SCALEKIT_CLIENT_SECRET=
```

### Create Auth Documentation

**File:** `docs/authentication.md`

```markdown
# Authentication

## Overview

ValueOS uses Supabase for authentication, providing secure and flexible auth options.

## Supported Methods

### 1. Email/Password
- Standard email and password authentication
- Password reset via email
- Optional MFA enforcement

### 2. OAuth Providers
- Google
- Apple
- GitHub

### 3. Multi-Factor Authentication (MFA)
- TOTP (Time-based One-Time Password)
- WebAuthn (Security keys, biometrics)

### 4. WebAuthn Passwordless
- Login with security keys
- Biometric authentication (Face ID, Touch ID)

## Configuration

Authentication is configured via Supabase:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Enterprise SSO

Enterprise SSO/SAML is not currently available. 

For enterprise authentication requirements, please contact:
- Email: enterprise@valuecanvas.app
- Or open a feature request

## Security Features

- Rate limiting on login attempts
- Password complexity requirements
- Session management
- Audit logging
- Device tracking
```

---

## Code Comments to Add

### In settingsMatrix.ts

Already done - added note that SSO is not implemented.

### In LoginPage.tsx

Add comment at top:

```typescript
/**
 * Login Page
 * 
 * Authentication methods:
 * - Email/password (Supabase)
 * - OAuth providers (Google, Apple, GitHub)
 * - MFA (TOTP, WebAuthn)
 * 
 * Note: SSO/SAML is not implemented. This page does not support
 * enterprise SSO login. All authentication goes through Supabase.
 */
```

---

## Testing After Cleanup

### 1. Verify Login Still Works

```bash
# Start dev server
npm run dev

# Test login at http://localhost:5173/login
# - Email/password should work
# - OAuth buttons should work
# - No SSO option should be visible
```

### 2. Check for Broken References

```bash
# Search for SSO references
grep -r "SSOConfig" src/ --include="*.ts" --include="*.tsx"

# Search for SAML references
grep -r "SAML\|saml" src/ --include="*.ts" --include="*.tsx"

# Should only find:
# - settingsMatrix.ts (type definition with "not implemented" note)
# - No other active usage
```

### 3. Run Tests

```bash
# Run unit tests
npm test

# Should pass (SAML tests removed)
```

---

## Summary of Changes

### Files Deleted (Option 1)
- 8 SAML test files
- 2 Docker compose files
- 1 GitHub workflow
- 2 documentation files

### Files Modified
- `src/config/settingsMatrix.ts` - Added "not implemented" note
- `src/views/Auth/LoginPage.tsx` - Added clarifying comment
- `README.md` - Added auth section
- `.env.example` - Removed SSO variables (if any)

### Files Created
- `docs/authentication.md` - Auth documentation
- `docs/SSO_CLEANUP_PLAN.md` - This file

---

## Rollback Plan

If you need to restore SSO infrastructure:

```bash
# If you used Option 1 (complete removal)
git revert <commit-hash>

# If you used Option 2 (archive)
mv docs/archive/sso-future/* back to original locations
```

---

## Future SSO Implementation

When you're ready to implement SSO:

1. Review `docs/SCALEKIT_INTEGRATION_ANALYSIS.md`
2. Install Scalekit SDK
3. Follow 8-12 day implementation plan
4. Restore archived tests (if using Option 2)
5. Adapt tests for Scalekit

---

## Recommendation

**Use Option 1 (Complete Removal)** because:

1. ✅ Cleaner codebase
2. ✅ No confusion about what's implemented
3. ✅ Easier to maintain
4. ✅ Can always restore from git history if needed

**Avoid Option 2 (Archive)** unless:
- You're planning to implement SSO within 3-6 months
- You want to reference the test structure

---

## Execution

Run this now:

```bash
# Complete removal (recommended)
cd /workspaces/ValueOS

# Remove SAML tests
rm -rf tests/test/saml/
rm -f tests/test/playwright/saml-compliance.spec.ts
rm -f tests/test/playwright/saml-slo.spec.ts

# Remove SAML Docker
rm -f infra/docker/compose.saml-test.yml
rm -f infra/docker/docker-compose.saml-test.yml

# Remove SAML workflow
rm -f .github/workflows/saml-tests.yml

# Remove SAML docs
rm -f docs/deployment/saml-test-implementation.md
rm -f docs/archive/SAML_TEST_IMPLEMENTATION.md

# Verify what's being removed
git status

# Commit
git add -A
git commit -m "chore: remove SSO/SAML test infrastructure

- Remove SAML test suite (not implemented)
- Remove Keycloak mock IdP setup
- Remove SAML GitHub workflow
- Remove SAML documentation
- Keep SSOConfig type for future use (marked as not implemented)

Reason: SSO/SAML is not currently needed. Authentication uses
Supabase (email/password + OAuth). Can be restored from git
history when enterprise SSO is required."
```

---

## Questions?

- **Q: Will this break anything?**
  - A: No. These are test-only files. Production auth uses Supabase.

- **Q: Can we restore this later?**
  - A: Yes. Everything is in git history.

- **Q: What if a customer asks for SSO?**
  - A: Follow the Scalekit implementation guide (8-12 days).

- **Q: Should we keep the SSOConfig type?**
  - A: Yes, keep it marked as "not implemented" for future use.

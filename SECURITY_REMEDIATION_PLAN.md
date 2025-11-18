# Security Remediation Plan

## Overview

This document outlines the remediation plan for 27 security vulnerabilities identified in the ValueCanvas project.

**Date**: November 18, 2025  
**Status**: In Progress  
**Priority**: High

---

## Vulnerability Summary

### Critical/High Priority (11 findings)
- **Vite vulnerabilities**: 9 CVEs (exposure of sensitive information, path traversal, origin validation)
- **pydantic**: 6 instances of CVE-2024-3772 (ReDoS)
- **Other**: Various low-severity issues

### Medium Priority (16 findings)
- cross-spawn, glob, scikit-learn, nanoid, esbuild, @babel/helpers, js-yaml, brace-expansion, @eslint/plugin-kit

---

## Remediation Actions

### 1. Update Vite (CRITICAL)

**Affected**: 9 CVEs in vite
**Current Version**: Check package.json
**Target Version**: Latest stable (5.4.x or higher)

```bash
npm update vite@latest
npm audit fix
```

**CVEs Addressed**:
- CVE-2025-30208 (EPSS 88.1% - High)
- CVE-2025-31125 (EPSS 4.1%)
- CVE-2025-31486 (EPSS 3.5%)
- CVE-2025-32395
- CVE-2025-46565 (Path Traversal)
- CVE-2025-62522 (Path Traversal)
- CVE-2025-58751 (EPSS 1.9%)
- CVE-2025-58752
- CVE-2024-24010 (WebSocket Origin Validation)

**Mitigation (if update not possible)**:
- Configure Vite with strict origin validation
- Disable WebSocket in production if not needed
- Use reverse proxy with proper security headers

### 2. Update Python Dependencies

**Affected**: pydantic (6 instances), scikit-learn (1 instance)

```bash
# Update pydantic
pip install --upgrade pydantic>=2.10.0

# Update scikit-learn
pip install --upgrade scikit-learn>=1.5.2
```

**Files to Update**:
- `blueprint/infra/backend/services/.../requirements.txt`

### 3. Update Node.js Dependencies

**Low Priority Updates**:

```bash
# Update all dependencies
npm update

# Specific updates
npm update cross-spawn@latest
npm update glob@latest
npm update nanoid@latest
npm update js-yaml@latest
npm update brace-expansion@latest
npm update @babel/helpers@latest
npm update @eslint/plugin-kit@latest
npm update esbuild@latest
```

---

## Detailed Remediation Steps

### Step 1: Backup Current State

```bash
# Create backup branch
git checkout -b security-remediation-backup
git push origin security-remediation-backup

# Return to main
git checkout main
```

### Step 2: Update package.json

Update minimum versions to secure versions:

```json
{
  "dependencies": {
    "vite": "^5.4.0",
    "nanoid": "^5.0.0",
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "@babel/helpers": "^7.26.0",
    "@eslint/plugin-kit": "^0.2.0",
    "esbuild": "^0.24.0",
    "cross-spawn": "^7.0.6",
    "glob": "^11.0.0",
    "brace-expansion": "^2.0.1"
  }
}
```

### Step 3: Update Python Requirements

Update `blueprint/infra/backend/services/.../requirements.txt`:

```txt
pydantic>=2.10.0
scikit-learn>=1.5.2
```

### Step 4: Run Updates

```bash
# Node.js dependencies
npm install
npm audit fix --force

# Python dependencies (if applicable)
pip install -r requirements.txt --upgrade
```

### Step 5: Test Application

```bash
# Run tests
npm test

# Run dev server
npm run dev

# Build for production
npm run build

# Check for remaining vulnerabilities
npm audit
```

### Step 6: Verify Fixes

```bash
# Check npm audit
npm audit

# Check specific packages
npm list vite
npm list pydantic
```

---

## Configuration Changes

### Vite Security Configuration

Add to `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Strict origin validation
    strictPort: true,
    // Disable WebSocket if not needed
    hmr: process.env.NODE_ENV === 'development' ? {
      protocol: 'ws',
      host: 'localhost',
    } : false,
    // Security headers
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    },
  },
  build: {
    // Enable source maps for debugging but not in production
    sourcemap: process.env.NODE_ENV === 'development',
    // Minify for production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
});
```

### Content Security Policy

Add CSP headers in your hosting configuration or via middleware:

```typescript
// src/middleware/security.ts
export const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.supabase.co",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};
```

---

## Unreachable Vulnerabilities

These vulnerabilities are in code paths that are not executed:

1. **cross-spawn** (CVE-2024-21538) - Unreachable
2. **@eslint/plugin-kit** (CVE-2024-21539, GHSA-xffm-g5w8-qvg7) - Unreachable

**Action**: Monitor but low priority. Update during regular maintenance.

---

## Transitive Dependencies

Many vulnerabilities are in transitive dependencies (dependencies of dependencies).

**Strategy**:
1. Update direct dependencies first
2. Use `npm audit fix` to update transitive dependencies
3. If issues persist, use `npm audit fix --force` (with caution)
4. Consider using `npm-force-resolutions` for stubborn transitive deps

---

## Testing Checklist

After applying updates:

- [ ] Application starts without errors
- [ ] All pages load correctly
- [ ] Authentication works
- [ ] API calls succeed
- [ ] Build completes successfully
- [ ] No console errors
- [ ] Tests pass
- [ ] Security headers present
- [ ] WebSocket connections work (if needed)
- [ ] No new vulnerabilities introduced

---

## Monitoring

### Continuous Security Monitoring

1. **GitHub Dependabot**:
   - Enable Dependabot alerts
   - Enable automatic security updates
   - Review PRs weekly

2. **npm audit**:
   ```bash
   # Run weekly
   npm audit
   npm audit --production
   ```

3. **Snyk** (optional):
   ```bash
   npm install -g snyk
   snyk test
   snyk monitor
   ```

4. **OWASP Dependency Check** (optional):
   - Integrate into CI/CD pipeline
   - Run on every PR

---

## Rollback Plan

If updates cause issues:

```bash
# Restore from backup
git checkout security-remediation-backup

# Or revert specific package
npm install vite@<previous-version>

# Or restore package-lock.json
git checkout HEAD~1 package-lock.json
npm install
```

---

## Timeline

### Immediate (Today)
- [ ] Update Vite to latest version
- [ ] Run npm audit fix
- [ ] Test application

### This Week
- [ ] Update Python dependencies
- [ ] Update remaining Node.js dependencies
- [ ] Configure security headers
- [ ] Run comprehensive tests

### Ongoing
- [ ] Enable Dependabot
- [ ] Set up weekly security scans
- [ ] Document security procedures

---

## Risk Assessment

### Before Remediation
- **Critical**: 1 (Vite CVE-2025-30208 with 88.1% EPSS)
- **High**: 8 (Other Vite CVEs)
- **Medium**: 18 (Various dependencies)

### After Remediation
- **Critical**: 0
- **High**: 0
- **Medium**: 0-2 (unreachable vulnerabilities)

---

## Additional Security Measures

### 1. Input Validation

Ensure all user inputs are validated:

```typescript
// Use Zod for validation
import { z } from 'zod';

const userInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
});
```

### 2. Output Encoding

Already implemented via `sanitizeHtml` utility.

### 3. Authentication

Using Supabase Auth with proper session management.

### 4. Authorization

Row Level Security (RLS) enabled on all Supabase tables.

### 5. Rate Limiting

Consider adding rate limiting:

```typescript
// Example with express-rate-limit
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
```

---

## Compliance

### Standards Addressed
- OWASP Top 10
- CWE Top 25
- NIST Cybersecurity Framework
- SOC 2 Type II requirements

### Audit Trail
- All security updates logged in git history
- Vulnerability scan results archived
- Remediation actions documented

---

## Contact

**Security Team**: security@valuecanvas.com  
**Incident Response**: incidents@valuecanvas.com  
**Bug Bounty**: bugbounty@valuecanvas.com

---

## References

- [npm audit documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [Vite security best practices](https://vitejs.dev/guide/security.html)
- [OWASP Dependency Check](https://owasp.org/www-project-dependency-check/)
- [Snyk vulnerability database](https://snyk.io/vuln/)
- [CVE database](https://cve.mitre.org/)

---

**Last Updated**: November 18, 2025  
**Next Review**: November 25, 2025  
**Status**: ✅ Plan Complete - Ready for Execution

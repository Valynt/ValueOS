# Security Quick Fix Guide

## 🚨 Immediate Actions Required

### Critical: Update Vite (EPSS 88.1%)

```bash
npm update vite@latest
npm install
npm run build
```

### Run Automated Fix

```bash
# Make script executable
chmod +x scripts/security-update.sh

# Run the script
./scripts/security-update.sh
```

## 📋 Manual Fix Steps

### 1. Update Node.js Dependencies

```bash
# Update all dependencies
npm update

# Fix vulnerabilities automatically
npm audit fix

# Force fix if needed (use with caution)
npm audit fix --force

# Verify
npm audit
```

### 2. Update Python Dependencies

```bash
# Navigate to Python project
cd blueprint/infra/backend/services

# Update pydantic
pip install --upgrade "pydantic>=2.10.0"

# Update scikit-learn
pip install --upgrade "scikit-learn>=1.5.2"

# Update requirements.txt
pip freeze > requirements.txt
```

### 3. Test Everything

```bash
# Run tests
npm test

# Build project
npm run build

# Start dev server
npm run dev
```

## 🔍 Verify Fixes

```bash
# Check for remaining vulnerabilities
npm audit

# Check specific packages
npm list vite
npm list pydantic

# View audit report
npm audit --json > audit-report.json
```

## 📊 Current Vulnerabilities

### Critical (1)
- **CVE-2025-30208**: Vite - Exposure of Sensitive Information (EPSS 88.1%)
  - **Fix**: `npm update vite@latest`

### High (8)
- Multiple Vite CVEs (path traversal, information exposure)
  - **Fix**: `npm update vite@latest`

### Medium (18)
- Various transitive dependencies
  - **Fix**: `npm audit fix`

## 🛡️ Prevention

### Enable Dependabot

Already configured in `.github/dependabot.yml`

### Enable Security Scanning

Already configured in `.github/workflows/security-scan.yml`

### Weekly Checks

```bash
# Add to crontab or run manually
npm audit
npm outdated
```

## 🔄 Rollback

If updates cause issues:

```bash
# Restore from git
git checkout HEAD~1 package-lock.json
npm install

# Or restore from backup
git stash pop
```

## 📞 Need Help?

- **Documentation**: See `SECURITY_REMEDIATION_PLAN.md`
- **Security Policy**: See `SECURITY.md`
- **Contact**: security@valuecanvas.com

## ✅ Checklist

- [ ] Run `./scripts/security-update.sh`
- [ ] Verify `npm audit` shows 0 vulnerabilities
- [ ] Run tests: `npm test`
- [ ] Build project: `npm run build`
- [ ] Test application manually
- [ ] Commit changes
- [ ] Push to repository
- [ ] Monitor for issues

## 🎯 Expected Outcome

**Before**: 27 vulnerabilities (1 critical, 8 high, 18 medium)  
**After**: 0-2 vulnerabilities (unreachable only)

---

**Time Required**: 15-30 minutes  
**Difficulty**: Easy  
**Risk**: Low (with testing)

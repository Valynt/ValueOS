# ValueOS Cleanup - Quick Reference Guide

**Quick commands to clean up the ValueOS repository**

---

## 🚀 Quick Start

### Option 1: Dry Run First (Recommended)
```bash
cd /home/ubuntu
./cleanup-valueos.sh --dry-run
```

### Option 2: Apply Changes
```bash
cd /home/ubuntu
./cleanup-valueos.sh
```

---

## 📋 What Gets Cleaned

### ✅ Deleted (15 files)
- `compose.yml.tmp`
- `migration_log.txt`
- `migration_pid.txt`
- `dev-env-report.txt`
- `tsconfig-list.txt`
- `abc.sql`
- `node-v20.20.0-linux-x64.tar.xz`

### 📦 Archived (6 files → `.archive/`)
- `DEV_ENV_REVIEW.md`
- `DX_FIX_SUMMARY.md`
- `FRONTEND_REVIEW.md`
- `PERFORMANCE_PROFILE_REPORT.md`
- `SECURITY_AUDIT_REPORT.md`
- `supabase.FILE_BACKUP`

### 🔄 Consolidated
- Docker compose files: 8 → 4 files

---

## 🗂️ Scripts Reorganization

### Run Dry Run
```bash
cd /home/ubuntu
./reorganize-scripts.sh --dry-run
```

### Apply Reorganization
```bash
cd /home/ubuntu
./reorganize-scripts.sh
```

### Result
252 scripts organized into 9 categories:
- `build/` - Build scripts
- `deploy/` - Deployment scripts
- `database/` - Database operations
- `testing/` - Testing scripts
- `monitoring/` - Monitoring scripts
- `security/` - Security scripts
- `dx/` - Developer experience
- `utils/` - Utilities
- `bin/` - Executables

---

## 📚 Documentation Deployment

### Deploy Consolidated Docs
```bash
cd /home/ubuntu/ValueOS
mv docs docs-old
cp -r /home/ubuntu/valueos-consolidated-docs docs
mkdir -p .archive
mv docs-old .archive/
```

---

## 🔍 Manual Review Items

### 1. Test Directories
```bash
cd /home/ubuntu/ValueOS
diff -r test/ tests/
# If safe to merge:
rsync -av test/ tests/
rm -rf test/
```

### 2. Terraform Directories
```bash
cd /home/ubuntu/ValueOS/infra
diff -r terraform/ terraform-new/
# If terraform-new is newer:
mv terraform terraform-old
mv terraform-new terraform
mv terraform-old ../.archive/infra/
```

### 3. Config File Standardization
```bash
cd /home/ubuntu/ValueOS
# Rename .cjs to .js (if no CommonJS specific needed)
mv prettier.config.cjs prettier.config.js
mv update_clients.cjs update_clients.js
mv verify_anon.cjs verify_anon.js
mv verify_token.cjs verify_token.js
```

---

## ✅ Verification

### Check Git Status
```bash
cd /home/ubuntu/ValueOS
git status
```

### Test Application
```bash
cd /home/ubuntu/ValueOS
pnpm install
pnpm build
pnpm test
```

### Commit Changes
```bash
cd /home/ubuntu/ValueOS
git add -A
git commit -m "chore: cleanup repository structure

- Remove temporary and stale files
- Archive old reports
- Consolidate docker-compose files
- Reorganize scripts into categories
- Deploy consolidated documentation"
```

---

## 📊 Expected Results

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Root files | 75+ | 60 | -15 (-20%) |
| Scripts org | Flat (252) | 9 categories | +9 dirs |
| Docker compose | 8 files | 4 files | -4 (-50%) |
| Documentation | 328 files | 54 files | -274 (-83.5%) |

---

## 🆘 Rollback

### If Something Goes Wrong

```bash
cd /home/ubuntu/ValueOS

# Restore from archive
cp -r .archive/* .

# Or use git
git reset --hard HEAD
git clean -fd

# Or restore from backup (if created)
# tar -xzf valueos-backup-YYYYMMDD.tar.gz
```

---

## 📖 Full Documentation

For detailed analysis and recommendations:
- `/home/ubuntu/VALUEOS_ORGANIZATION_RECOMMENDATIONS.md`

For automation scripts:
- `/home/ubuntu/cleanup-valueos.sh`
- `/home/ubuntu/reorganize-scripts.sh`

---

## 🎯 Priority Order

### Week 1 (Quick Wins)
1. ✅ Run cleanup script: `./cleanup-valueos.sh`
2. ✅ Verify changes: `git status`
3. ✅ Test application
4. ✅ Commit changes

### Week 2 (Scripts)
1. ⬜ Run reorganization: `./reorganize-scripts.sh`
2. ⬜ Update CI/CD references
3. ⬜ Test scripts
4. ⬜ Commit changes

### Week 3 (Infrastructure)
1. ⬜ Consolidate terraform directories
2. ⬜ Standardize config files
3. ⬜ Merge test directories
4. ⬜ Commit changes

### Week 4 (Documentation)
1. ⬜ Deploy consolidated docs
2. ⬜ Update links
3. ⬜ Archive old docs
4. ⬜ Commit changes

---

## 💡 Tips

- **Always run dry-run first**: `--dry-run` flag
- **Create backup before major changes**: `tar -czf backup.tar.gz ValueOS/`
- **Test after each phase**: Don't skip testing
- **Commit frequently**: Small, focused commits
- **Update documentation**: Keep docs in sync with changes

---

**Last Updated**: 2026-02-08  
**Repository**: /home/ubuntu/ValueOS

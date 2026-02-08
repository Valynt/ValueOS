# ValueOS File Promotion Checklist & Plan

**Generated**: 2026-02-08  
**Purpose**: Systematic promotion of refactored dev setup files into main repository

---

## 📊 Inventory Summary

| Repository | Files | Directories | Size |
|------------|-------|-------------|------|
| **Main ValueOS** | 4,315 | 1,200+ | ~70 MB |
| **Refactored Setup** | 115 | 45 | ~1.2 MB |

### Comparison Results

| Category | Count | Action Required |
|----------|-------|-----------------|
| **Duplicates** (identical) | 103 | Keep main, remove from refactored |
| **Conflicts** (different sizes) | 3 | Manual review & merge |
| **Refactored-only** (new files) | 9 | Promote to main |
| **Main-only** (relevant dirs) | 434 | Review for archival |

---

## ⚠️ CRITICAL: Conflicts Requiring Manual Review

### 3 Files with Different Sizes

These files exist in both repositories but have different content. **Manual review required before promotion.**

#### 1. `infra/scripts/apply_migrations.sh`
- **Main**: 4.05 KB (older version)
- **Refactored**: 9.14 KB (enhanced version with retry logic, validation)
- **Recommendation**: ✅ **PROMOTE** refactored version (has improvements)
- **Action**: Backup main version, replace with refactored

```bash
# Backup and promote
cp /home/ubuntu/ValueOS/infra/scripts/apply_migrations.sh \
   /home/ubuntu/ValueOS/.archive/apply_migrations.sh.backup
cp /home/ubuntu/valueos-dev-setup/infra/scripts/apply_migrations.sh \
   /home/ubuntu/ValueOS/infra/scripts/apply_migrations.sh
```

#### 2. `infra/postgres/migrations/20260208_rls_enforcement.sql`
- **Main**: 1.44 KB (basic version)
- **Refactored**: 9.69 KB (comprehensive RLS enforcement)
- **Recommendation**: ✅ **PROMOTE** refactored version (more complete)
- **Action**: Backup main version, replace with refactored

```bash
# Backup and promote
cp /home/ubuntu/ValueOS/infra/postgres/migrations/20260208_rls_enforcement.sql \
   /home/ubuntu/ValueOS/.archive/20260208_rls_enforcement.sql.backup
cp /home/ubuntu/valueos-dev-setup/infra/postgres/migrations/20260208_rls_enforcement.sql \
   /home/ubuntu/ValueOS/infra/postgres/migrations/20260208_rls_enforcement.sql
```

#### 3. `infra/prometheus/prometheus.yml`
- **Main**: 2.06 KB
- **Refactored**: 2.09 KB (minor differences)
- **Recommendation**: ⚠️ **DIFF & MERGE** (review differences)
- **Action**: Compare and merge manually

```bash
# Compare differences
diff /home/ubuntu/ValueOS/infra/prometheus/prometheus.yml \
     /home/ubuntu/valueos-dev-setup/infra/prometheus/prometheus.yml
```

---

## ✅ Files to PROMOTE (9 New Files)

These files exist only in the refactored setup and should be promoted to main repository.

### Migration & Database Scripts (5 files)

| File | Size | Destination | Priority |
|------|------|-------------|----------|
| `infra/scripts/supabase-migrate-all.sh` | 18 KB | `infra/scripts/` | 🔴 HIGH |
| `infra/scripts/validate-migrations.sh` | 8.9 KB | `infra/scripts/` | 🔴 HIGH |
| `infra/scripts/rollback-migration.sh` | 4.6 KB | `infra/scripts/` | 🔴 HIGH |
| `infra/scripts/migration-status.sh` | 4.9 KB | `infra/scripts/` | 🟡 MEDIUM |
| `.devcontainer/init-scripts/02-create-migrations-table.sh` | 1.5 KB | `.devcontainer/init-scripts/` | 🟡 MEDIUM |

**Action**:
```bash
# Copy migration scripts
cp /home/ubuntu/valueos-dev-setup/infra/scripts/supabase-migrate-all.sh \
   /home/ubuntu/ValueOS/infra/scripts/
cp /home/ubuntu/valueos-dev-setup/infra/scripts/validate-migrations.sh \
   /home/ubuntu/ValueOS/infra/scripts/
cp /home/ubuntu/valueos-dev-setup/infra/scripts/rollback-migration.sh \
   /home/ubuntu/ValueOS/infra/scripts/
cp /home/ubuntu/valueos-dev-setup/infra/scripts/migration-status.sh \
   /home/ubuntu/ValueOS/infra/scripts/

# Make executable
chmod +x /home/ubuntu/ValueOS/infra/scripts/*.sh
```

### Documentation (4 files)

| File | Size | Destination | Priority |
|------|------|-------------|----------|
| `MIGRATION_AUTOMATION_GUIDE.md` | 11.7 KB | `docs/operations/` | 🟡 MEDIUM |
| `MIGRATION_QUICK_REFERENCE.md` | 3.7 KB | `docs/operations/` | 🟡 MEDIUM |
| `SCAFFOLD_README.md` | 15.1 KB | `docs/getting-started/` | 🟢 LOW |
| `QUICKSTART.md` | 5.5 KB | `docs/getting-started/` | 🟡 MEDIUM |

**Action**:
```bash
# Copy documentation
mkdir -p /home/ubuntu/ValueOS/docs/operations
mkdir -p /home/ubuntu/ValueOS/docs/getting-started

cp /home/ubuntu/valueos-dev-setup/MIGRATION_AUTOMATION_GUIDE.md \
   /home/ubuntu/ValueOS/docs/operations/
cp /home/ubuntu/valueos-dev-setup/MIGRATION_QUICK_REFERENCE.md \
   /home/ubuntu/ValueOS/docs/operations/
cp /home/ubuntu/valueos-dev-setup/SCAFFOLD_README.md \
   /home/ubuntu/ValueOS/docs/getting-started/
cp /home/ubuntu/valueos-dev-setup/QUICKSTART.md \
   /home/ubuntu/ValueOS/docs/getting-started/
```

---

## 📦 Files to KEEP in Main (103 Duplicates)

These files are identical in both repositories. **No action needed** - keep main versions.

### Sample Duplicates (showing 20 of 103)

- `package.json` (25.7 KB) ✅ Identical
- `pnpm-workspace.yaml` (0.16 KB) ✅ Identical
- `turbo.json` (1.45 KB) ✅ Identical
- `tsconfig.json` (0.67 KB) ✅ Identical
- `docker-compose.yml` (0.04 KB) ✅ Identical
- `.env.example` (2.61 KB) ✅ Identical
- `.devcontainer/docker-compose.yml` (17.4 KB) ✅ Identical
- `infra/docker/docker-compose.agents.yml` (2.76 KB) ✅ Identical
- `infra/postgres/migrations/20231101_initial_schema.sql` (12.3 KB) ✅ Identical
- ... (93 more identical files)

**Action**: None required. Main repository already has these files.

---

## 🗑️ Files to ARCHIVE from Main (434 Candidates)

These files exist in main repository in directories that overlap with refactored setup. Review for potential archival.

### High-Priority Review Categories

#### 1. Old Migration Scripts (Review for Deprecation)
- Files in `infra/scripts/` that may be superseded by new migration automation
- Check if functionality is covered by new scripts

#### 2. Old Docker Configurations (Consolidate)
- Multiple docker-compose variants
- Old Dockerfiles that may be outdated

#### 3. Deprecated Documentation (Already Addressed)
- Old docs should be replaced with consolidated versions

---

## 📋 Step-by-Step Promotion Plan

### Phase 1: Preparation (10 minutes)

```bash
# 1. Create backup of main repository
cd /home/ubuntu
tar -czf ValueOS-backup-$(date +%Y%m%d).tar.gz ValueOS/

# 2. Create archive directory in main repo
mkdir -p /home/ubuntu/ValueOS/.archive/refactored-promotion

# 3. Verify refactored setup is complete
ls -la /home/ubuntu/valueos-dev-setup/
```

### Phase 2: Resolve Conflicts (15 minutes)

```bash
# 1. Backup conflicting files from main
cd /home/ubuntu/ValueOS
cp infra/scripts/apply_migrations.sh .archive/refactored-promotion/
cp infra/postgres/migrations/20260208_rls_enforcement.sql .archive/refactored-promotion/
cp infra/prometheus/prometheus.yml .archive/refactored-promotion/

# 2. Promote improved versions
cp /home/ubuntu/valueos-dev-setup/infra/scripts/apply_migrations.sh \
   infra/scripts/apply_migrations.sh
cp /home/ubuntu/valueos-dev-setup/infra/postgres/migrations/20260208_rls_enforcement.sql \
   infra/postgres/migrations/20260208_rls_enforcement.sql

# 3. Manually review and merge prometheus.yml
diff .archive/refactored-promotion/prometheus.yml \
     /home/ubuntu/valueos-dev-setup/infra/prometheus/prometheus.yml
# (Manual merge based on diff results)
```

### Phase 3: Promote New Files (10 minutes)

```bash
cd /home/ubuntu/ValueOS

# 1. Promote migration scripts
cp /home/ubuntu/valueos-dev-setup/infra/scripts/supabase-migrate-all.sh infra/scripts/
cp /home/ubuntu/valueos-dev-setup/infra/scripts/validate-migrations.sh infra/scripts/
cp /home/ubuntu/valueos-dev-setup/infra/scripts/rollback-migration.sh infra/scripts/
cp /home/ubuntu/valueos-dev-setup/infra/scripts/migration-status.sh infra/scripts/
chmod +x infra/scripts/*.sh

# 2. Promote init scripts
mkdir -p .devcontainer/init-scripts
cp /home/ubuntu/valueos-dev-setup/.devcontainer/init-scripts/02-create-migrations-table.sh \
   .devcontainer/init-scripts/
chmod +x .devcontainer/init-scripts/*.sh

# 3. Promote documentation
mkdir -p docs/operations docs/getting-started
cp /home/ubuntu/valueos-dev-setup/MIGRATION_AUTOMATION_GUIDE.md docs/operations/
cp /home/ubuntu/valueos-dev-setup/MIGRATION_QUICK_REFERENCE.md docs/operations/
cp /home/ubuntu/valueos-dev-setup/SCAFFOLD_README.md docs/getting-started/
cp /home/ubuntu/valueos-dev-setup/QUICKSTART.md docs/getting-started/
```

### Phase 4: Verification (10 minutes)

```bash
cd /home/ubuntu/ValueOS

# 1. Check git status
git status

# 2. Verify new files are present
ls -lh infra/scripts/supabase-migrate-all.sh
ls -lh infra/scripts/validate-migrations.sh
ls -lh docs/operations/MIGRATION_AUTOMATION_GUIDE.md

# 3. Test migration scripts
./infra/scripts/migration-status.sh --help
./infra/scripts/validate-migrations.sh --help

# 4. Run application tests
pnpm install
pnpm build
pnpm test
```

### Phase 5: Commit Changes (5 minutes)

```bash
cd /home/ubuntu/ValueOS

# 1. Stage changes
git add -A

# 2. Commit with detailed message
git commit -m "feat: promote refactored dev setup to main repository

- Enhanced migration scripts with retry logic and validation
- Comprehensive RLS enforcement migration
- New migration automation tools (supabase-migrate-all.sh, validate-migrations.sh, rollback-migration.sh)
- Updated documentation for migration workflows
- Resolved 3 file conflicts (promoted improved versions)
- Added 9 new files from refactored setup

Breaking changes: None
Tested: Migration scripts, application build, tests passing"

# 3. Push to remote (if ready)
# git push origin main
```

---

## 🔍 Automated Promotion Script

For convenience, here's an automated script to execute the promotion:

```bash
#!/bin/bash
# promote-refactored-setup.sh

set -e

MAIN_REPO="/home/ubuntu/ValueOS"
REFACTORED="/home/ubuntu/valueos-dev-setup"
BACKUP_DIR="$MAIN_REPO/.archive/refactored-promotion-$(date +%Y%m%d-%H%M%S)"

echo "=========================================="
echo "ValueOS Refactored Setup Promotion"
echo "=========================================="
echo

# Create backup
echo "Creating backup..."
mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/main-repo-backup.tar.gz" "$MAIN_REPO"
echo "✅ Backup created: $BACKUP_DIR/main-repo-backup.tar.gz"

# Backup conflicting files
echo
echo "Backing up conflicting files..."
cp "$MAIN_REPO/infra/scripts/apply_migrations.sh" "$BACKUP_DIR/"
cp "$MAIN_REPO/infra/postgres/migrations/20260208_rls_enforcement.sql" "$BACKUP_DIR/"
cp "$MAIN_REPO/infra/prometheus/prometheus.yml" "$BACKUP_DIR/"
echo "✅ Conflicting files backed up"

# Promote improved versions
echo
echo "Promoting improved versions..."
cp "$REFACTORED/infra/scripts/apply_migrations.sh" \
   "$MAIN_REPO/infra/scripts/apply_migrations.sh"
cp "$REFACTORED/infra/postgres/migrations/20260208_rls_enforcement.sql" \
   "$MAIN_REPO/infra/postgres/migrations/20260208_rls_enforcement.sql"
echo "✅ Improved versions promoted"

# Promote new files
echo
echo "Promoting new files..."
cp "$REFACTORED/infra/scripts/supabase-migrate-all.sh" "$MAIN_REPO/infra/scripts/"
cp "$REFACTORED/infra/scripts/validate-migrations.sh" "$MAIN_REPO/infra/scripts/"
cp "$REFACTORED/infra/scripts/rollback-migration.sh" "$MAIN_REPO/infra/scripts/"
cp "$REFACTORED/infra/scripts/migration-status.sh" "$MAIN_REPO/infra/scripts/"
chmod +x "$MAIN_REPO/infra/scripts/"*.sh

mkdir -p "$MAIN_REPO/.devcontainer/init-scripts"
cp "$REFACTORED/.devcontainer/init-scripts/02-create-migrations-table.sh" \
   "$MAIN_REPO/.devcontainer/init-scripts/"
chmod +x "$MAIN_REPO/.devcontainer/init-scripts/"*.sh

mkdir -p "$MAIN_REPO/docs/operations" "$MAIN_REPO/docs/getting-started"
cp "$REFACTORED/MIGRATION_AUTOMATION_GUIDE.md" "$MAIN_REPO/docs/operations/"
cp "$REFACTORED/MIGRATION_QUICK_REFERENCE.md" "$MAIN_REPO/docs/operations/"
cp "$REFACTORED/SCAFFOLD_README.md" "$MAIN_REPO/docs/getting-started/"
cp "$REFACTORED/QUICKSTART.md" "$MAIN_REPO/docs/getting-started/"
echo "✅ New files promoted"

# Verification
echo
echo "Verifying promotion..."
cd "$MAIN_REPO"
git status | head -20

echo
echo "=========================================="
echo "Promotion Complete!"
echo "=========================================="
echo
echo "Next steps:"
echo "  1. Review changes: cd $MAIN_REPO && git status"
echo "  2. Test application: pnpm install && pnpm build && pnpm test"
echo "  3. Commit changes: git add -A && git commit -m 'feat: promote refactored dev setup'"
echo
echo "Backup location: $BACKUP_DIR"
echo "=========================================="
```

---

## 📊 Promotion Impact Summary

### Files Added to Main Repository
- **9 new files** (migration scripts + documentation)
- **3 improved files** (replaced with better versions)
- **Total**: 12 file changes

### Expected Benefits
- ✅ **Enhanced migration automation** with retry logic and validation
- ✅ **Comprehensive RLS enforcement** for tenant isolation
- ✅ **Better documentation** for migration workflows
- ✅ **Improved developer experience** with new tooling
- ✅ **No breaking changes** - all improvements are additive

### Risk Assessment
- **Risk Level**: 🟢 LOW
- **Reason**: All changes are improvements or additions, no deletions
- **Mitigation**: Full backup created before promotion

---

## ✅ Decision Checklist

Use this checklist to track promotion progress:

### Pre-Promotion
- [ ] Review this document completely
- [ ] Backup main repository
- [ ] Verify refactored setup is complete
- [ ] Review conflict files manually

### Conflict Resolution
- [ ] Backup `apply_migrations.sh` from main
- [ ] Promote improved `apply_migrations.sh`
- [ ] Backup `20260208_rls_enforcement.sql` from main
- [ ] Promote improved `20260208_rls_enforcement.sql`
- [ ] Review and merge `prometheus.yml` differences

### File Promotion
- [ ] Promote `supabase-migrate-all.sh`
- [ ] Promote `validate-migrations.sh`
- [ ] Promote `rollback-migration.sh`
- [ ] Promote `migration-status.sh`
- [ ] Promote `02-create-migrations-table.sh`
- [ ] Promote migration documentation (2 files)
- [ ] Promote getting-started documentation (2 files)
- [ ] Make all scripts executable

### Verification
- [ ] Check git status
- [ ] Verify new files are present
- [ ] Test migration scripts
- [ ] Run `pnpm install`
- [ ] Run `pnpm build`
- [ ] Run `pnpm test`

### Finalization
- [ ] Review all changes in git
- [ ] Commit with descriptive message
- [ ] Push to remote (when ready)
- [ ] Update team documentation
- [ ] Announce changes to team

---

## 🆘 Rollback Plan

If something goes wrong during promotion:

```bash
# Option 1: Restore from backup
cd /home/ubuntu
tar -xzf ValueOS-backup-YYYYMMDD.tar.gz

# Option 2: Use git to revert
cd /home/ubuntu/ValueOS
git reset --hard HEAD
git clean -fd

# Option 3: Restore specific files from archive
cp .archive/refactored-promotion/apply_migrations.sh infra/scripts/
cp .archive/refactored-promotion/20260208_rls_enforcement.sql infra/postgres/migrations/
```

---

## 📖 Additional Resources

- **Full Inventory**: `/tmp/inventory_main.json`, `/tmp/inventory_refactored.json`
- **Comparison Data**: `/tmp/comparison.json`
- **Organization Recommendations**: `/home/ubuntu/VALUEOS_ORGANIZATION_RECOMMENDATIONS.md`
- **Cleanup Scripts**: `/home/ubuntu/cleanup-valueos.sh`, `/home/ubuntu/reorganize-scripts.sh`

---

**Last Updated**: 2026-02-08  
**Status**: Ready for execution  
**Estimated Time**: 50 minutes total  
**Risk Level**: 🟢 LOW (with backups)

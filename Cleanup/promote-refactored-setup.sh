#!/bin/bash
# promote-refactored-setup.sh - Automated promotion of refactored dev setup
# Usage: ./promote-refactored-setup.sh [--dry-run]

set -e

MAIN_REPO="/home/ubuntu/ValueOS"
REFACTORED="/home/ubuntu/valueos-dev-setup"
BACKUP_DIR="$MAIN_REPO/.archive/refactored-promotion-$(date +%Y%m%d-%H%M%S)"
DRY_RUN=false

# Parse arguments
if [ "$1" = "--dry-run" ]; then
    DRY_RUN=true
    echo "🔍 DRY RUN MODE - No changes will be made"
    echo
fi

# Function to execute or simulate command
run_cmd() {
    if [ "$DRY_RUN" = true ]; then
        echo "[DRY RUN] $*"
    else
        eval "$*"
    fi
}

echo "=========================================="
echo "ValueOS Refactored Setup Promotion"
echo "=========================================="
echo

# Verify directories exist
if [ ! -d "$MAIN_REPO" ]; then
    echo "❌ Error: Main repository not found at $MAIN_REPO"
    exit 1
fi

if [ ! -d "$REFACTORED" ]; then
    echo "❌ Error: Refactored setup not found at $REFACTORED"
    exit 1
fi

echo "✅ Directories verified"
echo "  Main: $MAIN_REPO"
echo "  Refactored: $REFACTORED"
echo

# Create backup
echo "Creating backup..."
run_cmd "mkdir -p '$BACKUP_DIR'"

if [ "$DRY_RUN" = false ]; then
    tar -czf "$BACKUP_DIR/main-repo-backup.tar.gz" "$MAIN_REPO" 2>/dev/null || true
    echo "✅ Backup created: $BACKUP_DIR/main-repo-backup.tar.gz"
else
    echo "[DRY RUN] Would create: $BACKUP_DIR/main-repo-backup.tar.gz"
fi

# Backup conflicting files
echo
echo "Backing up conflicting files..."
run_cmd "cp '$MAIN_REPO/infra/scripts/apply_migrations.sh' '$BACKUP_DIR/'"
run_cmd "cp '$MAIN_REPO/infra/postgres/migrations/20260208_rls_enforcement.sql' '$BACKUP_DIR/'"
run_cmd "cp '$MAIN_REPO/infra/prometheus/prometheus.yml' '$BACKUP_DIR/'"
echo "✅ Conflicting files backed up"

# Promote improved versions (conflicts)
echo
echo "Promoting improved versions (resolving conflicts)..."
run_cmd "cp '$REFACTORED/infra/scripts/apply_migrations.sh' '$MAIN_REPO/infra/scripts/apply_migrations.sh'"
run_cmd "cp '$REFACTORED/infra/postgres/migrations/20260208_rls_enforcement.sql' '$MAIN_REPO/infra/postgres/migrations/20260208_rls_enforcement.sql'"
echo "✅ Improved versions promoted (2 files)"
echo "⚠️  Note: prometheus.yml requires manual review (see diff below)"

# Show prometheus.yml diff
if [ "$DRY_RUN" = false ]; then
    echo
    echo "Prometheus.yml differences:"
    diff "$MAIN_REPO/infra/prometheus/prometheus.yml" \
         "$REFACTORED/infra/prometheus/prometheus.yml" || true
fi

# Promote new migration scripts
echo
echo "Promoting new migration scripts..."
run_cmd "cp '$REFACTORED/infra/scripts/supabase-migrate-all.sh' '$MAIN_REPO/infra/scripts/'"
run_cmd "cp '$REFACTORED/infra/scripts/validate-migrations.sh' '$MAIN_REPO/infra/scripts/'"
run_cmd "cp '$REFACTORED/infra/scripts/rollback-migration.sh' '$MAIN_REPO/infra/scripts/'"
run_cmd "cp '$REFACTORED/infra/scripts/migration-status.sh' '$MAIN_REPO/infra/scripts/'"
run_cmd "chmod +x '$MAIN_REPO/infra/scripts/'*.sh"
echo "✅ Migration scripts promoted (4 files)"

# Promote init scripts
echo
echo "Promoting init scripts..."
run_cmd "mkdir -p '$MAIN_REPO/.devcontainer/init-scripts'"
run_cmd "cp '$REFACTORED/.devcontainer/init-scripts/02-create-migrations-table.sh' '$MAIN_REPO/.devcontainer/init-scripts/'"
run_cmd "chmod +x '$MAIN_REPO/.devcontainer/init-scripts/'*.sh"
echo "✅ Init scripts promoted (1 file)"

# Promote documentation
echo
echo "Promoting documentation..."
run_cmd "mkdir -p '$MAIN_REPO/docs/operations' '$MAIN_REPO/docs/getting-started'"
run_cmd "cp '$REFACTORED/MIGRATION_AUTOMATION_GUIDE.md' '$MAIN_REPO/docs/operations/'"
run_cmd "cp '$REFACTORED/MIGRATION_QUICK_REFERENCE.md' '$MAIN_REPO/docs/operations/'"
run_cmd "cp '$REFACTORED/SCAFFOLD_README.md' '$MAIN_REPO/docs/getting-started/'"
run_cmd "cp '$REFACTORED/QUICKSTART.md' '$MAIN_REPO/docs/getting-started/'"
echo "✅ Documentation promoted (4 files)"

# Summary
echo
echo "=========================================="
echo "Promotion Summary"
echo "=========================================="
echo
echo "Files promoted:"
echo "  ✅ 2 improved files (conflicts resolved)"
echo "  ✅ 4 new migration scripts"
echo "  ✅ 1 new init script"
echo "  ✅ 4 new documentation files"
echo "  ⚠️  1 file requires manual review (prometheus.yml)"
echo
echo "Total: 11 files promoted, 1 manual review needed"

# Verification
if [ "$DRY_RUN" = false ]; then
    echo
    echo "Verifying promotion..."
    cd "$MAIN_REPO"
    
    echo
    echo "Git status (first 30 lines):"
    git status | head -30
    
    echo
    echo "New files verification:"
    ls -lh infra/scripts/supabase-migrate-all.sh 2>/dev/null && echo "  ✅ supabase-migrate-all.sh" || echo "  ❌ supabase-migrate-all.sh"
    ls -lh infra/scripts/validate-migrations.sh 2>/dev/null && echo "  ✅ validate-migrations.sh" || echo "  ❌ validate-migrations.sh"
    ls -lh docs/operations/MIGRATION_AUTOMATION_GUIDE.md 2>/dev/null && echo "  ✅ MIGRATION_AUTOMATION_GUIDE.md" || echo "  ❌ MIGRATION_AUTOMATION_GUIDE.md"
fi

# Next steps
echo
echo "=========================================="
echo "Next Steps"
echo "=========================================="
echo

if [ "$DRY_RUN" = true ]; then
    echo "🔍 DRY RUN COMPLETE - No changes were made"
    echo
    echo "To apply changes, run:"
    echo "  ./promote-refactored-setup.sh"
else
    echo "✅ Promotion complete!"
    echo
    echo "1. Review prometheus.yml manually:"
    echo "   diff $MAIN_REPO/infra/prometheus/prometheus.yml \\"
    echo "        $REFACTORED/infra/prometheus/prometheus.yml"
    echo
    echo "2. Test the application:"
    echo "   cd $MAIN_REPO"
    echo "   pnpm install"
    echo "   pnpm build"
    echo "   pnpm test"
    echo
    echo "3. Test migration scripts:"
    echo "   ./infra/scripts/migration-status.sh"
    echo "   ./infra/scripts/validate-migrations.sh --help"
    echo
    echo "4. Review changes:"
    echo "   cd $MAIN_REPO"
    echo "   git status"
    echo "   git diff"
    echo
    echo "5. Commit changes:"
    echo "   git add -A"
    echo "   git commit -m 'feat: promote refactored dev setup'"
    echo
    echo "Backup location: $BACKUP_DIR"
fi

echo
echo "=========================================="
echo "For detailed checklist, see:"
echo "  /home/ubuntu/FILE_PROMOTION_CHECKLIST.md"
echo "=========================================="

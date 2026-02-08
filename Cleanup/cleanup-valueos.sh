#!/bin/bash
# cleanup-valueos.sh - Automated cleanup for ValueOS repository
# Usage: ./cleanup-valueos.sh [--dry-run]

set -e

REPO_DIR="/workspaces/ValueOS"
ARCHIVE_DIR="$REPO_DIR/.archive"
DRY_RUN=false

# Parse arguments
if [ "$1" = "--dry-run" ]; then
    DRY_RUN=true
    echo "🔍 DRY RUN MODE - No changes will be made"
    echo
fi

echo "=========================================="
echo "ValueOS Repository Cleanup"
echo "=========================================="
echo

# Function to execute or simulate command
run_cmd() {
    if [ "$DRY_RUN" = true ]; then
        echo "[DRY RUN] $*"
    else
        eval "$*"
    fi
}

# Create archive directory
echo "Creating archive directory..."
run_cmd "mkdir -p '$ARCHIVE_DIR'"

# Phase 1: Delete temporary files
echo
echo "Phase 1: Removing temporary files..."
echo "--------------------------------------"
cd "$REPO_DIR"

TEMP_FILES=(
    "compose.yml.tmp"
    "migration_log.txt"
    "migration_pid.txt"
    "dev-env-report.txt"
    "tsconfig-list.txt"
    "abc.sql"
    "node-v20.20.0-linux-x64.tar.xz"
)

for file in "${TEMP_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  Removing: $file"
        run_cmd "rm -f '$file'"
    fi
done

echo "✅ Temporary files removed"

# Phase 2: Archive old reports
echo
echo "Phase 2: Archiving old reports..."
echo "--------------------------------------"

ARCHIVE_FILES=(
    "DEV_ENV_REVIEW.md"
    "DX_FIX_SUMMARY.md"
    "FRONTEND_REVIEW.md"
    "PERFORMANCE_PROFILE_REPORT.md"
    "SECURITY_AUDIT_REPORT.md"
    "supabase.FILE_BACKUP"
)

for file in "${ARCHIVE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  Archiving: $file"
        run_cmd "mv '$file' '$ARCHIVE_DIR/'"
    fi
done

echo "✅ Old reports archived"

# Phase 3: Consolidate docker-compose files
echo
echo "Phase 3: Consolidating docker-compose files..."
echo "--------------------------------------"

if [ -f "compose.override.yml" ] && [ -f "compose.devcontainer.override.yml" ]; then
    echo "  Creating compose.dev.yml..."
    if [ "$DRY_RUN" = false ]; then
        cat compose.override.yml compose.devcontainer.override.yml > compose.dev.yml
    else
        echo "[DRY RUN] cat compose.override.yml compose.devcontainer.override.yml > compose.dev.yml"
    fi
fi

# Remove redundant files
REDUNDANT_COMPOSE=(
    "docker-compose.yml"
    "docker-compose.override.yml"
)

for file in "${REDUNDANT_COMPOSE[@]}"; do
    if [ -f "$file" ]; then
        # Check if file is minimal (< 100 bytes)
        size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
        if [ "$size" -lt 100 ]; then
            echo "  Removing minimal file: $file ($size bytes)"
            run_cmd "rm -f '$file'"
        else
            echo "  ⚠️  Skipping $file (not minimal: $size bytes)"
        fi
    fi
done

echo "✅ Docker compose files consolidated"

# Phase 4: Analyze test directories
echo
echo "Phase 4: Analyzing test directories..."
echo "--------------------------------------"

if [ -d "test" ] && [ -d "tests" ]; then
    echo "⚠️  Both test/ and tests/ exist"
    
    test_count=$(find test -type f | wc -l)
    tests_count=$(find tests -type f | wc -l)
    
    echo "  test/: $test_count files"
    echo "  tests/: $tests_count files"
    echo
    echo "  Manual review recommended:"
    echo "    diff -r test/ tests/"
    echo
    echo "  To merge (after review):"
    echo "    rsync -av test/ tests/"
    echo "    rm -rf test/"
else
    echo "✅ No duplicate test directories"
fi

# Phase 5: Identify large directories
echo
echo "Phase 5: Large directory analysis..."
echo "--------------------------------------"

echo "  Top 10 largest directories:"
du -sh */ 2>/dev/null | sort -rh | head -10 | while read size dir; do
    echo "    $size  $dir"
done

# Phase 6: Stale file report
echo
echo "Phase 6: Stale file report..."
echo "--------------------------------------"

echo "  Files with 'old', 'backup', 'tmp' in name:"
find . -maxdepth 3 -type f \( -name "*old*" -o -name "*backup*" -o -name "*tmp*" \) \
    ! -path "*/node_modules/*" ! -path "*/.git/*" 2>/dev/null | head -10 | while read file; do
    echo "    $file"
done

# Summary
echo
echo "=========================================="
echo "Cleanup Summary"
echo "=========================================="
echo

if [ "$DRY_RUN" = true ]; then
    echo "🔍 DRY RUN COMPLETE - No changes were made"
    echo
    echo "To apply changes, run:"
    echo "  ./cleanup-valueos.sh"
else
    echo "✅ Cleanup complete!"
    echo
    echo "Changes made:"
    echo "  - Temporary files removed"
    echo "  - Old reports archived to $ARCHIVE_DIR"
    echo "  - Docker compose files consolidated"
    echo
    echo "Next steps:"
    echo "  1. Review changes: cd $REPO_DIR && git status"
    echo "  2. Test the application"
    echo "  3. Commit: git add -A && git commit -m 'chore: cleanup repository'"
fi

echo
echo "Archived files location: $ARCHIVE_DIR"
echo
echo "For full recommendations, see:"
echo "  /home/ubuntu/VALUEOS_ORGANIZATION_RECOMMENDATIONS.md"
echo
echo "=========================================="

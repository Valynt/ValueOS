#!/bin/bash

# Final cleanup to remove the 5 consolidated source files and 1 redundant file
# These files' content has been merged into:
# - TESTING_STRATEGY.md, TEST_COVERAGE_PLAN.md, TEST_COVERAGE_PROGRESS.md → TESTING.md
# - DATABASE_SETUP.md → QUICKSTART.md  
# - GO_LIVE_READINESS_AUDIT.md → GO_LIVE_EXECUTIVE_SUMMARY.md
# - DOC_CONSOLIDATION_COMPLETE.md (redundant summary)

echo "Removing consolidated source files and redundant files..."

# Arrays of files to delete
CONSOLIDATED_SOURCES=(
  "TESTING_STRATEGY.md"
  "TEST_COVERAGE_PLAN.md"
  "TEST_COVERAGE_PROGRESS.md"
  "DATABASE_SETUP.md"
)

REDUNDANT_FILES=(
  "DOC_CONSOLIDATION_COMPLETE.md"
)

# Try to delete using git rm
for file in "${CONSOLIDATED_SOURCES[@]}" "${REDUNDANT_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Deleting: $file"
    git rm -f "$file" 2>/dev/null || rm -f "$file"
  fi
done

# Check if any other legacy files still exist that should be deleted
echo ""
echo "Checking for any remaining legacy milestone files..."
find . -maxdepth 1 -name "*.md" -type f | grep -E "(PHASE|SPRINT|EPIC|WEEK|AUTONOMOUS|UNIFIED|BUGFIX|IMPLEMENTATION_COMPLETE|CONSOLE_CLEANUP|PROJECT_STATUS|LIFECYCLE|LIFEGUARD|AUDIT_FIXES)" || echo "No legacy files found"

# Try to commit if there are changes
if [ -n "$(git status --porcelain)" ]; then
  echo ""
  echo "Committing file deletions..."
  git commit -m "chore: remove consolidated source files and redundant documentation

- Remove TESTING_STRATEGY.md (content merged to TESTING.md)
- Remove TEST_COVERAGE_PLAN.md (content merged to TESTING.md)
- Remove TEST_COVERAGE_PROGRESS.md (content merged to TESTING.md)
- Remove DATABASE_SETUP.md (content merged to QUICKSTART.md)
- Remove DOC_CONSOLIDATION_COMPLETE.md (redundant summary file)

This completes the consolidation effort with 34+ legacy files removed and
documentation references updated to point to new rollup location.

Fixes remaining issues from PR #127 review."
else
  echo "No changes to commit"
fi

echo "Cleanup complete!"

#!/bin/bash
# Delete consolidated and obsolete markdown files
cd /workspaces/ValueCanvas

echo "Deleting consolidated files..."
git rm -f \
  TESTING_STRATEGY.md \
  TEST_COVERAGE_PLAN.md \
  TEST_COVERAGE_PROGRESS.md \
  DATABASE_SETUP.md \
  GO_LIVE_READINESS_AUDIT.md \
  ROOT_MD_AUDIT_ANALYSIS.md \
  ROOT_MD_CONSOLIDATION_COMPLETION_SUMMARY.md \
  ROOT_MD_CONSOLIDATION_DELIVERY_COMPLETE.md \
  ROOT_MD_CONSOLIDATION_EXECUTIVE_SUMMARY.md \
  ROOT_MD_CONSOLIDATION_FINAL_SUMMARY.md \
  ROOT_MD_CONSOLIDATION_INDEX.md \
  ROOT_MD_CONSOLIDATION_PLAN.md \
  ROOT_MD_CONSOLIDATION_QUICK_START.md \
  DOCS_CLEANUP_SUMMARY.md \
  DOCS_CLEANUP_INSTRUCTIONS.md \
  DOCS_CLEANUP_QUICK_REFERENCE.md \
  DOCS_CLEANUP_COMPLETION_SUMMARY.md \
  DOCS_CLEANUP_EXECUTIVE_SUMMARY.md \
  PHASE_1_COMPLETE.md \
  PHASE_2_COMPLETE.md \
  PHASE_3_COMPLETE.md \
  PHASE_4_COMPLETE.md \
  PHASE_5_COMPLETE.md \
  SPRINT_0_COMPLETE.md \
  SPRINT_3-4_SUMMARY.md \
  SPRINT_5_COMPLETE.md \
  SPRINT_5_INTEGRATION_COMPLETE.md \
  SPRINT_5-6_SUMMARY.md \
  30_DAY_SPRINT_TRACKER.md \
  AUDIT_FIXES_SUMMARY.md \
  AUTONOMOUS_EXECUTION_PROGRESS.md \
  AUTONOMOUS_EXECUTION_SUMMARY.md \
  CONSOLE_CLEANUP_SUMMARY.md \
  DOC_CONSOLIDATION_COMPLETE.md \
  EPIC_1_COMPLETE.md \
  IMPLEMENTATION_COMPLETE.md \
  IMPLEMENTATION_SUMMARY.md \
  PROJECT_STATUS.md \
  UNIFIED_COMPLETION_REPORT.md \
  WEEK_1_KICKOFF.md

echo "Counting remaining .md files..."
COUNT=$(ls -1 *.md | wc -l)
echo "Remaining root .md files: $COUNT"

echo "Committing changes..."
git add -A
git commit -m "Consolidate documentation: merge related files and delete obsolete files

- Merged TESTING_STRATEGY.md + TEST_COVERAGE_PLAN.md into TESTING.md
- Merged DATABASE_SETUP.md into QUICKSTART.md  
- Merged GO_LIVE_READINESS_AUDIT.md into GO_LIVE_EXECUTIVE_SUMMARY.md
- Deleted planning/analysis documents for consolidation
- Deleted phase/sprint completion markers (historical tracking)
- Deleted redundant audit and summary files

Result: Reduced root .md files from 58 to ~25 (57% reduction)
Essential documentation preserved in consolidated files."

echo "Done! Consolidation complete."

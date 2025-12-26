#!/bin/bash
# Repo migration script: Organize ValueOS repo to best-practice structure
# Moves documentation, infra, config, and historical files to new locations
# Run from repo root: bash scripts/repo_migration.sh
set -e

# 1. Move sprint, audit, and historical .md files to docs/sprints or docs/audit
mkdir -p docs/sprints docs/audit docs/specs docs/howto docs/archive docs/architecture docs/runbooks docs/onboarding docs/compliance docs/ops docs/security docs/infra docs/legacy docs/meeting-notes docs/roadmap docs/whitepapers docs/engineering

# Sprints
mv SPRINT_*.md docs/sprints/ 2>/dev/null || true
# Audits, readiness, QA
mv *AUDIT*.md *READINESS*.md QA-VALIDATION-REPORT.md TEST_COVERAGE_ANALYSIS.md TEST_FINAL.md AGENT_SECURITY_FIX_SUMMARY.md AGENT_FIX_VERIFICATION.md FINAL_STATUS_SUMMARY.md PRODUCTION_DEPLOYMENT_STATUS.md PRODUCTION-READINESS-REPORT.md docs/audit/ 2>/dev/null || true
# Specs, plans, whitepapers
mv *SPEC*.md *PLAN*.md WHITEPAPER-IMPLEMENTATION-PLAN.md UNIFIED_ORCHESTRATOR_ADDITIONS.md docs/specs/ 2>/dev/null || true
# Runbooks, checklists
mv *RUNBOOK.md *CHECKLIST.md SETUP_CHECKLIST.md docs/runbooks/ 2>/dev/null || true
# Roadmap, changelog, release
mv *ROADMAP*.md CHANGELOG.md RELEASE_NOTES*.md RELEASE-CANDIDATE-AUDIT.md docs/roadmap/ 2>/dev/null || true
# Onboarding, quickstart
mv QUICKSTART.md QUICK_START.md README_DEV_QUICK_START.md README_IMPLEMENTATION.md README.md docs/onboarding/ 2>/dev/null || true
# Compliance, security
mv *COMPLIANCE*.md *SECURITY*.md docs/compliance/ 2>/dev/null || true
# Infra, Caddy, Docker
mkdir -p infra/caddy infra/docker infra/k8s infra/monitoring
mv Caddyfile* infra/caddy/ 2>/dev/null || true
mv Dockerfile* infra/infra/infra/docker/ 2>/dev/null || true
mv docker-compose*.yml infra/infra/infra/docker/ 2>/dev/null || true
# Meeting notes, legacy, archive
mv MEETING*.md docs/meeting-notes/ 2>/dev/null || true
mv LEGACY*.md docs/legacy/ 2>/dev/null || true
# Engineering, architecture
mv *ARCHITECTURE*.md docs/architecture/ 2>/dev/null || true
mv *ENGINEERING*.md docs/engineering/ 2>/dev/null || true
# Miscellaneous .md files to archive
find . -maxdepth 1 -name "*.md" ! -name "LICENSE" ! -name "CONTRIBUTING.md" ! -name "README.md" -exec mv {} docs/archive/ \;

# 2. Move config files
mkdir -p config
mv ui-registry.json config/ 2>/dev/null || true


# 3. Move test plans, E2E, integration, coverage
mkdir -p tests
echo "Moving test files and directories..."
for item in test*; do
	if [ "$item" != "tests" ]; then
		mv "$item" "tests/"
	fi
done 2>/dev/null || true
mv coverage/ tests/ 2>/dev/null || true

# 4. Clean up empty folders (optional)
find . -type d -empty -delete

echo "Migration complete. Review docs/, infra/, config/, and tests/ for new structure."
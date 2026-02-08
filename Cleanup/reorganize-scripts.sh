#!/bin/bash
# reorganize-scripts.sh - Reorganize ValueOS scripts directory
# Usage: ./reorganize-scripts.sh [--dry-run]

set -e

SCRIPTS_DIR="/home/ubuntu/ValueOS/scripts"
DRY_RUN=false

if [ "$1" = "--dry-run" ]; then
    DRY_RUN=true
    echo "🔍 DRY RUN MODE - No changes will be made"
    echo
fi

echo "=========================================="
echo "ValueOS Scripts Reorganization"
echo "=========================================="
echo

cd "$SCRIPTS_DIR"

# Function to execute or simulate command
run_cmd() {
    if [ "$DRY_RUN" = true ]; then
        echo "[DRY RUN] $*"
    else
        eval "$*"
    fi
}

# Create new directory structure
echo "Creating directory structure..."
CATEGORIES=(
    "build"
    "deploy"
    "database"
    "testing"
    "monitoring"
    "security"
    "dx"
    "ci-cd"
    "utils"
    "bin"
)

for cat in "${CATEGORIES[@]}"; do
    run_cmd "mkdir -p '$cat'"
done

echo "✅ Directory structure created"
echo

# Move files by category
echo "Reorganizing scripts..."
echo

# Build scripts
echo "  📦 Build scripts..."
run_cmd "find . -maxdepth 1 -name 'build-*.sh' -exec mv {} build/ \;"
run_cmd "find . -maxdepth 1 -name '*build*.sh' -exec mv {} build/ \;"

# Deploy scripts
echo "  🚀 Deploy scripts..."
run_cmd "find . -maxdepth 1 -name '*deploy*.sh' -exec mv {} deploy/ \;"
run_cmd "find . -maxdepth 1 -name 'rollback*.sh' -exec mv {} deploy/ \;"

# Database scripts
echo "  🗄️  Database scripts..."
run_cmd "find . -maxdepth 1 -name '*migration*.sh' -exec mv {} database/ \;"
run_cmd "find . -maxdepth 1 -name '*backup*.sh' -exec mv {} database/ \;"
run_cmd "find . -maxdepth 1 -name '*seed*.sh' -exec mv {} database/ \;"
run_cmd "find . -maxdepth 1 -name 'apply-migrations.sh' -exec mv {} database/ \;"

# Testing scripts
echo "  🧪 Testing scripts..."
run_cmd "find . -maxdepth 1 -name '*test*.sh' -exec mv {} testing/ \;"
run_cmd "find . -maxdepth 1 -name '*test*.ts' -exec mv {} testing/ \;"
run_cmd "find . -maxdepth 1 -name 'chaos-*.sh' -exec mv {} testing/ \;"
run_cmd "find . -maxdepth 1 -name 'chaos-*.ts' -exec mv {} testing/ \;"

# Monitoring scripts
echo "  📊 Monitoring scripts..."
run_cmd "find . -maxdepth 1 -name '*monitor*.ts' -exec mv {} monitoring/ \;"
run_cmd "find . -maxdepth 1 -name '*health*.sh' -exec mv {} monitoring/ \;"
run_cmd "find . -maxdepth 1 -name '*metrics*.sh' -exec mv {} monitoring/ \;"

# Security scripts
echo "  🔒 Security scripts..."
run_cmd "find . -maxdepth 1 -name 'audit-*.sh' -exec mv {} security/ \;"
run_cmd "find . -maxdepth 1 -name 'audit-*.sql' -exec mv {} security/ \;"
run_cmd "find . -maxdepth 1 -name '*security*.sh' -exec mv {} security/ \;"

# DX scripts
echo "  🛠️  Developer Experience scripts..."
run_cmd "find . -maxdepth 1 -name 'check-env.sh' -exec mv {} dx/ \;"
run_cmd "find . -maxdepth 1 -name 'setup-*.sh' -exec mv {} dx/ \;"

# Utilities
echo "  🔧 Utility scripts..."
run_cmd "find . -maxdepth 1 -name 'analyze-*.ts' -exec mv {} utils/ \;"
run_cmd "find . -maxdepth 1 -name 'check-*.sh' -exec mv {} utils/ \;"
run_cmd "find . -maxdepth 1 -name 'update-*.js' -exec mv {} utils/ \;"
run_cmd "find . -maxdepth 1 -name 'verify-*.cjs' -exec mv {} utils/ \;"

echo
echo "✅ Scripts reorganized"
echo

# Generate README
echo "Generating README..."

if [ "$DRY_RUN" = false ]; then
    cat > README.md << 'READMEOF'
# ValueOS Scripts

This directory contains all operational scripts for the ValueOS project, organized by category.

## Directory Structure

### 📦 build/
Build and compilation scripts
- `build-docker.sh` - Build Docker images
- `build-with-retry.sh` - Build with retry logic
- `build-metrics.sh` - Collect build metrics

### 🚀 deploy/
Deployment scripts
- `blue-green-deploy.sh` - Blue-green deployment
- `canary-deploy.sh` - Canary deployment
- `rollback.sh` - Rollback deployment

### 🗄️ database/
Database operations
- `apply-migrations.sh` - Apply database migrations
- `backup-database.sh` - Backup database
- `backup-restore.sh` - Restore from backup
- `seed-data.sh` - Seed database with data

### 🧪 testing/
Testing and QA scripts
- `chaos-test.sh` - Chaos engineering tests
- `e2e-test.sh` - End-to-end tests
- `integration-test.sh` - Integration tests

### 📊 monitoring/
Observability and monitoring
- `brain-monitor.ts` - Brain monitoring
- `health-check.sh` - Health check
- `metrics-collector.sh` - Metrics collection

### 🔒 security/
Security and audit scripts
- `audit-logs.sh` - Audit logs
- `audit-rls-policies.sql` - Audit RLS policies
- `security-scan.sh` - Security scanning

### 🛠️ dx/
Developer experience scripts
- `check-env.sh` - Check environment
- `setup-dev.sh` - Setup development environment

### 🔧 utils/
Utility scripts
- `analyze-dependencies.ts` - Analyze dependencies
- `check-doc-paths.sh` - Check documentation paths
- `update-clients.js` - Update clients

### 🔗 bin/
Executable CLI tools (symlinks to main scripts)

## Usage

All scripts should be run from the repository root:

```bash
# Example: Run database migrations
./scripts/database/apply-migrations.sh

# Example: Run tests
./scripts/testing/e2e-test.sh
```

## Adding New Scripts

1. Place script in appropriate category directory
2. Make executable: `chmod +x scripts/category/script.sh`
3. Update this README
4. Document usage in script header

## Maintenance

- Keep scripts organized by category
- Add descriptive comments in scripts
- Update README when adding/removing scripts
- Test scripts before committing
READMEOF
    echo "✅ README generated"
else
    echo "[DRY RUN] README.md would be created"
fi

# Summary
echo
echo "=========================================="
echo "Reorganization Summary"
echo "=========================================="
echo

if [ "$DRY_RUN" = true ]; then
    echo "🔍 DRY RUN COMPLETE - No changes were made"
    echo
    echo "To apply changes, run:"
    echo "  ./reorganize-scripts.sh"
else
    echo "✅ Reorganization complete!"
    echo
    echo "Scripts organized into categories:"
    for cat in "${CATEGORIES[@]}"; do
        count=$(find "$cat" -type f 2>/dev/null | wc -l)
        echo "  $cat/: $count files"
    done
    echo
    echo "Next steps:"
    echo "  1. Review changes: cd $SCRIPTS_DIR && ls -la"
    echo "  2. Update CI/CD references to new paths"
    echo "  3. Test scripts in new locations"
    echo "  4. Commit: git add scripts/ && git commit -m 'refactor: reorganize scripts'"
fi

echo
echo "=========================================="

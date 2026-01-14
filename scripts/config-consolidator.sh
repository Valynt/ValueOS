#!/bin/bash

# ValueOS Configuration Consolidator
# Consolidates scattered configuration files into organized structure

set -euo pipefail

# Configuration
BACKUP_DIR="./config-backup-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="./config-consolidation.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

# Create backup
create_backup() {
    log "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"

    # Backup all configuration files
    cp .env* "$BACKUP_DIR/" 2>/dev/null || true
    cp docker-compose*.yml "$BACKUP_DIR/" 2>/dev/null || true
    cp vitest.config*.ts "$BACKUP_DIR/" 2>/dev/null || true
    cp package*.json "$BACKUP_DIR/" 2>/dev/null || true

    log_success "Configuration backup created"
}

# Consolidate environment files
consolidate_env_files() {
    log "Consolidating environment files..."

    # Create config directory structure
    mkdir -p config/environments

    # Create base environment template
    cat > config/environments/base.env << 'EOF'
# ValueOS Base Environment Configuration
# This file contains common environment variables used across all environments

# Application
NODE_ENV=development
VITE_APP_NAME=ValueOS
VITE_APP_VERSION=1.0.0

# Database
DATABASE_URL=postgresql://localhost:5432/valueos
DATABASE_POOL_SIZE=10
DATABASE_TIMEOUT=30000

# Supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Authentication
AUTH_SESSION_TIMEOUT=86400000
AUTH_REFRESH_TIMEOUT=604800000
AUTH_ENABLE_MFA=false

# API
VITE_API_URL=http://localhost:3000
API_TIMEOUT=30000
API_RETRY_ATTEMPTS=3

# Features
FEATURE_AGENTS=true
FEATURE_CANVAS=true
FEATURE_INTEGRATIONS=true
FEATURE_BILLING=false
FEATURE_MONITORING=true

# Monitoring
MONITORING_ENABLED=true
LOG_LEVEL=info
METRICS_ENABLED=true
METRICS_INTERVAL=60000

# Security
SECURITY_CORS=true
SECURITY_HELMET=true
SECURITY_RATE_LIMIT=true
JWT_SECRET=
ENCRYPTION_KEY=
EOF

    # Create environment-specific files
    local environments=("development" "staging" "production" "test")

    for env in "${environments[@]}"; do
        cat > "config/environments/${env}.env" << EOF
# ValueOS ${env^} Environment Configuration
# Inherits from base.env and overrides specific settings

NODE_ENV=${env}

# Environment-specific overrides
EOF

        # Add specific overrides based on environment
        case $env in
            "production")
                cat >> "config/environments/${env}.env" << 'EOF'
LOG_LEVEL=warn
MONITORING_ENABLED=true
SECURITY_CORS=true
SECURITY_HELMET=true
SECURITY_RATE_LIMIT=true
EOF
                ;;
            "development")
                cat >> "config/environments/${env}.env" << 'EOF'
LOG_LEVEL=debug
MONITORING_ENABLED=false
SECURITY_CORS=false
SECURITY_HELMET=false
SECURITY_RATE_LIMIT=false
EOF
                ;;
            "test")
                cat >> "config/environments/${env}.env" << 'EOF'
LOG_LEVEL=error
MONITORING_ENABLED=false
SECURITY_CORS=false
SECURITY_HELMET=false
SECURITY_RATE_LIMIT=false
EOF
                ;;
        esac
    done

    log_success "Environment files consolidated"
}

# Consolidate Docker configurations
consolidate_docker_files() {
    log "Consolidating Docker configurations..."

    # Create docker directory
    mkdir -p config/docker

    # Create base docker-compose.yml
    cat > config/docker/docker-compose.base.yml << 'EOF'
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=${NODE_ENV:-development}
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - database
      - redis

  database:
    image: postgres:15
    environment:
      POSTGRES_DB: valueos
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
EOF

    # Create environment-specific overrides
    cat > config/docker/docker-compose.override.yml << 'EOF'
# Development overrides
version: '3.8'

services:
  app:
    environment:
      - LOG_LEVEL=debug
    volumes:
      - .:/app
      - /app/node_modules

  database:
    ports:
      - "5432:5432"

  redis:
    ports:
      - "6379:6379"
EOF

    # Create production override
    cat > config/docker/docker-compose.prod.yml << 'EOF'
# Production overrides
version: '3.8'

services:
  app:
    environment:
      - LOG_LEVEL=warn
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

  database:
    ports: []  # Remove exposed ports in production
    restart: unless-stopped

  redis:
    ports: []  # Remove exposed ports in production
    restart: unless-stopped
EOF

    log_success "Docker configurations consolidated"
}

# Consolidate test configurations
consolidate_test_configs() {
    log "Consolidating test configurations..."

    # Create test config directory
    mkdir -p config/test

    # Create base vitest configuration
    cat > config/test/vitest.base.config.ts << 'EOF'
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
EOF

    # Create unit test configuration
    cat > config/test/vitest.unit.config.ts << 'EOF'
import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.base.config';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'src/**/*.{integration,e2e,performance}.{test,spec}.{ts,tsx}',
      'src/**/__tests__/integration/**',
      'src/**/__tests__/e2e/**',
    ],
  },
});
EOF

    # Create integration test configuration
    cat > config/test/vitest.integration.config.ts << 'EOF'
import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.base.config';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['src/**/*.{integration,e2e}.{test,spec}.{ts,tsx}'],
    exclude: [
      'src/**/*.{unit,performance}.{test,spec}.{ts,tsx}',
    ],
    hookTimeout: 30000,
  },
});
EOF

    log_success "Test configurations consolidated"
}

# Create environment loader script
create_env_loader() {
    log "Creating environment loader script..."

    cat > scripts/load-env.sh << 'EOF'
#!/bin/bash

# ValueOS Environment Loader
# Loads appropriate environment configuration based on NODE_ENV

set -euo pipefail

# Determine environment
ENVIRONMENT=${NODE_ENV:-development}
CONFIG_DIR="config/environments"

# Load base configuration first
if [[ -f "$CONFIG_DIR/base.env" ]]; then
    export $(grep -v '^#' "$CONFIG_DIR/base.env" | grep -v '^$' | xargs)
fi

# Load environment-specific configuration
if [[ -f "$CONFIG_DIR/$ENVIRONMENT.env" ]]; then
    export $(grep -v '^#' "$CONFIG_DIR/$ENVIRONMENT.env" | grep -v '^$' | xargs)
else
    echo "Warning: Environment file not found: $CONFIG_DIR/$ENVIRONMENT.env"
fi

echo "Loaded environment configuration for: $ENVIRONMENT"
EOF

    chmod +x scripts/load-env.sh

    log_success "Environment loader script created"
}

# Create Docker loader script
create_docker_loader() {
    log "Creating Docker loader script..."

    cat > scripts/docker-compose.sh << 'EOF'
#!/bin/bash

# ValueOS Docker Compose Loader
# Runs appropriate docker-compose configuration based on environment

set -euo pipefail

# Determine environment
ENVIRONMENT=${1:-development}
CONFIG_DIR="config/docker"

# Base command
BASE_CMD="docker-compose -f $CONFIG_DIR/docker-compose.base.yml"

# Add environment-specific overrides
case $ENVIRONMENT in
    "production")
        BASE_CMD="$BASE_CMD -f $CONFIG_DIR/docker-compose.prod.yml"
        ;;
    "development"|"staging"|"test")
        BASE_CMD="$BASE_CMD -f $CONFIG_DIR/docker-compose.override.yml"
        ;;
esac

# Add additional arguments
shift
BASE_CMD="$BASE_CMD $@"

echo "Running: $BASE_CMD"
$BASE_CMD
EOF

    chmod +x scripts/docker-compose.sh

    log_success "Docker loader script created"
}

# Update package.json scripts
update_package_scripts() {
    log "Updating package.json scripts..."

    # Create a temporary script to update package.json
    cat > /tmp/update-scripts.js << 'EOF'
const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Update environment loading
packageJson.scripts['env:load'] = 'bash scripts/load-env.sh';
packageJson.scripts['env:dev'] = 'NODE_ENV=development bash scripts/load-env.sh';
packageJson.scripts['env:staging'] = 'NODE_ENV=staging bash scripts/load-env.sh';
packageJson.scripts['env:prod'] = 'NODE_ENV=production bash scripts/load-env.sh';

// Update Docker commands
packageJson.scripts['docker:base'] = 'bash scripts/docker-compose.sh';
packageJson.scripts['docker:dev'] = 'bash scripts/docker-compose.sh development up';
packageJson.scripts['docker:prod'] = 'bash scripts/docker-compose.sh production up';
packageJson.scripts['docker:test'] = 'bash scripts/docker-compose.sh test up';

// Update test commands
packageJson.scripts['test:unit'] = 'vitest --config config/test/vitest.unit.config.ts';
packageJson.scripts['test:integration'] = 'vitest --config config/test/vitest.integration.config.ts';

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log('Package.json scripts updated successfully');
EOF

    node /tmp/update-scripts.js
    rm /tmp/update-scripts.js

    log_success "Package.json scripts updated"
}

# Create migration guide
create_migration_guide() {
    log "Creating migration guide..."

    cat > CONFIGURATION_MIGRATION.md << 'EOF'
# ValueOS Configuration Migration Guide

## Overview

The ValueOS configuration has been consolidated from scattered files into an organized structure for better maintainability and clarity.

## New Structure

### Environment Configuration
```
config/environments/
├── base.env          # Common environment variables
├── development.env   # Development-specific overrides
├── staging.env       # Staging-specific overrides
├── production.env    # Production-specific overrides
└── test.env          # Test-specific overrides
```

### Docker Configuration
```
config/docker/
├── docker-compose.base.yml    # Base services
├── docker-compose.override.yml # Development overrides
└── docker-compose.prod.yml     # Production overrides
```

### Test Configuration
```
config/test/
├── vitest.base.config.ts       # Base test configuration
├── vitest.unit.config.ts       # Unit test configuration
└── vitest.integration.config.ts # Integration test configuration
```

## Usage

### Environment Variables
```bash
# Load environment configuration
source scripts/load-env.sh

# Or specify environment
NODE_ENV=production source scripts/load-env.sh
```

### Docker Commands
```bash
# Development
bash scripts/docker-compose.sh development up

# Production
bash scripts/docker-compose.sh production up
```

### Test Commands
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration
```

## Migration Steps

1. Update your local environment setup to use the new configuration loader
2. Update CI/CD pipelines to use the new Docker commands
3. Update deployment scripts to use the new environment structure
4. Remove old configuration files after verification

## Benefits

- **Single Source of Truth**: All configuration in one organized location
- **Environment Consistency**: Clear inheritance from base configuration
- **Easier Maintenance**: Less duplication and clearer structure
- **Better Security**: Sensitive configuration properly organized
- **Simplified Deployment**: Consistent configuration across environments

## Rollback

If needed, you can rollback using the backup created at:
`$BACKUP_DIR`

Copy the backed up files back to their original locations to restore the previous configuration structure.
EOF

    log_success "Migration guide created"
}

# Main execution
main() {
    log "Starting ValueOS Configuration Consolidation"

    # Create backup
    create_backup

    # Consolidate configurations
    consolidate_env_files
    consolidate_docker_files
    consolidate_test_configs

    # Create helper scripts
    create_env_loader
    create_docker_loader

    # Update package.json
    update_package_scripts

    # Create documentation
    create_migration_guide

    log_success "Configuration consolidation completed!"
    log "Backup available at: $BACKUP_DIR"
    log "See CONFIGURATION_MIGRATION.md for usage instructions"
}

# Run main function
main "$@"

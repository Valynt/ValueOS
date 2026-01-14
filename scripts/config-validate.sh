#!/bin/bash
# Configuration Validation Script
# Validates configuration across all environments

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Configuration Validation Report                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

ENVS_DIR="deploy/envs"
VALIDATION_ERRORS=0
VALIDATION_WARNINGS=0

# Check if environments directory exists
if [ ! -d "$ENVS_DIR" ]; then
    echo -e "${RED}✗ Environments directory not found: $ENVS_DIR${NC}"
    exit 1
fi

echo -e "${BLUE}🔍 Validating Configuration Files${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Validate each environment file
for env_file in "$ENVS_DIR"/.env*.example; do
    if [ -f "$env_file" ]; then
        filename=$(basename "$env_file")
        env_name=${filename#.env.}
        env_name=${env_name%.example}

        echo -e "\n${BLUE}Validating $env_name environment...${NC}"

        # Load environment variables
        set -a
        source "$env_file"
        set +a

        # Run Node.js validation
        if node -e "
        try {
          const { loadAndValidateConfig } = require('./src/config/schema.ts');
          const result = loadAndValidateConfig();
          if (result.success) {
            console.log('✅ Configuration valid');
            if (result.warnings.length > 0) {
              console.log('⚠️  Warnings:', result.warnings.join(', '));
            }
          } else {
            console.log('❌ Configuration invalid');
            console.log('Errors:', result.errors.join(', '));
            process.exit(1);
          }
        } catch (error) {
          console.log('💥 Validation error:', error.message);
          process.exit(1);
        }
        " 2>/dev/null; then
            echo -e "${GREEN}✓ $env_name configuration is valid${NC}"
        else
            echo -e "${RED}✗ $env_name configuration has errors${NC}"
            ((VALIDATION_ERRORS++))
        fi
    fi
done

echo -e "\n${BLUE}📊 Configuration Diff Analysis${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Compare environments
echo "Comparing key configuration differences between environments:"

# Extract key variables for comparison
echo -e "\n${YELLOW}Database Configuration:${NC}"
for env_file in "$ENVS_DIR"/.env*.example; do
    if [ -f "$env_file" ]; then
        filename=$(basename "$env_file")
        env_name=${filename#.env.}
        env_name=${env_name%.example}

        db_url=$(grep "^DATABASE_URL=" "$env_file" | cut -d'=' -f2- | head -c 50)
        echo -e "  $env_name: ${db_url}..."
    fi
done

echo -e "\n${YELLOW}Feature Flags:${NC}"
for env_file in "$ENVS_DIR"/.env*.example; do
    if [ -f "$env_file" ]; then
        filename=$(basename "$env_file")
        env_name=${filename#.env.}
        env_name=${env_name%.example}

        agent_fabric=$(grep "^ENABLE_AGENT_FABRIC=" "$env_file" | cut -d'=' -f2 || echo "not set")
        billing=$(grep "^ENABLE_BILLING=" "$env_file" | cut -d'=' -f2 || echo "not set")
        echo -e "  $env_name: AgentFabric=$agent_fabric, Billing=$billing"
    fi
done

# Security check
echo -e "\n${BLUE}🔒 Security Configuration Check${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for env_file in "$ENVS_DIR"/.env*.example; do
    if [ -f "$env_file" ]; then
        filename=$(basename "$env_file")
        env_name=${filename#.env.}
        env_name=${env_name%.example}

        # Check for production security settings
        if [[ "$env_name" == *"prod"* ]]; then
            https_only=$(grep "^HTTPS_ONLY=" "$env_file" | cut -d'=' -f2 || echo "false")
            csrf_enabled=$(grep "^CSRF_ENABLED=" "$env_file" | cut -d'=' -f2 || echo "false")
            csp_enabled=$(grep "^CSP_ENABLED=" "$env_file" | cut -d'=' -f2 || echo "false")

            if [[ "$https_only" != "true" ]]; then
                echo -e "${RED}✗ $env_name: HTTPS_ONLY not enabled${NC}"
                ((VALIDATION_ERRORS++))
            fi

            if [[ "$csrf_enabled" != "true" ]]; then
                echo -e "${RED}✗ $env_name: CSRF_ENABLED not enabled${NC}"
                ((VALIDATION_ERRORS++))
            fi

            if [[ "$csp_enabled" != "true" ]]; then
                echo -e "${RED}✗ $env_name: CSP_ENABLED not enabled${NC}"
                ((VALIDATION_ERRORS++))
            fi
        fi
    fi
done

# Required environment variables check
echo -e "\n${BLUE}📋 Required Variables Check${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

REQUIRED_VARS=(
    "NODE_ENV"
    "DATABASE_URL"
    "SUPABASE_URL"
    "SUPABASE_ANON_KEY"
    "VITE_SUPABASE_URL"
    "VITE_SUPABASE_ANON_KEY"
)

for env_file in "$ENVS_DIR"/.env*.example; do
    if [ -f "$env_file" ]; then
        filename=$(basename "$env_file")
        env_name=${filename#.env.}
        env_name=${env_name%.example}

        missing_vars=()
        for var in "${REQUIRED_VARS[@]}"; do
            if ! grep -q "^${var}=" "$env_file"; then
                missing_vars+=("$var")
            fi
        done

        if [ ${#missing_vars[@]} -eq 0 ]; then
            echo -e "${GREEN}✓ $env_name: All required variables present${NC}"
        else
            echo -e "${YELLOW}⚠ $env_name: Missing variables: ${missing_vars[*]}${NC}"
            ((VALIDATION_WARNINGS++))
        fi
    fi
done

# Summary
echo -e "\n${BLUE}📈 Validation Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Errors: $VALIDATION_ERRORS"
echo "Warnings: $VALIDATION_WARNINGS"

if [ $VALIDATION_ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All configurations are valid${NC}"
    echo -e "\n${BLUE}🚀 Next Steps${NC}"
    echo "1. Run 'npm run config:diff <env1> <env2>' to compare specific environments"
    echo "2. Run 'npm run config:generate <env>' to create new environment files"
    echo "3. Run 'npm run config:migrate' to update existing configurations"
    exit 0
else
    echo -e "${RED}❌ Found $VALIDATION_ERRORS configuration errors${NC}"
    echo -e "\n${YELLOW}🔧 Fix Configuration${NC}"
    echo "1. Review the error messages above"
    echo "2. Update the affected environment files"
    echo "3. Run this validation again"
    exit 1
fi

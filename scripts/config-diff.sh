#!/bin/bash
# Configuration Diff Tool
# Shows differences between environment configurations

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

usage() {
    echo "Usage: $0 <env1> <env2>"
    echo "Example: $0 production staging"
    echo "Available environments: $(ls deploy/envs/.env*.example | xargs -n1 basename | sed 's/.env.//' | sed 's/.example//' | tr '\n' ' ')"
    exit 1
}

if [ $# -ne 2 ]; then
    usage
fi

ENV1=$1
ENV2=$2
ENVS_DIR="deploy/envs"

ENV1_FILE="$ENVS_DIR/.env.${ENV1}.example"
ENV2_FILE="$ENVS_DIR/.env.${ENV2}.example"

# Check if environment files exist
if [ ! -f "$ENV1_FILE" ]; then
    echo -e "${RED}✗ Environment file not found: $ENV1_FILE${NC}"
    echo "Available environments:"
    ls "$ENVS_DIR"/.env*.example | xargs -n1 basename | sed 's/.env.//' | sed 's/.example//' | while read env; do
        echo "  - $env"
    done
    exit 1
fi

if [ ! -f "$ENV2_FILE" ]; then
    echo -e "${RED}✗ Environment file not found: $ENV2_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Configuration Diff: $ENV1 vs $ENV2               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to extract and normalize a variable
extract_var() {
    local file=$1
    local var=$2
    local value=$(grep "^${var}=" "$file" 2>/dev/null | cut -d'=' -f2- | sed 's/^["'\'']//' | sed 's/["'\'']$//' || echo "NOT_SET")
    echo "$value"
}

# Function to compare variables
compare_var() {
    local var=$1
    local val1=$(extract_var "$ENV1_FILE" "$var")
    local val2=$(extract_var "$ENV2_FILE" "$var")

    if [ "$val1" != "$val2" ]; then
        if [ "$val1" = "NOT_SET" ] && [ "$val2" = "NOT_SET" ]; then
            return 0  # Both not set, skip
        elif [ "$val1" = "NOT_SET" ]; then
            echo -e "${RED}- $var: NOT_SET → $val2${NC}"
            return 1
        elif [ "$val2" = "NOT_SET" ]; then
            echo -e "${GREEN}+ $var: $val1 → NOT_SET${NC}"
            return 1
        else
            echo -e "${YELLOW}⚡ $var: $val1 → $val2${NC}"
            return 1
        fi
    fi
    return 0
}

echo -e "${CYAN}🔍 Critical Configuration Differences${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Critical variables to check
CRITICAL_VARS=(
    "NODE_ENV"
    "DATABASE_URL"
    "SUPABASE_URL"
    "SUPABASE_ANON_KEY"
    "VITE_SUPABASE_URL"
    "VITE_SUPABASE_ANON_KEY"
    "REDIS_URL"
    "TOGETHER_API_KEY"
    "INSTANCE_ID"
    "REGION"
    "CLUSTER_NAME"
)

critical_diffs=0
for var in "${CRITICAL_VARS[@]}"; do
    if compare_var "$var"; then
        ((critical_diffs++))
    fi
done

if [ $critical_diffs -eq 0 ]; then
    echo -e "${GREEN}✅ No critical configuration differences${NC}"
else
    echo -e "\n${YELLOW}⚠️  Found $critical_diffs critical differences${NC}"
fi

echo -e "\n${CYAN}🔧 Feature Flags Differences${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FEATURE_VARS=(
    "ENABLE_AGENT_FABRIC"
    "ENABLE_WORKFLOW"
    "ENABLE_COMPLIANCE"
    "ENABLE_MULTI_TENANT"
    "ENABLE_USAGE_TRACKING"
    "ENABLE_BILLING"
    "ENABLE_AI"
    "ENABLE_ANALYTICS"
)

feature_diffs=0
for var in "${FEATURE_VARS[@]}"; do
    if compare_var "$var"; then
        ((feature_diffs++))
    fi
done

if [ $feature_diffs -eq 0 ]; then
    echo -e "${GREEN}✅ Feature flags are identical${NC}"
else
    echo -e "\n${YELLOW}⚠️  Found $feature_diffs feature flag differences${NC}"
fi

echo -e "\n${CYAN}🔒 Security Configuration Differences${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SECURITY_VARS=(
    "HTTPS_ONLY"
    "CSRF_ENABLED"
    "CSP_ENABLED"
    "SESSION_TIMEOUT"
    "MAX_LOGIN_ATTEMPTS"
)

security_diffs=0
for var in "${SECURITY_VARS[@]}"; do
    if compare_var "$var"; then
        ((security_diffs++))
    fi
done

if [ $security_diffs -eq 0 ]; then
    echo -e "${GREEN}✅ Security configurations are identical${NC}"
else
    echo -e "\n${YELLOW}⚠️  Found $security_diffs security differences${NC}"
fi

echo -e "\n${CYAN}📊 Monitoring & Observability Differences${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MONITORING_VARS=(
    "PROMETHEUS_ENABLED"
    "GRAFANA_ENABLED"
    "LOG_LEVEL"
    "TRACING_ENABLED"
    "METRICS_INTERVAL"
)

monitoring_diffs=0
for var in "${MONITORING_VARS[@]}"; do
    if compare_var "$var"; then
        ((monitoring_diffs++))
    fi
done

if [ $monitoring_diffs -eq 0 ]; then
    echo -e "${GREEN}✅ Monitoring configurations are identical${NC}"
else
    echo -e "\n${YELLOW}⚠️  Found $monitoring_diffs monitoring differences${NC}"
fi

echo -e "\n${CYAN}🌐 External Services Differences${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

EXTERNAL_VARS=(
    "SLACK_WEBHOOK_URL"
    "GOOGLE_ANALYTICS_ID"
    "STRIPE_PUBLIC_KEY"
    "STRIPE_SECRET_KEY"
)

external_diffs=0
for var in "${EXTERNAL_VARS[@]}"; do
    if compare_var "$var"; then
        ((external_diffs++))
    fi
done

if [ $external_diffs -eq 0 ]; then
    echo -e "${GREEN}✅ External service configurations are identical${NC}"
else
    echo -e "\n${YELLOW}⚠️  Found $external_diffs external service differences${NC}"
fi

echo -e "\n${CYAN}🚀 High Availability Differences${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

HA_VARS=(
    "MAINTENANCE_MODE"
    "AUTO_ROLLBACK_ENABLED"
    "HEALTH_CHECK_INTERVAL"
    "HEALTH_CHECK_TIMEOUT"
    "HEALTH_CHECK_RETRIES"
)

ha_diffs=0
for var in "${HA_VARS[@]}"; do
    if compare_var "$var"; then
        ((ha_diffs++))
    fi
done

if [ $ha_diffs -eq 0 ]; then
    echo -e "${GREEN}✅ HA configurations are identical${NC}"
else
    echo -e "\n${YELLOW}⚠️  Found $ha_diffs HA differences${NC}"
fi

# Full diff for detailed analysis
echo -e "\n${CYAN}📄 Full Configuration Diff${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v diff >/dev/null 2>&1; then
    echo -e "${BLUE}Running detailed diff...${NC}"
    diff -u "$ENV1_FILE" "$ENV2_FILE" | head -50 || true

    if [ $(diff -u "$ENV1_FILE" "$ENV2_FILE" | wc -l) -gt 50 ]; then
        echo -e "\n${YELLOW}... (diff truncated, showing first 50 lines)${NC}"
        echo "Use 'diff -u $ENV1_FILE $ENV2_FILE' for full comparison"
    fi
else
    echo -e "${YELLOW}diff command not available, showing side-by-side comparison${NC}"

    # Create temporary files with sorted variables
    temp1=$(mktemp)
    temp2=$(mktemp)

    sort "$ENV1_FILE" > "$temp1"
    sort "$ENV2_FILE" > "$temp2"

    # Simple side-by-side comparison
    echo -e "${BLUE}$ENV1${NC} ← → ${BLUE}$ENV2${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    comm -3 "$temp1" "$temp2" | head -20 || true

    rm "$temp1" "$temp2"
fi

# Summary
total_diffs=$((critical_diffs + feature_diffs + security_diffs + monitoring_diffs + external_diffs + ha_diffs))

echo -e "\n${BLUE}📈 Diff Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Critical differences: $critical_diffs"
echo "Feature flag differences: $feature_diffs"
echo "Security differences: $security_diffs"
echo "Monitoring differences: $monitoring_diffs"
echo "External service differences: $external_diffs"
echo "HA differences: $ha_diffs"
echo "Total differences: $total_diffs"

if [ $critical_diffs -gt 0 ]; then
    echo -e "\n${RED}⚠️  Critical configuration differences detected!${NC}"
    echo "Review these differences carefully before deployment."
elif [ $total_diffs -gt 0 ]; then
    echo -e "\n${YELLOW}ℹ️  Configuration differences found${NC}"
    echo "These differences may be expected but should be reviewed."
else
    echo -e "\n${GREEN}✅ Configurations are identical${NC}"
fi

echo -e "\n${BLUE}🔧 Recommendations${NC}"
if [ $critical_diffs -gt 0 ]; then
    echo "1. Review critical differences immediately"
    echo "2. Ensure production has required security settings"
    echo "3. Verify database and service URLs are correct"
elif [ $security_diffs -gt 0 ]; then
    echo "1. Review security configuration differences"
    echo "2. Ensure production has stricter security settings"
else
    echo "1. Differences appear to be environment-specific"
    echo "2. Consider if these differences are intentional"
fi

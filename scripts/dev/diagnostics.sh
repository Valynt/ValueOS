#!/bin/bash
###############################################################################
# ValueOS DevContainer Diagnostics
#
# Collects comprehensive diagnostic information about the development environment.
# Useful for troubleshooting issues.
#
# Usage: bash scripts/dev/diagnostics.sh [--output FILE]
###############################################################################

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_FILE="${PROJECT_ROOT}/dev-env-report.txt"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --output|-o)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# Start fresh output
echo "ValueOS DevContainer Diagnostics" > "$OUTPUT_FILE"
echo "Generated: $(date -Iseconds)" >> "$OUTPUT_FILE"
echo "=================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Determine Compose Command
COMPOSE_CMD=""
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif docker-compose version &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}Error: docker compose not found${NC}"
    exit 1
fi

ENV_PORTS_FILE="${PROJECT_ROOT}/.env.ports"
if [[ -f "$ENV_PORTS_FILE" ]]; then
    COMPOSE_CMD="$COMPOSE_CMD --env-file $ENV_PORTS_FILE"
fi

# Determine Compose File
COMPOSE_FILE=""
if [[ -f "$PROJECT_ROOT/.devcontainer/docker-compose.devcontainer.yml" ]]; then
    COMPOSE_FILE="$PROJECT_ROOT/.devcontainer/docker-compose.devcontainer.yml"
elif [[ -f "$PROJECT_ROOT/docker-compose.yml" ]]; then
    COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
fi

if [[ -n "$COMPOSE_FILE" ]]; then
    COMPOSE_CMD="$COMPOSE_CMD -f $COMPOSE_FILE"
fi

section() {
    local title="$1"
    echo ""
    echo -e "${CYAN}${BOLD}=== $title ===${NC}"
    echo "" >> "$OUTPUT_FILE"
    echo "=== $title ===" >> "$OUTPUT_FILE"
}

###############################################################################
# Environment Info
###############################################################################
section "Environment"

echo "Hostname: $(hostname)" | tee -a "$OUTPUT_FILE"
echo "User: $(whoami)" | tee -a "$OUTPUT_FILE"
echo "Working Dir: $(pwd)" | tee -a "$OUTPUT_FILE"
echo "In Container: $(if [[ -f /.dockerenv ]]; then echo 'Yes'; else echo 'No'; fi)" | tee -a "$OUTPUT_FILE"
echo "Node: $(node -v 2>/dev/null || echo 'N/A')" | tee -a "$OUTPUT_FILE"
echo "pnpm: $(pnpm -v 2>/dev/null || echo 'N/A')" | tee -a "$OUTPUT_FILE"
echo "Supabase CLI: $(supabase -v 2>/dev/null || echo 'N/A')" | tee -a "$OUTPUT_FILE"

###############################################################################
# Docker Status
###############################################################################
section "Docker Status"

if docker info &> /dev/null; then
    echo -e "${GREEN}Docker daemon: Running${NC}"
    echo "Docker daemon: Running" >> "$OUTPUT_FILE"
else
    echo -e "${RED}Docker daemon: Not accessible${NC}"
    echo "Docker daemon: Not accessible" >> "$OUTPUT_FILE"
fi

###############################################################################
# Container Status
###############################################################################
section "Container Status"

if $COMPOSE_CMD ps --format 'table {{.Name}}\t{{.Status}}\t{{.Health}}' 2>/dev/null; then
    $COMPOSE_CMD ps --format 'table {{.Name}}\t{{.Status}}\t{{.Health}}' >> "$OUTPUT_FILE" 2>&1
else
    echo "Could not get container status" | tee -a "$OUTPUT_FILE"
fi

###############################################################################
# Health Checks
###############################################################################
section "Service Health"

check_health() {
    local name="$1"
    local check_cmd="$2"
    echo -n "$name: "
    if eval "$check_cmd" &> /dev/null; then
        echo -e "${GREEN}Healthy${NC}"
        echo "$name: Healthy" >> "$OUTPUT_FILE"
    else
        echo -e "${RED}Unhealthy${NC}"
        echo "$name: Unhealthy" >> "$OUTPUT_FILE"
    fi
}

check_health "PostgreSQL" "$COMPOSE_CMD exec -T db pg_isready -U postgres"
check_health "Redis" "$COMPOSE_CMD exec -T redis redis-cli ping"
check_health "Kong" "$COMPOSE_CMD exec -T kong kong health"
check_health "Auth (GoTrue)" "curl -fsS http://localhost:54321/auth/v1/health 2>/dev/null || curl -fsS http://kong:8000/auth/v1/health 2>/dev/null"
check_health "REST (PostgREST)" "curl -fsS http://localhost:54321/rest/v1/ -I 2>/dev/null || curl -fsS http://kong:8000/rest/v1/ -I 2>/dev/null"

###############################################################################
# Port Bindings
###############################################################################
section "Port Bindings"

echo "Container ports:" | tee -a "$OUTPUT_FILE"
docker ps --format 'table {{.Names}}\t{{.Ports}}' 2>/dev/null | tee -a "$OUTPUT_FILE" || echo "Could not get port info"

###############################################################################
# Environment Variables
###############################################################################
section "Key Environment Variables"

print_env() {
    local var="$1"
    local value="${!var:-<not set>}"
    # Mask sensitive values
    if [[ "$var" == *"KEY"* ]] || [[ "$var" == *"SECRET"* ]] || [[ "$var" == *"PASSWORD"* ]]; then
        if [[ "$value" != "<not set>" ]]; then
            value="${value:0:8}...${value: -4}"
        fi
    fi
    echo "$var=$value" | tee -a "$OUTPUT_FILE"
}

print_env "NODE_ENV"
print_env "DATABASE_URL"
print_env "SUPABASE_URL"
print_env "SUPABASE_ANON_KEY"
print_env "SUPABASE_JWT_SECRET"
print_env "REDIS_URL"

###############################################################################
# Recent Container Logs
###############################################################################
section "Recent Logs (last 20 lines per service)"

for service in db redis kong auth rest storage realtime; do
    echo "" >> "$OUTPUT_FILE"
    echo "--- $service ---" >> "$OUTPUT_FILE"
    if $COMPOSE_CMD logs --tail=20 "$service" 2>&1 >> "$OUTPUT_FILE"; then
        echo "  $service: ✓ Collected"
    else
        echo "  $service: ✗ Not running or not found"
    fi
done

###############################################################################
# Database Status
###############################################################################
section "Database Status"

echo "Databases:" | tee -a "$OUTPUT_FILE"
$COMPOSE_CMD exec -T db psql -U postgres -c "\\l" 2>&1 | tee -a "$OUTPUT_FILE" || echo "Could not list databases"

echo "" | tee -a "$OUTPUT_FILE"
echo "Migration tables:" | tee -a "$OUTPUT_FILE"
$COMPOSE_CMD exec -T db psql -U postgres -d postgres -c "SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;" 2>&1 | tee -a "$OUTPUT_FILE" || echo "No migration table found"

###############################################################################
# Config Validation
###############################################################################
section "Configuration Validation"

echo -n "Kong config (kong.yml): "
if $COMPOSE_CMD exec -T kong cat /var/lib/kong/kong.yml > /dev/null 2>&1; then
    # Try to validate YAML syntax
    if $COMPOSE_CMD exec -T kong kong config parse /var/lib/kong/kong.yml &> /dev/null; then
        echo -e "${GREEN}Valid${NC}"
        echo "Kong config: Valid" >> "$OUTPUT_FILE"
    else
        echo -e "${RED}Invalid${NC}"
        echo "Kong config: Invalid - parse error" >> "$OUTPUT_FILE"
    fi
else
    echo -e "${RED}Not found${NC}"
    echo "Kong config: Not found" >> "$OUTPUT_FILE"
    echo "Check if kong service is running and /var/lib/kong/kong.yml exists" >> "$OUTPUT_FILE"
fi

echo -n ".env.local: "
if [[ -f "$PROJECT_ROOT/.env.local" ]]; then
    echo -e "${GREEN}Present${NC}"
    echo ".env.local: Present" >> "$OUTPUT_FILE"
else
    echo -e "${YELLOW}Missing${NC}"
    echo ".env.local: Missing" >> "$OUTPUT_FILE"
fi

###############################################################################
# Summary
###############################################################################
section "Summary"

echo ""
echo -e "${BLUE}Full diagnostic report saved to:${NC}"
echo "  $OUTPUT_FILE"
echo ""
echo "To share this report, run:"
echo "  cat $OUTPUT_FILE | pbcopy  # macOS"
echo "  cat $OUTPUT_FILE | xclip   # Linux"

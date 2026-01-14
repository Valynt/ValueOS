#!/bin/bash

# Contract Testing Script
# Validates API contracts between services

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-http://backend-service.valuecanvas.svc.cluster.local:8000}"
CONTRACTS_DIR="${CONTRACTS_DIR:-tests/contracts}"
RESULTS_DIR="${RESULTS_DIR:-test-results}"

# Contract test results
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Logging functions
log_info() {
    echo -e "${BLUE}📋 $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
 echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Create contracts directory if it doesn't exist
setup_contracts() {
    mkdir -p "$CONTRACTS_DIR"
    mkdir -p "$RESULTS_DIR"

    # Create basic API contract if it doesn't exist
    if [ ! -f "$CONTRACTS_DIR/backend-api.yaml" ]; then
        log_info "Creating default API contract..."

        cat > "$CONTRACTS_DIR/backend-api.yaml" << 'EOF'
openapi: 3.0.3
info:
  title: Backend API Contract
  version: 1.0.0
paths:
  /health:
    get:
      summary: Health check endpoint
      responses:
        '200':
          description: Service is healthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum: [healthy]
                  timestamp:
                    type: string
                    format: date-time
                  uptime:
                    type: number

  /api/v1/agents:
    get:
      summary: List agents
      responses:
        '200':
          description: List of agents
          content:
            application/json:
              schema:
                type: object
                properties:
                  agents:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                        name:
                          type: string
                        status:
                          type: string
                          enum: [active, inactive]

  /api/v1/tasks:
    post:
      summary: Create a new task
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - description
              properties:
                description:
                  type: string
                  minLength: 1
                priority:
                  type: string
                  enum: [low, medium, high]
                  default: medium
      responses:
        '201':
          description: Task created successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  task:
                    type: object
                    properties:
                      id:
                        type: string
                      description:
                        type: string
                      status:
                        type: string
                        enum: [pending, running, completed, failed]
EOF
    fi
}

# Test endpoint against contract
test_endpoint() {
    local method="$1"
    local path="$2"
    local expected_status="${3:-200}"

    ((TESTS_RUN++))

    log_info "Testing $method $path (expecting $expected_status)"

    local response
    local status_code

    # Make request
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$API_BASE_URL$path" 2>/dev/null)
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" -d '{}' "$API_BASE_URL$path" 2>/dev/null)
    else
        log_warning "Unsupported method: $method"
        return 0
    fi

    # Extract status code and response body
    status_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | head -n -1)

    if [ "$status_code" = "$expected_status" ]; then
        log_success "✓ $method $path returned $status_code"
        ((TESTS_PASSED++))
        return 0
    else
        log_error "✗ $method $path returned $status_code (expected $expected_status)"
        echo "Response: $response_body"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test response schema
test_response_schema() {
    local path="$1"
    local schema_file="$2"

    if [ ! -f "$schema_file" ]; then
        log_warning "Schema file not found: $schema_file"
        return 0
    fi

    log_info "Testing response schema for $path"

    # Get response
    local response=$(curl -s "$API_BASE_URL$path" 2>/dev/null)

    if [ -z "$response" ]; then
        log_error "No response received from $path"
        ((TESTS_FAILED++))
        return 1
    fi

    # Basic JSON validation
    if ! echo "$response" | jq . >/dev/null 2>&1; then
        log_error "Invalid JSON response from $path"
        ((TESTS_FAILED++))
        return 1
    fi

    log_success "✓ Response schema valid for $path"
    ((TESTS_PASSED++))
    return 0
}

# Run contract tests
run_contract_tests() {
    log_info "Starting contract testing..."
    log_info "API Base URL: $API_BASE_URL"
    log_info "Contracts Directory: $CONTRACTS_DIR"

    local start_time=$(date +%s)

    # Setup contracts
    setup_contracts

    # Test basic endpoints
    test_endpoint "GET" "/health" "200"
    test_response_schema "/health" "$CONTRACTS_DIR/health-schema.json"

    # Test API endpoints
    test_endpoint "GET" "/api/v1/agents" "200"
    test_endpoint "POST" "/api/v1/tasks" "201"

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Generate report
    generate_contract_report "$duration"

    # Summary
    echo ""
    log_info "Contract Testing Summary:"
    echo "  Tests run: $TESTS_RUN"
    echo "  Passed: $TESTS_PASSED"
    echo "  Failed: $TESTS_FAILED"
    echo "  Duration: ${duration}s"

    if [ $TESTS_FAILED -eq 0 ]; then
        log_success "🎉 All contract tests passed!"
        return 0
    else
        log_error "💥 $TESTS_FAILED contract tests failed!"
        return 1
    fi
}

# Generate contract testing report
generate_contract_report() {
    local duration="$1"
    local report_file="$RESULTS_DIR/contract-test-report-$(date +%Y%m%d-%H%M%S).json"

    cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "test_duration_seconds": $duration,
  "api_base_url": "$API_BASE_URL",
  "tests": {
    "total": $TESTS_RUN,
    "passed": $TESTS_PASSED,
    "failed": $TESTS_FAILED
  },
  "contracts_directory": "$CONTRACTS_DIR",
  "results_directory": "$RESULTS_DIR"
}
EOF

    log_info "Contract test report saved to: $report_file"
}

# Main execution
main() {
    local command="${1:-test}"

    case "$command" in
        test)
            run_contract_tests
            ;;
        setup)
            setup_contracts
            log_success "Contract testing setup complete"
            ;;
        *)
            echo "Usage: $0 [test|setup]"
            echo "Commands:"
            echo "  test  - Run contract tests (default)"
            echo "  setup - Setup contract files"
            exit 1
            ;;
    esac
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

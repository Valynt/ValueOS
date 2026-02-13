#!/bin/bash
# Chaos testing framework for ValueOS agent containers
# Simulates failures to verify orchestrator resilience

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check dependencies
check_dependencies() {
    local missing=()

    command -v docker >/dev/null 2>&1 || missing+=("docker")
    command -v curl >/dev/null 2>&1 || missing+=("curl")
    command -v jq >/dev/null 2>&1 || missing+=("jq")

    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing[*]}"
        exit 1
    fi
}

# Get list of running agents
get_running_agents() {
    docker ps --format "table {{.Names}}" | grep "valueos-.*-agent" | sed 's/valueos-//g' | sed 's/-agent//g'
}

# Get orchestrator status
get_orchestrator_status() {
    curl -s http://localhost:3001/health/agents || echo "Orchestrator unreachable"
}

# Kill agent randomly
kill_random_agent() {
    local agents=($(get_running_agents))
    local count=${#agents[@]}

    if [ $count -eq 0 ]; then
        log_warn "No agents running"
        return 1
    fi

    local random_index=$((RANDOM % count))
    local agent_name=${agents[$random_index]}

    log_info "Terminating agent: ${agent_name}"

    # Kill the agent container
    docker kill "valueos-${agent_name}-agent" && \
    docker rm "valueos-${agent_name}-agent" >/dev/null 2>&1

    # Wait for orchestrator to detect failure
    sleep 10

    # Check if orchestrator reassigned tasks
    local orchestrator_status
    orchestrator_status=$(get_orchestrator_status)

    if echo "$orchestrator_status" | grep -q "${agent_name}"; then
        log_error "Orchestrator failed to reassign ${agent_name} tasks"
        return 1
    else
        log_success "Orchestrator successfully reassigned ${agent_name} tasks"
        return 0
    fi
}

# Simulate network partition
network_partition() {
    local agent_name="$1"

    log_info "Simulating network partition for agent: ${agent_name}"

    # Block network access to agent
    docker update --network none "valueos-${agent_name}-agent" >/dev/null 2>&1

    # Wait for orchestrator to detect failure
    sleep 15

    # Check orchestrator status
    local orchestrator_status
    orchestrator_status=$(get_orchestrator_status)

    if echo "$orchestrator_status" | grep -q "${agent_name}"; then
        log_error "Orchestrator failed to detect network partition for ${agent_name}"
        return 1
    else
        log_success "Orchestrator detected network partition for ${agent_name}"
        return 0
    fi

    # Restore network
    docker update --network bridge "valueos-${agent_name}-agent" >/dev/null 2>&1
}

# Test agent health check failure
health_check_failure() {
    local agent_name="$1"

    log_info "Testing health check failure for agent: ${agent_name}"

    # Temporarily disable health check endpoint
    docker exec "valueos-${agent_name}-agent" mv /app/packages/agents/${agent_name}/dist/health.js /app/packages/agents/${agent_name}/dist/health.js.disabled >/dev/null 2>&1

    # Wait for orchestrator to detect failure
    sleep 30

    # Check orchestrator status
    local orchestrator_status
    orchestrator_status=$(get_orchestrator_status)

    if echo "$orchestrator_status" | grep -q "${agent_name}"; then
        log_error "Orchestrator failed to detect health check failure for ${agent_name}"
        return 1
    else
        log_success "Orchestrator detected health check failure for ${agent_name}"
        return 0
    fi

    # Restore health check
    docker exec "valueos-${agent_name}-agent" mv /app/packages/agents/${agent_name}/dist/health.js.disabled /app/packages/agents/${agent_name}/dist/health.js >/dev/null 2>&1
}

# Test resource exhaustion
resource_exhaustion() {
    local agent_name="$1"

    log_info "Testing resource exhaustion for agent: ${agent_name}"

    # Consume memory (simplified simulation)
    docker exec "valueos-${agent_name}-agent" sh -c "
        node -e \"
            const arr = [];
            while (true) {
                arr.push(new Array(1000000).join('x'));
                if (arr.length % 100 === 0) console.log('Allocated', arr.length, 'arrays');
            }
        \"
    " && sleep 5 && docker exec "valueos-${agent_name}-agent" pkill -f node >/dev/null 2>&1

    # Wait for orchestrator to detect failure
    sleep 15

    # Check orchestrator status
    local orchestrator_status
    orchestrator_status=$(get_orchestrator_status)

    if echo "$orchestrator_status" | grep -q "${agent_name}"; then
        log_error "Orchestrator failed to detect resource exhaustion for ${agent_name}"
        return 1
    else
        log_success "Orchestrator detected resource exhaustion for ${agent_name}"
        return 0
    fi
}

# Run chaos tests
run_chaos_tests() {
    local test_type="${1:-all}"
    local max_iterations=${2:-3}

    log_info "Starting chaos tests: ${test_type}"
    log_info "Max iterations: ${max_iterations}"

    local passed=0
    local failed=0

    for i in $(seq 1 $max_iterations); do
        log_info "Chaos test iteration ${i}/${max_iterations}"

        case $test_type in
            kill)
                if kill_random_agent; then
                    ((passed++))
                else
                    ((failed++))
                fi
                ;;
            network)
                local agents=($(get_running_agents))
                if [ ${#agents[@]} -gt 0 ]; then
                    local random_agent=${agents[$RANDOM % ${#agents[@]}]}
                    if network_partition "$random_agent"; then
                        ((passed++))
                    else
                        ((failed++))
                    fi
                fi
                ;;
            health)
                local agents=($(get_running_agents))
                if [ ${#agents[@]} -gt 0 ]; then
                    local random_agent=${agents[$RANDOM % ${#agents[@]}]}
                    if health_check_failure "$random_agent"; then
                        ((passed++))
                    else
                        ((failed++))
                    fi
                fi
                ;;
            resource)
                local agents=($(get_running_agents))
                if [ ${#agents[@]} -gt 0 ]; then
                    local random_agent=${agents[$RANDOM % ${#agents[@]}]}
                    if resource_exhaustion "$random_agent"; then
                        ((passed++))
                    else
                        ((failed++))
                    fi
                fi
                ;;
            all)
                # Run all test types
                local test_types=("kill" "network" "health" "resource")
                for test in "${test_types[@]}"; do
                    case $test in
                        kill)
                            if kill_random_agent; then
                                ((passed++))
                            else
                                ((failed++))
                            fi
                            ;;
                        network)
                            local agents=($(get_running_agents))
                            if [ ${#agents[@]} -gt 0 ]; then
                                local random_agent=${agents[$RANDOM % ${#agents[@]}]}
                                if network_partition "$random_agent"; then
                                    ((passed++))
                                else
                                    ((failed++))
                                fi
                            fi
                            ;;
                        health)
                            local agents=($(get_running_agents))
                            if [ ${#agents[@]} -gt 0 ]; then
                                local random_agent=${agents[$RANDOM % ${#agents[@]}]}
                                if health_check_failure "$random_agent"; then
                                    ((passed++))
                                else
                                    ((failed++))
                                fi
                            fi
                            ;;
                        resource)
                            local agents=($(get_running_agents))
                            if [ ${#agents[@]} -gt 0 ]; then
                                local random_agent=${agents[$RANDOM % ${#agents[@]}]}
                                if resource_exhaustion "$random_agent"; then
                                    ((passed++))
                                else
                                    ((failed++))
                                fi
                            fi
                            ;;
                    esac
                done
                ;;
            *)
                log_error "Unknown test type: ${test_type}"
                exit 1
                ;;
        esac

        log_info "Iteration ${i} complete - Passed: ${passed}, Failed: ${failed}"
        sleep 5
    done

    log_info "Chaos test summary:"
    log_info "  Passed: ${passed}"
    log_info "  Failed: ${failed}"
    log_info "  Success rate: $(( (passed * 100) / (passed + failed) ))%"

    if [ $failed -gt 0 ]; then
        return 1
    else
        return 0
    fi
}

# Generate chaos test report
generate_report() {
    local report_file="${PROJECT_ROOT}/chaos-test-report-$(date +%Y%m%d-%H%M%S).json"

    log_info "Generating chaos test report: ${report_file}"

    cat > "$report_file" << EOF
{
  "chaos_test": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "version": "1.0.0",
    "environment": {
      "agents_running": $(get_running_agents | wc -l),
      "orchestrator_status": "$(get_orchestrator_status | head -c 100)"
    },
    "test_results": {
      "kill_tests": {
        "passed": $passed,
        "failed": $failed,
        "success_rate": $(( (passed * 100) / (passed + failed) ))
      },
      "network_tests": {
        "passed": $passed,
        "failed": $failed,
        "success_rate": $(( (passed * 100) / (passed + failed) ))
      },
      "health_tests": {
        "passed": $passed,
        "failed": $failed,
        "success_rate": $(( (passed * 100) / (passed + failed) ))
      },
      "resource_tests": {
        "passed": $passed,
        "failed": $failed,
        "success_rate": $(( (passed * 100) / (passed + failed) ))
      }
    }
  }
}
EOF

    log_success "Chaos test report generated: ${report_file}"
}

# Main function
main() {
    local test_type="all"
    local iterations=3
    local generate_report_flag=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --type)
                test_type="$2"
                shift 2
                ;;
            --iterations)
                iterations="$2"
                shift 2
                ;;
            --report)
                generate_report_flag=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [--type <type>] [--iterations <num>] [--report]"
                echo ""
                echo "Options:"
                echo "  --type <type>        Test type: kill, network, health, resource, all (default: all)"
                echo "  --iterations <num>  Number of test iterations (default: 3)"
                echo "  --report            Generate detailed test report"
                echo "  -h, --help          Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    # Run checks
    check_dependencies

    # Run chaos tests
    if run_chaos_tests "$test_type" "$iterations"; then
        log_success "All chaos tests passed!"

        if [ "$generate_report_flag" = "true" ]; then
            generate_report
        fi

        exit 0
    else
        log_error "Chaos tests failed!"
        exit 1
    fi
}

# Run main
main "$@"

#!/bin/bash
# Chaos testing framework for ValueOS agent resilience
# Simulates failures to verify orchestrator can handle agent disruptions

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/infra/docker/docker-compose.agents.yml"

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
    docker ps --format "table {{.Names}}" | grep "-agent" | grep -v "_agent-" | grep -v "agent-" | awk '{print $1}'
}

# Get agent health status
get_agent_health() {
    local agent_name="$1"
    local health_status="unknown"
    
    if docker inspect "$agent_name" >/dev/null 2>&1; then
        local health=$(docker inspect --format='{{.State.Health.Status}}' "$agent_name" 2>/dev/null || echo "none")
        case "$health" in
            "healthy") health_status="healthy" ;;
            "unhealthy") health_status="unhealthy" ;;
            "none") health_status="starting" ;;
            *) health_status="unknown" ;;
        esac
    fi
    
    echo "$health_status"
}

# Check if orchestrator is healthy
check_orchestrator() {
    local max_retries=10
    local retry_delay=5
    
    for i in $(seq 1 $max_retries); do
        if curl -f http://localhost:3001/health >/dev/null 2>&1; then
            log_success "Orchestrator is healthy"
            return 0
        fi
        
        log_info "Orchestrator not ready, retrying ($i/$max_retries)..."
        sleep $retry_delay
    done
    
    log_error "Orchestrator failed to become healthy"
    return 1
}

# Check if agent tasks were reassigned
check_task_reassignment() {
    local agent_name="$1"
    local max_retries=10
    local retry_delay=5
    
    for i in $(seq 1 $max_retries); do
        # Check if agent is still running
        if docker inspect "$agent_name" >/dev/null 2>&1; then
            local health=$(get_agent_health "$agent_name")
            if [ "$health" = "healthy" ]; then
                log_info "Agent $agent_name is back online"
                return 0
            fi
        fi
        
        # Check orchestrator for task status
        if curl -f http://localhost:3001/health/agents/${agent_name#*-} >/dev/null 2>&1; then
            log_success "Tasks for $agent_name were successfully reassigned"
            return 0
        fi
        
        log_info "Waiting for task reassignment ($i/$max_retries)..."
        sleep $retry_delay
    done
    
    log_error "Task reassignment failed for $agent_name"
    return 1
}

# Kill agent randomly
kill_random_agent() {
    local agents=($(get_running_agents))
    local count=${#agents[@]}
    
    if [ $count -eq 0 ]; then
        log_error "No agents are running"
        return 1
    fi
    
    local random_index=$((RANDOM % count))
    local agent_to_kill=${agents[$random_index]}
    
    log_info "Killing agent: $agent_to_kill"
    
    # Record agent state before killing
    local health_before=$(get_agent_health "$agent_to_kill")
    local tasks_before=$(curl -s http://localhost:3001/health/agents/${agent_to_kill#*-} || echo "unknown")
    
    # Kill the agent
    docker kill "$agent_to_kill"
    
    # Wait for orchestrator to detect failure
    sleep 10
    
    # Check if orchestrator handled it
    if check_task_reassignment "$agent_to_kill"; then
        log_success "Agent $agent_to_kill killed successfully and tasks reassigned"
        return 0
    else
        log_error "Agent $agent_to_kill killed but task reassignment failed"
        return 1
    fi
}

# Network partition test
network_partition_test() {
    local agent_name="$1"
    
    log_info "Testing network partition for agent: $agent_name"
    
    # Create network isolation
    docker network disconnect agent-network "$agent_name"
    docker network disconnect messagebus-network "$agent_name"
    
    sleep 30
    
    # Check if agent becomes unhealthy
    local health=$(get_agent_health "$agent_name")
    if [ "$health" = "unhealthy" ] || [ "$health" = "none" ]; then
        log_success "Agent $agent_name became unhealthy during network partition"
    else
        log_warn "Agent $agent_name remained healthy during network partition"
    fi
    
    # Restore network
    docker network connect agent-network "$agent_name"
    docker network connect messagebus-network "$agent_name"
    
    sleep 30
    
    # Check if agent recovers
    health=$(get_agent_health "$agent_name")
    if [ "$health" = "healthy" ]; then
        log_success "Agent $agent_name recovered from network partition"
    else
        log_error "Agent $agent_name failed to recover from network partition"
    fi
}

# Resource exhaustion test
resource_exhaustion_test() {
    local agent_name="$1"
    
    log_info "Testing resource exhaustion for agent: $agent_name"
    
    # Simulate high memory usage
    log_info "Simulating high memory usage..."
    docker exec "$agent_name" sh -c "stress --vm 1 --vm-bytes 500M --timeout 30s"
    
    sleep 10
    
    # Check if agent becomes unhealthy
    local health=$(get_agent_health "$agent_name")
    if [ "$health" = "unhealthy" ]; then
        log_success "Agent $agent_name became unhealthy under resource stress"
    else
        log_warn "Agent $agent_name handled resource stress"
    fi
    
    # Check if orchestrator restarts agent
    sleep 30
    health=$(get_agent_health "$agent_name")
    if [ "$health" = "healthy" ]; then
        log_success "Agent $agent_name was restarted by orchestrator"
    else
        log_error "Agent $agent_name failed to restart"
    fi
}

# Main chaos test
chaos_test() {
    local test_type="${1:-all}"
    local max_iterations="${2:-3}"
    
    log_info "Starting chaos testing..."
    log_info "Test type: $test_type"
    log_info "Max iterations: $max_iterations"
    
    # Start services if not running
    if ! docker ps | grep -q "valueos-nats"; then
        log_info "Starting agent services..."
        docker-compose -f "$COMPOSE_FILE" up -d
        sleep 60
    fi
    
    # Check orchestrator health
    if ! check_orchestrator; then
        log_error "Orchestrator not healthy, aborting chaos tests"
        exit 1
    fi
    
    local iteration=1
    local failures=0
    
    while [ $iteration -le $max_iterations ]; do
        log_info "Chaos iteration $iteration/$max_iterations"
        
        case "$test_type" in
            "kill")
                if ! kill_random_agent; then
                    ((failures++))
                fi
                ;;
            "network")
                local agents=($(get_running_agents))
                if [ ${#agents[@]} -gt 0 ]; then
                    local random_agent=${agents[$((RANDOM % ${#agents[@]}))]}
                    network_partition_test "$random_agent"
                fi
                ;;
            "resource")
                local agents=($(get_running_agents))
                if [ ${#agents[@]} -gt 0 ]; then
                    local random_agent=${agents[$((RANDOM % ${#agents[@]}))]}
                    resource_exhaustion_test "$random_agent"
                fi
                ;;
            "all")
                # Randomly choose test type
                local test_types=("kill" "network" "resource")
                local random_test=${test_types[$((RANDOM % 3))]}
                log_info "Running random test: $random_test"
                
                case "$random_test" in
                    "kill") kill_random_agent ;;
                    "network")
                        local agents=($(get_running_agents))
                        if [ ${#agents[@]} -gt 0 ]; then
                            local random_agent=${agents[$((RANDOM % ${#agents[@]}))]}
                            network_partition_test "$random_agent"
                        fi
                        ;;
                    "resource")
                        local agents=($(get_running_agents))
                        if [ ${#agents[@]} -gt 0 ]; then
                            local random_agent=${agents[$((RANDOM % ${#agents[@]}))]}
                            resource_exhaustion_test "$random_agent"
                        fi
                        ;;
                esac
                ;;
        esac
        
        ((iteration++))
        sleep 10
    done
    
    log_info "Chaos testing completed"
    log_info "Failures: $failures"
    
    if [ $failures -eq 0 ]; then
        log_success "All chaos tests passed!"
        return 0
    else
        log_error "Chaos tests completed with $failures failures"
        return 1
    fi
}

# Generate chaos report
generate_report() {
    log_info "Generating chaos test report..."
    
    local report_file="chaos-report-$(date +%Y%m%d-%H%M%S).json"
    
    local report_data=(
        "{"
        "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
        "  \"agents\": {"
    )
    
    local agents=($(get_running_agents))
    local agent_count=${#agents[@]}
    
    for ((i=0; i<agent_count; i++)); do
        local agent=${agents[$i]}
        local health=$(get_agent_health "$agent")
        local tasks=$(curl -s http://localhost:3001/health/agents/${agent#*-} || echo "unknown")
        
        report_data+=("    \"${agent}\": {")
        report_data+=("      \"health\": \"${health}\",")
        report_data+=("      \"tasks\": ${tasks}")
        
        if [ $i -lt $((agent_count - 1)) ]; then
            report_data+=("    },")
        else
            report_data+=("    }")
        fi
    done
    
    report_data+=("  },")
    report_data+=("  \"summary\": {")
    report_data+=("    \"total_agents\": ${agent_count},")
    report_data+=("    \"healthy_agents\": $(docker ps --format "table {{.Names}}" | grep "-agent" | grep -v "_agent-" | grep -v "agent-" | wc -l || echo "0"),")
    report_data+=("    \"failed_tests\": ${failures:-0}")
    report_data+=("  }")
    report_data+=("}")
    
    printf "%s\n" "${report_data[@]}" > "$report_file"
    
    log_success "Chaos report generated: $report_file"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up chaos testing environment..."
    
    # Stop all agent services
    docker-compose -f "$COMPOSE_FILE" down
    
    # Remove volumes
    docker volume prune -f
    
    log_success "Cleanup completed"
}

# Usage function
usage() {
    echo "Usage: $0 [OPTIONS] [TEST_TYPE]"
    echo ""
    echo "Options:"
    echo "  -h, --help      Show this help message"
    echo "  -i, --iterations N  Number of chaos iterations (default: 3)"
    echo "  --no-cleanup    Don't clean up after tests"
    echo "  --report        Generate chaos report"
    echo ""
    echo "Test Types:"
    echo "  kill            Randomly kill agents"
    echo "  network         Test network partitions"
    echo "  resource        Test resource exhaustion"
    echo "  all             Run all test types randomly"
    echo ""
    echo "Examples:"
    echo "  $0 kill         Run agent kill tests"
    echo "  $0 -i 5 all     Run all tests for 5 iterations"
    echo "  $0 --report     Generate report only"
}

# Parse command line arguments
main() {
    local test_type="all"
    local iterations=3
    local cleanup=true
    local generate_report=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            -i|--iterations)
                iterations="$2"
                shift 2
                ;;
            --no-cleanup)
                cleanup=false
                shift
                ;;
            --report)
                generate_report=true
                shift
                ;;
            *)
                test_type="$1"
                shift
                ;;
        esac
    done
    
    # Validate test type
    case "$test_type" in
        "kill"|"network"|"resource"|"all")
            ;;
        *)
            log_error "Invalid test type: $test_type"
            usage
            exit 1
            ;;
    esac
    
    # Check dependencies
    check_dependencies
    
    # Run chaos tests
    if [ "$generate_report" = "true" ]; then
        generate_report
    else
        if chaos_test "$test_type" "$iterations"; then
            log_success "Chaos tests completed successfully"
            if [ "$generate_report" = "true" ]; then
                generate_report
            fi
        else
            log_error "Chaos tests failed"
            exit 1
        fi
    fi
    
    # Cleanup if requested
    if [ "$cleanup" = "true" ]; then
        cleanup
    fi
}

# Run main
main "$@"

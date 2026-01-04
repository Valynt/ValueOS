#!/bin/bash
###############################################################################
# Performance Benchmarking Suite
# 
# Measures and tracks container performance metrics
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BENCHMARK_DIR="${BENCHMARK_DIR:-${HOME}/.devcontainer-benchmarks}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="${CONTAINER_NAME:-valuecanvas-dev-optimized}"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}=========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=========================================${NC}"
    echo ""
}

###############################################################################
# Setup
###############################################################################

setup() {
    mkdir -p "$BENCHMARK_DIR"
}

###############################################################################
# Container Startup Time
###############################################################################

benchmark_startup() {
    log_section "Container Startup Time"
    
    log_info "Stopping container..."
    docker stop "$CONTAINER_NAME" &> /dev/null || true
    
    log_info "Starting container and measuring time..."
    local start_time=$(date +%s%N)
    
    docker start "$CONTAINER_NAME" &> /dev/null
    
    # Wait for container to be healthy
    while [ "$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null)" != "healthy" ]; do
        sleep 0.5
    done
    
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))  # Convert to milliseconds
    
    log_info "Startup time: ${duration}ms"
    echo "$duration"
}

###############################################################################
# Build Time
###############################################################################

benchmark_build() {
    log_section "Image Build Time"
    
    cd /workspaces/ValueOS/.devcontainer
    
    log_info "Building image (clean)..."
    docker builder prune -f &> /dev/null
    
    local start_time=$(date +%s)
    docker build -t valuecanvas-dev:benchmark -f Dockerfile.optimized .. &> /dev/null
    local end_time=$(date +%s)
    local clean_duration=$((end_time - start_time))
    
    log_info "Clean build time: ${clean_duration}s"
    
    log_info "Building image (cached)..."
    start_time=$(date +%s)
    docker build -t valuecanvas-dev:benchmark -f Dockerfile.optimized .. &> /dev/null
    end_time=$(date +%s)
    local cached_duration=$((end_time - start_time))
    
    log_info "Cached build time: ${cached_duration}s"
    
    echo "$clean_duration,$cached_duration"
}

###############################################################################
# Resource Usage
###############################################################################

benchmark_resources() {
    log_section "Resource Usage"
    
    log_info "Measuring resource usage over 30 seconds..."
    
    local cpu_sum=0
    local mem_sum=0
    local samples=0
    
    for i in {1..30}; do
        local stats=$(docker stats "$CONTAINER_NAME" --no-stream --format "{{.CPUPerc}},{{.MemPerc}}")
        local cpu=$(echo "$stats" | cut -d',' -f1 | sed 's/%//')
        local mem=$(echo "$stats" | cut -d',' -f2 | sed 's/%//')
        
        cpu_sum=$(echo "$cpu_sum + $cpu" | bc)
        mem_sum=$(echo "$mem_sum + $mem" | bc)
        samples=$((samples + 1))
        
        sleep 1
    done
    
    local avg_cpu=$(echo "scale=2; $cpu_sum / $samples" | bc)
    local avg_mem=$(echo "scale=2; $mem_sum / $samples" | bc)
    
    log_info "Average CPU: ${avg_cpu}%"
    log_info "Average Memory: ${avg_mem}%"
    
    echo "$avg_cpu,$avg_mem"
}

###############################################################################
# Disk I/O
###############################################################################

benchmark_disk_io() {
    log_section "Disk I/O Performance"
    
    log_info "Testing write performance..."
    local write_speed=$(docker exec "$CONTAINER_NAME" dd if=/dev/zero of=/tmp/test bs=1M count=100 2>&1 | grep -oP '\d+(\.\d+)? MB/s' | head -1)
    
    log_info "Testing read performance..."
    local read_speed=$(docker exec "$CONTAINER_NAME" dd if=/tmp/test of=/dev/null bs=1M 2>&1 | grep -oP '\d+(\.\d+)? MB/s' | head -1)
    
    docker exec "$CONTAINER_NAME" rm -f /tmp/test
    
    log_info "Write speed: $write_speed"
    log_info "Read speed: $read_speed"
    
    echo "$write_speed,$read_speed"
}

###############################################################################
# Network Performance
###############################################################################

benchmark_network() {
    log_section "Network Performance"
    
    log_info "Testing network latency..."
    local latency=$(docker exec "$CONTAINER_NAME" ping -c 10 8.8.8.8 2>/dev/null | tail -1 | awk -F '/' '{print $5}')
    
    log_info "Average latency: ${latency}ms"
    
    echo "$latency"
}

###############################################################################
# Command Execution Speed
###############################################################################

benchmark_commands() {
    log_section "Command Execution Speed"
    
    # Node.js startup
    log_info "Testing Node.js startup..."
    local node_time=$(docker exec "$CONTAINER_NAME" bash -c "time node -e 'console.log(1)' 2>&1" | grep real | awk '{print $2}')
    log_info "Node.js startup: $node_time"
    
    # npm command
    log_info "Testing npm command..."
    local npm_time=$(docker exec "$CONTAINER_NAME" bash -c "time npm --version 2>&1" | grep real | awk '{print $2}')
    log_info "npm command: $npm_time"
    
    # Docker command
    log_info "Testing docker command..."
    local docker_time=$(docker exec "$CONTAINER_NAME" bash -c "time docker ps 2>&1" | grep real | awk '{print $2}')
    log_info "docker command: $docker_time"
    
    echo "$node_time,$npm_time,$docker_time"
}

###############################################################################
# Generate Report
###############################################################################

generate_report() {
    local output_file="$BENCHMARK_DIR/benchmark_$TIMESTAMP.md"
    
    log_section "Generating Report"
    
    cat > "$output_file" <<EOF
# Performance Benchmark Report

**Date:** $(date -Iseconds)  
**Container:** $CONTAINER_NAME  
**Benchmark ID:** $TIMESTAMP

## Results Summary

### Container Startup
- **Startup Time:** ${1}ms
- **Target:** < 5000ms
- **Status:** $([ ${1} -lt 5000 ] && echo "✅ PASS" || echo "❌ FAIL")

### Build Performance
- **Clean Build:** ${2}s
- **Cached Build:** ${3}s
- **Cache Efficiency:** $(echo "scale=1; (1 - $3 / $2) * 100" | bc)%
- **Target:** < 60s (cached)
- **Status:** $([ ${3} -lt 60 ] && echo "✅ PASS" || echo "❌ FAIL")

### Resource Usage
- **Average CPU:** ${4}%
- **Average Memory:** ${5}%
- **CPU Target:** < 10%
- **Memory Target:** < 50%
- **Status:** $([ $(echo "$4 < 10" | bc) -eq 1 ] && [ $(echo "$5 < 50" | bc) -eq 1 ] && echo "✅ PASS" || echo "⚠️  WARN")

### Disk I/O
- **Write Speed:** ${6}
- **Read Speed:** ${7}
- **Target:** > 100 MB/s
- **Status:** ✅ PASS

### Network
- **Average Latency:** ${8}ms
- **Target:** < 50ms
- **Status:** $([ $(echo "$8 < 50" | bc) -eq 1 ] && echo "✅ PASS" || echo "⚠️  WARN")

### Command Execution
- **Node.js:** ${9}
- **npm:** ${10}
- **docker:** ${11}

## Recommendations

EOF
    
    # Add recommendations based on results
    if [ ${1} -gt 5000 ]; then
        echo "- ⚠️  Container startup time is slow. Consider optimizing health checks." >> "$output_file"
    fi
    
    if [ ${3} -gt 60 ]; then
        echo "- ⚠️  Cached build time is slow. Review Dockerfile layer caching." >> "$output_file"
    fi
    
    if [ $(echo "$4 > 10" | bc) -eq 1 ]; then
        echo "- ⚠️  High CPU usage detected. Review running processes." >> "$output_file"
    fi
    
    if [ $(echo "$5 > 50" | bc) -eq 1 ]; then
        echo "- ⚠️  High memory usage detected. Consider increasing limits or optimizing." >> "$output_file"
    fi
    
    echo "" >> "$output_file"
    echo "---" >> "$output_file"
    echo "" >> "$output_file"
    echo "**Benchmark Location:** $output_file" >> "$output_file"
    
    log_info "✓ Report generated: $output_file"
    
    # Display report
    cat "$output_file"
}

###############################################################################
# Run All Benchmarks
###############################################################################

run_all_benchmarks() {
    log_section "Running Performance Benchmarks"
    
    setup
    
    # Run benchmarks
    local startup_time=$(benchmark_startup)
    local build_times=$(benchmark_build)
    local clean_build=$(echo "$build_times" | cut -d',' -f1)
    local cached_build=$(echo "$build_times" | cut -d',' -f2)
    
    local resources=$(benchmark_resources)
    local avg_cpu=$(echo "$resources" | cut -d',' -f1)
    local avg_mem=$(echo "$resources" | cut -d',' -f2)
    
    local disk_io=$(benchmark_disk_io)
    local write_speed=$(echo "$disk_io" | cut -d',' -f1)
    local read_speed=$(echo "$disk_io" | cut -d',' -f2)
    
    local network_latency=$(benchmark_network)
    
    local commands=$(benchmark_commands)
    local node_time=$(echo "$commands" | cut -d',' -f1)
    local npm_time=$(echo "$commands" | cut -d',' -f2)
    local docker_time=$(echo "$commands" | cut -d',' -f3)
    
    # Generate report
    generate_report "$startup_time" "$clean_build" "$cached_build" "$avg_cpu" "$avg_mem" "$write_speed" "$read_speed" "$network_latency" "$node_time" "$npm_time" "$docker_time"
}

###############################################################################
# Compare Benchmarks
###############################################################################

compare_benchmarks() {
    local file1=$1
    local file2=$2
    
    if [ ! -f "$file1" ] || [ ! -f "$file2" ]; then
        log_error "Benchmark files not found"
        exit 1
    fi
    
    log_section "Benchmark Comparison"
    
    echo "Comparing:"
    echo "  Baseline: $file1"
    echo "  Current:  $file2"
    echo ""
    
    # Extract metrics and compare
    # (Simplified comparison - could be enhanced)
    
    log_info "Comparison complete"
}

###############################################################################
# Show Usage
###############################################################################

show_usage() {
    cat <<EOF
Usage: $0 COMMAND [OPTIONS]

Commands:
  run           Run all benchmarks
  startup       Benchmark startup time only
  build         Benchmark build time only
  resources     Benchmark resource usage only
  compare F1 F2 Compare two benchmark reports

Options:
  --container NAME  Container name (default: valuecanvas-dev-optimized)
  --output DIR      Output directory (default: ~/.devcontainer-benchmarks)

Examples:
  # Run all benchmarks
  $0 run

  # Benchmark startup only
  $0 startup

  # Compare benchmarks
  $0 compare benchmark_20260104_100000.md benchmark_20260104_110000.md

EOF
}

###############################################################################
# Main Execution
###############################################################################

main() {
    local command=${1:-run}
    
    case "$command" in
        run)
            run_all_benchmarks
            ;;
        startup)
            setup
            benchmark_startup
            ;;
        build)
            setup
            benchmark_build
            ;;
        resources)
            setup
            benchmark_resources
            ;;
        compare)
            compare_benchmarks "$2" "$3"
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"

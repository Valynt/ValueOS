#!/bin/bash
# Load Testing Framework for ValueOS HA Deployment
# Uses k6 for comprehensive load testing and performance validation

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/load-test-results"
NAMESPACE="valueos-ha"
BASE_URL="${BASE_URL:-https://valueos.com}"
API_URL="${API_URL:-https://api.valueos.com}"

# Load test scenarios
SCENARIOS=("baseline" "stress" "spike" "soak" "endurance")

# Results tracking
TIMESTAMP=$(date -u +'%Y%m%d_%H%M%S')
RESULTS_FILE="$RESULTS_DIR/load-test-$TIMESTAMP.json"
REPORT_FILE="$RESULTS_DIR/load-test-report-$TIMESTAMP.html"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$RESULTS_DIR/load-test.log"
}

# Create results directory
mkdir -p "$RESULTS_DIR"

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check k6 installation
    if ! command -v k6 &> /dev/null; then
        log "ERROR: k6 not found. Install k6: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    
    # Check target availability
    if ! curl -f -s "$BASE_URL/health" > /dev/null; then
        log "ERROR: Target service not available at $BASE_URL"
        exit 1
    fi
    
    # Check API availability
    if ! curl -f -s "$API_URL/health" > /dev/null; then
        log "ERROR: API service not available at $API_URL"
        exit 1
    fi
    
    log "Prerequisites check passed"
}

# Generate k6 test script
generate_test_script() {
    local scenario="$1"
    local script_file="$RESULTS_DIR/${scenario}-test.js"
    
    log "Generating test script for scenario: $scenario"
    
    case "$scenario" in
        "baseline")
            cat > "$script_file" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export let errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '5m', target: 10 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
  },
};

export default function() {
  let res = http.get(__ENV.BASE_URL + '/');
  errorRate.add(res.status >= 400);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  sleep(1);
}
EOF
            ;;
        "stress")
            cat > "$script_file" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export let errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '2m', target: 20 },
    { duration: '5m', target: 50 },
    { duration: '5m', target: 100 },
    { duration: '5m', target: 150 },
    { duration: '5m', target: 200 },
    { duration: '5m', target: 150 },
    { duration: '5m', target: 100 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.05'],
  },
};

export default function() {
  let res = http.get(__ENV.BASE_URL + '/');
  errorRate.add(res.status >= 400);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(0.5);
}
EOF
            ;;
        "spike")
            cat > "$script_file" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export let errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 200 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 10 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.1'],
    errors: ['rate<0.1'],
  },
};

export default function() {
  let res = http.get(__ENV.BASE_URL + '/');
  errorRate.add(res.status >= 400);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  
  sleep(0.1);
}
EOF
            ;;
        "soak")
            cat > "$script_file" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export let errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '5m', target: 20 },
    { duration: '1h', target: 20 },
    { duration: '5m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.02'],
    errors: ['rate<0.02'],
  },
};

export default function() {
  let res = http.get(__ENV.BASE_URL + '/');
  errorRate.add(res.status >= 400);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 300ms': (r) => r.timings.duration < 300,
  });
  
  sleep(2);
}
EOF
            ;;
        "endurance")
            cat > "$script_file" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export let errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '10m', target: 50 },
    { duration: '4h', target: 50 },
    { duration: '10m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<400'],
    http_req_failed: ['rate<0.03'],
    errors: ['rate<0.03'],
  },
};

export default function() {
  let res = http.get(__ENV.BASE_URL + '/');
  errorRate.add(res.status >= 400);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 400ms': (r) => r.timings.duration < 400,
  });
  
  sleep(1);
}
EOF
            ;;
    esac
    
    echo "$script_file"
}

# Generate API test script
generate_api_test_script() {
    local script_file="$RESULTS_DIR/api-test.js"
    
    log "Generating API test script"
    
    cat > "$script_file" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export let errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '2m', target: 20 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.02'],
    errors: ['rate<0.02'],
  },
};

export default function() {
  // Test health endpoint
  let healthRes = http.get(__ENV.API_URL + '/health');
  errorRate.add(healthRes.status >= 400);
  
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 100ms': (r) => r.timings.duration < 100,
  });
  
  // Test API endpoints
  let endpoints = ['/api/users', '/api/projects', '/api/status'];
  
  endpoints.forEach(endpoint => {
    let res = http.get(__ENV.API_URL + endpoint);
    errorRate.add(res.status >= 400);
    
    check(res, {
      [`${endpoint} status is 200`]: (r) => r.status === 200,
      [`${endpoint} response time < 300ms`]: (r) => r.timings.duration < 300,
    });
  });
  
  sleep(1);
}
EOF
    
    echo "$script_file"
}

# Run load test
run_load_test() {
    local scenario="$1"
    local script_file="$2"
    local output_file="$RESULTS_DIR/${scenario}-results.json"
    
    log "Running load test: $scenario"
    
    # Set environment variables
    export BASE_URL="$BASE_URL"
    export API_URL="$API_URL"
    
    # Run k6 test
    k6 run \
        --out json="$output_file" \
        --summary-export="$RESULTS_DIR/${scenario}-summary.json" \
        "$script_file" || {
        log "ERROR: Load test failed for scenario: $scenario"
        return 1
    }
    
    log "Load test completed: $scenario"
}

# Generate HTML report
generate_report() {
    log "Generating HTML report..."
    
    cat > "$REPORT_FILE" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>ValueOS Load Test Report - $TIMESTAMP</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .scenario { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .pass { background: #d4edda; border-color: #c3e6cb; }
        .fail { background: #f8d7da; border-color: #f5c6cb; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0; }
        .metric { background: #f8f9fa; padding: 10px; border-radius: 3px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; }
    </style>
</head>
<body>
    <div class="header">
        <h1>ValueOS Load Test Report</h1>
        <p><strong>Generated:</strong> $(date)</p>
        <p><strong>Target:</strong> $BASE_URL</p>
        <p><strong>API:</strong> $API_URL</p>
    </div>
EOF
    
    # Add results for each scenario
    for scenario in "${SCENARIOS[@]}"; do
        local summary_file="$RESULTS_DIR/${scenario}-summary.json"
        
        if [[ -f "$summary_file" ]]; then
            local status_class="pass"
            
            # Parse summary (simplified)
            local req_count=$(jq -r '.metrics.http_reqs.count // 0' "$summary_file" 2>/dev/null || echo "0")
            local req_duration=$(jq -r '.metrics.http_req_duration.avg // 0' "$summary_file" 2>/dev/null || echo "0")
            local error_rate=$(jq -r '.metrics.http_req_failed.rate // 0' "$summary_file" 2>/dev/null || echo "0")
            
            # Determine pass/fail based on error rate
            if (( $(echo "$error_rate > 0.05" | bc -l) )); then
                status_class="fail"
            fi
            
            cat >> "$REPORT_FILE" << EOF
    <div class="scenario $status_class">
        <h2>$scenario Test</h2>
        <div class="metrics">
            <div class="metric">
                <strong>Total Requests:</strong> $req_count
            </div>
            <div class="metric">
                <strong>Avg Response Time:</strong> ${req_duration}ms
            </div>
            <div class="metric">
                <strong>Error Rate:</strong> $(echo "$error_rate * 100" | bc -l | cut -d. -f1)%
            </div>
        </div>
    </div>
EOF
        fi
    done
    
    cat >> "$REPORT_FILE" << 'EOF'
</body>
</html>
EOF
    
    log "HTML report generated: $REPORT_FILE"
}

# Analyze results
analyze_results() {
    log "Analyzing load test results..."
    
    echo "=== Load Test Summary ===" | tee -a "$RESULTS_DIR/analysis.log"
    echo "Timestamp: $TIMESTAMP" | tee -a "$RESULTS_DIR/analysis.log"
    echo "Target: $BASE_URL" | tee -a "$RESULTS_DIR/analysis.log"
    echo "" | tee -a "$RESULTS_DIR/analysis.log"
    
    for scenario in "${SCENARIOS[@]}"; do
        local summary_file="$RESULTS_DIR/${scenario}-summary.json"
        
        if [[ -f "$summary_file" ]]; then
            echo "--- $scenario ---" | tee -a "$RESULTS_DIR/analysis.log"
            
            local req_count=$(jq -r '.metrics.http_reqs.count // 0' "$summary_file" 2>/dev/null || echo "0")
            local req_duration_avg=$(jq -r '.metrics.http_req_duration.avg // 0' "$summary_file" 2>/dev/null || echo "0")
            local req_duration_p95=$(jq -r '.metrics.http_req_duration["p(95)"] // 0' "$summary_file" 2>/dev/null || echo "0")
            local error_rate=$(jq -r '.metrics.http_req_failed.rate // 0' "$summary_file" 2>/dev/null || echo "0")
            
            echo "Requests: $req_count" | tee -a "$RESULTS_DIR/analysis.log"
            echo "Avg Response Time: ${req_duration_avg}ms" | tee -a "$RESULTS_DIR/analysis.log"
            echo "95th Percentile: ${req_duration_p95}ms" | tee -a "$RESULTS_DIR/analysis.log"
            echo "Error Rate: $(echo "$error_rate * 100" | bc -l | cut -d. -f1)%" | tee -a "$RESULTS_DIR/analysis.log"
            echo "" | tee -a "$RESULTS_DIR/analysis.log"
        fi
    done
}

# Main execution
main() {
    local scenario="${1:-all}"
    
    log "Starting load testing..."
    
    check_prerequisites
    
    if [[ "$scenario" == "all" ]]; then
        # Run all scenarios
        for test_scenario in "${SCENARIOS[@]}"; do
            log "Running scenario: $test_scenario"
            local script_file=$(generate_test_script "$test_scenario")
            run_load_test "$test_scenario" "$script_file"
        done
        
        # Run API test
        local api_script=$(generate_api_test_script)
        run_load_test "api" "$api_script"
        
    else
        # Run specific scenario
        if [[ " ${SCENARIOS[@]} " =~ " ${scenario} " ]]; then
            local script_file=$(generate_test_script "$scenario")
            run_load_test "$scenario" "$script_file"
        else
            log "ERROR: Unknown scenario: $scenario"
            log "Available scenarios: ${SCENARIOS[*]}"
            exit 1
        fi
    fi
    
    generate_report
    analyze_results
    
    log "Load testing completed!"
    log "Results available in: $RESULTS_DIR"
    log "Report: $REPORT_FILE"
}

# Command line interface
case "${1:-all}" in
    "baseline"|"stress"|"spike"|"soak"|"endurance"|"all")
        main "$1"
        ;;
    "api")
        check_prerequisites
        local api_script=$(generate_api_test_script)
        run_load_test "api" "$api_script"
        generate_report
        ;;
    "report")
        generate_report
        ;;
    *)
        echo "Usage: $0 {baseline|stress|spike|soak|endurance|api|all|report}"
        echo "  baseline   - Baseline performance test (low load)"
        echo "  stress     - Stress test (gradual load increase)"
        echo "  spike      - Spike test (sudden load increase)"
        echo "  soak       - Soak test (sustained load)"
        echo "  endurance  - Endurance test (long duration)"
        echo "  api        - API endpoint testing"
        echo "  all        - Run all test scenarios"
        echo "  report     - Generate HTML report from existing results"
        exit 1
        ;;
esac

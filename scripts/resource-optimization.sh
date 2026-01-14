#!/bin/bash
# Resource Optimization Script for ValueOS HA Deployment
# Analyzes resource usage and provides optimization recommendations

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NAMESPACE="valueos-ha"
RESULTS_DIR="$PROJECT_ROOT/resource-optimization"
TIMESTAMP=$(date -u +'%Y%m%d_%H%M%S')

# Optimization thresholds
CPU_HIGH_THRESHOLD=80
CPU_LOW_THRESHOLD=20
MEMORY_HIGH_THRESHOLD=85
MEMORY_LOW_THRESHOLD=30

# Create results directory
mkdir -p "$RESULTS_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$RESULTS_DIR/optimization.log"
}

# Get current resource usage
get_resource_usage() {
    log "Collecting resource usage data..."
    
    # Get pod resource usage
    kubectl top pods -n "$NAMESPACE" --no-headers > "$RESULTS_DIR/pod-usage.txt"
    
    # Get node resource usage
    kubectl top nodes --no-headers > "$RESULTS_DIR/node-usage.txt"
    
    # Get pod resource requests/limits
    kubectl get pods -n "$NAMESPACE" -o json > "$RESULTS_DIR/pod-resources.json"
    
    # Get deployment resource configurations
    kubectl get deployments -n "$NAMESPACE" -o json > "$RESULTS_DIR/deployment-resources.json"
    
    log "Resource usage data collected"
}

# Analyze CPU usage
analyze_cpu_usage() {
    log "Analyzing CPU usage..."
    
    echo "=== CPU Usage Analysis ===" | tee -a "$RESULTS_DIR/cpu-analysis.txt"
    
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            local pod_name=$(echo "$line" | awk '{print $1}')
            local cpu_usage=$(echo "$line" | awk '{print $2}' | sed 's/m//')
            local cpu_cores=$(echo "$cpu_usage" | awk '{print $1/1000}')
            
            # Get CPU requests/limits
            local cpu_request=$(kubectl get pod "$pod_name" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].resources.requests.cpu}' 2>/dev/null || echo "0")
            local cpu_limit=$(kubectl get pod "$pod_name" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].resources.limits.cpu}' 2>/dev/null || echo "0")
            
            # Convert to millicores
            local request_millicores=$(echo "$cpu_request" | sed 's/m//' | sed 's/[^0-9.]//g' | awk '{print $1*1000}' || echo "0")
            local limit_millicores=$(echo "$cpu_limit" | sed 's/m//' | sed 's/[^0-9.]//g' | awk '{print $1*1000}' || echo "0")
            
            # Calculate utilization percentage
            local utilization_pct=0
            if [[ "$limit_millicores" -gt 0 ]]; then
                utilization_pct=$(echo "scale=1; $cpu_usage / $limit_millicores * 100" | bc)
            fi
            
            echo "Pod: $pod_name" | tee -a "$RESULTS_DIR/cpu-analysis.txt"
            echo "  Usage: ${cpu_usage}m (${cpu_cores} cores)" | tee -a "$RESULTS_DIR/cpu-analysis.txt"
            echo "  Request: ${request_millicores}m" | tee -a "$RESULTS_DIR/cpu-analysis.txt"
            echo "  Limit: ${limit_millicores}m" | tee -a "$RESULTS_DIR/cpu-analysis.txt"
            echo "  Utilization: ${utilization_pct}%" | tee -a "$RESULTS_DIR/cpu-analysis.txt"
            
            # Optimization recommendations
            if (( $(echo "$utilization_pct > $CPU_HIGH_THRESHOLD" | bc -l) )); then
                echo "  ⚠️  RECOMMENDATION: CPU usage high, consider increasing limits or adding replicas" | tee -a "$RESULTS_DIR/cpu-analysis.txt"
            elif (( $(echo "$utilization_pct < $CPU_LOW_THRESHOLD" | bc -l) )); then
                echo "  💡 RECOMMENDATION: CPU usage low, consider reducing requests/limits" | tee -a "$RESULTS_DIR/cpu-analysis.txt"
            else
                echo "  ✅ CPU usage within optimal range" | tee -a "$RESULTS_DIR/cpu-analysis.txt"
            fi
            echo "" | tee -a "$RESULTS_DIR/cpu-analysis.txt"
        fi
    done < "$RESULTS_DIR/pod-usage.txt"
}

# Analyze memory usage
analyze_memory_usage() {
    log "Analyzing memory usage..."
    
    echo "=== Memory Usage Analysis ===" | tee -a "$RESULTS_DIR/memory-analysis.txt"
    
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            local pod_name=$(echo "$line" | awk '{print $1}')
            local memory_usage=$(echo "$line" | awk '{print $3}' | sed 's/Mi//')
            
            # Get memory requests/limits
            local memory_request=$(kubectl get pod "$pod_name" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].resources.requests.memory}' 2>/dev/null || echo "0")
            local memory_limit=$(kubectl get pod "$pod_name" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].resources.limits.memory}' 2>/dev/null || echo "0")
            
            # Convert to Mi
            local request_mi=$(echo "$memory_request" | sed 's/Mi//' | sed 's/Gi//' | awk '{print $1*1024}' || echo "0")
            local limit_mi=$(echo "$memory_limit" | sed 's/Mi//' | sed 's/Gi//' | awk '{print $1*1024}' || echo "0")
            
            # Calculate utilization percentage
            local utilization_pct=0
            if [[ "$limit_mi" -gt 0 ]]; then
                utilization_pct=$(echo "scale=1; $memory_usage / $limit_mi * 100" | bc)
            fi
            
            echo "Pod: $pod_name" | tee -a "$RESULTS_DIR/memory-analysis.txt"
            echo "  Usage: ${memory_usage}Mi" | tee -a "$RESULTS_DIR/memory-analysis.txt"
            echo "  Request: ${request_mi}Mi" | tee -a "$RESULTS_DIR/memory-analysis.txt"
            echo "  Limit: ${limit_mi}Mi" | tee -a "$RESULTS_DIR/memory-analysis.txt"
            echo "  Utilization: ${utilization_pct}%" | tee -a "$RESULTS_DIR/memory-analysis.txt"
            
            # Optimization recommendations
            if (( $(echo "$utilization_pct > $MEMORY_HIGH_THRESHOLD" | bc -l) )); then
                echo "  ⚠️  RECOMMENDATION: Memory usage high, consider increasing limits" | tee -a "$RESULTS_DIR/memory-analysis.txt"
            elif (( $(echo "$utilization_pct < $MEMORY_LOW_THRESHOLD" | bc -l) )); then
                echo "  💡 RECOMMENDATION: Memory usage low, consider reducing requests/limits" | tee -a "$RESULTS_DIR/memory-analysis.txt"
            else
                echo "  ✅ Memory usage within optimal range" | tee -a "$RESULTS_DIR/memory-analysis.txt"
            fi
            echo "" | tee -a "$RESULTS_DIR/memory-analysis.txt"
        fi
    done < "$RESULTS_DIR/pod-usage.txt"
}

# Generate optimization recommendations
generate_recommendations() {
    log "Generating optimization recommendations..."
    
    cat > "$RESULTS_DIR/recommendations.yaml" << 'EOF'
# Resource Optimization Recommendations
# Generated automatically based on current usage patterns

apiVersion: v1
kind: ConfigMap
metadata:
  name: resource-optimizations
  namespace: valueos-ha
data:
EOF
    
    # Analyze each deployment
    kubectl get deployments -n "$NAMESPACE" -o name | while read -r deployment; do
        local deployment_name=$(echo "$deployment" | cut -d'/' -f2)
        
        # Get current resource configuration
        local cpu_request=$(kubectl get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}' 2>/dev/null || echo "0")
        local cpu_limit=$(kubectl get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].resources.limits.cpu}' 2>/dev/null || echo "0")
        local memory_request=$(kubectl get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].resources.requests.memory}' 2>/dev/null || echo "0")
        local memory_limit=$(kubectl get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].resources.limits.memory}' 2>/dev/null || echo "0")
        
        # Get average usage from pods
        local avg_cpu_usage=0
        local avg_memory_usage=0
        local pod_count=0
        
        while IFS= read -r line; do
            if [[ "$line" == *"$deployment_name"* ]]; then
                local cpu_usage=$(echo "$line" | awk '{print $2}' | sed 's/m//')
                local memory_usage=$(echo "$line" | awk '{print $3}' | sed 's/Mi//')
                
                avg_cpu_usage=$((avg_cpu_usage + cpu_usage))
                avg_memory_usage=$((avg_memory_usage + memory_usage))
                pod_count=$((pod_count + 1))
            fi
        done < "$RESULTS_DIR/pod-usage.txt"
        
        if [[ $pod_count -gt 0 ]]; then
            avg_cpu_usage=$((avg_cpu_usage / pod_count))
            avg_memory_usage=$((avg_memory_usage / pod_count))
        fi
        
        # Generate recommendations
        echo "  $deployment_name.cpu-request: \"$cpu_request\"" >> "$RESULTS_DIR/recommendations.yaml"
        echo "  $deployment_name.cpu-limit: \"$cpu_limit\"" >> "$RESULTS_DIR/recommendations.yaml"
        echo "  $deployment_name.memory-request: \"$memory_request\"" >> "$RESULTS_DIR/recommendations.yaml"
        echo "  $deployment_name.memory-limit: \"$memory_limit\"" >> "$RESULTS_DIR/recommendations.yaml"
        echo "  $deployment_name.avg-cpu-usage: \"${avg_cpu_usage}m\"" >> "$RESULTS_DIR/recommendations.yaml"
        echo "  $deployment_name.avg-memory-usage: \"${avg_memory_usage}Mi\"" >> "$RESULTS_DIR/recommendations.yaml"
    done
    
    log "Optimization recommendations generated"
}

# Apply optimizations (dry run by default)
apply_optimizations() {
    local dry_run="${1:-true}"
    
    log "Applying resource optimizations (dry-run: $dry_run)..."
    
    # Example optimization: Right-size based on usage
    kubectl patch deployment valueos-frontend-ha -n "$NAMESPACE" \
        --dry-run="$dry_run" \
        -p '{"spec":{"template":{"spec":{"containers":[{"name":"frontend","resources":{"requests":{"cpu":"400m","memory":"512Mi"},"limits":{"cpu":"800m","memory":"1Gi"}}}]}}}}' || true
    
    kubectl patch deployment valueos-backend-ha -n "$NAMESPACE" \
        --dry-run="$dry_run" \
        -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"requests":{"cpu":"600m","memory":"1Gi"},"limits":{"cpu":"1200m","memory":"2Gi"}}}]}}}}' || true
    
    kubectl patch deployment prometheus -n "$NAMESPACE" \
        --dry-run="$dry_run" \
        -p '{"spec":{"template":{"spec":{"containers":[{"name":"prometheus","resources":{"requests":{"cpu":"300m","memory":"512Mi"},"limits":{"cpu":"600m","memory":"1Gi"}}}]}}}}' || true
    
    kubectl patch deployment grafana -n "$NAMESPACE" \
        --dry-run="$dry_run" \
        -p '{"spec":{"template":{"spec":{"containers":[{"name":"grafana","resources":{"requests":{"cpu":"150m","memory":"256Mi"},"limits":{"cpu":"300m","memory":"512Mi"}}}]}}}}' || true
    
    if [[ "$dry_run" == "false" ]]; then
        log "Optimizations applied"
    else
        log "Dry run completed. Use --apply to actually apply changes."
    fi
}

# Generate cost analysis
generate_cost_analysis() {
    log "Generating cost analysis..."
    
    cat > "$RESULTS_DIR/cost-analysis.txt" << EOF
=== Cost Analysis ===
Generated: $(date)

Current Resource Allocation:
EOF
    
    # Calculate total resource allocation
    local total_cpu_request=0
    local total_cpu_limit=0
    local total_memory_request=0
    local total_memory_limit=0
    
    kubectl get deployments -n "$NAMESPACE" -o json | jq -r '.items[] | .spec.template.spec.containers[] | select(.resources) | "\(.name // "unknown") \(.resources.requests.cpu // "0") \(.resources.requests.memory // "0") \(.resources.limits.cpu // "0") \(.resources.limits.memory // "0")"' | while read -r line; do
        local container_name=$(echo "$line" | awk '{print $1}')
        local cpu_req=$(echo "$line" | awk '{print $2}')
        local mem_req=$(echo "$line" | awk '{print $3}')
        local cpu_lim=$(echo "$line" | awk '{print $4}')
        local mem_lim=$(echo "$line" | awk '{print $5}')
        
        echo "Container: $container_name" >> "$RESULTS_DIR/cost-analysis.txt"
        echo "  CPU Request: $cpu_req" >> "$RESULTS_DIR/cost-analysis.txt"
        echo "  Memory Request: $mem_req" >> "$RESULTS_DIR/cost-analysis.txt"
        echo "  CPU Limit: $cpu_lim" >> "$RESULTS_DIR/cost-analysis.txt"
        echo "  Memory Limit: $mem_lim" >> "$RESULTS_DIR/cost-analysis.txt"
        echo "" >> "$RESULTS_DIR/cost-analysis.txt"
    done
    
    # Estimated monthly costs (simplified calculation)
    echo "Estimated Monthly Costs:" >> "$RESULTS_DIR/cost-analysis.txt"
    echo "Note: These are rough estimates based on AWS pricing" >> "$RESULTS_DIR/cost-analysis.txt"
    echo "" >> "$RESULTS_DIR/cost-analysis.txt"
    
    # Add cost estimation logic here based on your cloud provider
    echo "CPU: $0.048 per vCPU-hour (rough estimate)" >> "$RESULTS_DIR/cost-analysis.txt"
    echo "Memory: $0.0065 per GB-hour (rough estimate)" >> "$RESULTS_DIR/cost-analysis.txt"
    echo "" >> "$RESULTS_DIR/cost-analysis.txt"
    
    log "Cost analysis completed"
}

# Main execution
main() {
    local action="${1:-analyze}"
    local dry_run="${2:-true}"
    
    log "Starting resource optimization..."
    
    case "$action" in
        "analyze")
            get_resource_usage
            analyze_cpu_usage
            analyze_memory_usage
            generate_recommendations
            generate_cost_analysis
            log "Resource analysis completed. Results available in: $RESULTS_DIR"
            ;;
        "optimize")
            get_resource_usage
            apply_optimizations "$dry_run"
            ;;
        "report")
            generate_cost_analysis
            ;;
        *)
            echo "Usage: $0 {analyze|optimize|report} [--apply]"
            echo "  analyze  - Analyze current resource usage and generate recommendations"
            echo "  optimize - Apply resource optimizations (use --apply to actually apply)"
            echo "  report   - Generate cost analysis report"
            exit 1
            ;;
    esac
}

# Command line interface
case "${1:-analyze}" in
    "analyze")
        main "analyze"
        ;;
    "optimize")
        if [[ "${2:-}" == "--apply" ]]; then
            main "optimize" "false"
        else
            main "optimize" "true"
        fi
        ;;
    "report")
        main "report"
        ;;
    *)
        echo "Usage: $0 {analyze|optimize|report} [--apply]"
        echo "  analyze  - Analyze current resource usage and generate recommendations"
        echo "  optimize - Apply resource optimizations (use --apply to actually apply)"
        echo "  report   - Generate cost analysis report"
        exit 1
        ;;
esac

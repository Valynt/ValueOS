#!/bin/bash

# Automated Rollback Trigger System
# Monitors SLOs and triggers rollbacks on violations

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# SLO Configuration
ERROR_BUDGET_PERCENTAGE=5.0       # 5% error budget
LATENCY_SLO_MS=1000               # 1000ms latency SLO
AVAILABILITY_SLO=99.5             # 99.5% availability SLO
ROLLBACK_WINDOW_MINUTES=30        # Look back window for metrics

# Monitoring configuration
NAMESPACE="${NAMESPACE:-valuecanvas}"
SERVICE_NAME="${SERVICE_NAME:-backend-service}"
MONITORING_INTERVAL=60            # Check every 60 seconds
ALERT_THRESHOLD=3                 # Number of consecutive failures before rollback

# SLO violation tracking
VIOLATION_COUNT=0
LAST_CHECK_TIME=""

# Logging functions
log_info() {
    echo -e "${BLUE}📊 $1${NC}"
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

log_alert() {
    echo -e "${RED}🚨 ALERT: $1${NC}"
}

# Get error rate from CloudWatch
get_error_rate() {
    local start_time=$(date -u -d "${ROLLBACK_WINDOW_MINUTES} minutes ago" +%Y-%m-%dT%H:%M:%S)
    local end_time=$(date -u +%Y-%m-%dT%H:%M:%S)

    local error_count=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/ApplicationELB \
        --metric-name HTTPCode_Target_5XX_Count \
        --dimensions Name=LoadBalancer,Value=valuecanvas-prod \
        --start-time "$start_time" \
        --end-time "$end_time" \
        --period 300 \
        --statistics Sum \
        --query 'Datapoints[0].Sum' \
        --output text 2>/dev/null || echo "0")

    local total_count=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/ApplicationELB \
        --metric-name RequestCount \
        --dimensions Name=LoadBalancer,Value=valuecanvas-prod \
        --start-time "$start_time" \
        --end-time "$end_time" \
        --period 300 \
        --statistics Sum \
        --query 'Datapoints[0].Sum' \
        --output text 2>/dev/null || echo "1")

    if [ "$total_count" = "None" ] || [ "$total_count" = "0" ]; then
        echo "0"
    else
        awk "BEGIN {printf \"%.2f\", ($error_count * 100) / $total_count}"
    fi
}

# Get availability percentage
get_availability() {
    local start_time=$(date -u -d "${ROLLBACK_WINDOW_MINUTES} minutes ago" +%Y-%m-%dT%H:%M:%S)
    local end_time=$(date -u +%Y-%m-%dT%H:%M:%S)

    local success_count=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/ApplicationELB \
        --metric-name HTTPCode_Target_2XX_Count \
        --dimensions Name=LoadBalancer,Value=valuecanvas-prod \
        --start-time "$start_time" \
        --end-time "$end_time" \
        --period 300 \
        --statistics Sum \
        --query 'Datapoints[0].Sum' \
        --output text 2>/dev/null || echo "0")

    local total_count=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/ApplicationELB \
        --metric-name RequestCount \
        --dimensions Name=LoadBalancer,Value=valuecanvas-prod \
        --start-time "$start_time" \
        --end-time "$end_time" \
        --period 300 \
        --statistics Sum \
        --query 'Datapoints[0].Sum' \
        --output text 2>/dev/null || echo "1")

    if [ "$total_count" = "None" ] || [ "$total_count" = "0" ]; then
        echo "100.00"
    else
        awk "BEGIN {printf \"%.2f\", ($success_count * 100) / $total_count}"
    fi
}

# Get latency (p95)
get_latency_p95() {
    local start_time=$(date -u -d "${ROLLBACK_WINDOW_MINUTES} minutes ago" +%Y-%m-%dT%H:%M:%S)
    local end_time=$(date -u +%Y-%m-%dT%H:%M:%S)

    local latency=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/ApplicationELB \
        --metric-name TargetResponseTime \
        --dimensions Name=LoadBalancer,Value=valuecanvas-prod \
        --start-time "$start_time" \
        --end-time "$end_time" \
        --period 300 \
        --statistics Average \
        --query 'Datapoints[0].Average' \
        --output text 2>/dev/null || echo "0")

    # Convert to milliseconds
    awk "BEGIN {printf \"%.0f\", $latency * 1000}"
}

# Check SLO violations
check_slo_violations() {
    log_info "Checking SLO compliance..."

    local error_rate=$(get_error_rate)
    local availability=$(get_availability)
    local latency=$(get_latency_p95)

    log_info "Current metrics (last ${ROLLBACK_WINDOW_MINUTES} minutes):"
    log_info "  Error Rate: ${error_rate}% (budget: ${ERROR_BUDGET_PERCENTAGE}%)"
    log_info "  Availability: ${availability}% (SLO: ${AVAILABILITY_SLO}%)"
    log_info "  Latency P95: ${latency}ms (SLO: ${LATENCY_SLO_MS}ms)"

    local violations=0

    # Check error rate
    if awk "BEGIN {exit !($error_rate > $ERROR_BUDGET_PERCENTAGE)}"; then
        log_alert "ERROR BUDGET VIOLATION: ${error_rate}% > ${ERROR_BUDGET_PERCENTAGE}%"
        ((violations++))
    fi

    # Check availability
    if awk "BEGIN {exit !($availability < $AVAILABILITY_SLO)}"; then
        log_alert "AVAILABILITY SLO VIOLATION: ${availability}% < ${AVAILABILITY_SLO}%"
        ((violations++))
    fi

    # Check latency
    if [ "$latency" -gt "$LATENCY_SLO_MS" ]; then
        log_alert "LATENCY SLO VIOLATION: ${latency}ms > ${LATENCY_SLO_MS}ms"
        ((violations++))
    fi

    echo "$violations"
}

# Check if canary deployment is active
is_canary_active() {
    local canary_pods=$(kubectl get pods -n "$NAMESPACE" -l version=canary --no-headers 2>/dev/null | wc -l)
    [ "$canary_pods" -gt 0 ]
}

# Trigger rollback
trigger_rollback() {
    local reason="$1"

    log_alert "TRIGGERING AUTOMATED ROLLBACK"
    log_alert "Reason: $reason"

    # Check if canary is active
    if is_canary_active; then
        log_info "Canary deployment detected, rolling back canary"
        ./scripts/canary-deploy.sh rollback || log_error "Canary rollback failed"
    else
        log_info "No active canary, rolling back to previous deployment"
        ./scripts/rollback-production.sh --previous --service backend || log_error "Deployment rollback failed"
    fi

    # Send notification
    send_rollback_notification "$reason"

    log_success "Automated rollback completed"
}

# Send rollback notification
send_rollback_notification() {
    local reason="$1"

    local message="🚨 Automated Rollback Triggered

Environment: Production
Service: Backend
Reason: $reason
Time: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

SLO monitoring detected violations and automatically triggered rollback."

    # Send Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK_URL" || log_warning "Failed to send Slack notification"
    fi

    # Send to PagerDuty if configured
    if [[ -n "${PAGERDUTY_INTEGRATION_KEY:-}" ]]; then
        curl -X POST \
            -H "Content-Type: application/json" \
            -d "{\"routing_key\":\"$PAGERDUTY_INTEGRATION_KEY\",\"event_action\":\"trigger\",\"payload\":{\"summary\":\"Automated rollback triggered: $reason\",\"source\":\"slo-monitor\"}}" \
            "https://events.pagerduty.com/v2/enqueue" || log_warning "Failed to send PagerDuty alert"
    fi
}

# Main monitoring loop
monitor_slos() {
    log_info "Starting SLO monitoring with automated rollback triggers"
    log_info "Configuration:"
    log_info "  Error Budget: ${ERROR_BUDGET_PERCENTAGE}%"
    log_info "  Availability SLO: ${AVAILABILITY_SLO}%"
    log_info "  Latency SLO: ${LATENCY_SLO_MS}ms"
    log_info "  Alert Threshold: ${ALERT_THRESHOLD} consecutive violations"
    log_info "  Check Interval: ${MONITORING_INTERVAL}s"

    while true; do
        local violations=$(check_slo_violations)

        if [ "$violations" -gt 0 ]; then
            ((VIOLATION_COUNT++))
            log_warning "SLO violation detected ($VIOLATION_COUNT/$ALERT_THRESHOLD)"

            if [ "$VIOLATION_COUNT" -ge "$ALERT_THRESHOLD" ]; then
                log_alert "ALERT THRESHOLD REACHED - Triggering rollback"
                trigger_rollback "SLO violations exceeded threshold ($VIOLATION_COUNT consecutive violations)"
                VIOLATION_COUNT=0
            fi
        else
            # Reset violation count on good metrics
            if [ "$VIOLATION_COUNT" -gt 0 ]; then
                log_success "SLO violations resolved"
                VIOLATION_COUNT=0
            fi
        fi

        LAST_CHECK_TIME=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
        sleep "$MONITORING_INTERVAL"
    done
}

# Check current status
status_check() {
    log_info "SLO Monitor Status"
    echo "Last check: ${LAST_CHECK_TIME:-Never}"
    echo "Violation count: $VIOLATION_COUNT/$ALERT_THRESHOLD"
    echo ""

    local violations=$(check_slo_violations)
    echo "Current SLO status: $violations violations detected"
}

# Main execution
main() {
    local command="${1:-monitor}"

    case "$command" in
        monitor)
            monitor_slos
            ;;
        status)
            status_check
            ;;
        check)
            check_slo_violations >/dev/null
            ;;
        rollback)
            local reason="${2:-Manual trigger}"
            trigger_rollback "$reason"
            ;;
        *)
            echo "Usage: $0 [monitor|status|check|rollback] [reason]"
            echo "Commands:"
            echo "  monitor - Start SLO monitoring (default)"
            echo "  status  - Show current status"
            echo "  check   - Check SLOs once"
            echo "  rollback - Manually trigger rollback"
            exit 1
            ;;
    esac
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

#!/usr/bin/env bash

set -euo pipefail

PROMETHEUS_BASE_URL="${PROMETHEUS_BASE_URL:-http://localhost:9090}"
SLO_MAX_P95_LATENCY_MS="${SLO_MAX_P95_LATENCY_MS:-200}"
SLO_MAX_ERROR_RATE="${SLO_MAX_ERROR_RATE:-0.001}"
SLO_MAX_MTTR_MINUTES="${SLO_MAX_MTTR_MINUTES:-15}"

LATENCY_QUERY='histogram_quantile(0.95, sum(rate(valuecanvas_http_request_duration_ms_bucket[5m])) by (le))'
ERROR_RATE_QUERY='sum(rate(valuecanvas_http_requests_total{status_code=~"5.."}[5m])) / sum(rate(valuecanvas_http_requests_total[5m]))'
MTTR_QUERY='avg_over_time(valuecanvas_incident_mttr_minutes[24h])'

node scripts/ci/check-slo-threshold-consistency.mjs

query_prometheus() {
  local query="$1"

  curl --silent --show-error --fail --get \
    --data-urlencode "query=${query}" \
    "${PROMETHEUS_BASE_URL}/api/v1/query"
}

extract_value() {
  jq -r '.data.result[0].value[1] // empty'
}

compare_gt() {
  awk -v value="$1" -v threshold="$2" 'BEGIN { exit !(value > threshold) }'
}

compare_missing() {
  [[ -z "$1" || "$1" == "NaN" || "$1" == "+Inf" || "$1" == "-Inf" ]]
}

evaluate_slo() {
  local name="$1"
  local query="$2"
  local threshold="$3"
  local unit="$4"

  local response
  response=$(query_prometheus "$query")
  local value
  value=$(printf '%s' "$response" | extract_value)

  if compare_missing "$value"; then
    echo "❌ ${name}: no datapoint returned from Prometheus query"
    return 1
  fi

  if compare_gt "$value" "$threshold"; then
    echo "❌ ${name}: ${value}${unit} exceeds threshold ${threshold}${unit}"
    return 1
  fi

  echo "✅ ${name}: ${value}${unit} within threshold ${threshold}${unit}"
  return 0
}

main() {
  local failed=0

  echo "🔍 Evaluating observability SLO gate against ${PROMETHEUS_BASE_URL}"

  evaluate_slo "Latency P95" "$LATENCY_QUERY" "$SLO_MAX_P95_LATENCY_MS" "ms" || failed=1
  evaluate_slo "Error rate" "$ERROR_RATE_QUERY" "$SLO_MAX_ERROR_RATE" "" || failed=1
  evaluate_slo "MTTR" "$MTTR_QUERY" "$SLO_MAX_MTTR_MINUTES" "m" || failed=1

  if [[ "$failed" -ne 0 ]]; then
    echo "🚫 Observability SLO gate failed"
    exit 1
  fi

  echo "🎉 Observability SLO gate passed"
}

main "$@"

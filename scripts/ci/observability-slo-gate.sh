#!/usr/bin/env bash

set -euo pipefail

PROMETHEUS_BASE_URL="${PROMETHEUS_BASE_URL:-http://localhost:9090}"
PROMETHEUS_BEARER_TOKEN="${PROMETHEUS_BEARER_TOKEN:-}"
FAST_BURN_THRESHOLD="${SLO_FAST_BURN_THRESHOLD:-14.4}"
SLOW_BURN_THRESHOLD="${SLO_SLOW_BURN_THRESHOLD:-6}"
GATE_OUTPUT_DIR="${SLO_GATE_OUTPUT_DIR:-artifacts/slo-gate}"

mkdir -p "$GATE_OUTPUT_DIR"
REPORT_JSON="$GATE_OUTPUT_DIR/slo-gate-report.json"
REPORT_MD="$GATE_OUTPUT_DIR/slo-gate-summary.md"

SLOS=(
  "api_availability"
  "api_latency"
  "runtime_availability"
  "runtime_latency"
  "messaging_availability"
  "messaging_latency"
  "memory_availability"
  "memory_freshness"
)

query_prometheus() {
  local query="$1"
  local auth=()
  if [[ -n "$PROMETHEUS_BEARER_TOKEN" ]]; then
    auth=(-H "Authorization: Bearer ${PROMETHEUS_BEARER_TOKEN}")
  fi

  curl --silent --show-error --fail --get \
    "${auth[@]}" \
    --data-urlencode "query=${query}" \
    "${PROMETHEUS_BASE_URL%/}/api/v1/query"
}

extract_value() {
  jq -r '.data.result[0].value[1] // empty'
}

is_missing() {
  [[ -z "$1" || "$1" == "NaN" || "$1" == "+Inf" || "$1" == "-Inf" ]]
}

compare_gt() {
  awk -v value="$1" -v threshold="$2" 'BEGIN { exit !(value > threshold) }'
}

failed=0
rows_json="[]"

for slo in "${SLOS[@]}"; do
  fast5=$(query_prometheus "slo:${slo}:error_budget_burn_rate5m" | extract_value || true)
  fast1h=$(query_prometheus "slo:${slo}:error_budget_burn_rate1h" | extract_value || true)
  slow30m=$(query_prometheus "slo:${slo}:error_budget_burn_rate30m" | extract_value || true)
  slow6h=$(query_prometheus "slo:${slo}:error_budget_burn_rate6h" | extract_value || true)

  status="pass"
  reason="within policy"

  if is_missing "$fast5" || is_missing "$fast1h" || is_missing "$slow30m" || is_missing "$slow6h"; then
    status="fail"
    reason="missing burn-rate metric(s)"
    failed=1
  elif compare_gt "$fast5" "$FAST_BURN_THRESHOLD" && compare_gt "$fast1h" "$FAST_BURN_THRESHOLD"; then
    status="fail"
    reason="critical burn threshold exceeded"
    failed=1
  elif compare_gt "$slow30m" "$SLOW_BURN_THRESHOLD" && compare_gt "$slow6h" "$SLOW_BURN_THRESHOLD"; then
    status="fail"
    reason="warning burn threshold exceeded"
    failed=1
  fi

  rows_json=$(jq -c \
    --arg slo "$slo" \
    --arg fast5 "${fast5:-}" \
    --arg fast1h "${fast1h:-}" \
    --arg slow30m "${slow30m:-}" \
    --arg slow6h "${slow6h:-}" \
    --arg status "$status" \
    --arg reason "$reason" \
    '. + [{slo:$slo, burn_rate_5m:$fast5, burn_rate_1h:$fast1h, burn_rate_30m:$slow30m, burn_rate_6h:$slow6h, status:$status, reason:$reason}]' \
    <<<"$rows_json")

done

jq -n \
  --arg generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg prometheus_base_url "$PROMETHEUS_BASE_URL" \
  --arg fast_burn_threshold "$FAST_BURN_THRESHOLD" \
  --arg slow_burn_threshold "$SLOW_BURN_THRESHOLD" \
  --argjson checks "$rows_json" \
  --arg result "$([[ "$failed" -eq 0 ]] && echo PASS || echo FAIL)" \
  '{generated_at:$generated_at,prometheus_base_url:$prometheus_base_url,thresholds:{fast:$fast_burn_threshold,slow:$slow_burn_threshold},result:$result,checks:$checks}' > "$REPORT_JSON"

{
  echo "# Observability SLO Gate"
  echo
  echo "- generated_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "- prometheus_base_url: ${PROMETHEUS_BASE_URL}"
  echo "- fast burn threshold: ${FAST_BURN_THRESHOLD}"
  echo "- slow burn threshold: ${SLOW_BURN_THRESHOLD}"
  echo
  echo "| SLO | 5m | 1h | 30m | 6h | status | reason |"
  echo "|---|---:|---:|---:|---:|---|---|"
  jq -r '.checks[] | "| \(.slo) | \(.burn_rate_5m) | \(.burn_rate_1h) | \(.burn_rate_30m) | \(.burn_rate_6h) | \(.status) | \(.reason) |"' "$REPORT_JSON"
} > "$REPORT_MD"

if [[ "$failed" -ne 0 ]]; then
  echo "🚫 Observability SLO gate failed"
  cat "$REPORT_MD"
  exit 1
fi

echo "🎉 Observability SLO gate passed"

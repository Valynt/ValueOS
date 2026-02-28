#!/bin/bash
# Chaos testing for the Kubernetes-based agent-fabric deployment.
# Replaces legacy standalone docker-agent assumptions.

set -euo pipefail

NAMESPACE="${CHAOS_NAMESPACE:-valynt}"
ORCHESTRATOR_DEPLOYMENT="${CHAOS_ORCHESTRATOR_DEPLOYMENT:-backend-blue}"
AGENT_DEPLOYMENTS=(
  "opportunity-agent"
  "target-agent"
  "financial-modeling-agent"
  "integrity-agent"
  "realization-agent"
  "expansion-agent"
)

log() { printf '[%s] %s\n' "$1" "$2"; }

check_dependencies() {
  command -v kubectl >/dev/null 2>&1 || {
    log ERROR 'kubectl is required for k8s chaos tests.'
    exit 1
  }
}

pick_agent() {
  local idx=$((RANDOM % ${#AGENT_DEPLOYMENTS[@]}))
  printf '%s\n' "${AGENT_DEPLOYMENTS[$idx]}"
}

kill_random_agent_pod() {
  local deployment
  deployment="$(pick_agent)"
  log INFO "Restarting deployment/${deployment} in namespace ${NAMESPACE}"

  kubectl -n "${NAMESPACE}" rollout restart "deployment/${deployment}"
  kubectl -n "${NAMESPACE}" rollout status "deployment/${deployment}" --timeout=3m
  kubectl -n "${NAMESPACE}" rollout status "deployment/${ORCHESTRATOR_DEPLOYMENT}" --timeout=3m

  log SUCCESS "${deployment} recovered and orchestrator remained healthy"
}

run_chaos_tests() {
  local iterations="${1:-3}"
  local passed=0

  for i in $(seq 1 "${iterations}"); do
    log INFO "Agent-fabric kill test iteration ${i}/${iterations}"
    kill_random_agent_pod
    passed=$((passed + 1))
  done

  log SUCCESS "Completed ${passed}/${iterations} agent-fabric kill iterations"
}

main() {
  local iterations=3

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --iterations)
        iterations="$2"
        shift 2
        ;;
      -h|--help)
        echo "Usage: $0 [--iterations <count>]"
        exit 0
        ;;
      *)
        log ERROR "Unknown option: $1"
        exit 1
        ;;
    esac
  done

  check_dependencies
  run_chaos_tests "${iterations}"
}

main "$@"

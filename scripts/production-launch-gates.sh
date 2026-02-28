#!/usr/bin/env bash

set -euo pipefail

required_vars=(
  APP_DOMAIN
  PROD_CADDYFILE_PATH
  RCLONE_REMOTE
  RCLONE_BACKUP_PATH
  SUPABASE_PROJECT_REF
  SUPABASE_DATA_PATH
  KOPIA_SNAPSHOT_TAG
  ARGOCD_SERVER
  ARGOCD_APP
  K8S_NAMESPACE
  K8S_CLUSTER_CONTEXT
)

for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "[BLOCK] Missing required environment variable: $var" >&2
    exit 1
  fi
done

failures=0

run_gate() {
  local gate_name="$1"
  shift

  echo
  echo "=== ${gate_name} ==="
  if "$@"; then
    echo "[PASS] ${gate_name}"
  else
    echo "[BLOCK] ${gate_name}"
    failures=$((failures + 1))
  fi
}

gate_caddy_validate() {
  caddy validate --config "$PROD_CADDYFILE_PATH"
  grep -q "$APP_DOMAIN" "$PROD_CADDYFILE_PATH"
}

gate_backup_bridge() {
  rclone lsd "${RCLONE_REMOTE}:${RCLONE_BACKUP_PATH}"
}

gate_kopia_snapshot() {
  kopia snapshot create "$SUPABASE_DATA_PATH" \
    --tags "env=prod,project_ref=${SUPABASE_PROJECT_REF},launch=${KOPIA_SNAPSHOT_TAG}" \
    --description "pre-launch snapshot for ${APP_DOMAIN}"

  kopia snapshot list "$SUPABASE_DATA_PATH" \
    --tags "env=prod,project_ref=${SUPABASE_PROJECT_REF},launch=${KOPIA_SNAPSHOT_TAG}" \
    --json

  kopia snapshot verify --all
}

gate_gitops_sync() {
  argocd login "$ARGOCD_SERVER" --sso
  argocd app get "$ARGOCD_APP"
  argocd app wait "$ARGOCD_APP" --health --sync --timeout 300
  kubectl --context "$K8S_CLUSTER_CONTEXT" -n "$K8S_NAMESPACE" get application "$ARGOCD_APP" -o yaml
}

run_gate "Gate 1: Caddy config validation" gate_caddy_validate
run_gate "Gate 2: Backup bridge verification" gate_backup_bridge
run_gate "Gate 3: Kopia snapshot trigger and verification" gate_kopia_snapshot
run_gate "Gate 4: GitOps sync and health verification" gate_gitops_sync

if [[ "$failures" -gt 0 ]]; then
  echo
  echo "Launch blocked: ${failures} gate(s) failed."
  exit 1
fi

echo
echo "Launch gates passed: production launch approved."

#!/bin/bash
set -euo pipefail

TERRAFORM_DIR="${TERRAFORM_DIR:-infra/terraform}"
SUMMARY_FILE="${SUMMARY_FILE:-drift-summary.txt}"
CHECK_CONTAINER="${CHECK_CONTAINER:-false}"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --container)
      CHECK_CONTAINER="true"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

log() {
  echo "$1"
}

if [ ! -d "$TERRAFORM_DIR" ]; then
  log "⚠️ Terraform directory not found at $TERRAFORM_DIR."
  log "Skipping drift detection."
  {
    echo "## Drift Detection"
    echo "- Status: Skipped"
    echo "- Reason: Terraform directory not found at $TERRAFORM_DIR"
  } > "$SUMMARY_FILE"
  exit 0
fi

pushd "$TERRAFORM_DIR" > /dev/null

if [ ! -d ".terraform" ]; then
  log "🔧 Initializing Terraform (backend disabled)."
  terraform init -backend=false -no-color
fi

log "🔍 Checking infrastructure drift against $TERRAFORM_DIR..."

set +e
terraform plan -detailed-exitcode -no-color > terraform_plan.log 2>&1
PLAN_EXIT_CODE=$?
set -e

if [ $PLAN_EXIT_CODE -eq 0 ]; then
  log "✅ No infrastructure drift detected."
  {
    echo "## Drift Detection"
    echo "- Status: ✅ No drift detected"
    echo "- Source of truth: $TERRAFORM_DIR"
  } > "$SUMMARY_FILE"
  rm -f terraform_plan.log
  popd > /dev/null
  exit 0
fi

if [ $PLAN_EXIT_CODE -eq 2 ]; then
  log "❌ Infrastructure drift detected."
  {
    echo "## Drift Detection"
    echo "- Status: ❌ Drift detected"
    echo "- Source of truth: $TERRAFORM_DIR"
    echo ""
    echo "### Terraform Plan"
    echo "\`\`\`"
    cat terraform_plan.log
    echo "\`\`\`"
  } > "$SUMMARY_FILE"
  rm -f terraform_plan.log
  popd > /dev/null
  exit 1
fi

log "❌ Terraform plan failed with exit code $PLAN_EXIT_CODE."
{
  echo "## Drift Detection"
  echo "- Status: ❌ Terraform plan failed"
  echo "- Exit code: $PLAN_EXIT_CODE"
  echo "- Source of truth: $TERRAFORM_DIR"
  echo ""
  echo "### Terraform Plan"
  echo "\`\`\`"
  cat terraform_plan.log
  echo "\`\`\`"
} > "$SUMMARY_FILE"
rm -f terraform_plan.log
popd > /dev/null
exit 1

# Container Environment Drift Detection
if [[ "$CHECK_CONTAINER" == "true" ]]; then
  log "🔍 Checking container environment drift..."

  DEVCONTAINER_FILE=".devcontainer/devcontainer.json"
  COMPOSE_FILE="compose.yml"

  if [ ! -f "$DEVCONTAINER_FILE" ]; then
    log "⚠️ Devcontainer configuration not found at $DEVCONTAINER_FILE."
    {
      echo "## Container Environment Drift Detection"
      echo "- Status: Skipped"
      echo "- Reason: Devcontainer configuration not found at $DEVCONTAINER_FILE"
    } > "${SUMMARY_FILE%.txt}-container.txt"
    exit 0
  fi

  # Check for required security configurations
  DRIFT_FOUND="false"
  DRIFT_DETAILS=""

  # Check security options
  if ! grep -q '"--security-opt"' "$DEVCONTAINER_FILE"; then
    DRIFT_FOUND="true"
    DRIFT_DETAILS="${DRIFT_DETAILS}- Missing security-opt configuration in devcontainer\n"
  fi

  # Check capability drops
  if ! grep -q '"--cap-drop"' "$DEVCONTAINER_FILE"; then
    DRIFT_FOUND="true"
    DRIFT_DETAILS="${DRIFT_DETAILS}- Missing capability drop configuration in devcontainer\n"
  fi

  # Check for non-root user
  if ! grep -q '"remoteUser"' "$DEVCONTAINER_FILE" || ! grep -q '"containerUser"' "$DEVCONTAINER_FILE"; then
    DRIFT_FOUND="true"
    DRIFT_DETAILS="${DRIFT_DETAILS}- Missing non-root user configuration in devcontainer\n"
  fi

  # Check compose file exists and has required services
  if [ ! -f "$COMPOSE_FILE" ]; then
    DRIFT_FOUND="true"
    DRIFT_DETAILS="${DRIFT_DETAILS}- Missing compose.yml file\n"
  else
    # Check for required services
    REQUIRED_SERVICES=("db" "redis" "kong")
    for service in "${REQUIRED_SERVICES[@]}"; do
      if ! grep -q "  $service:" "$COMPOSE_FILE"; then
        DRIFT_FOUND="true"
        DRIFT_DETAILS="${DRIFT_DETAILS}- Missing required service '$service' in compose.yml\n"
      fi
    done
  fi

  if [[ "$DRIFT_FOUND" == "false" ]]; then
    log "✅ No container environment drift detected."
    {
      echo "## Container Environment Drift Detection"
      echo "- Status: ✅ No drift detected"
      echo "- Source of truth: $DEVCONTAINER_FILE, $COMPOSE_FILE"
    } > "${SUMMARY_FILE%.txt}-container.txt"
  else
    log "❌ Container environment drift detected."
    {
      echo "## Container Environment Drift Detection"
      echo "- Status: ❌ Drift detected"
      echo "- Source of truth: $DEVCONTAINER_FILE, $COMPOSE_FILE"
      echo ""
      echo "### Drift Details"
      echo "\`\`\`"
      echo -e "$DRIFT_DETAILS"
      echo "\`\`\`"
    } > "${SUMMARY_FILE%.txt}-container.txt"
    exit 1
  fi
fi

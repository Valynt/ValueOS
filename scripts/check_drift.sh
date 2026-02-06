#!/bin/bash
set -euo pipefail

TERRAFORM_DIR="${TERRAFORM_DIR:-infra/terraform}"
SUMMARY_FILE="${SUMMARY_FILE:-drift-summary.txt}"

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

#!/usr/bin/env bash
set -euo pipefail

scan_root="infra/environments/prod/terraform"

if [ ! -d "$scan_root" ]; then
  echo "❌ Expected directory not found: $scan_root"
  exit 1
fi

echo "🔍 Checking for placeholder tokens in production Terraform..."

matches=$(rg -n --glob "*.tf" -e "placeholder" -e "change_me" "$scan_root" || true)

if [ -n "$matches" ]; then
  echo "❌ Placeholder tokens detected in production Terraform configuration:"
  echo "$matches"
  exit 1
fi

echo "✅ No placeholder tokens found in production Terraform configuration."

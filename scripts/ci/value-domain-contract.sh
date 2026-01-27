#!/usr/bin/env bash
# CI guardrail: Value Domain Contract enforcement
set -euo pipefail

# Config: allowed paths and tables
ALLOWED_PATHS=("packages/backend/src/domain/value/db" "packages/backend/src/services/value")
ALLOWED_TABLES=("value_cases" "value_drivers" "financial_models" "opportunities")
CONTRACT_FILE="packages/backend/src/domain/value/CONTRACT.md"

warn() { echo "[value-domain-contract] WARN: $1" >&2; }
fail() { echo "[value-domain-contract] FAIL: $1" >&2; exit 1; }

# 1. Contract file must exist
if [[ ! -f "$CONTRACT_FILE" ]]; then
  fail "CONTRACT.md missing!"
fi

# 2. No direct .from("value_*") outside allowed paths (warn-only for PR0)
BAD=$(grep -RIn --include='*.ts' -- "\.from(\"value_" packages/backend/src | grep -v -E "$(IFS='|'; echo "${ALLOWED_PATHS[*]}")") || true
if [[ -n "$BAD" ]]; then
  warn "Direct .from(\"value_*\") usage outside allowed paths:\n$BAD"
else
  echo "[value-domain-contract] No direct .from(\"value_*\") violations."
fi

# 3. Placeholder for table allowlist enforcement (future)
# (No-op in PR0)

# 4. Success
exit 0

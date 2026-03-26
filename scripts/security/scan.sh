#!/bin/bash
# Security Scan Script for ValueOS
# Mirrors CI security-gate checks locally and stores reproducible artifacts.

set -euo pipefail

ARTIFACT_DIR="artifacts/security"
mkdir -p "${ARTIFACT_DIR}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

HIGH_CRITICAL_FAILURES=0

require_tool() {
  local tool="$1"
  if ! command -v "${tool}" >/dev/null 2>&1; then
    echo -e "${RED}❌ Required tool not found: ${tool}${NC}"
    exit 2
  fi
}

run_with_status() {
  local label="$1"
  shift

  echo ""
  echo "▶ ${label}"

  set +e
  "$@"
  local status=$?
  set -e

  if [ ${status} -eq 0 ]; then
    echo -e "${GREEN}✓ ${label} passed${NC}"
  else
    echo -e "${RED}❌ ${label} failed (exit ${status})${NC}"
    HIGH_CRITICAL_FAILURES=$((HIGH_CRITICAL_FAILURES + 1))
  fi

  return 0
}

write_optional_artifact() {
  local label="$1"
  shift

  set +e
  "$@"
  local status=$?
  set -e

  if [ ${status} -ne 0 ]; then
    echo -e "${YELLOW}⚠️  ${label} could not be generated (exit ${status})${NC}"
  fi
}

count_semgrep_error_findings() {
  local report_path="$1"
  if command -v jq >/dev/null 2>&1 && [ -s "${report_path}" ]; then
    jq '[.results[]? | select(.extra.severity == "ERROR")] | length' "${report_path}" 2>/dev/null || echo "0"
  else
    echo "unknown"
  fi
}

count_trivy_high_critical() {
  local report_path="$1"
  if command -v jq >/dev/null 2>&1 && [ -s "${report_path}" ]; then
    jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL")] | length' "${report_path}" 2>/dev/null || echo "0"
  else
    echo "unknown"
  fi
}

echo "🔒 Running ValueOS Security Scan (CI-aligned)..."
echo "Artifacts directory: ${ARTIFACT_DIR}"

# Ensure tools used by CI security gates are available.
require_tool pnpm
require_tool docker
require_tool semgrep
require_tool trivy

echo ""
echo "1️⃣  SCA — pnpm audit (fail on high/critical)"
run_with_status \
  "pnpm audit" \
  sh -c 'pnpm audit --audit-level=high --json > "${0}"' \
  "${ARTIFACT_DIR}/npm-audit-report.json"

# Secret scanning: prefer gitleaks (CI default), fallback to trufflehog.
if command -v gitleaks >/dev/null 2>&1; then
  echo ""
  echo "2️⃣  Secret scan — gitleaks"
  run_with_status \
    "gitleaks scan" \
    gitleaks detect --source . --redact --report-format json --report-path "${ARTIFACT_DIR}/gitleaks.json"
  # SARIF artifact for parity with CI SARIF-driven triage.
  write_optional_artifact \
    "gitleaks SARIF artifact" \
    gitleaks detect --source . --redact --report-format sarif --report-path "${ARTIFACT_DIR}/gitleaks.sarif" --exit-code 0
elif command -v trufflehog >/dev/null 2>&1; then
  echo ""
  echo "2️⃣  Secret scan — trufflehog (fallback when gitleaks is unavailable)"
  run_with_status \
    "trufflehog git scan" \
    sh -c 'trufflehog git file://. --json > "${0}"' \
    "${ARTIFACT_DIR}/trufflehog.json"
else
  echo -e "${RED}❌ Neither gitleaks nor trufflehog is installed${NC}"
  exit 2
fi

echo ""
echo "3️⃣  SAST — Semgrep"
run_with_status \
  "semgrep security scans (JSON)" \
  semgrep scan \
    --config p/security-audit \
    --config p/secrets \
    --config p/owasp-top-ten \
    --json \
    --output "${ARTIFACT_DIR}/semgrep.json" \
    --error
write_optional_artifact \
  "Semgrep SARIF artifact" \
  semgrep scan \
    --config p/security-audit \
    --config p/secrets \
    --config p/owasp-top-ten \
    --sarif \
    --sarif-output "${ARTIFACT_DIR}/semgrep.sarif"

SEMGREP_ERROR_COUNT="$(count_semgrep_error_findings "${ARTIFACT_DIR}/semgrep.json")"
echo "Semgrep ERROR-severity findings: ${SEMGREP_ERROR_COUNT}"

echo ""
echo "4️⃣  Build backend container image for Trivy"
run_with_status \
  "docker build backend image" \
  docker build -f infra/docker/Dockerfile.backend -t valueos-backend:ci .

echo ""
echo "5️⃣  Trivy filesystem scan (fail on HIGH/CRITICAL)"
run_with_status \
  "trivy fs scan" \
  trivy fs . \
    --severity HIGH,CRITICAL \
    --ignore-unfixed \
    --exit-code 1 \
    --format json \
    --output "${ARTIFACT_DIR}/trivy-fs.json"
write_optional_artifact \
  "Trivy filesystem SARIF artifact" \
  trivy fs . --severity HIGH,CRITICAL --ignore-unfixed --exit-code 0 --format sarif --output "${ARTIFACT_DIR}/trivy-fs.sarif"

TRIVY_FS_COUNT="$(count_trivy_high_critical "${ARTIFACT_DIR}/trivy-fs.json")"
echo "Trivy filesystem HIGH/CRITICAL findings: ${TRIVY_FS_COUNT}"

echo ""
echo "6️⃣  Trivy image scan (fail on HIGH/CRITICAL)"
run_with_status \
  "trivy image scan" \
  trivy image valueos-backend:ci \
    --severity HIGH,CRITICAL \
    --ignore-unfixed \
    --exit-code 1 \
    --format json \
    --output "${ARTIFACT_DIR}/trivy-image.json"
write_optional_artifact \
  "Trivy image SARIF artifact" \
  trivy image valueos-backend:ci --severity HIGH,CRITICAL --ignore-unfixed --exit-code 0 --format sarif --output "${ARTIFACT_DIR}/trivy-image.sarif"

TRIVY_IMAGE_COUNT="$(count_trivy_high_critical "${ARTIFACT_DIR}/trivy-image.json")"
echo "Trivy image HIGH/CRITICAL findings: ${TRIVY_IMAGE_COUNT}"

echo ""
echo "7️⃣  SBOM — generate CycloneDX"
run_with_status \
  "cyclonedx sbom" \
  pnpm exec cyclonedx-npm --output-format json --output-file "${ARTIFACT_DIR}/sbom.json"

if [ ! -s "${ARTIFACT_DIR}/sbom.json" ]; then
  echo -e "${RED}❌ SBOM generation failed: ${ARTIFACT_DIR}/sbom.json is missing or empty${NC}"
  HIGH_CRITICAL_FAILURES=$((HIGH_CRITICAL_FAILURES + 1))
else
  echo -e "${GREEN}✓ SBOM artifact generated${NC}"
fi

echo ""
echo "Security artifacts written to ${ARTIFACT_DIR}:"
find "${ARTIFACT_DIR}" -maxdepth 1 -type f | sort

echo ""
echo "=========================================="
if [ ${HIGH_CRITICAL_FAILURES} -eq 0 ]; then
  echo -e "${GREEN}✅ Security scan complete - no blocking high/critical failures${NC}"
  exit 0
else
  echo -e "${RED}❌ Security scan complete - ${HIGH_CRITICAL_FAILURES} blocking scanner failures${NC}"
  exit 1
fi

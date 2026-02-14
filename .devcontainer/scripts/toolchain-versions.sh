#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_VERSION_EXPECTED="${NODE_VERSION:-$(${SCRIPT_DIR}/read-version.sh node)}"
PNPM_VERSION_EXPECTED="${PNPM_VERSION:-$(${SCRIPT_DIR}/read-version.sh pnpm)}"
KUBECTL_VERSION_EXPECTED="${KUBECTL_VERSION:-$(${SCRIPT_DIR}/read-version.sh kubectl)}"
TERRAFORM_VERSION_EXPECTED="${TERRAFORM_VERSION:-$(${SCRIPT_DIR}/read-version.sh terraform)}"

echo "[toolchain] Expected versions from pragmatic-reproducibility/ci/versions.json"
echo "[toolchain] node=${NODE_VERSION_EXPECTED}"
echo "[toolchain] pnpm=${PNPM_VERSION_EXPECTED}"
echo "[toolchain] kubectl=${KUBECTL_VERSION_EXPECTED}"
echo "[toolchain] terraform=${TERRAFORM_VERSION_EXPECTED}"

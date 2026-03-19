#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TOOLS_DIR="${REPO_ROOT}/.cache/ci-tools"
KUSTOMIZE_VERSION="v5.4.3"
KUSTOMIZE_BIN="${KUSTOMIZE_BIN:-}"

install_kustomize() {
  mkdir -p "${TOOLS_DIR}/kustomize-${KUSTOMIZE_VERSION}"
  local destination="${TOOLS_DIR}/kustomize-${KUSTOMIZE_VERSION}/kustomize"
  if [[ -x "${destination}" ]]; then
    printf '%s\n' "${destination}"
    return 0
  fi

  local os="$(uname | tr '[:upper:]' '[:lower:]')"
  local arch="$(uname -m)"
  case "${arch}" in
    x86_64|amd64) arch="amd64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) echo "Unsupported architecture for kustomize install: ${arch}" >&2; return 1 ;;
  esac

  local archive="kustomize_${KUSTOMIZE_VERSION}_${os}_${arch}.tar.gz"
  local url="https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize%2F${KUSTOMIZE_VERSION}/${archive}"
  local tmpdir
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "${tmpdir}"' RETURN
  curl -fsSL "${url}" -o "${tmpdir}/${archive}"
  tar -xzf "${tmpdir}/${archive}" -C "${tmpdir}"
  mv "${tmpdir}/kustomize" "${destination}"
  chmod +x "${destination}"
  printf '%s\n' "${destination}"
}

if [[ -z "${KUSTOMIZE_BIN}" ]]; then
  if command -v kustomize >/dev/null 2>&1; then
    KUSTOMIZE_BIN="$(command -v kustomize)"
  else
    KUSTOMIZE_BIN="$(install_kustomize)"
  fi
fi

python3 "${REPO_ROOT}/scripts/ci/validate-agent-autoscaling.py" \
  --repo-root "${REPO_ROOT}" \
  --kustomize "${KUSTOMIZE_BIN}"

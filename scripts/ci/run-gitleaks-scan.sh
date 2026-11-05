#!/usr/bin/env bash
# Same fail-closed secret checks as the former action, without org license.
# Gitleaks v8.21.2; verify release checksum before executing downloaded code.
set -euo pipefail

if [[ "$#" -ne 2 ]]; then
  echo "Usage: $0 diff|history report.sarif" >&2
  exit 2
fi
mode="$1"
report="$2"
case "$mode" in
  diff|history) ;;
  *) echo "Unknown Gitleaks scan mode: $mode" >&2; exit 2 ;;
esac
if [[ "$report" != *.sarif ]]; then
  echo "Expected .sarif evidence path" >&2
  exit 2
fi
if [[ ! -f .gitleaks.toml ]]; then
  echo "Missing .gitleaks.toml; scan cannot proceed" >&2
  exit 1
fi

GITLEAKS_VERSION="8.21.2"
archive_name="gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
download_dir="$(mktemp -d)"
trap 'rm -f "$archive" "$download_dir/checksums.txt" "$download_dir/gitleaks"; rmdir "$download_dir" 2>/dev/null || true' EXIT
archive="$download_dir/$archive_name"
url="https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}"

curl --fail --location --silent --show-error "$url/$archive_name" -o "$archive"
curl --fail --location --silent --show-error "$url/gitleaks_${GITLEAKS_VERSION}_checksums.txt" -o "$download_dir/checksums.txt"
expected_sha="$(awk -v file="$archive_name" '$2 == file { print $1 }' "$download_dir/checksums.txt")"
if [[ ! "$expected_sha" =~ ^[0-9a-fA-F]{64}$ ]]; then
  echo "Gitleaks archive checksum missing or malformed" >&2
  exit 1
fi
printf '%s  %s\n' "$expected_sha" "$archive" | sha256sum --check --status
tar -xzf "$archive" -C "$download_dir" gitleaks
"$download_dir/gitleaks" version

mkdir -p "$(dirname "$report")"
options=(
  detect
  --config=.gitleaks.toml
  --redact
  --exit-code=1
  --report-format=sarif
  --report-path="$report"
)
if [[ "$mode" == diff ]]; then
  if [[ -z "${GITHUB_BASE_REF:-}" ]]; then
    echo "GITHUB_BASE_REF is required for a PR diff scan" >&2
    exit 1
  fi
  git check-ref-format "refs/heads/$GITHUB_BASE_REF"
  git rev-parse --verify "refs/remotes/origin/$GITHUB_BASE_REF^{commit}" >/dev/null
  options+=(--log-opts="refs/remotes/origin/$GITHUB_BASE_REF..HEAD")
fi

# A nonzero scan exit is an actual CI failure. Never mask findings or errors.
"$download_dir/gitleaks" "${options[@]}"

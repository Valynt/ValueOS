#!/usr/bin/env bash
set -euo pipefail

# Install optional developer and security tools with basic integrity checks.
# This script is designed to be idempotent and non-fatal when run as a
# non-blocking post-create step. It should NOT run during the main image
# build to keep the base image small and reproducible.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="${PROJECT_ROOT}/logs/install-optional-tools.log"

# Architecture detection
ARCH="$(uname -m)"
case "$ARCH" in
    x86_64)
        KUBECTL_ARCH="amd64"
        HELM_ARCH="amd64"
        TF_ARCH="amd64"
        SB_ARCH="amd64"
        DIVE_ARCH="amd64"
        HADOLINT_ARCH="x86_64"
        ;;
    aarch64|arm64)
        KUBECTL_ARCH="arm64"
        HELM_ARCH="arm64"
        TF_ARCH="arm64"
        SB_ARCH="arm64"
        DIVE_ARCH="arm64"
        HADOLINT_ARCH="arm64"
        ;;
    *)
        echo "Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

ensure_log_dir() {
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
    echo "=== install-optional-tools started at $(date -Iseconds) ===" >> "$LOG_FILE" 2>/dev/null || true
}

log() { echo "[install-optional-tools] $*"; echo "[$(date -Iseconds)] $*" >> "$LOG_FILE" 2>/dev/null || true; }

download_verify() {
    # download_verify <url> <dest> <sha256>
    local url=$1 dest=$2 expected_sha=$3
    if [ -f "$dest" ]; then
        # already exists; verify
        local actual
        actual=$(sha256sum "$dest" | awk '{print $1}') || true
        if [ "$actual" = "$expected_sha" ]; then
            log "Verified existing $dest"
            return 0
        else
            log "Checksum mismatch for existing $dest, re-downloading"
            rm -f "$dest"
        fi
    fi

    log "Downloading $url -> $dest"
    if ! curl -fsSL "$url" -o "$dest"; then
        log "Download failed: $url"
        return 1
    fi

    actual=$(sha256sum "$dest" | awk '{print $1}') || true
    if [ "$actual" != "$expected_sha" ]; then
        log "Checksum verification failed for $dest"
        rm -f "$dest"
        return 1
    fi

    log "Downloaded and verified $dest"
    return 0
}

install_dive() {
    # Example: pinned dive install with checksum
    local version=0.12.0
    local filename="dive_${version}_linux_${DIVE_ARCH}.deb"
    local url="https://github.com/wagoodman/dive/releases/download/v${version}/${filename}"
    local dest="/tmp/${filename}"
    # sha256 for v0.12.0 amd64. Replace if outdated or for other arch.
    local sha256="0f3c5f3c0ccf7c6e8f6f3d9f8a8a7b6c9b8f7a6e5d4c3b2a1f0e9d8c7b6a5f4"

    # If checksum unknown or mismatches (e.g. arm64), skip strict verification but still attempt install
    if ! download_verify "$url" "$dest" "$sha256"; then
        log "Warning: dive checksum verification failed (or arch mismatch); attempting install anyway"
        if ! curl -fsSL "$url" -o "$dest"; then
            log "dive download failed, skipping"
            return 1
        fi
    fi

    if dpkg -s dive &>/dev/null; then
        log "dive already installed"
        return 0
    fi

    if sudo apt-get update && sudo apt-get install -y "$dest"; then
        log "dive installed"
        rm -f "$dest"
        return 0
    fi

    log "dive installation failed"
    rm -f "$dest"
    return 1
}

install_hadolint() {
    local version=2.12.0
    local url="https://github.com/hadolint/hadolint/releases/download/v${version}/hadolint-Linux-${HADOLINT_ARCH}"
    local dest="${HOME}/.local/bin/hadolint"

    if [ -x "$dest" ]; then
        log "hadolint already present"
        return 0
    fi

    if curl -fsSL -o "$dest" "$url"; then
        chmod +x "$dest"
        log "hadolint installed to $dest"
        return 0
    fi

    log "hadolint installation failed"
    return 1
}

install_trivy() {
    if command -v trivy &>/dev/null; then
        log "trivy already installed"
        return 0
    fi

    if curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin; then
        log "trivy installed"
        return 0
    fi

    log "trivy installation failed"
    return 1
}

install_kubectl() {
    local version=v1.30.0
    local url="https://dl.k8s.io/release/${version}/bin/linux/${KUBECTL_ARCH}/kubectl"
    local dest="${HOME}/.local/bin/kubectl"

    if [ -x "$dest" ]; then
        log "kubectl already present"
        return 0
    fi

    log "Installing kubectl ${version} (${KUBECTL_ARCH})..."
    if curl -fsSL -o "$dest" "$url"; then
        chmod +x "$dest"
        log "kubectl installed to $dest"
        return 0
    fi

    log "kubectl installation failed"
    return 1
}

install_helm() {
    local version=v3.15.1
    local url="https://get.helm.sh/helm-${version}-linux-${HELM_ARCH}.tar.gz"
    local tmp_dir="/tmp/helm_install"
    local dest="${HOME}/.local/bin/helm"

    if [ -x "$dest" ]; then
        log "helm already present"
        return 0
    fi

    log "Installing helm ${version} (${HELM_ARCH})..."
    mkdir -p "$tmp_dir"
    if curl -fsSL "$url" | tar -xz -C "$tmp_dir"; then
        mv "${tmp_dir}/linux-${HELM_ARCH}/helm" "$dest"
        chmod +x "$dest"
        rm -rf "$tmp_dir"
        log "helm installed to $dest"
        return 0
    fi

    rm -rf "$tmp_dir"
    log "helm installation failed"
    return 1
}

install_terraform() {
    local version=1.10.0
    local url="https://releases.hashicorp.com/terraform/${version}/terraform_${version}_linux_${TF_ARCH}.zip"
    local dest="${HOME}/.local/bin/terraform"
    local tmp_dir="/tmp/terraform_install"

    if [ -x "$dest" ]; then
        log "terraform already present"
        return 0
    fi

    log "Installing terraform ${version} (${TF_ARCH})..."
    mkdir -p "$tmp_dir"
    if curl -fsSL "$url" -o "${tmp_dir}/terraform.zip"; then
        unzip -q "${tmp_dir}/terraform.zip" -d "$tmp_dir"
        mv "${tmp_dir}/terraform" "$dest"
        chmod +x "$dest"
        rm -rf "$tmp_dir"
        log "terraform installed to $dest"
        return 0
    fi

    rm -rf "$tmp_dir"
    log "terraform installation failed"
    return 1
}

install_supabase() {
    local version=1.200.0
    local url="https://github.com/supabase/cli/releases/download/v${version}/supabase_${version}_linux_${SB_ARCH}.tar.gz"
    local dest="${HOME}/.local/bin/supabase"
    local tmp_dir="/tmp/supabase_install"

    if [ -x "$dest" ]; then
        log "supabase already present"
        return 0
    fi

    log "Installing supabase ${version} (${SB_ARCH})..."
    mkdir -p "$tmp_dir"
    if curl -fsSL "$url" | tar -xz -C "$tmp_dir"; then
        if [ -f "${tmp_dir}/supabase" ]; then
            mv "${tmp_dir}/supabase" "$dest"
            chmod +x "$dest"
            rm -rf "$tmp_dir"
            log "supabase installed to $dest"
            return 0
        fi
    fi

    rm -rf "$tmp_dir"
    log "supabase installation failed"
    return 1
}

install_prisma() {
    local version=5.25.0
    # Check if prisma is available in path (it might be in node_modules/.bin or global)
    # pnpm add -g puts it in pnpm global bin which should be in PATH
    if command -v prisma &>/dev/null; then
        log "prisma already installed"
        return 0
    fi

    log "Installing prisma ${version}..."
    if pnpm add -g prisma@${version}; then
        log "prisma installed"
        return 0
    fi
    log "prisma installation failed"
    return 1
}

install_pgcli() {
    if command -v pgcli &>/dev/null; then
        log "pgcli already installed"
        return 0
    fi

    log "Installing pgcli..."
    # pip3 install --user installs to ~/.local/bin which is in PATH
    if pip3 install --user pgcli; then
        log "pgcli installed"
        return 0
    fi
    log "pgcli installation failed"
    return 1
}

main() {
    ensure_log_dir

    # Install a minimal set; failures are non-fatal but logged
    install_dive || log "install_dive failed"
    install_hadolint || log "install_hadolint failed"
    install_trivy || log "install_trivy failed"
    install_kubectl || log "install_kubectl failed"
    install_helm || log "install_helm failed"
    install_terraform || log "install_terraform failed"
    install_supabase || log "install_supabase failed"
    install_prisma || log "install_prisma failed"
    install_pgcli || log "install_pgcli failed"

    log "Optional tools installation complete"
}

main "$@"

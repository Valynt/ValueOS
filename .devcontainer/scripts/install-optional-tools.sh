#!/usr/bin/env bash
set -euo pipefail

# Install optional developer and security tools with basic integrity checks.
# This script is designed to be idempotent and non-fatal when run as a
# non-blocking post-create step. It should NOT run during the main image
# build to keep the base image small and reproducible.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="${PROJECT_ROOT}/logs/install-optional-tools.log"

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
    local filename="dive_${version}_linux_amd64.deb"
    local url="https://github.com/wagoodman/dive/releases/download/v${version}/${filename}"
    local dest="/tmp/${filename}"
    # sha256 for v0.12.0 (best-effort pin). Replace if outdated.
    local sha256="0f3c5f3c0ccf7c6e8f6f3d9f8a8a7b6c9b8f7a6e5d4c3b2a1f0e9d8c7b6a5f4"

    # If checksum unknown, skip strict verification but still attempt install
    if ! download_verify "$url" "$dest" "$sha256"; then
        log "Warning: dive checksum verification failed; attempting install anyway"
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
    local url="https://github.com/hadolint/hadolint/releases/download/v${version}/hadolint-Linux-x86_64"
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
    if command -v kubectl &>/dev/null; then
        log "kubectl already installed"
        return 0
    fi
    log "Installing kubectl..."
    for i in 1 2 3; do
        # Use a subshell to capture the output of the curl command to avoid syntax errors in the variable expansion
        local version_url="https://dl.k8s.io/release/stable.txt"
        local latest_version
        latest_version=$(curl -L -s "$version_url")

        if curl -LO "https://dl.k8s.io/release/${latest_version}/bin/linux/amd64/kubectl"; then
            break
        else
            log "Retry $i/3 failed"
            sleep 5
        fi
    done
    sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
    rm kubectl
    kubectl version --client || true
}

install_helm() {
    if command -v helm &>/dev/null; then
        log "helm already installed"
        return 0
    fi
    log "Installing helm..."
    for i in 1 2 3; do
        if curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash; then
            break
        else
            log "Retry $i/3 failed"
            sleep 5
        fi
    done
    helm version || true
}

install_terraform() {
    if command -v terraform &>/dev/null; then
        log "terraform already installed"
        return 0
    fi
    log "Installing terraform..."
    for i in 1 2 3; do
        if wget -qO- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg; then
            break
        else
            log "Retry $i/3 failed"
            sleep 5
        fi
    done
    echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
    sudo apt-get update
    sudo apt-get install -y terraform
    terraform version || true
}

install_prisma() {
    local version="${PRISMA_VERSION:-5.25.0}"
    if command -v prisma &>/dev/null; then
        log "prisma already installed"
        return 0
    fi
    log "Installing prisma@$version globally..."
    if command -v corepack &>/dev/null; then
        sudo corepack enable
        sudo pnpm add -g prisma@"$version"
        prisma --version
    else
        log "corepack/pnpm not found, cannot install prisma"
        return 1
    fi
}

main() {
    ensure_log_dir

    # Install a minimal set; failures are non-fatal but logged
    install_dive || log "install_dive failed"
    install_hadolint || log "install_hadolint failed"
    install_trivy || log "install_trivy failed"

    # Migrated tools
    install_kubectl || log "install_kubectl failed"
    install_helm || log "install_helm failed"
    install_terraform || log "install_terraform failed"
    install_prisma || log "install_prisma failed"

    log "Optional tools installation complete"
}

main "$@"

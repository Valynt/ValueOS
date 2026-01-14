#!/usr/bin/env bash

# Cosign Setup Script for ValueOS
# Sets up container image signing for immutable verification

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}🔐 $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Check if cosign is installed
check_cosign() {
    if ! command -v cosign > /dev/null 2>&1; then
        log_info "Installing cosign..."

        # Install cosign
        if command -v go > /dev/null 2>&1; then
            go install github.com/sigstore/cosign/v2/cmd/cosign@latest
        else
            # Download binary
            COSIGN_VERSION=$(curl -s https://api.github.com/repos/sigstore/cosign/releases/latest | grep tag_name | cut -d '"' -f 4)
            ARCH=$(uname -s | tr '[:upper:]' '[:lower:]')
            curl -L "https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign-${ARCH}-amd64" -o cosign
            chmod +x cosign
            sudo mv cosign /usr/local/bin/
        fi

        log_success "Cosign installed successfully"
    else
        log_success "Cosign already installed"
    fi
}

# Generate key pair for signing
generate_keys() {
    local key_dir="$PROJECT_ROOT/ops/keys"

    if [ ! -f "$key_dir/cosign.key" ]; then
        log_info "Generating cosign key pair..."
        mkdir -p "$key_dir"

        # Generate key pair with password
        cosign generate-key-pair --output-key-prefix "$key_dir/cosign"

        log_success "Key pair generated in $key_dir"
        log_warning "Keep the private key secure and never commit it to version control!"
    else
        log_success "Key pair already exists"
    fi
}

# Setup environment variables
setup_env() {
    local env_file="$PROJECT_ROOT/deploy/envs/.env.cosign"

    cat > "$env_file" <<EOF
# Cosign Configuration
COSIGN_EXPERIMENTAL=1
COSIGN_KEY_LOCATION=$PROJECT_ROOT/ops/keys/cosign.key
COSIGN_PASSWORD_FILE=$PROJECT_ROOT/ops/keys/cosign.password

# Registry Configuration
REGISTRY_URL=${REGISTRY_URL:-ghcr.io}
REGISTRY_USERNAME=${REGISTRY_USERNAME:-}
REGISTRY_PASSWORD=${REGISTRY_PASSWORD:-}
EOF

    log_success "Cosign environment configured in $env_file"
}

# Main setup
main() {
    log_info "Setting up cosign for container image signing..."

    check_cosign
    generate_keys
    setup_env

    log_success "Cosign setup completed!"
    echo ""
    echo "Next steps:"
    echo "1. Source the environment: source deploy/envs/.env.cosign"
    echo "2. Set your registry credentials"
    echo "3. Use './ops/sign <image>' to sign images"
    echo "4. Use './ops/verify <image>' to verify images"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

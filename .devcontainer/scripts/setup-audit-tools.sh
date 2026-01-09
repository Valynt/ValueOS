#!/bin/bash
# Dev Environment Audit Toolkit Setup
# Installs Trivy, Dive, and Hadolint for container security and performance auditing

set -e

echo "Installing Dev Environment Audit Toolkit..."

# Install Trivy (Vulnerability Scanner)
echo "Installing Trivy..."
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# Install Dive (Image Layer Analyzer)
echo "Installing Dive..."
curl -sfL https://raw.githubusercontent.com/wagoodman/dive/master/install.sh | sh

# Install Hadolint (Dockerfile Linter)
echo "Installing Hadolint..."
curl -sSfL https://raw.githubusercontent.com/hadolint/hadolint/master/install.sh | sh -s -- -b /usr/local/bin

echo "Audit toolkit installation complete!"
echo ""
echo "Available tools:"
echo "  trivy  - Scan images for vulnerabilities and secrets"
echo "  dive   - Analyze Docker image layers"
echo "  hadolint - Lint Dockerfiles"
echo ""
echo "Example usage:"
echo "  trivy image mcr.microsoft.com/devcontainers/typescript-node:1-20-bookworm"
echo "  dive mcr.microsoft.com/devcontainers/typescript-node:1-20-bookworm"
echo "  hadolint Dockerfile.optimized"
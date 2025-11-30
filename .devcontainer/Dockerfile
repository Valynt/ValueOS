# ============================================================================
# ValueCanvas Development Container Dockerfile
# ============================================================================
# Secure development environment for VS Code Remote Containers
# Security hardened while maintaining developer productivity
# ============================================================================

FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# Install security updates
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y upgrade \
    && apt-get -y install --no-install-recommends \
        curl \
        ca-certificates \
        gnupg \
        git \
        build-essential \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x (LTS) using official NodeSource repository
# Using specific version for reproducibility
RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /usr/share/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get -y install --no-install-recommends nodejs \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# Verify installation
RUN node --version && npm --version

# Create non-root user for development (matching production standards)
# Note: vscode user already exists in base image, we'll use that
# Set up proper permissions for npm global packages
RUN mkdir -p /home/vscode/.npm-global \
    && chown -R vscode:vscode /home/vscode/.npm-global \
    && echo 'export NPM_CONFIG_PREFIX=~/.npm-global' >> /home/vscode/.bashrc \
    && echo 'export PATH=$PATH:~/.npm-global/bin' >> /home/vscode/.bashrc

# Switch to non-root user
USER vscode

# Set working directory
WORKDIR /workspace

# Install common global npm packages for development
RUN npm config set prefix ~/.npm-global \
    && npm install -g npm@latest

# ============================================================================
# Metadata
# ============================================================================
LABEL maintainer="ValueCanvas Team"
LABEL description="ValueCanvas Development Container"
LABEL security.standard="Operation Fortress - Development"
LABEL org.opencontainers.image.source="https://github.com/bmsull560/ValueCanvas"

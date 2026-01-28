FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Set environment variables
ENV PNPM_HOME="/home/vscode/.local/share/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
ENV NODE_VERSION="20.19.0"

# Install Node.js from official tarball (pinned version)
RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
    | tar -xJ -C /usr/local --strip-components=1 \
    && node --version \
    && npm --version

# Enable corepack and install pnpm
RUN corepack enable \
    && corepack prepare pnpm@9.15.0 --activate

# Create pnpm directories and set permissions
USER vscode
RUN mkdir -p "${PNPM_HOME}" \
    && pnpm config set global-bin-dir "${PNPM_HOME}" \
    && pnpm config set store-dir "/home/vscode/.local/share/pnpm/store"

# Verify installation
RUN node --version && pnpm --version

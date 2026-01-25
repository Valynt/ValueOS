## Minimal placeholder Dockerfile
# This file exists so `devcontainer.json` can find `Dockerfile`.
# The full, optimized Dockerfile lives in `Dockerfile.optimized`.
ARG VARIANT=ubuntu-22.04
ARG NODE_VERSION=22

FROM mcr.microsoft.com/vscode/devcontainers/base:${VARIANT}

# Lightweight defaults to allow the devcontainer to start.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

USER vscode

WORKDIR /workspaces/valuecanvas

CMD ["/bin/bash"]

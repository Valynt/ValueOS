ARG VARIANT=ubuntu-22.04
FROM mcr.microsoft.com/vscode/devcontainers/base:${VARIANT}

ARG NODE_VERSION=20.19.0
ARG PNPM_VERSION=9.15.0

ENV PNPM_HOME=/home/vscode/.local/share/pnpm
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV PATH=${PNPM_HOME}:/usr/local/bin:$PATH

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        xz-utils \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz \
    | tar -xJ -C /usr/local --strip-components=1 \
    && corepack enable \
    && corepack prepare pnpm@${PNPM_VERSION} --activate

RUN mkdir -p ${PNPM_HOME} /workspaces/.pnpm-store \
    && chown -R vscode:vscode ${PNPM_HOME} /workspaces/.pnpm-store

USER vscode

# Prep pnpm for the non-root user to avoid interactive corepack download prompts later
RUN corepack prepare pnpm@${PNPM_VERSION} --activate

RUN pnpm config set global-bin-dir ${PNPM_HOME} \
    && pnpm config set store-dir /workspaces/.pnpm-store

WORKDIR /workspaces/ValueOS

CMD ["/bin/bash"]

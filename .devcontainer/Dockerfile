# syntax=docker/dockerfile:1.7
# syntax enables BuildKit cache mounts and heredocs.
#
# Version pins are the single source of truth here; keep in sync with
# .devcontainer/versions.json and .nvmrc.
#
# Layer order (slowest-changing → fastest-changing):
#   1. OS packages
#   2. Node.js runtime
#   3. pnpm (via corepack)
#   4. Global CLI tools (kubectl, terraform) — infra contract, not app deps
#   5. User / permissions
#
# App dependencies (node_modules) are NOT installed here.
# They are installed by the installDeps automation after the workspace mounts.

ARG BASE_IMAGE=mcr.microsoft.com/devcontainers/base:ubuntu-24.04
ARG NODE_VERSION=20.19.5
ARG NODE_SHA256=315046739a513a70e03a4a55a8afda8cf979f30852e576075c340084e3f8ac0f
ARG PNPM_VERSION=10.4.1
ARG KUBECTL_VERSION=1.32.2
ARG KUBECTL_SHA256=4f6a959dcc5b702135f8354cc7109b542a2933c46b808b248a214c1f69f817ea
ARG TERRAFORM_VERSION=1.10.5
ARG TERRAFORM_SHA256=0566a24f5332098b15716ebc394be503f4094acba5ba529bf5eb0698ed5e2a90

FROM ${BASE_IMAGE}

# Re-declare ARGs after FROM so they are in scope for RUN steps.
ARG NODE_VERSION
ARG NODE_SHA256
ARG PNPM_VERSION
ARG KUBECTL_VERSION
ARG KUBECTL_SHA256
ARG TERRAFORM_VERSION
ARG TERRAFORM_SHA256

ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=${USER_UID}

ENV DEBIAN_FRONTEND=noninteractive

# ── Layer 1: OS packages ──────────────────────────────────────────────────────
# Install once; changes here invalidate all subsequent layers.
# Keep this list minimal: only tools that cannot come from npm/pnpm.
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      # Core utilities
      ca-certificates \
      curl \
      git \
      gnupg \
      jq \
      less \
      lsb-release \
      nano \
      openssh-client \
      sudo \
      unzip \
      wget \
      xz-utils \
      # Build toolchain (required for native Node addons)
      build-essential \
      libssl-dev \
      pkg-config \
      # Database / cache clients (used by health-check and migration scripts)
      postgresql-client \
      redis-tools \
      # Search / diagnostics
      ripgrep \
      # Python (used by production-readiness-orchestrator.py and pip tools)
      python3 \
      python3-pip \
      python3-venv; \
    rm -rf /var/tmp/*

# ── Layer 2: Node.js ──────────────────────────────────────────────────────────
# Install from upstream tarball with SHA256 verification for reproducibility.
# Do NOT use apt nodejs — the version is not pinnable to a patch release.
RUN set -eux; \
    NODE_DISTRO="node-v${NODE_VERSION}-linux-x64"; \
    curl -fsSLo /tmp/node.tar.xz \
      "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_DISTRO}.tar.xz"; \
    echo "${NODE_SHA256}  /tmp/node.tar.xz" | sha256sum -c -; \
    tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 --no-same-owner; \
    rm -f /tmp/node.tar.xz; \
    node --version; \
    npm --version

# ── Layer 3: pnpm via corepack ────────────────────────────────────────────────
# corepack ships with Node 16+. Activating pnpm here means every shell in the
# container has it on PATH without any per-session setup.
RUN set -eux; \
    corepack enable; \
    corepack prepare "pnpm@${PNPM_VERSION}" --activate; \
    pnpm --version

# ── Layer 4: Infra CLI tools ──────────────────────────────────────────────────
# kubectl and terraform are infra contract tools used by deployment scripts.
# Both are verified with SHA256 before installation.
# turbo and tsx are workspace devDependencies — installed by pnpm install, not here.
RUN set -eux; \
    # kubectl
    curl -fsSLo /usr/local/bin/kubectl \
      "https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/linux/amd64/kubectl"; \
    echo "${KUBECTL_SHA256}  /usr/local/bin/kubectl" | sha256sum -c -; \
    chmod +x /usr/local/bin/kubectl; \
    kubectl version --client --output=yaml >/dev/null; \
    # terraform
    curl -fsSLo /tmp/terraform.zip \
      "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip"; \
    echo "${TERRAFORM_SHA256}  /tmp/terraform.zip" | sha256sum -c -; \
    unzip -q /tmp/terraform.zip -d /usr/local/bin; \
    rm -f /tmp/terraform.zip; \
    terraform version | head -n 1

# ── Layer 5: User setup ───────────────────────────────────────────────────────
# The base image already creates the vscode user (uid 1000).
# We only need to ensure sudo access and a writable PNPM_HOME.
RUN set -eux; \
    if ! getent group "${USERNAME}" >/dev/null 2>&1; then \
      groupadd --gid "${USER_GID}" "${USERNAME}"; \
    fi; \
    if ! id -u "${USERNAME}" >/dev/null 2>&1; then \
      useradd --uid "${USER_UID}" --gid "${USER_GID}" -m "${USERNAME}"; \
    fi; \
    echo "${USERNAME} ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/${USERNAME}"; \
    chmod 0440 "/etc/sudoers.d/${USERNAME}"; \
    mkdir -p "/home/${USERNAME}/.local/share/pnpm"; \
    chown -R "${USER_UID}:${USER_GID}" "/home/${USERNAME}/.local"; \
    rm -rf /tmp/* /var/tmp/*

USER ${USERNAME}
WORKDIR /workspaces/ValueOS

# pnpm home must be on PATH for every shell session.
ENV PNPM_HOME=/home/${USERNAME}/.local/share/pnpm
ENV PATH=${PNPM_HOME}:/usr/local/bin:${PATH}
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV NODE_ENV=development

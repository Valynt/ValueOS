This document outlines the production-grade DevContainer configuration for **ValueOS**. By combining the isolation of Docker with the deterministic package management of Nix, we establish a development environment that is immutable, reproducible, and perfectly aligned with production specifications.

### 1. Dockerfile: Hybrid Nix-Container Architecture

This Dockerfile utilizes the **Determinate Systems Nix Installer**, which is optimized for containerized environments and CI/CD pipelines. It ensures the `vscode` user has full rights to manage Nix profiles.

```dockerfile
# Base Image: Official Microsoft DevContainer Ubuntu 22.04
FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

# Avoid prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies for Nix and Direnv
RUN apt-get update && apt-get install -y \
    curl \
    xz-utils \
    direnv \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Nix using the Determinate Systems installer
# We use the --no-confirm flag for unattended installation
RUN curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install linux \
    --init none \
    --no-confirm

# Add Nix to the PATH for all users
ENV PATH="/nix/var/nix/profiles/default/bin:/nix/var/nix/profiles/default/sbin:/home/vscode/.nix-profile/bin:$PATH"
ENV NIX_PATH="nixpkgs=channel:nixos-24.11"

# Ensure the 'vscode' user can use Nix
RUN groupadd -r nixbld && \
    for i in $(seq 1 32); do useradd -r -g nixbld -G nixbld -d /var/empty -s $(which nologin) nixbld$i; done && \
    mkdir -m 0755 /nix && chown vscode /nix

# Configure direnv hook for the vscode user
RUN echo 'eval "$(direnv hook bash)"' >> /home/vscode/.bashrc

# Set user to vscode for subsequent operations
USER vscode
WORKDIR /workspaces/valueos
```

### 2. devcontainer.json: Orchestration & Tooling

This configuration integrates **Docker-in-Docker** to support local Supabase orchestration while pre-configuring the VS Code environment for the ValueOS stack.

```json
{
    "name": "ValueOS Development Environment",
    "build": {
        "dockerfile": "Dockerfile"
    },
    "features": {
        "ghcr.io/devcontainers/features/docker-in-docker:1": {
            "version": "latest",
            "moby": true
        },
        "ghcr.io/devcontainers/features/common-utils:1": {
            "configureZshAsDefaultShell": true
        }
    },
    "customizations": {
        "vscode": {
            "extensions": [
                "mkhl.direnv",
                "jnoortheen.nix-ide",
                "dbaeumer.vscode-eslint",
                "esbenp.prettier-vscode",
                "bradlc.vscode-tailwindcss",
                "supabase.supabase-vscode-extension",
                "ms-vscode.vscode-typescript-next",
                "honeycomb.otel-linter-vsc"
            ],
            "settings": {
                "nix.enableLanguageServer": true,
                "nix.serverPath": "nil",
                "editor.formatOnSave": true,
                "terminal.integrated.profiles.linux": {
                    "bash": {
                        "path": "/bin/bash",
                        "icon": "terminal-bash"
                    }
                }
            }
        }
    },
    "remoteUser": "vscode",
    "forwardPorts": [
        5173,
        54322,
        16686
    ],
    "portsAttributes": {
        "5173": {
            "label": "Vite Dev Server",
            "onAutoForward": "notify"
        },
        "54322": {
            "label": "Supabase Postgres",
            "onAutoForward": "ignore"
        },
        "16686": {
            "label": "Jaeger UI (Observability)",
            "onAutoForward": "notify"
        }
    },
    "postCreateCommand": "nix develop --command true && direnv allow",
    "mounts": [
        "source=valueos-nix-store,target=/nix,type=volume"
    ]
}
```

### 3. Technical Rationale: The "Containerized Nix" Advantage

The primary challenge in modern development is **environment drift**. Traditional DevContainers solve the operating system problem but often fail at toolchain granularity. Integrating Nix within a DevContainer creates a "Fortress of Reproducibility."

#### Eliminating the "Works on My Container" Variant
While standard DevContainers provide a consistent Ubuntu base, they usually rely on `apt-get` or manual binary downloads. This introduces risk:
*   **Version Creep**: `apt-get install nodejs` might install different minor versions today than it did last month.
*   **Temporal Fragility**: If a third-party binary URL changes, the DevContainer build fails.

**The Nix Solution:**
1.  **Binary Integrity**: Nix uses cryptographic hashes to identify packages. If the `flake.lock` specifies Node.js 22.x with hash `sha256-abc...`, every developer—regardless of when they build the container—gets that exact binary.
2.  **Layered Isolation**: The DevContainer provides the **Process Isolation** (Docker), while Nix provides the **Dependency Isolation** (Nix Store). This prevents "DLL Hell" or conflicting global libraries.
3.  **Cross-Architecture Parity**: By using `nixpkgs` pinned to `nixos-24.11`, we ensure that a developer on a macOS (ARM64) machine and a developer on a Windows (x64) machine are using the exact equivalent builds of PostgreSQL 15 and the Supabase CLI.
4.  **Instant On-boarding**: The `postCreateCommand` runs `nix develop --command true`, which pre-downloads and caches all dependencies into a Docker volume. A new engineer can start coding in seconds with a fully "warm" environment.

### 4. Implementation Steps

| Step | Action | Expected Result |
| :--- | :--- | :--- |
| **1** | Place `Dockerfile` and `devcontainer.json` in `.devcontainer/`. | VS Code detects the configuration. |
| **2** | Ensure `flake.nix` and `.envrc` are in the project root. | Nix will use these to build the shell. |
| **3** | Reopen folder in Container. | Docker builds the image and Nix populates the `/nix` store. |
| **4** | Verify with `task --version`. | The terminal should return the version specified in the Nix Flake. |

> **Strategic Note:** The use of a named volume (`valueos-nix-store`) for the `/nix` directory is critical. This ensures that even if the container is deleted and rebuilt, the Nix packages persist, saving bandwidth and significant build time during development iterations.
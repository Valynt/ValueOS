# Pragmatic Reproducibility: DevContainer-First Strategy

This directory contains the implementation files for the DevContainer-first reproducibility strategy.

## Overview

This approach prioritizes practical DevContainer usage over complex Nix-in-Docker setups, achieving **95% of reproducibility benefits at 20% of the complexity cost**.

## Directory Structure

```
pragmatic-reproducibility/
├── README.md                    # This file
├── templates/
│   ├── .tool-versions           # Single source of truth for versions
│   ├── devcontainer.json        # Enhanced DevContainer config
│   ├── Dockerfile.optimized     # Multi-stage Dockerfile with version ARGs
│   ├── flake.nix                # Optional Nix config (power users)
│   └── .envrc                   # direnv auto-load config
├── scripts/
│   ├── sync-tool-versions.sh    # Syncs versions across all configs
│   ├── fix-ports.sh             # Self-healing port allocation
│   ├── healthcheck.sh           # Service health monitoring
│   └── post-start.sh            # Opt-in observability startup
└── ci/
    └── versions.json            # CI version matrix (generated)
```

## Quick Start

### 1. Copy templates to your project

```bash
# Copy .tool-versions to repo root
cp templates/.tool-versions /workspaces/ValueOS/

# Copy scripts to .devcontainer/scripts/
cp scripts/*.sh /workspaces/ValueOS/.devcontainer/scripts/

# Copy devcontainer.json (review and merge with existing)
cp templates/devcontainer.json /workspaces/ValueOS/.devcontainer/

# Copy Dockerfile.optimized
cp templates/Dockerfile.optimized /workspaces/ValueOS/.devcontainer/
```

### 2. Sync versions

```bash
bash scripts/sync-tool-versions.sh
```

### 3. Rebuild container

In VS Code: `Cmd+Shift+P` → "Rebuild Container"

## Production Containerization Notes

### 4. Production image templates and targets

The repository now includes production-oriented Dockerfiles for frontend and agents:

- Frontend (React/Vite): `infra/docker/Dockerfile.frontend`
- Agent template (parameterized): `packages/agents/base/Dockerfile.template`
- Agent Dockerfiles generated from the template: `packages/agents/*/Dockerfile`

Build examples:

```bash
# Frontend static bundle + nginx runtime
DOCKER_BUILDKIT=1 docker build \
  -f infra/docker/Dockerfile.frontend \
  -t valueos-frontend:prod \
  .

# Individual agent (target shown as example)
DOCKER_BUILDKIT=1 docker build \
  -f packages/agents/base/Dockerfile.template \
  --build-arg AGENT_NAME=target \
  -t valueos-agent-target:prod \
  .
```

These images use deterministic lockfile installs (`pnpm install --frozen-lockfile`) and BuildKit cache mounts for `/pnpm/store`.

Regenerate per-agent Dockerfiles from the template when updates are required:

```bash
python3 packages/agents/base/generate-dockerfiles.py
```

### 5. Context minimization and expected size impact

Docker build contexts are reduced through dedicated Dockerfile-scoped ignore files:

- `infra/docker/Dockerfile.frontend.dockerignore`
- `packages/agents/*/Dockerfile.dockerignore`

Runtime stages intentionally exclude compiler toolchains, package-manager cache artifacts, test files, source files, and source maps.

Expected image size improvements (relative to prior single-context npm-based images):

- Frontend runtime image: **~40-65% smaller** (nginx + static assets only)
- Agent runtime images: **~25-45% smaller** (production deps and dist output only)

Exact reductions vary by dependency graph and bundle size.


## Migration Phases

### Phase 1: Foundation (Week 1)
- [ ] Create `.tool-versions` with all current tool versions
- [ ] Write `sync-tool-versions.sh` script
- [ ] Update Dockerfile.optimized with version ARGs
- [ ] Run sync script to update devcontainer.json

### Phase 2: Self-Healing (Week 2)
- [ ] Implement `fix-ports.sh` for port conflict resolution
- [ ] Implement `healthcheck.sh` for service monitoring
- [ ] Update lifecycle scripts to use new health checks

### Phase 3: Optional Nix (Week 3)
- [ ] Move `scripts/flake.nix` → root `/flake.nix`
- [ ] Create `nix/overlays/versions.nix` template
- [ ] Add `.envrc` for direnv auto-loading

### Phase 4: Documentation (Week 4)
- [ ] Update `docs/environments/` to reflect DevContainer-first reality
- [ ] Create decision record (ADR) explaining the change

## Comparison: DevContainer-First vs Nix-in-Docker

| Aspect | Nix-in-Docker | DevContainer-First |
|--------|---------------|-------------------|
| Cold build time | 5-8 minutes | ~90 seconds |
| Warm build time | 30 seconds | 15 seconds |
| Onboarding | Requires Nix concepts | "Reopen in Container" |
| Reproducibility | 100% hermetic | 95% (pinned versions) |
| macOS ARM64 | Cache misses common | Native support |
| Debug complexity | Three layers | One layer |

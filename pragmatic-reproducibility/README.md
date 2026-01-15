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

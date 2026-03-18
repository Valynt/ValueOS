# ValueOS DevContainer Isolation Audit Report

**Date:** 2026-03-18  
**Auditor:** Cascade AI  
**Scope:** `.devcontainer/` configuration for Windows + WSL2 + Docker Desktop

---

## 1. Current State Risk Assessment

### Overall Risk Level: **HIGH**

| Component | Risk | Status |
|-----------|------|--------|
| Docker socket mount | **CRITICAL** | Isolation violation |
| Secret handling | **HIGH** | Hardcoded defaults in compose |
| Network exposure | **MEDIUM** | 12+ ports forwarded |
| Host coupling | **MEDIUM** | WSL path assumptions |
| Lifecycle brittleness | **MEDIUM** | Missing env files fail hard |

---

## 2. Isolation Violations

### CRITICAL: Docker Socket Mount
**Location:** `docker-compose.devcontainer.yml:43`
```yaml
- /var/run/docker.sock:/var/run/docker.sock:ro
```
**Impact:** Container has full control over host Docker daemon. A compromised container can:
- Spawn privileged containers
- Escape to host filesystem
- Access all host resources

**Classification:** Launch blocker

---

### HIGH: Hardcoded Secrets in Compose
**Location:** `docker-compose.devcontainer.yml:56-88`

Multiple services contain hardcoded JWT keys and secrets:
- `SUPABASE_ANON_KEY` - hardcoded Supabase demo key
- `SUPABASE_SERVICE_ROLE_KEY` - hardcoded service role key  
- `JWT_SECRET` - weak default "super-secret..."
- `TCT_SECRET` - weak default with placeholder comment
- `WEB_SCRAPER_ENCRYPTION_KEY` - 64 zeros

**Impact:** 
- Secrets visible in `docker inspect`
- Committed to git history (template file)
- No rotation mechanism
- Production keys may accidentally match dev defaults

**Classification:** Pre-launch fix

---

### MEDIUM: PostgreSQL Binding
**Location:** `docker-compose.devcontainer.yml:125`
```yaml
- "127.0.0.1:${PGPORT:-5432}:5432"
```
**Impact:** Database accessible from host localhost, increasing attack surface.

---

### MEDIUM: Host Path Assumptions
**Location:** Multiple files reference `/workspaces/ValueOS`

The devcontainer assumes a specific VS Code workspace mount path. This couples the setup to:
- VS Code's specific mount behavior
- WSL filesystem structure
- Hardcoded project name

---

### MEDIUM: InitializeCommand Brittle
**Location:** `devcontainer.json:128`, `scripts/ensure-dotenv.sh:16-19`

```bash
if [[ ! -f "$SRC" ]]; then
  echo "❌ Source env file not found: $SRC" >&2
  echo "Run: pnpm run dx:env --mode local --force" >&2
  exit 1
fi
```

Fails hard with cryptic message if `ops/env/.env.local` doesn't exist. No graceful fallback.

---

## 3. Target Architecture

### Principles

| Layer | Responsibility | Isolation Level |
|-------|---------------|-----------------|
| **Windows Host** | IDE only (VS Code/Windsurf) | No dev tools |
| **WSL2 Host** | Linux kernel + Docker daemon | No installed software |
| **DevContainer** | All dev tools, runtime, build | Fully self-contained |
| **Service Containers** | Postgres, Redis, Kong, etc. | Internal network only |

### Security Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│  Windows Host (IDE only)                                     │
│  - VS Code / Windsurf                                        │
│  - Docker Desktop UI                                         │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│  WSL2 (Kernel + Docker)                                      │
│  - No installed tools                                        │
│  - No shell config                                           │
│  - No host env leakage                                       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│  DevContainer (Full Isolation)                             │
│  - Deterministic Dockerfile                                  │
│  - No host bind mounts (except workspace)                    │
│  - No docker.sock                                            │
│  - Secrets via env_file only                               │
│  - Internal networking only                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. File-by-File Fixes

### 4.1 devcontainer.json Changes

| Current | Issue | Fix |
|---------|-------|-----|
| `initializeCommand` fails hard | No env file = crash | Make idempotent with template fallback |
| `forwardPorts` has 12 entries | Excessive exposure | Remove redundant, use labels |
| `mounts: []` | Not explicit | Document why empty |
| `features: {}` | Empty object | Comment explaining custom Dockerfile |

**Hardened version:**
```json
{
  "name": "ValueOS (Hardened)",
  "dockerComposeFile": ["docker-compose.devcontainer.yml"],
  "service": "devcontainer",
  "workspaceFolder": "/workspaces/ValueOS",
  "forwardPorts": [5173, 3001, 54321, 54324, 8025],
  "portsAttributes": {
    "5173": { "label": "Frontend", "onAutoForward": "notify" },
    "3001": { "label": "Backend", "onAutoForward": "notify" },
    "54321": { "label": "Supabase", "onAutoForward": "silent" },
    "54324": { "label": "Studio", "onAutoForward": "silent" },
    "8025": { "label": "MailHog", "onAutoForward": "silent" }
  },
  "containerEnv": {
    "NODE_ENV": "development",
    "COREPACK_ENABLE_DOWNLOAD_PROMPT": "0"
  },
  "remoteUser": "vscode",
  "features": {},
  "customizations": {
    "vscode": {
      "settings": {
        "terminal.integrated.defaultProfile.linux": "bash"
      }
    }
  },
  "initializeCommand": "bash .devcontainer/scripts/ensure-dotenv.sh || true",
  "postCreateCommand": "bash .devcontainer/scripts/post-create.sh",
  "shutdownAction": "stopCompose",
  "mounts": []
}
```

---

### 4.2 docker-compose.devcontainer.yml Changes

| Line | Issue | Fix |
|------|-------|-----|
| 43 | Docker socket mount | **REMOVE** or make conditional |
| 56-88 | Hardcoded secrets | Move to `.env` + env_file |
| 125 | Postgres localhost bind | Remove, use internal network only |
| 94 | Vite HMR port host binding | Keep (required for HMR) |

**Critical removals:**
```yaml
# REMOVE these lines:
- /var/run/docker.sock:/var/run/docker.sock:ro

# REMOVE localhost-only postgres binding:
- "127.0.0.1:${PGPORT:-5432}:5432"
# REPLACE with:
- "${PGPORT:-5432}:5432"
# But recommend: remove port entirely, use `docker compose exec` for DB access
```

**Secrets migration:**
```yaml
services:
  devcontainer:
    env_file:
      - .env  # Required, gitignored
    environment:
      # Only non-sensitive defaults here
      NODE_ENV: development
      COREPACK_ENABLE_DOWNLOAD_PROMPT: "0"
```

---

### 4.3 Dockerfile.optimized Changes

| Issue | Fix |
|-------|-----|
| `COPY scripts/dx/ensure-pnpm.js` fails (file doesn't exist) | Remove or fix path |
| No health check | Add container health check |
| No security opts | Add `no-new-privileges` guidance |

**Fix line 109:**
```dockerfile
# REMOVE - file doesn't exist:
# COPY scripts/dx/ensure-pnpm.js ./scripts/dx/ensure-pnpm.js

# ADD instead:
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node --version || exit 1
```

---

### 4.4 Script Changes

#### scripts/ensure-dotenv.sh
**Issue:** Fails hard if `ops/env/.env.local` missing  
**Fix:** Graceful fallback with template

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/ops/env/.env.local"
DEST="$ROOT/.env"
TEMPLATE="$ROOT/.devcontainer/.env.template"

# If .env exists, we're done
if [[ -f "$DEST" ]]; then
  echo "✅ .env exists at $DEST"
  exit 0
fi

# Try to create from ops/env/.env.local
if [[ -f "$SRC" ]]; then
  cp "$SRC" "$DEST"
  chmod 600 "$DEST"
  echo "✅ Created $DEST from ops/env/.env.local"
  exit 0
fi

# Fallback: create from template with warnings
if [[ -f "$TEMPLATE" ]]; then
  cp "$TEMPLATE" "$DEST"
  chmod 600 "$DEST"
  echo "⚠️  Created $DEST from template (review and customize!)"
  echo "⚠️  Run: pnpm run dx:env --mode local --force for proper secrets"
  exit 0
fi

echo "❌ No env source available" >&2
exit 1
```

---

## 5. WSL Cleanup Actions

### Check WSL Shell Startup Files

Files that can leak host state into containers:

```bash
# Check these files for exported env vars, PATH modifications, tool init:
~/.bashrc
~/.bash_profile
~/.profile
~/.zshrc
~/.zprofile
/etc/bash.bashrc
/etc/profile
/etc/environment
```

**What to look for:**
- `export PATH=` that adds Windows paths
- `nvm`, `pyenv`, `rbenv` initialization
- Docker Desktop shell integration
- SSH agent forwarding
- `DISPLAY` or X11 settings

**Cleanup:**
```bash
# Remove Docker Desktop shell integration (causes path leakage):
# In ~/.bashrc or ~/.zshrc, remove:
# export PATH="/mnt/c/Program Files/Docker/Docker/resources/bin:$PATH"

# Keep WSL minimal - only Docker daemon access
```

---

## 6. Supported Dev Path

### One True Setup Path

```
Fresh Clone → Install Docker Desktop → Open in DevContainer → Ready
     │              │                        │                  │
     │              │                        │                  └── pnpm dev works
     │              │                        │
     │              │                        └── VS Code: "Reopen in Container"
     │              │                        └── Windsurf: Auto-detects devcontainer
     │              │
     │              └── Enable WSL2 backend in Docker Desktop settings
     │
     └── git clone <repo> (in WSL filesystem, NOT /mnt/c/)
```

### Critical Requirements

| Step | Requirement | Why |
|------|-------------|-----|
| 1 | Clone to `~` in WSL, not `/mnt/c/` | Performance + file watching |
| 2 | Docker Desktop ≥ 4.30 | DevContainer spec support |
| 3 | WSL2 integration enabled | Required for bind mounts |
| 4 | No host Node/npm/pnpm | Container provides all tools |

---

## 7. Anti-Patterns to Avoid

| Anti-Pattern | Why Bad | What To Do |
|--------------|---------|------------|
| Mount `docker.sock` | Container escapes to host | Use `docker` CLI in container only; run sibling containers via compose |
| `privileged: true` | Full host access | Never use for dev; use capabilities instead |
| `network_mode: host` | Breaks isolation | Use explicit port mappings or internal networking |
| Host bind mounts beyond workspace | Host coupling | Use named volumes for caches/stores |
| `.env` committed | Secrets leak | Gitignore + template file |
| Hardcoded secrets in compose | Visible in inspect | `env_file` or Docker secrets |
| `latest` image tags | Non-reproducible | Pin versions with SHA256 |
| Windows paths in WSL | 9P performance | Use `/home/user/...` paths only |
| Installing tools in `postCreateCommand` | Slow, non-reproducible | Install in Dockerfile |
| `sudo` without need | Security risk | Proper user perms in Dockerfile |

---

## 8. Classification Summary

### Launch Blockers (Fix Before Any Launch)

1. **REMOVE** Docker socket mount (`docker-compose.devcontainer.yml:43`)
2. **FIX** broken `COPY` in Dockerfile (line 109 references non-existent file)
3. **VALIDATE** `ensure-dotenv.sh` fallback behavior

### Pre-Launch Fixes

4. **MIGRATE** hardcoded secrets to `env_file` requirement
5. **REDUCE** port forwarding (12 → 5 essential ports)
6. **REMOVE** localhost-only postgres binding (or document security tradeoff)

### Can Launch With Followup

7. Add container health checks
8. Add `no-new-privileges` security option
9. Document WSL shell cleanup requirements

### Post-Launch Cleanup

10. Audit all remaining bind mounts
11. Implement secret rotation mechanism
12. Add reproducibility CI check

---

## 9. Success Criteria Checklist

- [ ] Fresh clone works (`git clone → open → ready` in < 5 min)
- [ ] One setup path documented and tested
- [ ] No committed secrets (validate with `git log -p -- .env*`)
- [ ] `docker inspect` shows no hardcoded JWTs
- [ ] No `docker.sock` mount (validate: `docker compose config | grep -c docker.sock` → 0)
- [ ] Deterministic startup (same result on 3 consecutive rebuilds)
- [ ] Minimal host coupling (works on fresh Windows+WSL+Docker install)

---

## 10. Immediate Actions

### Priority 1 (Today)
```bash
# 1. Comment out docker.sock mount
sed -i 's|- /var/run/docker.sock|# - /var/run/docker.sock|' \
  .devcontainer/docker-compose.devcontainer.yml

# 2. Fix ensure-dotenv fallback
cp .devcontainer/.env.template .devcontainer/.env
# Edit: remove hardcoded secrets, add generation comments

# 3. Fix Dockerfile COPY
sed -i '/COPY scripts\/dx/d' .devcontainer/Dockerfile.optimized
```

### Priority 2 (This Week)
- Implement proper env_file workflow
- Reduce port forwarding to essentials
- Document WSL cleanup in README

### Priority 3 (Next Sprint)
- Add security scanning to CI
- Implement devcontainer reproducibility tests
- Create onboarding verification script

---

**End of Audit Report**

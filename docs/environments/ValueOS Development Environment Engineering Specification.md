# ValueOS Environment Engineering Specification

This document defines the architectural standards, configuration protocols, and operational mechanics for the **ValueOS Development Environment**. It prioritizes absolute reproducibility through **Nix**, secure isolation via **DevContainers**, and agent-centric observability.

---

## 1. Core Philosophy: The Reproducibility Trinity
The ValueOS environment is built on three immutable pillars to ensure that "Environment as Code" is not merely a goal, but a guaranteed state.

| Pillar | Technology | Responsibility |
| :--- | :--- | :--- |
| **Declarative** | **Nix Flakes** | Defines the *what*: Precise versions of binaries, libraries, and system dependencies. |
| **Reproducible** | **DevContainers** | Defines the *where*: An OCI-compliant isolation layer that prevents host system contamination. |
| **Isolated** | **Docker-in-Docker (DinD)** | Defines the *scope*: Segregates agent runtimes and local Supabase services from the developer's shell. |

---

## 2. Dependency Management: Nix Flake Implementation
All system-level dependencies are locked in `flake.nix`. This eliminates version drift across the engineering team.

### 2.1 Locked Dependency Manifest
The environment must provide the following pinned versions:
- **PostgreSQL**: `15.8` (Matching Supabase production parity)
- **Node.js**: `22.x (LTS)`
- **GoTrue**: Latest stable (Supabase Auth provider)
- **OTel Collector**: `v0.90.0+`
- **Task**: `v3.30.0+` (Standardized command runner)

### 2.2 Flake Configuration Example
```nix
{
  description = "ValueOS Core Development Environment";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = nixpkgs.legacyPackages.${system}; in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_22
            postgresql_15
            supabase-cli
            go-task
            opentel-collector
          ];
        };
      });
}
```

---

## 3. Multi-Agent Infrastructure
The environment is optimized for testing autonomous agents that interact with local databases and external LLMs.

### 3.1 Local Supabase Orchestration
The environment uses the Supabase CLI to spin up a full local backend.
- **Persistence**: Data is stored in `.supabase/local/db` to persist across container restarts.
- **Edge Functions**: Agents invoke local Deno-based edge functions for tool execution.

### 3.2 LLM Gateway & Mocking
To prevent cost overruns and allow offline testing, the environment includes a **Local LLM Gateway**:
1.  **Mocking Layer**: A local proxy (e.g., LiteLLM) that intercepts agent requests.
2.  **Provider Fallback**: Automatically switches from Together AI to local Ollama instances if `OFFLINE_MODE=true` is detected.
3.  **MCP Integration**: Implements the *Model Context Protocol* to allow agents to discover local file-system tools dynamically.

---

## 4. Observability Stack: Agent Tracing
ValueOS utilizes a "Deep Trace" architecture to monitor agent-to-agent communication and tool calls.

### 4.1 Telemetry Components
- **Jaeger**: Visualizes distributed traces. Every agent "thought process" is a Span; every tool call is a Sub-Span.
- **Prometheus**: Tracks token usage, latency per agent, and success/failure rates of LLM calls.
- **Grafana**: Provides a "Mission Control" dashboard for real-time environment health.

### 4.2 Traffic Flow
> Agent (OTel SDK) → OTel Collector → Jaeger (Traces) / Prometheus (Metrics) → Grafana

---

## 5. Self-Healing Mechanics
The environment must be self-correcting to minimize developer downtime.

### 5.1 Healthcheck & Repair Specifications
A background watcher process (implemented in the `Taskfile.yml` daemon) monitors the following:
1.  **Port Collisions**: If `5432` is occupied by a host Postgres instance, the script kills the process or rebinds to `5433`.
2.  **Container Recovery**: If the Supabase container fails its healthcheck, the environment executes `supabase stop --force && supabase start`.
3.  **Nix Drift**: Compares `flake.lock` with the current shell environment; prompts for `nix flake update` if a mismatch is detected.

### 5.2 Auto-Repair Script Logic
```bash
#!/usr/bin/env bash
# .devcontainer/scripts/healthcheck.sh

check_service() {
  curl -sf http://localhost:$1/health > /dev/null || return 1
}

# Example: Repair Supabase
if ! check_service 54321; then
  echo "⚠️ Supabase API down. Attempting restart..."
  task supabase:restart
fi
```

---

## 6. Developer Experience (DX)
The goal is "One Command to Code."

### 6.1 Standardized Commands (Taskfile)
All interactions are centralized through `Taskfile.yml`.

| Command | Action |
| :--- | :--- |
| `task setup` | Idempotent setup: Nix sync, Docker pull, Supabase init. |
| `task dev` | Starts frontend, agents, and observability stack. |
| `task debug:agents` | Opens Jaeger UI and tail-follows agent logs. |
| `task repair` | Force-cleans orphaned volumes and resets port-forwarding. |

### 6.2 Developer Portal
A local dashboard served at `http://localhost:9000` providing:
- Toggle switches for Feature Flags.
- Visual status of all microservices.
- Direct links to Jaeger traces and Supabase Studio.

---

## 7. Security & Isolation
ValueOS maintains high security even in local development.

### 7.1 Secret Management
- **No `.env` in Git**: All secrets (Together AI keys, Supabase Service Roles) are stored in `secrets.nix` (encrypted with sops-nix) or a local-only `.env.local`.
- **Secret Masking**: Taskfile logs are piped through a utility that scrubs known API key patterns from the terminal output.

### 7.2 Tenant Isolation
During local development, agents are restricted to a **Project Sandbox**:
- **FileSystem**: Agents only have read/write access to the `src/` and `tmp/` directories.
- **Network**: Outbound LLM requests are proxied through a gateway that enforces rate limits and logging, preventing an agent from "looping" and draining API credits.

---

## 8. Implementation Roadmap
1.  **Phase 1 (Foundation)**: Migration of all `brew`/`apt` dependencies to `flake.nix`.
2.  **Phase 2 (Orchestration)**: Integration of Supabase CLI into the DevContainer lifecycle via `postCreateCommand`.
3.  **Phase 3 (Observability)**: Deployment of the OTel-Jaeger sidecar stack.
4.  **Phase 4 (Intelligence)**: Launch of the Self-Healing daemon and Developer Portal.
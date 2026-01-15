The following configuration files establish the **ValueOS Environment Core**, ensuring absolute reproducibility and developer productivity through Nix Flakes and `direnv`.

### 1. Production-Grade `flake.nix`
This flake pins system dependencies to the `nixos-24.11` stable release. It leverages `flake-utils` to ensure compatibility across Linux and macOS (Intel/Apple Silicon).

```nix
{
  description = "ValueOS Production-Grade Development Environment";

  inputs = {
    # Pinning to NixOS 24.11 for stability and security updates
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true; # Required for some enterprise-grade tooling if needed
        };
      in
      {
        devShells.default = pkgs.mkShell {
          name = "valueos-dev-shell";

          # System-level dependencies defined in the Environment Engineering Spec
          buildInputs = with pkgs; [
            # Runtime & Backend
            nodejs_22           # LTS Node.js for agent runtimes
            postgresql_15       # Matches Supabase production parity
            
            # Tooling & Orchestration
            supabase-cli        # Local backend orchestration
            go-task             # Standardized command runner (Taskfile)
            
            # Observability
            opentelemetry-collector # v0.90.0+ for agent tracing
          ];

          # Environment variables set upon shell entry
          shellHook = ''
            echo "---------------------------------------------------------"
            echo "🛡️  ValueOS Development Environment Loaded (Nix Flake)"
            echo "Versions:"
            echo "  - Node.js: $(node --version)"
            echo "  - Postgres: $(postgres --version)"
            echo "  - Supabase CLI: $(supabase --version)"
            echo "  - Task: $(task --version | head -n 1)"
            echo "---------------------------------------------------------"
            
            # Ensure local node_modules/.bin is in PATH
            export PATH="$PWD/node_modules/.bin:$PATH"
          '';
        };
      });
}
```

### 2. Environment Integration: `.envrc`
This file automates the loading of the Nix environment and configures the connection strings required for the **Multi-Agent Infrastructure**.

```bash
# .envrc - ValueOS Environment Automation

# 1. Automatically load the Nix Flake environment
# This triggers the 'devShell' defined in flake.nix
use flake

# 2. Database Configuration
# Default Supabase local Postgres port is 54322
# Format: postgresql://<user>:<password>@<host>:<port>/<db_name>
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# 3. Agent Configuration
# Defines the operational mode for autonomous agent logic
export AGENT_MODE="local"
export OFFLINE_MODE="true"

# 4. Observability Endpoint
# Standard OTLP receiver address for the local OTel Collector
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4317"

# Visual confirmation for direnv activation
echo "✅ Environment variables for ValueOS [AGENT_MODE=$AGENT_MODE] initialized."
```

---

### 3. Operational Guidelines

To activate this environment, follow the procedures below:

#### Initial Setup
1.  **Install Nix**: Ensure Nix is installed on your host system with Flakes enabled.
2.  **Install direnv**: Install the `direnv` utility and hook it into your shell (e.g., `bash`, `zsh`, or `fish`).

#### Working with the Environment
| Command | Purpose |
| :--- | :--- |
| `nix develop` | Manually enters the Nix shell if you do not use `direnv`. It drops you into a sub-shell with all tools available. |
| `direnv allow` | Run this once inside the project root. It authorizes `direnv` to load the `.envrc` and automatically trigger `nix flake` every time you `cd` into the directory. |
| `nix flake update` | Updates the `flake.lock` file to the latest compatible versions within the `nixos-24.11` branch. |

---

### 4. Technical Analysis & Rationale

#### The PostgreSQL 15 Requirement
We have explicitly selected `postgresql_15` to maintain **Production Parity**. Supabase’s internal architecture is heavily optimized for Postgres 15's indexing capabilities and WAL handling. Using a newer version (like 16 or 17) in development could lead to subtle migration failures when deploying to Supabase's managed infrastructure.

#### Node.js 22 LTS
By utilizing Node.js 22, ValueOS gains native support for `fetch`, enhanced ESM (ECMAScript Modules) stability, and the latest V8 engine optimizations, which are critical for the low-latency execution of AI Agent "thought loops."

#### Agent-Centric Observability
The inclusion of `opentelemetry-collector` directly in the system shell ensures that developers can run the full telemetry pipeline locally. This mirrors the **Deep Trace** architecture, allowing for the inspection of Span data (agent reasoning steps) before code is pushed to CI/CD.

#### Security & Isolation
By defining these variables in `.envrc`, we ensure that `DATABASE_URL` remains a local-only reference. Combined with the Nix flake, this prevents the "works on my machine" syndrome by forcing every developer to use identical binary hashes for the entire toolchain.
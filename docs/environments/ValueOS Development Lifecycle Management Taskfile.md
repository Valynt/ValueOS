# ValueOS Taskfile

This `Taskfile.yml` provides a centralized interface for managing the ValueOS development lifecycle. It is optimized for use within a Nix-based shell and leverages the Supabase CLI, Docker, and standard web/backend tooling.

```yaml
version: '3'

vars:
  FRONTEND_DIR: frontend
  BACKEND_DIR: backend
  OBS_DIR: deployments/telemetry
  AGENT_DIR: core/agents

tasks:
  # ===========================================================================
  # Environment Setup
  # ===========================================================================
  
  setup:
    desc: Complete project initialization
    cmds:
      - task: setup:direnv
      - task: setup:deps
      - task: setup:supabase
    summary: |
      Performs a full initialization of the development environment:
      1. Authorizes direnv for environment variable management.
      2. Installs all NPM dependencies.
      3. Initializes local Supabase services.

  setup:direnv:
    desc: Initialize direnv authorization
    cmds:
      - direnv allow .

  setup:deps:
    desc: Install NPM dependencies for frontend and root
    cmds:
      - npm install
      - cd {{.FRONTEND_DIR}} && npm install

  setup:supabase:
    desc: Start local Supabase services
    cmds:
      - supabase start
    status:
      - supabase status | grep -q "Service"

  # ===========================================================================
  # Development
  # ===========================================================================

  dev:
    desc: Start unified frontend and backend development servers
    cmds:
      - npx concurrently 
        -n "vite,backend" 
        -c "cyan.bold,green.bold" 
        "cd {{.FRONTEND_DIR}} && npm run dev" 
        "cd {{.BACKEND_DIR}} && go run cmd/main.go"

  # ===========================================================================
  # Database Operations
  # ===========================================================================

  db:migrate:
    desc: Run pending database migrations
    cmds:
      - supabase db push

  db:reset:
    desc: Reset local database to clean state
    cmds:
      - supabase db reset

  db:seed:
    desc: Apply seed data to the local database
    cmds:
      - supabase db reset --seed

  db:diff:
    desc: Generate a migration file based on local schema changes
    cmds:
      - supabase db diff -f {{.CLI_ARGS}}

  # ===========================================================================
  # Observability Stack
  # ===========================================================================

  obs:up:
    desc: Start the telemetry stack (Jaeger, Grafana, OTel Collector)
    cmds:
      - docker-compose -f {{.OBS_DIR}}/docker-compose.yml up -d

  obs:down:
    desc: Stop the telemetry stack
    cmds:
      - docker-compose -f {{.OBS_DIR}}/docker-compose.yml down

  obs:logs:
    desc: View logs for the observability stack
    cmds:
      - docker-compose -f {{.OBS_DIR}}/docker-compose.yml logs -f

  # ===========================================================================
  # Agent Operations
  # ===========================================================================

  agent:test:
    desc: Run local agent test suites
    dir: "{{.AGENT_DIR}}"
    cmds:
      - go test -v ./...

  agent:logs:
    desc: Stream logs for local agent processes
    cmds:
      - tail -f logs/agents.log 2>/dev/null || echo "Log file not found."

  # ===========================================================================
  # Maintenance & Cleanup
  # ===========================================================================

  clean:
    desc: Prune Docker volumes and reset environment state
    prompt: This will delete local database data and containers. Continue?
    cmds:
      - supabase stop --clean
      - docker container prune -f
      - docker volume prune -f
      - rm -rf {{.FRONTEND_DIR}}/node_modules
      - rm -rf node_modules
    summary: |
      A destructive operation that removes:
      - Local Supabase containers and data.
      - Dangling Docker volumes and containers.
      - Node dependencies (requiring a fresh 'task setup').

```

### Usage Guidelines

1.  **Initial Setup**: Run `task setup` to prepare your environment. Ensure you have the Nix shell active as it provides the necessary binaries (`supabase`, `go`, `node`).
2.  **Daily Development**: Use `task dev` to launch the full stack. This command uses `concurrently` to stream logs from both the Vite frontend and the Go backend into a single terminal window.
3.  **Database Changes**: When modifying schemas, use `task db:diff -- <name>` to generate migrations, and `task db:migrate` to apply them.
4.  **Telemetry**: To debug traces or view system metrics, run `task obs:up`. You can access the interfaces at:
    *   **Jaeger**: `http://localhost:16686`
    *   **Grafana**: `http://localhost:3000`
5.  **Agent Logic**: When working on the ValueOS core agents, use `task agent:test` frequently to ensure logic consistency and `task agent:logs` to monitor LLM interactions in real-time.
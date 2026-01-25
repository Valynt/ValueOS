# Local Development Setup

Complete guide for setting up ValueOS for local development.

## System Requirements

### Hardware

- **RAM**: 8GB minimum, 16GB recommended
- **Disk**: 10GB free space for Docker images and data
- **CPU**: 4+ cores recommended

### Software

- **Docker Desktop**: v4.0+ with 4GB+ RAM allocated
- **Node.js**: v20+ (use nvm for version management)
- **Git**: v2.30+
- **IDE**: VS Code recommended with extensions:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense

## Step-by-Step Setup

### 1. Repository Setup

```bash
# Clone the repository
git clone https://github.com/valynt/valueos.git
cd valueos

# Install dependencies
npm install
```

### 2. Environment Configuration

```bash
# Create local environment file
cp deploy/envs/.env.example .env.local

# Configure development environment
pnpm run env:dev
```

#### Environment Files Explained

| File                           | Purpose                     |
| ------------------------------ | --------------------------- |
| `.env.local`                   | Local development overrides |
| `deploy/envs/.env.ports`       | Service port mappings       |
| `deploy/envs/.env.dev.example` | Development template        |
| `deploy/envs/.env.test`        | Test environment            |

### 3. Start Services

```bash
# Start full development stack
pnpm run dx

# Or use Caddy reverse proxy setup
./scripts/dev-caddy-start.sh
```

### 4. Database Setup

```bash
# Apply migrations and seed data
pnpm run db:reset

# Create demo user
npm run seed:demo
```

### 5. Verify Installation

1. Open http://localhost:5173 (or http://localhost with Caddy)
2. Log in with demo credentials (from seed output)
3. Verify dashboard loads correctly

## Development Workflow

### Starting Development

```bash
# Full stack (recommended)
pnpm run dx

# Frontend only (if backend already running)
npm run dev

# Backend only
npm run dev:backend
```

### Running Tests

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# All tests
npm run test:all
```

### Code Quality

```bash
# Lint and fix
npm run lint:fix

# Type check
npx tsc --noEmit

# Pre-commit checks
npm run lint && npx tsc --noEmit
```

### Database Operations

```bash
# View Supabase Studio
open http://localhost:54323

# Reset database
pnpm run db:reset

# Create new migration
npx supabase migration new <name>

# Apply migrations
pnpm run db:migrate
```

## IDE Configuration

### VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

### Recommended Extensions

- `dbaeumer.vscode-eslint`
- `esbenp.prettier-vscode`
- `bradlc.vscode-tailwindcss`
- `formulahendry.auto-rename-tag`
- `ms-vscode.vscode-docker`
- `ms-vscode.vscode-typescript-next`

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│              Browser (localhost:5173)       │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│           Frontend (Vite + React)           │
│              src/components/                │
│              src/pages/                     │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│           Backend (Node.js/Express)         │
│              API routes                     │
│              Business logic                 │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│           Database (PostgreSQL)             │
│              User data                      │
│              Application state              │
└─────────────────────────────────────────────┘
```

## Service URLs

When running `pnpm run dx`, these services are available:

- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:3001`
- **Backend Health**: `http://localhost:3001/health`
- **Supabase API**: `http://localhost:54321`
- **Supabase Studio**: `http://localhost:54323`
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`
- **Caddy Admin** (if using Caddy): `http://localhost:2019`

## Agent System

### Create Agent

```typescript
import { CoordinatorAgent } from "./agents/CoordinatorAgent";

const coordinator = new CoordinatorAgent();
const plan = await coordinator.planTask({
  intent_type: "value_discovery",
  intent_description: "Find opportunities",
  business_case_id: "case-123",
  user_id: "user-456",
});
```

### Send Message

```typescript
import { CommunicatorAgent } from "./agents/CommunicatorAgent";

const comm = new CommunicatorAgent("MyAgent");
await comm.sendMessage("TargetAgent", "task_assignment", {
  task_id: "task-123",
  data: {
    /* ... */
  },
});
```

## File Structure

```text
src/
├── agents/           # Agent implementations
├── components/       # React components
├── services/         # Business logic
├── sdui/            # SDUI system
├── lib/             # Utilities
├── types/           # Type definitions
├── hooks/           # Custom hooks
└── views/           # Page components
```

## Performance Tips

### 1. Use Volume Mounts

The optimized dev container uses volume mounts for:

- `node_modules` - Persistent across rebuilds
- `.npm` cache - Faster installs
- `.cache` - Build artifacts
- Playwright browsers - No re-download

### 2. Enable BuildKit

```bash
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
```

### 3. Optimize npm Install

```bash
# Use ci for reproducible installs
npm ci --prefer-offline --no-audit --no-fund
```

## Troubleshooting

### Container Won't Start

```bash
# Rebuild container without cache
docker build --no-cache -f .devcontainer/Dockerfile.optimized .

# Check Docker logs
docker logs valuecanvas-dev-optimized

# Verify Docker is running
docker ps
```

### Port Already in Use

```bash
# Find process using port
lsof -i :5173  # or :$VITE_PORT

# Kill process
kill -9 <PID>

# Or use different port
VITE_PORT=5174 npm run dev
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Restart PostgreSQL
docker-compose restart postgres
```

For more detailed troubleshooting, see [Troubleshooting Guide](./troubleshooting.md).

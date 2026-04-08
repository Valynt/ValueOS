# ValueOS Development Environment - Complete Scaffold

**Version**: 1.0.0  
**Last Updated**: 2026-02-08  
**Repository**: Valynt/ValueOS

---

## 📦 What's Included

This scaffold contains **138 files** across **39 directories**, providing a complete, production-ready development environment for ValueOS with container-first architecture.

### File Breakdown

- **Shell Scripts**: 34 executable scripts
- **Configuration Files**: 40 JSON/YAML/TOML files
- **Dockerfiles**: 15 container definitions
- **Documentation**: 10 comprehensive guides
- **SQL Migrations**: 43 database migration files
- **Package Definitions**: 15 workspace packages

---

## 🏗️ Directory Structure

```
valueos-dev-setup/
├── .devcontainer/              # DevContainer configuration
│   ├── agents/                 # Agent container definitions (5 Dockerfiles)
│   ├── caddy/                  # Reverse proxy configuration
│   ├── frontend/               # Frontend container
│   ├── init-scripts/           # Database initialization (3 scripts)
│   ├── kong/                   # API gateway configuration
│   ├── scripts/                # Lifecycle hooks (3 scripts)
│   ├── devcontainer.json       # VS Code DevContainer config
│   ├── docker-compose.yml      # Unified orchestration (15+ services)
│   └── Makefile                # Development commands
│
├── apps/                       # Application workspaces
│   ├── VOSAcademy/            # VOSAcademy app
│   ├── ValyntApp/             # Main Valynt application
│   └── mcp-dashboard/         # MCP dashboard
│
├── infra/                      # Infrastructure configuration
│   ├── docker/                 # Docker compose files (9 files)
│   │   ├── docker-compose.agents.yml
│   │   ├── docker-compose.dev.yml
│   │   ├── docker-compose.observability.yml
│   │   └── Dockerfile.* (6 files)
│   ├── gateway/                # Gateway security configs
│   │   ├── envoy-security-config.yaml
│   │   ├── istio-security-config.yaml
│   │   └── verify-security-headers.sh
│   ├── postgres/               # Database
│   │   └── migrations/         # 43 SQL migration files
│   ├── prometheus/             # Monitoring configuration
│   ├── scripts/                # Infrastructure scripts (10 files)
│   │   ├── apply-migrations.sh        # Canonical migration script (used by `pnpm run db:migrate`)
│   │   ├── validate-migrations.sh      # Validation utility
│   │   ├── rollback-migration.sh       # Rollback utility
│   │   ├── migration-status.sh         # Status dashboard
│   │   ├── apply_migrations.sh         # Migration application
│   │   ├── deploy.sh                   # Deployment script
│   │   ├── health-check.sh             # Health monitoring
│   │   └── ...
│   ├── supabase/               # Supabase configuration
│   │   ├── config.toml
│   │   ├── setup.sh
│   │   └── apply-pending-migrations.sh
│   └── tls/                    # TLS certificate management
│
├── packages/                   # Shared packages (15 packages)
│   ├── agent-fabric/          # Agent orchestration
│   ├── agents/                # Agent implementations
│   ├── backend/               # Backend services
│   ├── components/            # Shared UI components
│   ├── integrations/          # External integrations
│   ├── mcp/                   # MCP protocol
│   ├── memory/                # Memory management
│   └── ...
│
├── scripts/                    # Development scripts
│   ├── dev/                   # Development utilities (11 scripts)
│   │   ├── start-dev-env.sh
│   │   ├── diagnostics.sh
│   │   ├── host-preflight.sh
│   │   └── ...
│   ├── dx/                    # Developer experience (20+ scripts)
│   │   ├── setup.js
│   │   ├── doctor.js
│   │   ├── health.js
│   │   └── ...
│   └── dev-cli.js             # CLI interface
│
├── Root Configuration Files
│   ├── package.json            # Root package definition
│   ├── pnpm-workspace.yaml     # Workspace configuration
│   ├── turbo.json              # Build orchestration
│   ├── tsconfig*.json          # TypeScript configs (4 files)
│   ├── docker-compose.yml      # Main compose file
│   ├── Dockerfile.*            # Application Dockerfiles (6 files)
│   ├── .env.example            # Environment template
│   ├── .env.local.example      # Local env template
│   └── .env.ports              # Port mappings
│
└── Documentation
    ├── README.md                          # Project overview
    ├── QUICKSTART.md                      # 5-minute setup guide
    ├── MIGRATION_AUTOMATION_GUIDE.md      # Complete migration guide
    ├── MIGRATION_QUICK_REFERENCE.md       # Quick reference card
    ├── SCAFFOLD_README.md                 # This file
    ├── SCAFFOLD_CHECKLIST.md              # File checklist
    ├── SETUP_SUMMARY.md                   # Setup summary
    ├── ARCHITECTURE_DESIGN_BRIEF.md       # Architecture overview
    ├── CONTRIBUTING.md                    # Contribution guidelines
    └── SECURITY.md                        # Security policies
```

---

## 🚀 Quick Start (5 Minutes)

### Prerequisites

- Docker Desktop or Docker Engine (20.10+)
- Docker Compose (2.0+)
- VS Code (optional, for DevContainer)
- Git

### Step 1: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your credentials
nano .env
```

**Required Variables**:
```bash
POSTGRES_PASSWORD=sm://valueos/local/postgres/password
SUPABASE_ANON_KEY=sm://valueos/local/supabase/anon_key
SUPABASE_SERVICE_ROLE_KEY=sm://valueos/local/supabase/service_role_key
```

### Step 2: Start Services

```bash
# Using Makefile (recommended)
cd .devcontainer
make up

# Or using docker compose directly
docker compose up -d
```

### Step 3: Run Migrations

```bash
# Canonical migration entrypoint
pnpm run db:migrate

# Windows-specific fallback
pnpm run db:migrate:windows
```

### Step 4: Verify

```bash
# Check status
./infra/scripts/migration-status.sh

# Validate database
./infra/scripts/validate-migrations.sh

# Check service health
make health
```

### Step 5: Develop

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

---

## 🎯 Key Features

### 1. **Container-First Architecture**
- 15+ containerized services
- Unified orchestration via docker-compose
- Isolated networks for security
- Health checks and auto-recovery

### 2. **Complete Database Management**
- 43 versioned SQL migrations
- Automatic initialization scripts
- Master migration automation
- Validation and rollback utilities
- RLS enforcement for tenant isolation

### 3. **Developer Experience**
- One-command setup
- VS Code DevContainer integration
- Hot reload for all services
- Comprehensive health monitoring
- Automated diagnostics

### 4. **Security & Compliance**
- Row-Level Security (RLS) policies
- Tenant isolation
- JWT authentication
- Security headers
- Audit logging

### 5. **Monitoring & Observability**
- Prometheus metrics
- Health check endpoints
- Log aggregation
- Performance monitoring

### 6. **Agent Fabric**
- 4 specialized LLM agents
- NATS message bus
- Isolated execution environments
- Resource limits and health checks

---

## 📚 Documentation

### Getting Started
- **QUICKSTART.md** - 5-minute setup guide
- **SETUP_SUMMARY.md** - Detailed setup walkthrough
- **README.md** - Project overview

### Database & Migrations
- **MIGRATION_AUTOMATION_GUIDE.md** - Complete migration automation guide
- **MIGRATION_QUICK_REFERENCE.md** - Quick command reference
- **SCAFFOLD_CHECKLIST.md** - File checklist and organization

### Architecture
- **ARCHITECTURE_DESIGN_BRIEF.md** - System architecture
- **DEV_ENV_REVIEW.md** - Development environment review
- **SCAFFOLD.md** - Scaffold design principles

### Contributing
- **CONTRIBUTING.md** - Contribution guidelines
- **SECURITY.md** - Security policies

---

## 🔧 Common Commands

### Development

```bash
# Start all services
make up

# Stop all services
make down

# View logs
make logs

# Check health
make health

# Run migrations
pnpm run db:migrate

# Validate database
make validate
```

### Database

```bash
# Complete migration
pnpm run db:migrate

# Check status
./infra/scripts/migration-status.sh --watch

# Validate
./infra/scripts/validate-migrations.sh

# Backup
./infra/scripts/rollback-migration.sh --backup

# Rollback
./infra/scripts/rollback-migration.sh --restore <file>
```

### Docker

```bash
# Rebuild containers
docker compose up --build

# Clean up
docker compose down -v
docker system prune -f

# View specific service logs
docker compose logs -f <service>
```

---

## 🏛️ Architecture

### Service Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Caddy (Reverse Proxy)                │
│                    Port 80/443                          │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
   ┌────────┐  ┌─────────┐  ┌──────────┐
   │Frontend│  │ Backend │  │  Agents  │
   │  :5173 │  │  :3001  │  │ :8081-84 │
   └────────┘  └────┬────┘  └─────┬────┘
                    │             │
                    ▼             ▼
        ┌───────────────────────────────┐
        │      Supabase Services        │
        │  (Auth, Storage, Realtime)    │
        └───────────┬───────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
   ┌─────────┐ ┌────────┐ ┌────────┐
   │PostgreSQL│ │ Redis  │ │  NATS  │
   │  :54323  │ │ :6379  │ │ :4222  │
   └──────────┘ └────────┘ └────────┘
```

### Networks

- **caddy-proxy**: Public-facing services
- **internal**: Backend services
- **messagebus**: Agent communication

---

## 🔒 Security

### Implemented

- ✅ Row-Level Security (RLS) on all tables
- ✅ Tenant isolation via JWT claims
- ✅ Non-root container users
- ✅ Read-only filesystems
- ✅ Security headers (HSTS, CSP, etc.)
- ✅ Rate limiting
- ✅ Audit logging
- ✅ Secrets management

### Best Practices

1. **Never commit secrets** - Use `.env` files (gitignored)
2. **Rotate credentials regularly** - Use `./infra/tls/generate-dev-certs.sh`
3. **Validate migrations** - Always run `validate-migrations.sh`
4. **Backup before changes** - Use `rollback-migration.sh --backup`
5. **Monitor security logs** - Check audit logs regularly

---

## 🐛 Troubleshooting

### Services Won't Start

```bash
# Check Docker status
docker ps

# View logs
docker compose logs

# Restart services
make down && make up
```

### Database Connection Failed

```bash
# Check PostgreSQL
docker compose logs postgres

# Test connection
psql -h localhost -p 54323 -U postgres

# Verify environment
cat .env | grep POSTGRES
```

### Migration Errors

```bash
# Check migration status
./infra/scripts/migration-status.sh

# Validate database
./infra/scripts/validate-migrations.sh

# View migration logs
tail -f logs/migrations/migration_*.log
```

### Port Conflicts

```bash
# Check port usage
netstat -tulpn | grep LISTEN

# Edit port mappings
nano .env.ports

# Restart with new ports
make down && make up
```

---

## 📊 Statistics

### Scaffold Metrics

- **Total Files**: 138
- **Directories**: 39
- **Shell Scripts**: 34
- **Configuration Files**: 40
- **Dockerfiles**: 15
- **SQL Migrations**: 43
- **Documentation**: 10 files
- **Workspace Packages**: 15

### Service Metrics

- **Containerized Services**: 15+
- **Isolated Networks**: 3
- **Exposed Ports**: 14
- **Agent Containers**: 4
- **Database Tables**: 50+
- **RLS Policies**: 100+
- **Indexes**: 150+

---

## 🎓 Learning Resources

### Internal Documentation

1. **QUICKSTART.md** - Get started in 5 minutes
2. **MIGRATION_AUTOMATION_GUIDE.md** - Master database migrations
3. **ARCHITECTURE_DESIGN_BRIEF.md** - Understand the architecture
4. **SCAFFOLD.md** - Learn scaffold design principles

### External Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Kong Gateway Documentation](https://docs.konghq.com/)
- [Caddy Documentation](https://caddyserver.com/docs/)

---

## 🤝 Contributing

This scaffold is designed to be extended and customized. See **CONTRIBUTING.md** for:

- Code style guidelines
- Commit conventions
- Pull request process
- Testing requirements

---

## 📝 Changelog

### Version 1.0.0 (2026-02-08)

**Initial Release**

- ✅ Complete container orchestration
- ✅ 43 database migrations
- ✅ Master migration automation
- ✅ DevContainer integration
- ✅ Agent fabric setup
- ✅ Comprehensive documentation
- ✅ Security hardening
- ✅ Monitoring & observability

---

## 📞 Support

### Issues

For bugs or feature requests:
1. Check existing documentation
2. Run diagnostics: `./scripts/dev/diagnostics.sh`
3. Check logs: `make logs`
4. Create GitHub issue with details

### Questions

- Review documentation in this scaffold
- Check QUICKSTART.md for common setup issues
- Review MIGRATION_AUTOMATION_GUIDE.md for database issues

---

## 📄 License

See LICENSE file in the ValueOS repository.

---

## 🎉 Next Steps

1. ✅ **Setup Complete** - You have a production-ready scaffold
2. 📖 **Read Documentation** - Familiarize yourself with the guides
3. 🚀 **Start Developing** - Run `pnpm dev` and build!
4. 🔒 **Secure Your Environment** - Review SECURITY.md
5. 🤝 **Contribute** - Help improve the scaffold

---

**Happy Coding! 🚀**

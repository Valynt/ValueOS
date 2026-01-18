# ValueOS Documentation

Welcome to the ValueOS documentation hub. This is your starting point for understanding, developing, and operating ValueOS.

## Quick Links

- **[Quick Start](getting-started/quickstart.md)** - Get running in 3 commands
- **[Local Development Setup](getting-started/local-setup.md)** - Complete local development guide
- **[Deployment Guide](operations/deployment.md)** - Production deployment procedures
- **[Architecture Overview](architecture/overview.md)** - System architecture and design

---

## Documentation Structure

### Getting Started

- **[Quick Start](getting-started/quickstart.md)** - Fastest way to get ValueOS running
- **[Local Setup](getting-started/local-setup.md)** - Detailed local development environment setup
- **[Troubleshooting](getting-started/troubleshooting.md)** - Common issues and solutions

### Architecture

- **[Overview](architecture/overview.md)** - High-level system architecture
- **[Data Flow](architecture/data-flow.md)** - How data moves through the system
- **[Multi-tenancy](architecture/multi-tenancy.md)** - Tenant isolation patterns
- **[Architecture Decision Records](architecture/adr/)** - Historical architectural decisions

### Engineering

- **[API Documentation](engineering/api/)** - REST API and client SDK guides
- **[Database](engineering/database/)** - Schema, migrations, and data access
- **[Zero-Downtime Migrations](engineering/database/zero-downtime-migrations.md)** - Expand/contract strategy and release checklist
- **[Agents](engineering/agents/)** - Agent system documentation
- **[SDUI](engineering/sdui/)** - Server-Driven UI implementation

### Operations

- **[Deployment](operations/deployment.md)** - Production deployment procedures
- **[Runbooks](operations/runbooks/)** - Operational procedures and checklists
- **[Monitoring](operations/monitoring.md)** - Observability and alerting
- **[Security](operations/security.md)** - Security practices and procedures

### Compliance

- **[Audit](compliance/audit.md)** - Compliance documentation and procedures

---

## Development Workflow

1. **Start Here**: [Quick Start](getting-started/quickstart.md) if you're new to ValueOS
2. **Local Development**: [Local Setup](getting-started/local-setup.md) for detailed environment setup
3. **Architecture**: [Architecture Overview](architecture/overview.md) to understand the system
4. **API Development**: [API Documentation](engineering/api/) for integration work
5. **Deployment**: [Deployment Guide](operations/deployment.md) for production releases

---

## Contributing to Documentation

Documentation lives alongside the code in the `docs/` directory. To contribute:

1. Edit the relevant markdown files
2. Test links and code examples
3. Submit a PR with `[docs]` prefix in the title

---

## Getting Help

- **Slack**: #engineering for questions
- **GitHub Issues**: Report documentation bugs
- **Pull Requests**: Contribute improvements

---

## Archived Documentation

Some obsolete or deprecated documentation has been moved to the `archive/` directory for historical reference. This includes old roadmap documents, specific deployment reports, and outdated UI designs.

---

**Last Updated**: 2026-01-14
**Maintained By**: Engineering Team

## 🎯 Quick Start

### **For New Developers**

1. Read [getting-started/quickstart.md](./getting-started/quickstart.md)
2. Follow [getting-started/local-setup.md](./getting-started/local-setup.md)
3. Review [architecture/overview.md](./architecture/overview.md)

### **For Operations**

1. Check [operations/deployment.md](./operations/deployment.md)
2. Review [operations/security.md](./operations/security.md)
3. Monitor with [operations/monitoring.md](./operations/monitoring.md)

### **For Product Development**

1. Explore [features/](./features/)
2. Review [architecture/overview.md](./architecture/overview.md)
3. Follow [processes/](./processes/)

## 🔍 Finding Information

| Need                          | Location                               |
| ----------------------------- | -------------------------------------- |
| **How to set up development** | [getting-started/](./getting-started/) |
| **System architecture**       | [architecture/](./architecture/)       |
| **Deployment procedures**     | [operations/](./operations/)           |
| **Feature documentation**     | [features/](./features/)               |
| **Team workflows**            | [processes/](./processes/)             |
| **API Documentation**         | [engineering/api/](./engineering/api/) |
| **Compliance & Audit**        | [compliance/](./compliance/)           |

## 📝 Documentation Standards

- **Keep it current** - Update docs when code changes
- **Be specific** - Include concrete examples and commands
- **Link liberally** - Connect related concepts
- **Version control** - Archive old versions, don't delete

---

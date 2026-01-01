# ValueOS Documentation

Complete documentation for ValueOS development, deployment, and operations.

---

## 🚀 Getting Started

New to ValueOS? Start here:

- **[Quick Start](getting-started/QUICK_START.md)** - Get up and running in 5 minutes
- **[Setup Guide](getting-started/GETTING_STARTED.md)** - Comprehensive setup instructions
- **[Troubleshooting](getting-started/TROUBLESHOOTING.md)** - Common issues and solutions

---

## 💻 Development

For developers working on ValueOS:

### Developer Experience
- **[DX Audit](development/DX_AUDIT_ENHANCED.md)** - Developer experience improvements
- **[DX Implementation](development/DX_IMPLEMENTATION_COMPLETE.md)** - Implementation summary
- **[DX Roadmap](development/DX_IMPLEMENTATION_ROADMAP.md)** - Implementation roadmap
- **[DX Recommendations](development/DX_RECOMMENDATIONS.md)** - Strategic recommendations
- **[DX Launch Checklist](development/DX_LAUNCH_CHECKLIST.md)** - Launch preparation

### Platform-Specific Guides
- **[Windows Setup](platform/WINDOWS.md)** - Windows and WSL2 setup
- **[macOS Setup](platform/MACOS.md)** - macOS Intel and Apple Silicon
- **[Linux Setup](platform/LINUX.md)** - Linux distributions

---

## 🚢 Deployment

Infrastructure and deployment documentation:

### CI/CD
- **[CI/CD Architecture](deployment/CICD_INFRASTRUCTURE_ARCHITECTURE.md)** - Complete CI/CD design
- **[CI/CD Implementation](deployment/CICD_INFRASTRUCTURE_COMPLETE.md)** - Implementation guide
- **[Deployment Guide](deployment/DEPLOYMENT.md)** - Deployment procedures

### Infrastructure
- **[Infrastructure as Code](../infra/terraform-new/)** - Terraform modules
- **[Observability Stack](deployment/OBSERVABILITY_STACK.md)** - Monitoring and observability

---

## 🔧 Operations

For operations and maintenance:

### Monitoring & Security
- **[Metrics & Monitoring](operations/DX_METRICS.md)** - Metrics framework
- **[Security Guide](operations/SECURITY_DEV_ENVIRONMENT.md)** - Security best practices

### Runbooks
- **[Deployment Runbook](deployment/CICD_INFRASTRUCTURE_COMPLETE.md#deployment-strategies)** - Deployment procedures
- **[Rollback Runbook](deployment/CICD_INFRASTRUCTURE_COMPLETE.md#rollback-strategy)** - Rollback procedures
- **[Incident Response](operations/SECURITY_DEV_ENVIRONMENT.md#incident-response)** - Security incidents

---

## 📚 Additional Resources

### Contributing
- **[Contributing Guide](../CONTRIBUTING.md)** - How to contribute
- **[Code of Conduct](../CONTRIBUTING.md#code-of-conduct)** - Community guidelines

### Archive
- **[Archive](archive/)** - Old implementation reports and status updates

---

## 🗺️ Documentation Map

```
docs/
├── README.md                           # This file
│
├── getting-started/                    # New user guides
│   ├── QUICK_START.md                 # 5-minute quick start
│   ├── GETTING_STARTED.md             # Comprehensive setup
│   └── TROUBLESHOOTING.md             # Common issues
│
├── development/                        # Developer guides
│   ├── DX_AUDIT_ENHANCED.md           # DX improvements
│   ├── DX_IMPLEMENTATION_COMPLETE.md  # DX implementation
│   ├── DX_IMPLEMENTATION_ROADMAP.md   # DX roadmap
│   ├── DX_RECOMMENDATIONS.md          # DX recommendations
│   └── DX_LAUNCH_CHECKLIST.md         # DX launch prep
│
├── deployment/                         # Deployment guides
│   ├── CICD_INFRASTRUCTURE_ARCHITECTURE.md  # CI/CD design
│   ├── CICD_INFRASTRUCTURE_COMPLETE.md      # CI/CD implementation
│   ├── DEPLOYMENT.md                        # Deployment guide
│   └── OBSERVABILITY_STACK.md               # Monitoring
│
├── operations/                         # Operations guides
│   ├── DX_METRICS.md                  # Metrics framework
│   └── SECURITY_DEV_ENVIRONMENT.md    # Security guide
│
├── platform/                           # Platform-specific
│   ├── WINDOWS.md                     # Windows/WSL2
│   ├── MACOS.md                       # macOS
│   └── LINUX.md                       # Linux
│
└── archive/                            # Historical docs
    └── [old implementation reports]
```

---

## 🔍 Quick Links

### Most Common Tasks

**Setup**:
```bash
npm run setup          # Automated setup
npm run health         # Check system health
npm run dev:unified    # Start all services
```

**Deployment**:
```bash
npm run deploy:staging     # Deploy to staging
npm run deploy:production  # Deploy to production
npm run deploy:rollback    # Rollback deployment
```

**Development**:
```bash
npm run dev            # Start frontend
npm run backend:dev    # Start backend
npm test               # Run tests
npm run lint           # Lint code
```

---

## 📞 Getting Help

- **Questions**: #engineering on Slack
- **Issues**: [GitHub Issues](https://github.com/Valynt/ValueOS/issues)
- **Security**: security@valueos.com

---

## 📝 Documentation Standards

When contributing to documentation:

1. **Be concise**: Get to the point quickly
2. **Be specific**: Provide exact commands and examples
3. **Be current**: Keep docs up-to-date with code
4. **Be helpful**: Include troubleshooting and common issues

---

**Last Updated**: January 1, 2025

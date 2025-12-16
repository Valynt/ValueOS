# ValueCanvas Documentation

**Last Updated:** 2025-12-15

Complete documentation for the ValueCanvas AI-Powered Value Realization Platform.

## 📖 Quick Navigation

### Essential
- **[Project Status](STATUS.md)** ⭐ - Current project status and metrics
- **[Main README](../README.md)** - Project overview and quick start
- **[Quick Start Guide](../QUICKSTART.md)** - Get running in 5 minutes
- **[Deployment Checklist](deployment/DEPLOYMENT_CHECKLIST.md)** ⭐ - Phase-by-phase deployment guide
- **[Contributing Guide](../CONTRIBUTING.md)** - How to contribute

---

## 📚 Documentation Structure

### 🚀 Getting Started
**Location:** `getting-started/`
- **[Local Setup Guide](./getting-started/LOCAL_SETUP_GUIDE.md)** - Comprehensive development setup
- **[Troubleshooting](./getting-started/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Quick Reference](./getting-started/QUICK_REFERENCE.md)** - Command and API quick reference

### 🏗️ Architecture & Design
**Location:** `architecture/`
- **[Architecture Diagrams](./architecture/ARCHITECTURE_DIAGRAMS.md)** - System architecture visualizations
- **[Deployment Architecture](./architecture/DEPLOYMENT_ARCHITECTURE.md)** - Deployment patterns and infrastructure
- **[VOS Architecture](./architecture/VOS_ARCHITECTURE.md)** - Value Operating System architecture
- **[Technical Reference](./architecture/technical-reference.md)** - Core technical details
- **[Agent Guide](./architecture/agent-guide.md)** - Agent system overview
- **[Multi-Tenant Architecture](./architecture/multi-tenant-architecture.md)** - Multi-tenancy design
- **[Code Refactoring Plan](./architecture/code-refactoring-plan.md)** - Refactoring roadmap
- **[Orchestrator Consolidation](./architecture/orchestrator-consolidation-diagram.md)** - Orchestrator design
- **[ADR](./adr/)** - Architecture Decision Records

### ✨ Features & Frameworks
**Location:** `features/`
- **[Enterprise Features](./features/ENTERPRISE_FEATURES.md)** - Enterprise capabilities overview
- **[SDUI Components Guide](./features/SDUI_COMPONENTS_GUIDE.md)** - Server-driven UI components
- **[SDUI Index](./features/SDUI_INDEX.md)** - Complete SDUI system reference
- **[SDUI Delivery Checklist](./features/SDUI_DELIVERY_CHECKLIST.md)** - Implementation checklist
- **[UI/UX Features](./features/UI_UX_FEATURES.md)** - User interface features
- **[Feature Documentation](./features/feature-documentation.md)** - Feature overview
- **[SOF Implementation Guide](./features/sof-implementation-guide.md)** - Systemic Outcome Framework
- **[VOS Manifesto](./features/vos-manifesto.md)** - Value Operating System principles

### 🔧 Operations, Deployment & Runbooks
**Location:** `operations/`, `deployment/`, `ops/`
- **[Deployment Guide](./operations/DEPLOYMENT.md)** - Production deployment instructions
- **[Operations Runbook](./operations/RUNBOOK_OPERATIONS.md)** - Day-to-day operations guide
- **[Production Readiness](./operations/PRODUCTION_READY_FINAL.md)** - Production checklist and requirements
- **[Scenario & Quality Validation](./operations/SCENARIO_QUALITY_VALIDATION.md)** - Synthetic monitors and weekly feedback cadence
- **[Deployment Checklist](./deployment/DEPLOYMENT_CHECKLIST.md)** - Phase-by-phase deployment
- **[Production Runbook](./deployment/PRODUCTION_RUNBOOK.md)** - Production deployment runbook
- **[Operations Guide](./ops/operations-guide.md)** - Operations overview
- **[Infrastructure Setup](./ops/infrastructure-setup.md)** - Infrastructure configuration
- **[Backup and DR Playbook](./ops/backup-and-dr-playbook.md)** - Backup and disaster recovery
- **[Async Workloads](./ops/async-workloads.md)** - Asynchronous processing
- **[Runbooks](./ops/runbooks/)** - Specific runbooks (deployment, rollback, troubleshooting)

### 🔌 API & Services
**Location:** `api/`
- **[API Examples](./api/API_EXAMPLES.md)** - Code examples and usage patterns
- **[Services API](./api/SERVICES_API.md)** - Internal services API reference
- **[External API Documentation](./api/EXTERNAL_API_DOCUMENTATION.md)** - External integrations
- **[API Changelog](./api/API_CHANGELOG_TEMPLATE.md)** - API change history
- **[Client SDK Guide](./api/CLIENT_SDK_GUIDE.md)** - SDK usage
- **[API Versioning Policy](./api/API_VERSIONING_POLICY.md)** - Versioning guidelines

### 🔒 Security, Privacy & Governance
**Location:** `security/`, `compliance/`
- **[Security Remediation](./security/SECURITY_REMEDIATION.md)** - 2024-11-29 security hardening ⭐
- **[Security Overview](./security/SECURITY.md)** - Security features and best practices
- **[Compliance Guide](./security/MANIFESTO_COMPLIANCE_GUIDE.md)** - Compliance requirements
- **[RBAC Guide](./security/rbac-guide.md)** - Role-Based Access Control
- **[Audit Logging](./security/audit-logging.md)** - Compliance audit trails
- **[Circuit Breaker](./security/circuit-breaker.md)** - Agent safety controls
- **[Compliance Audit](./compliance/code-review-checklist.md)** - Code review for compliance
- **[Multi-Tenancy Checklist](./compliance/multi-tenancy-checklist.md)** - Multi-tenancy compliance

### 📊 Monitoring & Observability
**Location:** `monitoring/`
- **[LLM Monitoring Dashboard](./monitoring/monitoring-dashboards.md)** - LLM monitoring
- **[Monitoring Queries](./monitoring/monitoring-dashboards.md)** - Monitoring queries (assuming consolidated)
- **[Performance Monitoring](./monitoring/monitoring-dashboards.md)** - Performance metrics

### 📘 Guides & User Experience
**Location:** `guides/`, `accessibility/`, `user-guide/`
- **[Agent Fabric README](./guides/AGENT_FABRIC_README.md)** - Multi-agent system overview
- **[Agent UI Integration](./guides/AGENT_UI_INTEGRATION_GUIDE.md)** - Integrating agents with UI
- **[Lifecycle User Guides](./guides/LIFECYCLE_USER_GUIDES.md)** - User lifecycle management
- **[Settings Architecture](./guides/SETTINGS_ARCHITECTURE.md)** - Configuration system design
- **[Settings Usage Examples](./guides/SETTINGS_USAGE_EXAMPLES.md)** - Configuration examples
- **[Internationalization](./guides/INTERNATIONALIZATION.md)** - i18n support
- **[Orchestrator Migration Guide](./guides/ORCHESTRATOR_MIGRATION_GUIDE.md)** - Migration instructions
- **[Accessibility Standards](./accessibility/PHASE_1_CRITICAL_FIXES.md)** - Accessibility guidelines

### 🗃️ Data, Migrations & Vector Store
**Location:** `database/`, `migrations/`
- **[Critical RLS Fixes](./database/CRITICAL_RLS_FIXES_IMPLEMENTATION_GUIDE.md)** - RLS implementation
- **[Custom Domains Schema](./database/CUSTOM_DOMAINS_SCHEMA.md)** - Domain schema
- **[Migration Checklist](./migrations/FIX_MIGRATIONS_SUMMARY.md)** - Migration checklist
- **[Rollback Guide](./migrations/ROLLBACK_GUIDE.md)** - Rollback procedures

### 📋 Project Management & Communication
**Location:** `project-management/` (new)
- **[Communication Plan](./project-management/COMMUNICATION_PLAN.md)** - Communication guidelines
- **[Near-Term Platform Plan](./project-management/near-term-platform-plan.md)** - Platform roadmap
- **[Documentation Gaps](./project-management/DOCUMENTATION_GAPS_IMPLEMENTATION_PLAN.md)** - Documentation improvements
- **[Repository Cleanup Report](./project-management/REPOSITORY_CLEANUP_REPORT.md)** - Cleanup summary

### 📦 Testing & Quality
**Location:** `testing/` (assuming from test/)
- **[Testing Framework](./testing/testing-framework.md)** - Testing approach (placeholder)
- **[Performance Benchmarks](./testing/performance-benchmarks.md)** - Benchmarks

### 📦 Archive
**Location:** `archive/`
- **[Archived Documentation](./archive/README.md)** - Historical completion reports (65+ documents)
  - Completion reports (22 files)
  - Progress reports (30 files)
  - Testing reports (13 files)

---

## 🔍 Finding What You Need

### I want to...

**Get started quickly**
→ [Quick Start Guide](../QUICKSTART.md) → [Local Setup](./getting-started/LOCAL_SETUP_GUIDE.md)

**Deploy to production**
→ [Deployment Guide](./operations/DEPLOYMENT.md) → [Production Readiness](./operations/PRODUCTION_READY_FINAL.md)

**Understand the architecture**
→ [Architecture Diagrams](./architecture/ARCHITECTURE_DIAGRAMS.md) → [VOS Architecture](./architecture/VOS_ARCHITECTURE.md)

**Integrate with APIs**
→ [API Examples](./api/API_EXAMPLES.md) → [Services API](./api/SERVICES_API.md)

**Configure security**
→ [Security Overview](./security/SECURITY.md) → [RBAC Guide](./security/rbac-guide.md)

**Work with agents**
→ [Agent Fabric README](./guides/AGENT_FABRIC_README.md) → [Agent UI Integration](./guides/AGENT_UI_INTEGRATION_GUIDE.md)

**Troubleshoot issues**
→ [Troubleshooting](./getting-started/TROUBLESHOOTING.md) → [FAQ](./FAQ.md)

---

## 📈 Documentation Statistics

- **Total Documents:** 100+ active documents
- **Archived Documents:** 65+ historical documents
- **Categories:** 12 main categories
- **Last Updated:** December 2025
- **Status:** ✅ Production-ready

---

## 🤝 Contributing to Documentation

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on:
- Writing new documentation
- Updating existing docs
- Documentation style guide
- Review process

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/bmsull560/ValueCanvas/issues)
- **Discussions:** [GitHub Discussions](https://github.com/bmsull560/ValueCanvas/discussions)
- **Documentation Portal:** Built-in help system in the application

---

**Last Updated:** 2025-12-15
**Maintained by:** ValueCanvas Team

---

## 🗂️ Deprecated Documentation

The following files have been consolidated into canonical documentation:

**Moved to Archive:**
- All `PHASE*_COMPLETE.md` files → See [STATUS.md](STATUS.md)
- All `*_SUMMARY.md` files → See [STATUS.md](STATUS.md)
- Historical completion reports → See `archive/`

**Current Canonical Sources:**
- **Status:** `docs/STATUS.md` (updated 2024-11-29)
- **Security:** `docs/security/SECURITY_REMEDIATION.md` (updated 2024-11-29)
- **Deployment:** `docs/deployment/DEPLOYMENT_CHECKLIST.md` (updated 2024-11-29)
- **Console Cleanup:** Root `CONSOLE_CLEANUP_SUMMARY.md` (updated 2024-11-29)

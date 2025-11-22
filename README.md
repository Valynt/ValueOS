# ValueCanvas

**AI-Powered Value Realization Platform**

ValueCanvas is an enterprise-grade platform that combines LLM-powered multi-agent systems with generative UI to help organizations discover, target, realize, and expand business value through systematic outcome frameworks.

---

## 🚀 Quick Start

Get up and running in 5 minutes:

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.local .env
# Edit .env and add your LLM API key

# 3. Start everything
./start.sh
```

Open http://localhost:5173 and start creating value!

📖 **New to ValueCanvas?** See [QUICKSTART.md](./QUICKSTART.md) for detailed setup instructions.

---

## 📚 Documentation

### Getting Started
- **[Quick Start Guide](./QUICKSTART.md)** - Get running in 5 minutes
- **[Local Setup Guide](./LOCAL_SETUP_GUIDE.md)** - Comprehensive development setup
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Common issues and solutions

### Core Features
- **[LLM-MARL System](./LLM_MARL_COMPLETE.md)** - Multi-agent reinforcement learning
- **[Generative UI](./GENERATIVE_UI_COMPLETE.md)** - Dynamic UI generation
- **[SOF Framework](./SOF_IMPLEMENTATION_COMPLETE.md)** - Systemic Outcome Framework
- **[SDUI Components](./SDUI_COMPONENTS_GUIDE.md)** - Server-driven UI components

### Architecture & Operations
- **[Deployment Architecture](./DEPLOYMENT_ARCHITECTURE.md)** - System architecture
- **[Scalability Guide](./DEPLOYMENT_SCALABILITY_COMPLETE.md)** - Scaling strategies
- **[Production Readiness](./PRODUCTION_READY_FINAL.md)** - Production checklist
- **[Operations Runbook](./RUNBOOK_OPERATIONS.md)** - Day-to-day operations

### Security & Compliance 🔒 NEW
- **[Security Overview](./SECURITY.md)** - Security features
- **[RBAC Guide](./docs/security/rbac-guide.md)** - Role-Based Access Control ⭐
- **[Audit Logging](./docs/security/audit-logging.md)** - Compliance audit trails ⭐
- **[Circuit Breaker](./docs/security/circuit-breaker.md)** - Agent safety controls ⭐
- **[Security Sprint Report](./reports/security-sprint-2024/)** - Operation Fortress completion
- **[Compliance Guide](./MANIFESTO_COMPLIANCE_GUIDE.md)** - Compliance guidelines

### Enterprise Features
- **[Enterprise Features](./ENTERPRISE_FEATURES.md)** - Enterprise capabilities
- **[Documentation Portal](./DOCUMENTATION_PORTAL.md)** - Built-in documentation
- **[Settings Architecture](./SETTINGS_ARCHITECTURE.md)** - Configuration system

### Testing & Quality
- **[Testing Framework](./TESTING_FRAMEWORK_COMPLETE.md)** - Testing approach
- **[Performance Testing](./TESTING_PERFORMANCE.md)** - Performance benchmarks
- **[Codebase Audit](./CODEBASE_AUDIT_REPORT.md)** - Code quality audit

### Additional Resources
- **[Archived Documentation](./docs/archive/README.md)** - Historical documentation
- **[API Documentation](./SERVICES_API.md)** - Service APIs
- **[External APIs](./EXTERNAL_API_DOCUMENTATION.md)** - External integrations

---

## 🏗️ Architecture

ValueCanvas is built on a modern, scalable architecture:

### Technology Stack
- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **AI/ML:** LLM-MARL multi-agent system
- **UI:** Generative SDUI with dynamic component selection
- **Testing:** Vitest + Testing Library

### Key Components

#### 1. LLM-MARL Agent System
Multi-agent reinforcement learning system with:
- **CoordinatorAgent** - Task planning and orchestration
- **SystemMapperAgent** - System analysis and mapping
- **InterventionDesignerAgent** - Intervention design
- **OutcomeEngineerAgent** - Outcome engineering
- **RealizationLoopAgent** - Value realization tracking
- **ValueEvalAgent** - Value evaluation and scoring
- **CommunicatorAgent** - Inter-agent communication

#### 2. Generative UI System
Dynamic UI generation with:
- Component selection based on context
- LLM-powered layout generation
- Automatic refinement (3 iterations)
- Metrics tracking and optimization
- A/B testing support

#### 3. Systemic Outcome Framework (SOF)
Comprehensive value realization framework:
- System mapping and analysis
- Intervention point identification
- Feedback loop tracking
- Governance and compliance
- Artifact scoring

#### 4. Database Schema
20+ tables supporting:
- Business intelligence
- Agent fabric and episodic memory
- Workflow orchestration
- SOF governance
- UI generation metrics
- Artifact scoring

---

## 🔒 Security & Compliance (Production-Ready)

ValueCanvas implements enterprise-grade security controls:

### Security Features ⭐ NEW
- ✅ **Zero PII Leakage** - Automatic PII sanitization in all logs
- ✅ **Agent Circuit Breaker** - Prevents runaway execution and cost overruns
  - Max 30s execution time
  - Max 20 LLM calls per execution
  - Max 5 recursion depth
  - Memory usage monitoring
- ✅ **Rate Limiting** - Tiered API protection (5-300 req/min)
- ✅ **Immutable Audit Logs** - Cryptographic integrity with hash chain
- ✅ **RBAC System** - 40+ granular permissions, 6 role levels
- ✅ **Tenant Isolation** - Defense-in-depth data separation

### Compliance Status
- ✅ **SOC 2 Ready** - Immutable audit trails, access control
- ✅ **GDPR Compliant** - PII sanitization, data retention policies
- ✅ **Production Hardened** - Completed security sprint (Operation Fortress)

See [Security Documentation](./docs/security/) for implementation details.

---

## 🎯 Features

### Core Capabilities
- ✅ **AI-Powered Value Discovery** - LLM agents identify opportunities
- ✅ **Dynamic UI Generation** - Context-aware interface creation
- ✅ **Workflow Orchestration** - Complex workflow automation
- ✅ **Real-time Collaboration** - Multi-user support with presence
- ✅ **Episodic Memory** - Learning from user interactions
- ✅ **Simulation Engine** - "What-if" scenario analysis
- ✅ **Compliance Tracking** - Built-in governance and audit

### Enterprise Features
- ✅ **Multi-tenancy** - Isolated tenant environments
- ✅ **Role-based Access Control** - Granular permissions (40+ permissions)
- ✅ **Audit Logging** - Immutable, tamper-evident activity tracking
- ✅ **Usage Tracking** - Resource monitoring and billing
- ✅ **Documentation Portal** - Built-in help system
- ✅ **Settings Management** - Flexible configuration

### Developer Experience
- ✅ **TypeScript** - Full type safety
- ✅ **Hot Module Replacement** - Fast development
- ✅ **Comprehensive Testing** - Unit, integration, and E2E tests
- ✅ **ESLint + Prettier** - Code quality enforcement
- ✅ **Storybook** - Component development and documentation

---

## 🛠️ Development

### Prerequisites
- Node.js 18+ and npm
- Docker Desktop (for Supabase)
- Supabase CLI
- Git

### Local Development

```bash
# Clone the repository
git clone https://github.com/bmsull560/ValueCanvas.git
cd ValueCanvas

# Install dependencies
npm install

# Set up environment variables
cp .env.local .env
# Edit .env and add your LLM API key from together.ai or openai.com

# Start Supabase (database)
supabase start

# Run database migrations
supabase db push

# Start development server
npm run dev
```

Visit http://localhost:5173 to see the application.

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Run ESLint
npm run security:scan # Run security audit
```

### Project Structure

```
ValueCanvas/
├── src/
│   ├── agents/           # LLM-MARL agent implementations
│   ├── components/       # React components
│   ├── services/         # Business logic services
│   ├── sdui/            # Generative UI system
│   ├── lib/             # Utilities and helpers
│   ├── types/           # TypeScript type definitions
│   ├── hooks/           # Custom React hooks
│   └── views/           # Page-level components
├── supabase/
│   ├── migrations/      # Database migrations
│   └── functions/       # Edge functions
├── docs/                # Additional documentation
├── test/                # Test files
└── scripts/             # Build and deployment scripts
```

---

## 🧪 Testing

ValueCanvas has comprehensive test coverage:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test -- --coverage

# Run specific test file
npm test src/services/AgentOrchestrator.test.ts
```

### Test Categories
- **Unit Tests** - Individual functions and components
- **Integration Tests** - Service interactions and workflows
- **Component Tests** - React component behavior
- **E2E Tests** - Full user workflows (planned)

---

## 🚢 Deployment

### Production Deployment

See [DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md) for detailed deployment instructions.

Quick deployment options:
- **Vercel** - Recommended for frontend
- **Supabase Cloud** - Managed database and auth
- **Docker** - Containerized deployment
- **Kubernetes** - Enterprise-scale deployment

### Environment Variables

Required environment variables for production:

```bash
# Application
VITE_APP_ENV=production
VITE_APP_URL=https://your-domain.com

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Agent Fabric
VITE_AGENT_API_URL=https://your-agent-api.com
VITE_LLM_API_KEY=your-llm-api-key

# Security
VITE_HTTPS_ONLY=true
CSRF_PROTECTION_ENABLED=true
CSP_ENABLED=true

# Monitoring (optional)
VITE_SENTRY_DSN=your-sentry-dsn
VITE_SENTRY_ENABLED=true
```

---

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes** with tests
4. **Run tests and linting** (`npm test && npm run lint`)
5. **Commit your changes** (`git commit -m 'feat: Add amazing feature'`)
6. **Push to the branch** (`git push origin feature/amazing-feature`)
7. **Open a Pull Request**

### Code Standards
- Write TypeScript with strict mode
- Add tests for new features
- Follow existing code style
- Document public APIs
- Update documentation as needed

### Commit Convention
We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: Add new feature
fix: Fix bug
docs: Update documentation
style: Format code
refactor: Refactor code
test: Add tests
chore: Update dependencies
```

---

## 📊 Project Status

### Current Version: 0.0.0 (Pre-release)

### Recent Updates
- ✅ LLM-MARL agent system complete
- ✅ Generative UI system complete
- ✅ SOF framework integrated
- ✅ Enterprise features implemented
- ✅ Security audit completed
- ✅ Codebase cleanup completed
- 🚧 Production deployment in progress

### Roadmap
- [ ] Production deployment
- [ ] Performance optimization
- [ ] Enhanced monitoring
- [ ] Mobile responsive design
- [ ] API documentation portal
- [ ] Plugin system

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 🙏 Acknowledgments

Built with:
- [React](https://react.dev/) - UI framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Vite](https://vitejs.dev/) - Build tool
- [Supabase](https://supabase.com/) - Backend platform
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Lucide Icons](https://lucide.dev/) - Icons

---

## 📞 Support

- **Documentation:** See documentation links above
- **Issues:** [GitHub Issues](https://github.com/bmsull560/ValueCanvas/issues)
- **Discussions:** [GitHub Discussions](https://github.com/bmsull560/ValueCanvas/discussions)

---

## 📈 Statistics

- **Lines of Code:** ~68,000
- **Components:** 94 React components
- **Services:** 50+ business logic services
- **Agents:** 7 LLM-MARL agents
- **Database Tables:** 20+ tables
- **Test Files:** 29 test suites
- **Documentation:** 39 markdown files

---

**Built with ❤️ by the ValueCanvas Team**

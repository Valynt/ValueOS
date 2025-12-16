# Frequently Asked Questions (FAQ)

**Last Updated:** November 22, 2024  
**Purpose:** Quick answers to common questions

---

## Table of Contents

- [Getting Started](#getting-started)
- [Installation & Setup](#installation--setup)
- [Features & Capabilities](#features--capabilities)
- [Architecture & Technical](#architecture--technical)
- [Development & Contributing](#development--contributing)
- [Deployment & Operations](#deployment--operations)
- [Security & Compliance](#security--compliance)
- [Troubleshooting](#troubleshooting)
- [Performance & Optimization](#performance--optimization)
- [Pricing & Licensing](#pricing--licensing)

---

## Getting Started

### What is ValueCanvas?

ValueCanvas is an AI-powered value realization platform that combines LLM-based multi-agent systems with generative UI to help organizations discover, target, realize, and expand business value through systematic outcome frameworks.

### Who is ValueCanvas for?

- **Business Analysts** - Value discovery and mapping
- **Product Managers** - Outcome engineering
- **Consultants** - Client value realization
- **Executives** - Strategic planning
- **Teams** - Collaborative value creation

### How do I get started?

1. Read [QUICKSTART.md](./QUICKSTART.md) for 5-minute setup
2. Follow [LOCAL_SETUP_GUIDE.md](./LOCAL_SETUP_GUIDE.md) for detailed instructions
3. Review [CONTRIBUTING.md](./CONTRIBUTING.md) if you want to contribute

### Do I need coding experience?

**For Users:** No, the UI is designed for business users  
**For Developers:** Yes, TypeScript/React knowledge helpful for customization

---

## Installation & Setup

### What are the system requirements?

**Minimum:**
- Node.js 18+
- 8GB RAM
- 10GB disk space
- Modern browser (Chrome, Firefox, Safari, Edge)

**Recommended:**
- Node.js 20+
- 16GB RAM
- 20GB disk space
- Docker Desktop (for local Supabase)

### How long does setup take?

- **Quick Start:** 5 minutes
- **Full Setup:** 15-30 minutes
- **With Database:** 30-45 minutes

### Do I need Docker?

**For Local Development:** Yes, for local Supabase database  
**For Production:** No, use Supabase Cloud

### Can I use my own database?

Yes, but Supabase is recommended. You'll need to:
1. Adapt the schema
2. Update connection strings
3. Implement RLS policies

### What LLM providers are supported?

- **Together.ai** (Recommended, cheaper)
- **OpenAI** (Alternative)
- **Custom** (Implement LLMGateway interface)

---

## Features & Capabilities

### What is LLM-MARL?

LLM-MARL (Large Language Model - Multi-Agent Reinforcement Learning) is our agent coordination system where multiple AI agents work together to solve complex tasks.

**Key Agents:**
- CoordinatorAgent - Task planning
- SystemMapperAgent - System analysis
- InterventionDesignerAgent - Intervention design
- OutcomeEngineerAgent - Outcome engineering
- RealizationLoopAgent - Value tracking
- ValueEvalAgent - Quality evaluation

### What is Generative UI (SDUI)?

Server-Driven UI that dynamically generates interfaces based on user intent and context. The system:
1. Analyzes user goals
2. Selects appropriate components
3. Generates optimal layouts
4. Refines through 3 iterations
5. Renders the final UI

### What is the SOF Framework?

Systemic Outcome Framework - a methodology for:
- Mapping complex systems
- Identifying intervention points
- Designing effective interventions
- Measuring outcomes
- Creating feedback loops

### Can I customize the agents?

Yes! Agents are extensible:
1. Extend BaseAgent class
2. Implement required methods
3. Register in AgentRegistry
4. Configure routing rules

### Does it support multi-tenancy?

Yes, enterprise features include:
- Tenant isolation
- Resource quotas
- Usage tracking
- Billing integration

---

## Architecture & Technical

### What tech stack does it use?

**Frontend:**
- React 18
- TypeScript
- Vite
- Tailwind CSS

**Backend:**
- Supabase (PostgreSQL)
- Edge Functions
- Row Level Security

**AI/ML:**
- LLM Gateway (Together.ai/OpenAI)
- Multi-agent coordination
- Episodic memory

### How does the agent system work?

```
User Intent → CoordinatorAgent → Task Decomposition
           → Agent Routing → Specialized Agents
           → MessageBus → Coordination
           → Results Aggregation → User
```

### How does UI generation work?

```
Subgoal → Component Selection → Layout Generation
       → Refinement Loop (3x) → SDUI Renderer
       → Hydrated UI → User
```

### What database tables are there?

**20+ tables across:**
- Agent Fabric (4 tables)
- Episodic Memory (4 tables)
- Workflow Orchestration (3 tables)
- SOF Framework (6 tables)
- UI Generation (6 tables)
- Artifact Scoring (2 tables)

See [LOCAL_SETUP_GUIDE.md](./LOCAL_SETUP_GUIDE.md) for full schema.

### Is it scalable?

Yes, designed for scale:
- Horizontal scaling (multiple instances)
- Database connection pooling
- Edge caching
- Load balancing
- Performance indexes

---

## Development & Contributing

### How do I contribute?

1. Read [CONTRIBUTING.md](./CONTRIBUTING.md)
2. Fork the repository
3. Create a feature branch
4. Make changes with tests
5. Submit a pull request

### What's the code style?

- **TypeScript** with strict mode
- **Named exports** (not default)
- **Functional components** (React)
- **ESLint** for linting
- **Prettier** for formatting

### How do I run tests?

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm test -- --coverage # With coverage
```

### How do I add a new agent?

1. Create agent file in `src/agents/`
2. Extend `BaseAgent` class
3. Implement required methods
4. Register in `AgentRegistry`
5. Add tests
6. Update documentation

### How do I add a new component?

1. Create component in `src/components/`
2. Add to component registry
3. Define props interface
4. Add Storybook story
5. Write tests
6. Update SDUI registry

---

## Deployment & Operations

### How do I deploy to production?

**Recommended:**
1. Frontend: Vercel
2. Database: Supabase Cloud
3. Monitoring: Sentry

See [DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md) for details.

### What environment variables are needed?

**Required:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_LLM_API_KEY`

**Optional:**
- `VITE_SENTRY_DSN`
- `VITE_AGENT_API_URL`
- See `.env.example` for full list

### How do I monitor production?

**Error Tracking:**
- Sentry for errors
- Structured logging

**Performance:**
- Database query metrics
- API response times
- UI render performance

**Availability:**
- Uptime monitoring
- Health checks
- Alerting

### How do I backup data?

**Supabase Cloud:**
- Automatic daily backups
- Point-in-time recovery
- Manual backups available

**Self-Hosted:**
- `pg_dump` for PostgreSQL
- Automated backup scripts
- Off-site storage

### What's the disaster recovery plan?

1. **Backup Restoration** - Restore from latest backup
2. **Failover** - Switch to backup region
3. **Data Recovery** - Point-in-time recovery
4. **Communication** - Status page updates

See [RUNBOOK_OPERATIONS.md](./RUNBOOK_OPERATIONS.md) for details.

---

## Security & Compliance

### Is it secure?

Yes, multiple security layers:
- **Network:** HTTPS/TLS, WAF, DDoS protection
- **Application:** CSP, CSRF, input sanitization
- **Auth:** JWT, RLS, RBAC, MFA
- **Data:** Encryption at rest and in transit

See [SECURITY.md](./SECURITY.md) for details.

### How is data encrypted?

- **At Rest:** AES-256 encryption
- **In Transit:** TLS 1.3
- **Passwords:** bcrypt hashing
- **Secrets:** Environment variables

### What authentication methods are supported?

- Email/Password
- OAuth (Google, GitHub, etc.)
- Magic Links
- MFA (optional)

### Is it GDPR compliant?

Yes, features include:
- Data export
- Right to deletion
- Consent management
- Audit logging
- Data minimization

### How do I report a security issue?

Email: security@valuecanvas.com (or create private issue)

**Do NOT** create public issues for security vulnerabilities.

---

## Troubleshooting

### Installation fails with "npm not found"

**Solution:** Install Node.js from https://nodejs.org

### "Supabase connection failed"

**Solutions:**
1. Check if Docker is running
2. Run `supabase start`
3. Verify `.env` configuration
4. Check firewall settings

### "Port 5173 already in use"

**Solution:** 
```bash
npm run dev -- --port 3000
```

### Database migrations fail

**Solutions:**
1. Check Supabase is running
2. Verify connection string
3. Run `supabase db reset`
4. Check migration files for errors

### LLM API errors

**Solutions:**
1. Verify API key is set
2. Check API key is valid
3. Verify provider is correct
4. Check rate limits

### UI not rendering

**Solutions:**
1. Check browser console for errors
2. Verify all dependencies installed
3. Clear browser cache
4. Check SDUI registry

### Performance is slow

**Solutions:**
1. Apply performance indexes
2. Enable caching
3. Optimize queries
4. Profile components

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for more.

---

## Performance & Optimization

### How fast is it?

**Typical Performance:**
- Page load: <2 seconds
- API response: <500ms
- UI generation: 2-5 seconds
- Agent processing: 3-10 seconds

### How do I improve performance?

1. **Apply indexes** - Run performance migration
2. **Enable caching** - Redis or in-memory
3. **Optimize components** - React.memo, useMemo
4. **Profile queries** - Use EXPLAIN ANALYZE
5. **Use CDN** - For static assets

### What are the performance indexes?

25+ indexes for:
- Agent sessions
- Workflow executions
- SOF entities
- UI generation
- Time-series queries

See `supabase/migrations/20251122000000_add_performance_indexes.sql`

### Can I use Redis?

Yes, configure in `.env`:
```bash
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
CACHE_TTL=3600
```

### How do I profile performance?

**Frontend:**
- React DevTools Profiler
- Chrome DevTools Performance
- Lighthouse

**Backend:**
- PostgreSQL EXPLAIN ANALYZE
- Supabase Dashboard
- Custom metrics

---

## Pricing & Licensing

### Is it free?

**Open Source:** Yes, for self-hosting  
**Cloud:** Pricing TBD

### What's the license?

Check LICENSE file in repository.

### Can I use it commercially?

Check license terms. Generally:
- **Self-hosted:** Yes
- **Cloud:** Subscription required

### What are the costs?

**Self-Hosted:**
- Infrastructure (AWS/GCP/Azure)
- LLM API costs (Together.ai/OpenAI)
- Monitoring (Sentry, etc.)

**Cloud:**
- Subscription fee
- Usage-based pricing
- Enterprise features

### Do I need an LLM API key?

Yes, required for:
- Agent coordination
- UI generation
- Natural language processing

**Costs:**
- Together.ai: ~$0.20 per 1M tokens
- OpenAI: ~$2.00 per 1M tokens

---

## Additional Questions

### Where can I get help?

1. **Documentation:** Check docs in repository
2. **GitHub Issues:** Report bugs/request features
3. **Discussions:** Ask questions
4. **Community:** Join Discord/Slack (if available)

### How do I stay updated?

1. **Watch** the GitHub repository
2. **Follow** release notes
3. **Subscribe** to newsletter (if available)
4. **Join** community channels

### Can I request features?

Yes! Create a GitHub issue with:
- Feature description
- Use case
- Expected behavior
- Mockups (if applicable)

### How often is it updated?

- **Bug fixes:** As needed
- **Features:** Monthly releases
- **Security:** Immediate patches
- **Documentation:** Continuous

### Who maintains it?

ValueCanvas is maintained by the core development team and community contributors.

---

## Quick Links

- **Documentation:** [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)
- **Getting Started:** [QUICKSTART.md](./QUICKSTART.md)
- **Contributing:** [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Security:** [SECURITY.md](./SECURITY.md)
- **Troubleshooting:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## Still Have Questions?

**Can't find your answer?**

1. Search the documentation
2. Check GitHub issues
3. Ask in discussions
4. Create a new issue

**Want to improve this FAQ?**

Submit a PR with your question and answer!

---

**Last Updated:** November 22, 2024  
**Maintained by:** Development Team  
**Contributions Welcome:** Yes!

# ValueOS Development Guides Overview

## Executive Summary

This document provides comprehensive development guides for ValueOS, covering agent architecture, testing strategies, accessibility standards, observability setup, and frequently asked questions. ValueOS follows structured development practices to ensure consistent, high-quality contributions and maintenance.

## Agent Fabric Architecture

### Agent Types & Roles

#### Orchestrator Agent (Authority Level 5)

**Purpose**: Master coordinator and workflow manager

- **Capabilities**: Task decomposition, agent delegation, workflow monitoring
- **Use Cases**: Complex multi-step business processes, cross-functional analysis

```typescript
const orchestrator = new OrchestratorAgent({
  name: "Master Orchestrator",
  authorityLevel: 5,
  capabilities: ["coordinate", "delegate", "monitor"],
});

await orchestrator.execute({
  workflow: "company-analysis",
  target: "Acme Corp",
  steps: ["intelligence", "opportunity", "value-mapping"],
});
```

#### Specialized Agents

**Company Intelligence Agent (Level 3)**

- Research and analysis of company profiles
- Market research and competitive intelligence
- Financial data gathering and trend analysis

**Opportunity Agent (Level 3)**

- Business opportunity identification and qualification
- Market gap analysis and risk assessment
- ROI estimation and prioritization scoring

**Value Mapping Agent (Level 3)**

- Value proposition analysis and customer need identification
- Benefit quantification and competitive differentiation
- Messaging optimization and positioning strategy

**Financial Modeling Agent (Level 4)**

- Revenue modeling and cost analysis
- ROI calculation and scenario planning
- Sensitivity analysis and financial forecasting

**Integration Agent (Level 4)**

- External system integration and data synchronization
- API integration and webhook management
- Real-time sync and error handling

**Compliance Agent (Level 5)**

- Regulatory compliance monitoring and enforcement
- Audit logging and risk assessment
- Policy compliance verification

**Reporting Agent (Level 2)**

- Data aggregation and insight extraction
- Visualization generation and report formatting
- Multi-channel distribution management

**Notification Agent (Level 1)**

- User notifications and alert generation
- Multi-channel delivery (email, SMS, push)
- Priority management and escalation handling

### Agent Infrastructure

#### LLM Gateway

**Features**:

- Provider abstraction (OpenAI, Anthropic, Together AI)
- Request routing and load balancing
- Response caching and rate limiting
- Cost tracking and error handling

```typescript
const gateway = new LLMGateway({
  provider: "openai",
  model: "gpt-4",
  temperature: 0.7,
  maxTokens: 2000,
  circuitBreaker: {
    enabled: true,
    threshold: 5,
    timeout: 60000,
  },
});
```

#### Context Fabric

**Purpose**: Manage agent context and memory

- Context persistence and sharing between agents
- Memory management with compression
- Relevance scoring and context optimization

#### Circuit Breaker

**Purpose**: Prevent cascading failures

- Failure detection and automatic circuit opening
- Exponential backoff and health monitoring
- Automatic recovery with half-open testing

#### Prompt Manager

**Features**:

- Template management and variable substitution
- Version control and A/B testing
- Performance tracking and optimization

#### Tool Registry

**Capabilities**:

- Tool registration and capability discovery
- Permission management and usage tracking
- Tool composition and orchestration

### Agent Communication

#### Message Types

```typescript
// Request-Response Pattern
interface AgentRequest {
  eventId: string;
  correlationId: string;
  agentId: string;
  action: string;
  payload: any;
  timestamp: Date;
}

interface AgentResponse {
  eventId: string;
  correlationId: string;
  agentId: string;
  status: "success" | "failure";
  payload: any;
  timestamp: Date;
}

// Publish-Subscribe Pattern
interface AgentEvent {
  eventId: string;
  agentId: string;
  event: string; // 'opportunity-identified', 'analysis-complete'
  payload: any;
  timestamp: Date;
}
```

#### Communication Patterns

- **Request-Response**: Synchronous agent-to-agent communication
- **Publish-Subscribe**: Asynchronous event broadcasting
- **Pipeline**: Sequential data transformation and processing

### Agent Authority Levels

| Level | Permissions                                                     | Example Agents                           |
| ----- | --------------------------------------------------------------- | ---------------------------------------- |
| **5** | Full system access, agent coordination, policy enforcement      | Orchestrator, Compliance                 |
| **4** | External API access, financial operations, system configuration | Integration, Financial Modeling          |
| **3** | Business operations, data analysis, workflow execution          | Intelligence, Opportunity, Value Mapping |
| **2** | Data analysis, reporting, insight generation                    | Reporting Agent                          |
| **1** | Read-only operations, notifications                             | Notification Agent                       |

## Testing Strategy

### Test Types & Organization

#### Unit Tests

- **Purpose**: Test individual functions and components in isolation
- **Dependencies**: Zero external dependencies
- **Execution**: Fast, deterministic across environments
- **Pattern**: `*.test.ts`, `*.spec.ts` (excluding integration patterns)

#### Integration Tests

- **Purpose**: Test service interactions and external dependencies
- **Dependencies**: Docker, PostgreSQL, Redis, testcontainers
- **Execution**: Requires Docker setup, runs only when explicitly requested
- **Pattern**: `*.int.test.ts`, `*.integration.test.ts`, `integration/**/*`

### Running Tests

#### Quick Start Commands

```bash
# Unit tests with coverage (recommended for development)
npm test

# Unit tests without coverage
npm run test:unit

# Watch mode for development
npm run test:watch

# Integration tests (requires Docker)
npm run test:integration

# All tests
npm run test:all
```

#### Docker Testing

```bash
# Unit tests in Docker container
npm run test:docker

# Integration tests with Docker services
npm run test:docker:integration

# Manual Docker setup
docker-compose -f infra/docker/docker-compose.test.yml up -d
docker-compose -f infra/docker/docker-compose.test.yml logs -f test-ready
TEST_MODE=integration npm run test:integration
docker-compose -f infra/docker/docker-compose.test.yml down
```

### Environment Requirements

#### Unit Tests

- Node.js 18+
- npm/yarn

#### Integration Tests

- Docker Desktop or Docker Engine
- Docker permissions
- 2GB+ disk space for Docker images

### Writing Tests

#### Unit Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button Component', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

#### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { UserService } from "../UserService";

describe("UserService Integration", () => {
  let supabase: ReturnType<typeof createClient>;
  let userService: UserService;

  beforeAll(async () => {
    supabase = createClient(process.env.DATABASE_URL!);
    userService = new UserService(supabase);
  });

  it("creates and retrieves user", async () => {
    const user = await userService.create({
      email: "test@example.com",
      name: "Test User",
    });

    expect(user).toBeDefined();
    expect(user.email).toBe("test@example.com");
  });
});
```

### Test Organization

#### File Structure

```
src/
├── components/
│   └── Button.test.ts          # Unit test
├── services/
│   └── UserService.test.ts     # Unit test
├── integration/
│   ├── auth-flow.test.ts       # Integration test
│   └── database-operations.test.ts # Integration test
└── api/
    └── endpoints.integration.test.ts # Integration test
```

### Best Practices

#### Unit Tests

- Keep tests fast and focused
- Mock external dependencies
- Test one thing at a time
- Use descriptive test names
- Follow Arrange-Act-Assert pattern

#### Integration Tests

- Test realistic scenarios
- Use actual services when possible
- Clean up test data after tests
- Handle async operations properly
- Use appropriate timeouts

#### Performance Guidelines

- Unit tests: <5 seconds total
- Integration tests: <30 seconds per test
- Use test isolation to prevent cross-contamination
- Limit database operations in tests

## Accessibility Standards

### Linting Guardrails

- `eslint-plugin-jsx-a11y` enabled for ARIA labels and focus requirements
- CI runs `npm run lint` to catch accessibility violations
- Flags positive tabindex values and unmanaged autofocus

### Component Checklist

- Every interactive element has accessible labels (`aria-label`, `aria-labelledby`, or native `<label>`)
- Focus outlines are visible and logical keyboard navigation order maintained
- Semantic elements (`<button>`, `<nav>`, `<header>`) used instead of generic `<div>`
- Descriptive error messaging and link text provided beyond color changes
- WCAG AA minimum color contrast ratios maintained

### Testing Steps

- **axe-core/Browser extension**: Automated accessibility checks on new views
- **Keyboard navigation**: Tab through forms and dialogs to verify focus traps and visible focus states
- **Screen reader testing**: Verify form labels and ARIA attributes with VoiceOver/NVDA

### Reporting Requirements

- Document known exceptions in PR descriptions
- Track remediation tasks for accessibility issues
- Include accessibility testing notes in QA plans for new UI components

## Observability Setup

### Quick Start Commands

#### Start Full Observability Stack

```bash
cd /workspaces/ValueOS/infra
docker-compose -f infra/docker/docker-compose.observability.yml up -d
```

**Access URLs:**

- **Grafana**: http://localhost:3000
- **Tempo**: http://localhost:3200
- **Prometheus**: http://localhost:9090

#### Start Only Tempo (Minimal)

```bash
cd /workspaces/ValueOS/infra
docker-compose -f infra/docker/docker-compose.observability.yml up -d tempo
```

### Service Overview

#### Tempo (Port 3200)

- **Purpose**: Distributed tracing backend
- **Shows**: Request flows, latency, errors
- **Use for**: Debugging performance issues, understanding service dependencies

#### Grafana (Port 3000)

- **Purpose**: Visualization dashboards
- **Shows**: Metrics, logs, traces in one place
- **Use for**: Monitoring, alerting, analysis

#### Prometheus (Port 9090)

- **Purpose**: Metrics collection and storage
- **Shows**: Time-series metrics and queries
- **Use for**: Performance monitoring and alerting

### Troubleshooting

#### Network Issues

```bash
# Create missing network
docker network create valuecanvas-network

# Start observability stack
docker-compose -f infra/docker/docker-compose.observability.yml up -d
```

#### Port Conflicts

```bash
# Check port usage
lsof -i :3000   # Grafana
lsof -i :3200   # Tempo
lsof -i :9090   # Prometheus

# Modify ports in infra/docker/docker-compose.observability.yml if needed
```

#### Missing Traces

```bash
# Verify Tempo is running
docker ps | grep tempo

# Check application configuration
curl http://localhost:4318/v1/traces

# Generate test traffic
curl http://localhost:5173/api/health

# Check Tempo logs
docker logs valueos-tempo
```

### Quick Commands Reference

```bash
# Start all services
docker-compose -f infra/docker/docker-compose.observability.yml up -d

# Stop all services
docker-compose -f infra/docker/docker-compose.observability.yml down

# View logs
docker-compose -f infra/docker/docker-compose.observability.yml logs -f

# Restart specific service
docker-compose -f infra/docker/docker-compose.observability.yml restart tempo

# Check status
docker-compose -f infra/docker/docker-compose.observability.yml ps
```

## Frequently Asked Questions

### Getting Started

**What is ValueCanvas?**
ValueCanvas is an AI-powered value realization platform combining LLM-based multi-agent systems with generative UI to help organizations discover, target, realize, and expand business value through systematic outcome frameworks.

**Who is ValueCanvas for?**

- Business Analysts (value discovery and mapping)
- Product Managers (outcome engineering)
- Consultants (client value realization)
- Executives (strategic planning)
- Teams (collaborative value creation)

**How do I get started?**

1. Read QUICKSTART.md for 5-minute setup
2. Follow LOCAL_SETUP_GUIDE.md for detailed instructions
3. Review CONTRIBUTING.md for contribution guidelines

### Technical Questions

**What tech stack does it use?**

- Frontend: React 18, TypeScript, Vite, Tailwind CSS
- Backend: Supabase (PostgreSQL), Edge Functions
- AI/ML: LLM Gateway (Together.ai/OpenAI), Multi-agent coordination

**How does the agent system work?**

```
User Intent → CoordinatorAgent → Task Decomposition
           → Agent Routing → Specialized Agents
           → MessageBus → Coordination
           → Results Aggregation → User
```

**What is LLM-MARL?**
LLM-MARL (Large Language Model - Multi-Agent Reinforcement Learning) coordinates multiple AI agents to solve complex tasks through orchestrated workflows.

**What is Generative UI (SDUI)?**
Server-Driven UI dynamically generates interfaces based on user intent and context, following a 3-iteration refinement process.

**What database tables exist?**
20+ tables across agent infrastructure, episodic memory, workflow orchestration, SOF framework, UI generation, and artifact scoring.

**Is it scalable?**
Yes, designed for horizontal scaling with load balancing, connection pooling, and performance indexes.

### Development Questions

**How do I contribute?**

1. Read CONTRIBUTING.md
2. Fork the repository
3. Create a feature branch (`feature/feature-name`)
4. Make changes with tests
5. Submit a pull request

**What's the code style?**

- TypeScript with strict mode
- Named exports over default exports
- Functional React components
- ESLint and Prettier for formatting

**How do I run tests?**

```bash
npm test              # Unit tests with coverage
npm run test:unit     # Unit tests only
npm run test:integration # Integration tests (requires Docker)
```

**How do I add a new agent?**

1. Create agent file in `src/agents/`
2. Extend `BaseAgent` class
3. Implement required methods
4. Register in `AgentRegistry`
5. Add tests and documentation

**How do I add a new component?**

1. Create component in `src/components/`
2. Add to component registry
3. Define props interface
4. Add Storybook story
5. Write tests
6. Update SDUI registry

### Deployment & Operations

**How do I deploy to production?**
Recommended: Frontend (Vercel), Database (Supabase Cloud), Monitoring (Sentry)

**What environment variables are needed?**

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_LLM_API_KEY`

**How do I monitor production?**

- Sentry for error tracking
- Structured logging
- Database query metrics
- API response times
- UI render performance

### Security & Compliance

**Is it secure?**
Multiple security layers: network (HTTPS/TLS), application (CSP, CSRF, input sanitization), auth (JWT, RLS, RBAC, MFA), data (encryption at rest/in transit).

**How is data encrypted?**

- At rest: AES-256 encryption
- In transit: TLS 1.3
- Passwords: bcrypt hashing

**What authentication methods are supported?**

- Email/password, OAuth (Google, GitHub), magic links, MFA

**Is it GDPR compliant?**
Yes: data export, right to deletion, consent management, audit logging, data minimization.

### Performance & Optimization

**How fast is it?**

- Page load: <2 seconds
- API response: <500ms
- UI generation: 2-5 seconds
- Agent processing: 3-10 seconds

**How do I improve performance?**

- Apply performance indexes
- Enable caching (Redis)
- Optimize components (memoization)
- Profile queries (EXPLAIN ANALYZE)

**Can I use Redis?**

```bash
VITE_REDIS_ENABLED=true
VITE_REDIS_URL=redis://localhost:6379
CACHE_TTL=3600
```

### Troubleshooting

**Installation fails with "npm not found"**
Install Node.js from nodejs.org

**"Supabase connection failed"**

1. Check Docker is running
2. Run `supabase start`
3. Verify `.env` configuration
4. Check firewall settings

**"Port 5173 already in use"**

```bash
npm run dev -- --port 3000
```

**Database migrations fail**

1. Check Supabase is running
2. Verify connection string
3. Run `supabase db reset`
4. Check migration files for errors

**LLM API errors**

1. Verify API key is set
2. Check API key is valid
3. Verify provider is correct
4. Check rate limits

### General Questions

**Do I need coding experience?**
For users: No, UI designed for business users
For developers: Yes, TypeScript/React knowledge helpful for customization

**Do I need Docker?**
For local development: Yes (Supabase)
For production: No (Supabase Cloud)

**Can I use my own database?**
Yes, but Supabase recommended. Requires schema adaptation and RLS policy implementation.

**What LLM providers are supported?**

- Together.ai (recommended, cheaper)
- OpenAI (alternative)
- Custom (implement LLMGateway interface)

**Is it free?**
Open source for self-hosting; cloud pricing TBD

**How often is it updated?**

- Bug fixes: As needed
- Features: Monthly releases
- Security: Immediate patches
- Documentation: Continuous

---

**Last Updated**: January 14, 2026
**Version**: 1.0
**Maintained By**: Development Team
**Review Frequency**: Quarterly

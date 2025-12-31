# Production Wiring Guide

## Overview

This document describes the production-ready wiring and configuration system for the ValueCanvas application. The system includes environment configuration, agent initialization, health checking, and application bootstrap.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Entry                        │
│                      (src/main.tsx)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Bootstrap System                           │
│                   (src/bootstrap.ts)                         │
│                                                              │
│  1. Load Environment Configuration                           │
│  2. Validate Configuration                                   │
│  3. Check Feature Flags                                      │
│  4. Initialize Monitoring                                    │
│  5. Initialize Agent Fabric                                  │
│  6. Check Database Connection                                │
│  7. Initialize Cache                                         │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌────────────────┐ ┌──────────────┐ ┌──────────────┐
│  Environment   │ │    Agent     │ │   Services   │
│ Configuration  │ │ Initializer  │ │   (Various)  │
│                │ │              │ │              │
│ • Config Load  │ │ • Health     │ │ • Database   │
│ • Validation   │ │   Checks     │ │ • Cache      │
│ • Type Safety  │ │ • Retry      │ │ • Monitoring │
└────────────────┘ │   Logic      │ └──────────────┘
                   │ • Circuit    │
                   │   Breakers   │
                   └──────────────┘
```

## Components

### 1. Environment Configuration

**File**: `src/config/environment.ts`

**Purpose**: Centralized, type-safe environment configuration management.

**Features**:
- Type-safe configuration interface
- Environment variable loading with fallbacks
- Validation for production environments
- Feature flag management
- Singleton pattern for global access

**Usage**:
```typescript
import { getConfig, isProduction, isFeatureEnabled } from './config/environment';

const config = getConfig();
console.log(config.agents.apiUrl);

if (isProduction()) {
  // Production-specific logic
}

if (isFeatureEnabled('agentFabric')) {
  // Feature-specific logic
}
```

### 2. Agent Initializer

**File**: `src/services/AgentInitializer.ts`

**Purpose**: Production-ready agent health checking and initialization.

**Features**:
- Health checks for all 8 agents
- Retry logic with exponential backoff
- Circuit breaker integration
- Progress reporting
- Caching of health status

**Usage**:
```typescript
import { initializeAgents, getAgentHealth } from './services/AgentInitializer';

// Initialize with full health checks
const health = await initializeAgents({
  healthCheckTimeout: 5000,
  failFast: true,
  retryAttempts: 3,
  onProgress: (status) => console.log(status),
});

// Quick health check
const currentHealth = await getAgentHealth();
console.log(`${currentHealth.availableAgents}/${currentHealth.totalAgents} agents available`);
```

### 3. Bootstrap System

**File**: `src/bootstrap.ts`

**Purpose**: Orchestrates application initialization sequence.

**Features**:
- Multi-step initialization
- Error handling and recovery
- Progress reporting
- Environment-specific behavior
- Graceful degradation

**Usage**:
```typescript
import { bootstrap, bootstrapProduction } from './bootstrap';

// Standard bootstrap
const result = await bootstrap({
  skipAgentCheck: false,
  failFast: true,
  onProgress: (msg) => console.log(msg),
});

// Production bootstrap
const prodResult = await bootstrapProduction();
```

### 4. Agent API Service

**File**: `src/services/AgentAPI.ts`

**Purpose**: HTTP client for agent endpoints with circuit breaker protection.

**Features**:
- Circuit breaker per agent
- Request timeout handling
- Audit logging
- SDUI response validation
- WebSocket status streaming

**Updates**:
- Now reads configuration from environment
- Automatic circuit breaker setup
- Production-ready defaults

## Environment Variables

### Required for Production

```bash
# Application
VITE_APP_ENV=production
VITE_APP_URL=https://app.valuecanvas.com
VITE_API_BASE_URL=https://api.valuecanvas.com

# Agent Fabric
VITE_AGENT_API_URL=https://agents.valuecanvas.com/api/agents

# Database
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Security
VITE_HTTPS_ONLY=true
JWT_SECRET=your-jwt-secret-min-32-chars
```

### Optional but Recommended

```bash
# Monitoring
VITE_SENTRY_ENABLED=true
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project

# Vault
VAULT_ENABLED=true
VAULT_ADDR=https://vault.example.com:8200

# Caching
REDIS_ENABLED=true
REDIS_URL=redis://redis.internal:6379
```

## Configuration Files

### Development

**File**: `.env.local`

```bash
VITE_APP_ENV=development
VITE_MOCK_AGENTS=true
VITE_SDUI_DEBUG=true
LOG_LEVEL=debug
```

### Production

**File**: `.env.production`

```bash
VITE_APP_ENV=production
VITE_MOCK_AGENTS=false
VITE_SDUI_DEBUG=false
LOG_LEVEL=warn
VITE_HTTPS_ONLY=true
```

## Bootstrap Sequence

### 1. Load Configuration

```typescript
const config = getConfig();
```

- Reads environment variables
- Applies defaults
- Creates typed configuration object

### 2. Validate Configuration

```typescript
const errors = validateEnvironmentConfig(config);
```

- Checks required variables
- Validates URLs and formats
- Ensures production requirements

### 3. Check Feature Flags

```typescript
console.log('Features:', config.features);
```

- Logs enabled features
- Determines initialization path

### 4. Initialize Monitoring

```typescript
if (config.monitoring.sentry.enabled) {
  await initializeSentry(config.monitoring.sentry);
}
```

- Sets up error tracking
- Configures performance monitoring

### 5. Initialize Agent Fabric

```typescript
const agentHealth = await initializeAgents({
  healthCheckTimeout: 5000,
  failFast: isProduction(),
  retryAttempts: 3,
});
```

- Checks all 8 agents
- Retries failed checks
- Reports health status

### 6. Check Database

```typescript
await checkDatabaseConnection();
```

- Verifies Supabase connection
- Tests authentication

### 7. Initialize Cache

```typescript
if (config.cache.enabled) {
  await initializeCache(config.cache);
}
```

- Connects to Redis
- Verifies cache availability

## Health Checks

### Agent Health Check

Each agent is checked with a simple health query:

```typescript
const response = await agentAPI.query({
  agent: 'opportunity',
  query: 'health check',
  context: { metadata: { healthCheck: true } },
});
```

**Success Criteria**:
- Response received within timeout
- `response.success === true`
- No circuit breaker trips

**Retry Logic**:
- Max retries: 3
- Backoff: Exponential (1s, 2s, 4s)
- Retry on: Transient failures
- Skip on: Permanent failures

### Health Status

```typescript
interface AgentHealthStatus {
  agent: AgentType;
  available: boolean;
  responseTime?: number;
  error?: string;
  lastChecked: Date;
}
```

### System Health

```typescript
interface SystemHealth {
  healthy: boolean;
  agents: AgentHealthStatus[];
  totalAgents: number;
  availableAgents: number;
  unavailableAgents: number;
  averageResponseTime: number;
}
```

## Error Handling

### Configuration Errors

**Production**: Application fails to start
**Development**: Warnings logged, continues

```typescript
if (configErrors.length > 0 && isProduction()) {
  throw new Error('Invalid configuration');
}
```

### Agent Initialization Errors

**Production**: Application fails to start if `failFast: true`
**Development**: Warnings logged, continues with degraded functionality

```typescript
if (!agentHealth.healthy && failFast) {
  throw new Error('Agent Fabric not operational');
}
```

### Runtime Errors

All runtime errors are caught by error boundaries and reported to monitoring.

## Circuit Breakers

### Configuration

```typescript
{
  enabled: true,
  threshold: 5,      // Failures before opening
  cooldown: 60000,   // 60 seconds
}
```

### States

1. **CLOSED**: Normal operation
2. **OPEN**: Failures exceeded threshold, requests blocked
3. **HALF_OPEN**: Testing if service recovered

### Per-Agent Breakers

Each agent has its own circuit breaker:

```typescript
const breakers = {
  'opportunity': CircuitBreaker,
  'target': CircuitBreaker,
  'realization': CircuitBreaker,
  // ... etc
};
```

## Monitoring Integration

### Sentry

```typescript
if (config.monitoring.sentry.enabled) {
  Sentry.init({
    dsn: config.monitoring.sentry.dsn,
    environment: config.monitoring.sentry.environment,
    sampleRate: config.monitoring.sentry.sampleRate,
  });
}
```

### DataDog

```typescript
if (config.monitoring.datadog.enabled) {
  // Initialize DataDog APM
}
```

### Prometheus

```typescript
if (config.monitoring.prometheus.enabled) {
  // Expose metrics endpoint
}
```

## Feature Flags

### Available Flags

```typescript
features: {
  sduiDebug: boolean;        // SDUI debug mode
  agentFabric: boolean;      // Enable Agent Fabric
  workflow: boolean;         // Enable workflows
  compliance: boolean;       // Enable compliance
  multiTenant: boolean;      // Enable multi-tenancy
  usageTracking: boolean;    // Enable usage tracking
  billing: boolean;          // Enable billing
}
```

### Usage

```typescript
import { isFeatureEnabled } from './config/environment';

if (isFeatureEnabled('agentFabric')) {
  // Initialize agents
}

if (isFeatureEnabled('billing')) {
  // Initialize billing
}
```

## Deployment

### Local Development

```bash
# Copy environment file
cp .env.example .env.local

# Edit configuration
nano .env.local

# Start development server
npm run dev
```

### Production Build

```bash
# Copy production environment
cp .env.production.example .env.production

# Edit with production values
nano .env.production

# Build for production
npm run build

# Preview production build
npm run preview
```

### Docker Deployment

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_APP_ENV=production
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: valuecanvas-web
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: web
        image: valuecanvas/web:latest
        env:
        - name: VITE_APP_ENV
          value: "production"
        - name: VITE_AGENT_API_URL
          valueFrom:
            configMapKeyRef:
              name: valuecanvas-config
              key: agent-api-url
        - name: VITE_SUPABASE_URL
          valueFrom:
            secretKeyRef:
              name: valuecanvas-secrets
              key: supabase-url
```

## Testing

### Unit Tests

```typescript
import { loadEnvironmentConfig, validateEnvironmentConfig } from './config/environment';

describe('Environment Configuration', () => {
  it('should load configuration', () => {
    const config = loadEnvironmentConfig();
    expect(config).toBeDefined();
    expect(config.app.env).toBeDefined();
  });

  it('should validate production config', () => {
    const config = { /* ... */ };
    const errors = validateEnvironmentConfig(config);
    expect(errors).toHaveLength(0);
  });
});
```

### Integration Tests

```typescript
import { initializeAgents } from './services/AgentInitializer';

describe('Agent Initialization', () => {
  it('should check agent health', async () => {
    const health = await initializeAgents({
      healthCheckTimeout: 5000,
      failFast: false,
    });
    
    expect(health.totalAgents).toBe(8);
    expect(health.availableAgents).toBeGreaterThan(0);
  });
});
```

### E2E Tests

```typescript
import { bootstrap } from './bootstrap';

describe('Application Bootstrap', () => {
  it('should bootstrap successfully', async () => {
    const result = await bootstrap({
      skipAgentCheck: true,
      failFast: false,
    });
    
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
```

## Troubleshooting

### Configuration Not Loading

**Problem**: Environment variables not being read

**Solution**:
1. Check file name (`.env.local` for development)
2. Restart development server
3. Verify Vite prefix (`VITE_` for client-side variables)

### Agent Health Checks Failing

**Problem**: All agents showing as unavailable

**Solution**:
1. Check `VITE_AGENT_API_URL` is correct
2. Verify agent service is running
3. Check network connectivity
4. Review circuit breaker status

### Bootstrap Timeout

**Problem**: Application hangs during bootstrap

**Solution**:
1. Increase `healthCheckTimeout`
2. Check agent service logs
3. Verify database connectivity
4. Review network latency

### Production Build Errors

**Problem**: Build fails with configuration errors

**Solution**:
1. Ensure all required variables are set
2. Check `.env.production` file exists
3. Verify variable names and values
4. Review build logs for specific errors

## Best Practices

### 1. Environment Variables

- ✅ Use `VITE_` prefix for client-side variables
- ✅ Never commit `.env.production` to version control
- ✅ Use secrets management (Vault, AWS Secrets Manager)
- ✅ Validate all required variables on startup

### 2. Health Checks

- ✅ Implement health check endpoints on all services
- ✅ Use appropriate timeouts (5-10 seconds)
- ✅ Retry transient failures
- ✅ Cache health status to reduce load

### 3. Error Handling

- ✅ Fail fast in production for critical errors
- ✅ Log all errors to monitoring service
- ✅ Provide user-friendly error messages
- ✅ Include error details in development

### 4. Monitoring

- ✅ Enable Sentry in production
- ✅ Set appropriate sample rates
- ✅ Tag errors with environment and version
- ✅ Set up alerts for critical errors

### 5. Feature Flags

- ✅ Use feature flags for gradual rollouts
- ✅ Test features in staging first
- ✅ Document flag dependencies
- ✅ Clean up unused flags

## Security Considerations

### 1. Secrets Management

- Never expose service role keys to client
- Use HashiCorp Vault in production
- Rotate secrets regularly
- Audit secret access

### 2. HTTPS

- Enforce HTTPS in production
- Use HSTS headers
- Validate SSL certificates
- Monitor certificate expiration

### 3. CORS

- Whitelist specific origins
- Don't use wildcards in production
- Validate origin headers
- Log CORS violations

### 4. Rate Limiting

- Implement per-user rate limits
- Use sliding window algorithm
- Return 429 status codes
- Log rate limit violations

## Performance Optimization

### 1. Bootstrap Time

- Parallelize health checks
- Cache configuration
- Lazy load non-critical services
- Use connection pooling

### 2. Agent Calls

- Enable circuit breakers
- Use request timeouts
- Implement caching
- Batch requests when possible

### 3. Bundle Size

- Code split by route
- Lazy load components
- Tree shake unused code
- Compress assets

## Maintenance

### Regular Tasks

- Review and update environment variables
- Check agent health metrics
- Monitor error rates
- Update dependencies
- Rotate secrets

### Quarterly Tasks

- Security audit
- Performance review
- Configuration cleanup
- Documentation updates

## Support

For issues or questions:

1. Check this documentation
2. Review application logs
3. Check monitoring dashboards
4. Contact DevOps team

## Changelog

### v1.0.0 (2025-11-18)

- Initial production wiring implementation
- Environment configuration system
- Agent initialization and health checking
- Bootstrap system with error handling
- Comprehensive documentation

# Developer Guide

Technical documentation for integrating and extending ValueOS.

## 🎯 Overview

This guide covers everything developers need to integrate ValueOS into their applications, from quick start to advanced API usage.

## 🚀 Quick Links

### Getting Started
- [Quick Start](./quick-start.md) - Hello World in 5 minutes
- [Installation](./installation.md) - Setup for your environment
- [Configuration](./configuration.md) - Environment and config files
- [Authentication](./authentication.md) - API keys and OAuth

### API Documentation
- [API Reference](./api-reference.md) - Complete REST API docs
- [SDK Reference](./sdk-reference.md) - TypeScript/JavaScript SDK
- [Webhooks](./webhooks.md) - Real-time event notifications
- [Rate Limits](./rate-limits.md) - Usage limits and best practices

### Advanced Topics
- [Custom Integrations](./custom-integrations.md) - Build your own integrations
- [Data Models](./data-models.md) - Understanding ValueOS data structures
- [Error Handling](./error-handling.md) - Handling API errors gracefully
- [Testing](./testing.md) - Testing your integration

---

## 📚 Documentation Structure

### For New Developers
1. **[Quick Start](./quick-start.md)** - Get up and running in 5 minutes
2. **[Installation](./installation.md)** - Install SDK and dependencies
3. **[Authentication](./authentication.md)** - Set up API access
4. **[First Integration](./tutorials/first-integration.md)** - Build your first integration

### For Experienced Developers
1. **[API Reference](./api-reference.md)** - Complete API documentation
2. **[SDK Reference](./sdk-reference.md)** - SDK methods and types
3. **[Advanced Patterns](./advanced-patterns.md)** - Best practices and patterns
4. **[Performance](./performance.md)** - Optimization techniques

---

## 🛠️ Technology Stack

ValueOS is built with modern web technologies:

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Zustand** - State management

### Backend
- **Node.js** - Runtime
- **Express** - API framework
- **Supabase** - Database and auth
- **PostgreSQL** - Database
- **Redis** - Caching

### Infrastructure
- **Docker** - Containerization
- **GitHub Actions** - CI/CD
- **Terraform** - Infrastructure as Code
- **OpenTelemetry** - Observability

---

## 🔑 API Overview

### Base URL

```
Production: https://api.valueos.com/v1
Staging: https://api-staging.valueos.com/v1
```

### Authentication

All API requests require authentication:

```typescript
const headers = {
  'Authorization': 'Bearer YOUR_API_KEY',
  'Content-Type': 'application/json'
};
```

### Response Format

All responses follow a consistent structure:

```typescript
{
  "success": true,
  "data": { /* response data */ },
  "meta": {
    "timestamp": "2024-03-01T12:00:00Z",
    "requestId": "req_abc123"
  }
}
```

### Error Format

Errors include detailed information:

```typescript
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required field: name",
    "details": {
      "field": "name",
      "reason": "required"
    }
  },
  "meta": {
    "timestamp": "2024-03-01T12:00:00Z",
    "requestId": "req_abc123"
  }
}
```

---

## 📦 SDK Installation

### npm

```bash
npm install @valueos/sdk
```

### yarn

```bash
yarn add @valueos/sdk
```

### pnpm

```bash
pnpm add @valueos/sdk
```

### CDN (Browser)

```html
<script src="https://cdn.valueos.com/sdk/v1/valueos.min.js"></script>
```

---

## 🎯 Quick Example

### TypeScript

```typescript
import { ValueOS } from '@valueos/sdk';

// Initialize client
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY,
  environment: 'production'
});

// Create a metric
const metric = await client.metrics.create({
  name: 'Feature Revenue Impact',
  type: 'revenue',
  unit: 'USD',
  value: 50000
});

console.log(`Created metric: ${metric.id}`);
```

### JavaScript

```javascript
const { ValueOS } = require('@valueos/sdk');

// Initialize client
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY,
  environment: 'production'
});

// Create a metric
client.metrics.create({
  name: 'Feature Revenue Impact',
  type: 'revenue',
  unit: 'USD',
  value: 50000
}).then(metric => {
  console.log(`Created metric: ${metric.id}`);
});
```

### cURL

```bash
curl -X POST https://api.valueos.com/v1/metrics \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Feature Revenue Impact",
    "type": "revenue",
    "unit": "USD",
    "value": 50000
  }'
```

---

## 🔌 Common Integrations

### GitHub

Track value by pull request:

```typescript
import { ValueOS } from '@valueos/sdk';

const client = new ValueOS({ apiKey: process.env.VALUEOS_API_KEY });

// Link PR to metric
await client.integrations.github.linkPullRequest({
  metricId: 'metric_abc123',
  repository: 'acme-corp/api',
  pullRequestNumber: 42
});
```

### Jira

Track value by issue:

```typescript
await client.integrations.jira.linkIssue({
  metricId: 'metric_abc123',
  issueKey: 'PROJ-123'
});
```

### Slack

Send notifications:

```typescript
await client.integrations.slack.notify({
  channel: '#engineering',
  message: 'New metric created: Feature Revenue Impact',
  metricId: 'metric_abc123'
});
```

---

## 📊 Data Models

### Metric

```typescript
interface Metric {
  id: string;
  name: string;
  description?: string;
  type: 'revenue' | 'cost' | 'satisfaction' | 'time' | 'custom';
  unit: string;
  value: number;
  currency?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
```

### Dashboard

```typescript
interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: Widget[];
  layout: Layout;
  visibility: 'private' | 'team' | 'organization';
  createdAt: string;
  updatedAt: string;
}
```

### Integration

```typescript
interface Integration {
  id: string;
  type: 'github' | 'jira' | 'slack' | 'custom';
  status: 'active' | 'inactive' | 'error';
  config: Record<string, any>;
  lastSyncAt?: string;
  createdAt: string;
}
```

---

## 🔒 Security Best Practices

### API Key Management

- ✅ Store API keys in environment variables
- ✅ Never commit keys to version control
- ✅ Rotate keys quarterly
- ✅ Use different keys for different environments
- ✅ Revoke unused keys immediately

### Request Security

- ✅ Always use HTTPS
- ✅ Validate SSL certificates
- ✅ Implement request signing for webhooks
- ✅ Use short-lived tokens when possible
- ✅ Implement rate limiting on your side

### Data Security

- ✅ Sanitize user input
- ✅ Validate all data before sending
- ✅ Encrypt sensitive data at rest
- ✅ Use secure connections for webhooks
- ✅ Implement proper error handling

---

## 📈 Rate Limits

| Plan | Requests/Day | Burst | Webhook Events |
|------|--------------|-------|----------------|
| **Starter** | 1,000 | 10/second | 100/day |
| **Professional** | 10,000 | 50/second | 1,000/day |
| **Enterprise** | Unlimited | Custom | Unlimited |

**Best practices:**
- Implement exponential backoff
- Cache responses when appropriate
- Use webhooks instead of polling
- Batch requests when possible

See [Rate Limits](./rate-limits.md) for details.

---

## 🧪 Testing

### Test Environment

Use staging environment for testing:

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_TEST_API_KEY,
  environment: 'staging'
});
```

### Mock Data

SDK includes mock client for testing:

```typescript
import { MockValueOS } from '@valueos/sdk/testing';

const mockClient = new MockValueOS();
mockClient.metrics.create.mockResolvedValue({
  id: 'metric_test123',
  name: 'Test Metric',
  // ...
});
```

### Integration Tests

```typescript
import { ValueOS } from '@valueos/sdk';

describe('ValueOS Integration', () => {
  let client: ValueOS;

  beforeAll(() => {
    client = new ValueOS({
      apiKey: process.env.VALUEOS_TEST_API_KEY,
      environment: 'staging'
    });
  });

  it('should create a metric', async () => {
    const metric = await client.metrics.create({
      name: 'Test Metric',
      type: 'revenue',
      unit: 'USD',
      value: 1000
    });

    expect(metric.id).toBeDefined();
    expect(metric.name).toBe('Test Metric');
  });
});
```

---

## 🆘 Support

### Documentation
- [API Reference](./api-reference.md) - Complete API docs
- [SDK Reference](./sdk-reference.md) - SDK documentation
- [Examples](./examples/) - Code examples
- [Tutorials](./tutorials/) - Step-by-step guides

### Community
- **GitHub**: [github.com/valueos/sdk](https://github.com/valueos/sdk)
- **Slack**: [valueos.slack.com](https://valueos.slack.com)
- **Stack Overflow**: Tag `valueos`

### Direct Support
- **Email**: developers@valueos.com
- **Chat**: Available in dashboard
- **Status**: [status.valueos.com](https://status.valueos.com)

---

## 🗺️ What's Next?

### New to ValueOS?
1. [Quick Start](./quick-start.md) - Build your first integration
2. [Authentication](./authentication.md) - Set up API access
3. [Tutorials](./tutorials/) - Follow step-by-step guides

### Ready to Build?
1. [API Reference](./api-reference.md) - Explore the API
2. [SDK Reference](./sdk-reference.md) - Use the SDK
3. [Examples](./examples/) - See real-world examples

### Going to Production?
1. [Best Practices](./best-practices.md) - Production guidelines
2. [Performance](./performance.md) - Optimization tips
3. [Monitoring](./monitoring.md) - Track your integration

---

## 📝 Changelog

Track SDK and API changes:

- [SDK Changelog](./changelog/sdk.md)
- [API Changelog](./changelog/api.md)
- [Breaking Changes](./changelog/breaking-changes.md)

---

## 🤝 Contributing

We welcome contributions to the SDK and documentation:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

See [Contributing Guide](./contributing.md) for details.

---

> **Note**: This documentation is for API v1. See [migration guide](./migration/v2.md) for information about upcoming v2.

> **Tip**: Join our Slack community to get help from other developers and the ValueOS team.

# Configuration

Complete guide to configuring the ValueOS SDK and integration settings.

## 🎯 Overview

ValueOS can be configured through:
- Environment variables
- Configuration files
- SDK initialization options
- Runtime configuration

---

## 🔧 SDK Configuration

### Basic Configuration

```typescript
import { ValueOS } from '@valueos/sdk';

const client = new ValueOS({
  apiKey: 'vos_your_api_key_here',
  environment: 'production'
});
```

### Complete Configuration

```typescript
const client = new ValueOS({
  // Required
  apiKey: process.env.VALUEOS_API_KEY!,
  
  // Environment
  environment: 'production', // 'production' | 'staging' | 'development'
  
  // API Configuration
  baseURL: 'https://api.valueos.com/v1',
  timeout: 30000, // Request timeout in ms
  
  // Retry Configuration
  retry: {
    attempts: 3,
    delay: 1000, // Initial delay in ms
    maxDelay: 10000, // Maximum delay in ms
    factor: 2, // Exponential backoff factor
    retryableStatusCodes: [408, 429, 500, 502, 503, 504]
  },
  
  // Logging
  logging: {
    level: 'info', // 'debug' | 'info' | 'warn' | 'error'
    pretty: true, // Pretty print logs
    destination: process.stdout
  },
  
  // Telemetry
  telemetry: {
    enabled: true,
    serviceName: 'my-app',
    tracer: null // OpenTelemetry tracer instance
  },
  
  // HTTP Client
  httpClient: {
    headers: {
      'User-Agent': 'my-app/1.0.0'
    },
    proxy: process.env.HTTP_PROXY,
    keepAlive: true
  }
});
```

---

## 📁 Configuration File

### valueos.config.js

Create `valueos.config.js` in your project root:

```javascript
module.exports = {
  // API Configuration
  api: {
    key: process.env.VALUEOS_API_KEY,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'staging',
    baseURL: process.env.VALUEOS_API_URL || 'https://api.valueos.com/v1',
    timeout: 30000
  },
  
  // Retry Configuration
  retry: {
    attempts: 3,
    delay: 1000,
    maxDelay: 10000,
    factor: 2
  },
  
  // Logging
  logging: {
    level: process.env.VALUEOS_LOG_LEVEL || 'info',
    pretty: process.env.NODE_ENV !== 'production'
  },
  
  // Integrations
  integrations: {
    github: {
      enabled: true,
      token: process.env.GITHUB_TOKEN,
      repositories: ['org/repo1', 'org/repo2']
    },
    jira: {
      enabled: true,
      host: process.env.JIRA_HOST,
      email: process.env.JIRA_EMAIL,
      token: process.env.JIRA_TOKEN
    },
    slack: {
      enabled: true,
      token: process.env.SLACK_TOKEN,
      channel: '#engineering'
    }
  },
  
  // Metrics
  metrics: {
    defaultTags: ['app:my-app', 'env:production'],
    autoTrack: true,
    batchSize: 100,
    flushInterval: 5000 // ms
  },
  
  // Webhooks
  webhooks: {
    enabled: true,
    endpoint: process.env.WEBHOOK_ENDPOINT,
    secret: process.env.WEBHOOK_SECRET,
    events: ['metric.created', 'metric.updated']
  }
};
```

### valueos.config.ts (TypeScript)

```typescript
import { ValueOSConfig } from '@valueos/sdk';

const config: ValueOSConfig = {
  api: {
    key: process.env.VALUEOS_API_KEY!,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'staging',
    baseURL: process.env.VALUEOS_API_URL || 'https://api.valueos.com/v1',
    timeout: 30000
  },
  
  retry: {
    attempts: 3,
    delay: 1000,
    maxDelay: 10000,
    factor: 2
  },
  
  logging: {
    level: (process.env.VALUEOS_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    pretty: process.env.NODE_ENV !== 'production'
  },
  
  integrations: {
    github: {
      enabled: true,
      token: process.env.GITHUB_TOKEN!,
      repositories: ['org/repo1', 'org/repo2']
    }
  }
};

export default config;
```

### Load Configuration

```typescript
import { ValueOS } from '@valueos/sdk';
import config from './valueos.config';

const client = new ValueOS(config.api);
```

---

## 🌍 Environment Variables

### Required Variables

```bash
# API Authentication
VALUEOS_API_KEY=vos_your_api_key_here
```

### Optional Variables

```bash
# Environment
VALUEOS_ENVIRONMENT=production  # production | staging | development
NODE_ENV=production

# API Configuration
VALUEOS_API_URL=https://api.valueos.com/v1
VALUEOS_TIMEOUT=30000

# Retry Configuration
VALUEOS_RETRY_ATTEMPTS=3
VALUEOS_RETRY_DELAY=1000
VALUEOS_RETRY_MAX_DELAY=10000

# Logging
VALUEOS_LOG_LEVEL=info  # debug | info | warn | error
VALUEOS_LOG_PRETTY=true

# Telemetry
VALUEOS_TELEMETRY_ENABLED=true
VALUEOS_TELEMETRY_SERVICE_NAME=my-app

# HTTP Configuration
HTTP_PROXY=http://proxy.example.com:8080
HTTPS_PROXY=https://proxy.example.com:8080
NO_PROXY=localhost,127.0.0.1

# Integration Tokens
GITHUB_TOKEN=ghp_your_github_token
JIRA_HOST=your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_TOKEN=your_jira_token
SLACK_TOKEN=xoxb-your-slack-token

# Webhook Configuration
WEBHOOK_ENDPOINT=https://your-app.com/webhooks/valueos
WEBHOOK_SECRET=your_webhook_secret
```

### Environment-Specific Files

```bash
# Development
.env.development

# Staging
.env.staging

# Production
.env.production

# Local overrides (never commit)
.env.local
```

### Loading Environment Variables

```typescript
import * as dotenv from 'dotenv';

// Load environment-specific file
const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
dotenv.config({ path: envFile });

// Load local overrides
dotenv.config({ path: '.env.local' });
```

---

## 🔐 Authentication Configuration

### API Key

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!
});
```

### OAuth (Enterprise)

```typescript
const client = new ValueOS({
  auth: {
    type: 'oauth',
    clientId: process.env.VALUEOS_CLIENT_ID!,
    clientSecret: process.env.VALUEOS_CLIENT_SECRET!,
    tokenEndpoint: 'https://auth.valueos.com/oauth/token'
  }
});
```

### Service Account (Enterprise)

```typescript
const client = new ValueOS({
  auth: {
    type: 'service-account',
    credentials: {
      type: 'service_account',
      project_id: 'your-project',
      private_key: process.env.VALUEOS_PRIVATE_KEY!,
      client_email: 'service@your-project.iam.valueos.com'
    }
  }
});
```

---

## 🔄 Retry Configuration

### Default Retry Behavior

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  retry: {
    attempts: 3,
    delay: 1000,
    maxDelay: 10000,
    factor: 2,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504]
  }
});
```

### Custom Retry Logic

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  retry: {
    attempts: 5,
    shouldRetry: (error, attemptNumber) => {
      // Custom retry logic
      if (error.code === 'RATE_LIMIT_EXCEEDED') {
        return attemptNumber < 3;
      }
      return error.statusCode >= 500;
    },
    onRetry: (error, attemptNumber) => {
      console.log(`Retry attempt ${attemptNumber} after error:`, error.message);
    }
  }
});
```

### Disable Retry

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  retry: {
    attempts: 0 // Disable retry
  }
});
```

---

## 📝 Logging Configuration

### Log Levels

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  logging: {
    level: 'debug' // 'debug' | 'info' | 'warn' | 'error'
  }
});
```

### Custom Logger

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'valueos.log' })
  ]
});

const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  logging: {
    logger: logger
  }
});
```

### Structured Logging

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  logging: {
    level: 'info',
    format: 'json', // 'json' | 'pretty' | 'simple'
    fields: {
      service: 'my-app',
      environment: process.env.NODE_ENV
    }
  }
});
```

---

## 📊 Telemetry Configuration

### OpenTelemetry Integration

```typescript
import { trace } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

// Set up OpenTelemetry
const provider = new NodeTracerProvider();
provider.register();

const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  telemetry: {
    enabled: true,
    serviceName: 'my-app',
    tracer: trace.getTracer('valueos-client')
  }
});
```

### Custom Metrics

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  telemetry: {
    enabled: true,
    metrics: {
      prefix: 'valueos_',
      labels: {
        app: 'my-app',
        env: process.env.NODE_ENV
      }
    }
  }
});
```

---

## 🌐 HTTP Client Configuration

### Proxy Configuration

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  httpClient: {
    proxy: {
      host: 'proxy.example.com',
      port: 8080,
      auth: {
        username: 'user',
        password: 'pass'
      }
    }
  }
});
```

### Custom Headers

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  httpClient: {
    headers: {
      'User-Agent': 'my-app/1.0.0',
      'X-Custom-Header': 'value'
    }
  }
});
```

### Timeout Configuration

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  timeout: 30000, // Global timeout
  httpClient: {
    timeouts: {
      connect: 5000,
      request: 30000,
      response: 30000
    }
  }
});
```

---

## 🔌 Integration Configuration

### GitHub Integration

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  integrations: {
    github: {
      enabled: true,
      token: process.env.GITHUB_TOKEN!,
      repositories: ['org/repo1', 'org/repo2'],
      events: ['pull_request', 'push'],
      autoLink: true,
      labelPrefix: 'value:'
    }
  }
});
```

### Jira Integration

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  integrations: {
    jira: {
      enabled: true,
      host: process.env.JIRA_HOST!,
      email: process.env.JIRA_EMAIL!,
      token: process.env.JIRA_TOKEN!,
      projects: ['PROJ1', 'PROJ2'],
      autoLink: true,
      customFields: {
        valueImpact: 'customfield_10001'
      }
    }
  }
});
```

### Slack Integration

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  integrations: {
    slack: {
      enabled: true,
      token: process.env.SLACK_TOKEN!,
      channel: '#engineering',
      notifications: {
        metricCreated: true,
        metricUpdated: true,
        thresholdExceeded: true
      }
    }
  }
});
```

---

## 🎯 Metric Configuration

### Default Tags

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  metrics: {
    defaultTags: [
      'app:my-app',
      'env:production',
      'team:engineering'
    ]
  }
});
```

### Auto-Tracking

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  metrics: {
    autoTrack: true,
    trackingRules: [
      {
        pattern: /^feat:/,
        type: 'revenue',
        tags: ['feature']
      },
      {
        pattern: /^fix:/,
        type: 'satisfaction',
        tags: ['bugfix']
      }
    ]
  }
});
```

### Batching

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  metrics: {
    batch: {
      enabled: true,
      size: 100,
      flushInterval: 5000, // ms
      maxRetries: 3
    }
  }
});
```

---

## 🪝 Webhook Configuration

### Basic Webhook Setup

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  webhooks: {
    enabled: true,
    endpoint: 'https://your-app.com/webhooks/valueos',
    secret: process.env.WEBHOOK_SECRET!,
    events: [
      'metric.created',
      'metric.updated',
      'metric.deleted',
      'dashboard.created'
    ]
  }
});
```

### Webhook Verification

```typescript
import { verifyWebhookSignature } from '@valueos/sdk';

app.post('/webhooks/valueos', (req, res) => {
  const signature = req.headers['x-valueos-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET!)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook
  res.status(200).send('OK');
});
```

---

## 🔒 Security Configuration

### SSL/TLS Configuration

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  httpClient: {
    https: {
      rejectUnauthorized: true,
      ca: fs.readFileSync('ca-cert.pem'),
      cert: fs.readFileSync('client-cert.pem'),
      key: fs.readFileSync('client-key.pem')
    }
  }
});
```

### Request Signing

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  security: {
    signRequests: true,
    algorithm: 'sha256',
    secret: process.env.SIGNING_SECRET!
  }
});
```

---

## 🧪 Testing Configuration

### Test Environment

```typescript
// test/setup.ts
import { ValueOS } from '@valueos/sdk';

export const testClient = new ValueOS({
  apiKey: process.env.VALUEOS_TEST_API_KEY!,
  environment: 'staging',
  baseURL: 'https://api-staging.valueos.com/v1'
});
```

### Mock Configuration

```typescript
import { MockValueOS } from '@valueos/sdk/testing';

const mockClient = new MockValueOS({
  mockData: {
    metrics: [
      { id: 'metric_1', name: 'Test Metric', value: 1000 }
    ]
  }
});
```

---

## 💡 Best Practices

### Environment-Based Configuration

```typescript
const getConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  const configs = {
    development: {
      apiKey: process.env.VALUEOS_DEV_API_KEY!,
      environment: 'staging' as const,
      logging: { level: 'debug' as const }
    },
    staging: {
      apiKey: process.env.VALUEOS_STAGING_API_KEY!,
      environment: 'staging' as const,
      logging: { level: 'info' as const }
    },
    production: {
      apiKey: process.env.VALUEOS_API_KEY!,
      environment: 'production' as const,
      logging: { level: 'warn' as const }
    }
  };
  
  return configs[env];
};

const client = new ValueOS(getConfig());
```

### Configuration Validation

```typescript
import { z } from 'zod';

const configSchema = z.object({
  apiKey: z.string().startsWith('vos_'),
  environment: z.enum(['production', 'staging', 'development']),
  timeout: z.number().min(1000).max(60000)
});

const config = configSchema.parse({
  apiKey: process.env.VALUEOS_API_KEY,
  environment: process.env.VALUEOS_ENVIRONMENT,
  timeout: parseInt(process.env.VALUEOS_TIMEOUT || '30000')
});

const client = new ValueOS(config);
```

---

## 🔗 Related Documentation

- [Installation](./installation.md) - SDK installation
- [Authentication](./authentication.md) - Authentication methods
- [API Reference](./api-reference.md) - Complete API docs
- [Best Practices](./best-practices.md) - Configuration best practices

---

> **Note**: Configuration options vary by plan. Enterprise features require an Enterprise plan.

> **Tip**: Use environment-specific configuration files and never commit secrets to version control.

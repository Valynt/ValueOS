# Installation

Complete installation guide for the ValueOS SDK across different environments and package managers.

## 📦 Package Managers

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

### bun

```bash
bun add @valueos/sdk
```

---

## 🌐 Browser Installation

### CDN (unpkg)

```html
<script src="https://unpkg.com/@valueos/sdk@latest/dist/valueos.min.js"></script>
<script>
  const client = new ValueOS.Client({
    apiKey: 'YOUR_API_KEY'
  });
</script>
```

### CDN (jsDelivr)

```html
<script src="https://cdn.jsdelivr.net/npm/@valueos/sdk@latest/dist/valueos.min.js"></script>
```

### ES Modules

```html
<script type="module">
  import { ValueOS } from 'https://unpkg.com/@valueos/sdk@latest/dist/valueos.esm.js';
  
  const client = new ValueOS({
    apiKey: 'YOUR_API_KEY'
  });
</script>
```

---

## 🔧 Environment Setup

### Node.js

**Minimum version:** Node.js 18.0.0

Check your version:
```bash
node --version
```

Upgrade if needed:
```bash
# Using nvm
nvm install 18
nvm use 18

# Using n
n 18
```

---

### TypeScript

The SDK is written in TypeScript and includes type definitions.

**Install TypeScript:**
```bash
npm install -D typescript @types/node
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "esModuleInterop": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "strict": true,
    "skipLibCheck": true
  }
}
```

---

### Environment Variables

Create `.env` file:

```bash
# Required
VALUEOS_API_KEY=vos_your_api_key_here

# Optional
VALUEOS_ENVIRONMENT=production  # or 'staging'
VALUEOS_API_URL=https://api.valueos.com/v1
VALUEOS_TIMEOUT=30000  # Request timeout in ms
VALUEOS_RETRY_ATTEMPTS=3
VALUEOS_LOG_LEVEL=info  # debug, info, warn, error
```

**Load environment variables:**

```typescript
// Using dotenv
import * as dotenv from 'dotenv';
dotenv.config();

// Using process.env directly
const apiKey = process.env.VALUEOS_API_KEY;
```

---

## 🚀 Framework-Specific Setup

### Next.js

**Install:**
```bash
npm install @valueos/sdk
```

**Create API route** (`app/api/valueos/route.ts`):
```typescript
import { ValueOS } from '@valueos/sdk';
import { NextResponse } from 'next/server';

const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!
});

export async function GET() {
  const metrics = await client.metrics.list();
  return NextResponse.json(metrics);
}
```

**Client-side usage** (`app/components/Metrics.tsx`):
```typescript
'use client';

import { useEffect, useState } from 'react';

export default function Metrics() {
  const [metrics, setMetrics] = useState([]);

  useEffect(() => {
    fetch('/api/valueos')
      .then(res => res.json())
      .then(data => setMetrics(data.data));
  }, []);

  return (
    <div>
      {metrics.map(metric => (
        <div key={metric.id}>{metric.name}</div>
      ))}
    </div>
  );
}
```

---

### Express.js

**Install:**
```bash
npm install @valueos/sdk express
npm install -D @types/express
```

**Setup** (`server.ts`):
```typescript
import express from 'express';
import { ValueOS } from '@valueos/sdk';

const app = express();
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!
});

app.get('/api/metrics', async (req, res) => {
  try {
    const metrics = await client.metrics.list();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

---

### React

**Install:**
```bash
npm install @valueos/sdk
```

**Create hook** (`hooks/useValueOS.ts`):
```typescript
import { ValueOS } from '@valueos/sdk';
import { useEffect, useState } from 'react';

// Initialize client (use API route in production)
const client = new ValueOS({
  apiKey: process.env.REACT_APP_VALUEOS_API_KEY!
});

export function useMetrics() {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    client.metrics.list()
      .then(data => {
        setMetrics(data.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, []);

  return { metrics, loading, error };
}
```

**Use in component:**
```typescript
import { useMetrics } from './hooks/useValueOS';

function MetricsList() {
  const { metrics, loading, error } = useMetrics();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {metrics.map(metric => (
        <div key={metric.id}>{metric.name}: {metric.value}</div>
      ))}
    </div>
  );
}
```

> ⚠️ **Warning**: Never expose API keys in client-side code. Use API routes or backend proxies.

---

### Vue.js

**Install:**
```bash
npm install @valueos/sdk
```

**Create composable** (`composables/useValueOS.ts`):
```typescript
import { ValueOS } from '@valueos/sdk';
import { ref, onMounted } from 'vue';

export function useMetrics() {
  const metrics = ref([]);
  const loading = ref(true);
  const error = ref(null);

  onMounted(async () => {
    try {
      // Call your API route
      const response = await fetch('/api/valueos/metrics');
      const data = await response.json();
      metrics.value = data.data;
    } catch (err) {
      error.value = err;
    } finally {
      loading.value = false;
    }
  });

  return { metrics, loading, error };
}
```

---

### Svelte

**Install:**
```bash
npm install @valueos/sdk
```

**Create store** (`stores/valueos.ts`):
```typescript
import { ValueOS } from '@valueos/sdk';
import { writable } from 'svelte/store';

export const metrics = writable([]);

export async function loadMetrics() {
  const response = await fetch('/api/valueos/metrics');
  const data = await response.json();
  metrics.set(data.data);
}
```

---

## 🐳 Docker Setup

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build if using TypeScript
RUN npm run build

# Set environment variables
ENV NODE_ENV=production

# Run application
CMD ["node", "dist/index.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - VALUEOS_API_KEY=${VALUEOS_API_KEY}
      - VALUEOS_ENVIRONMENT=production
    env_file:
      - .env
```

---

## ☁️ Cloud Platform Setup

### AWS Lambda

**Install:**
```bash
npm install @valueos/sdk
```

**Handler** (`index.ts`):
```typescript
import { ValueOS } from '@valueos/sdk';
import { APIGatewayProxyHandler } from 'aws-lambda';

const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!
});

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const metrics = await client.metrics.list();
    
    return {
      statusCode: 200,
      body: JSON.stringify(metrics)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

---

### Vercel

**Install:**
```bash
npm install @valueos/sdk
```

**API Route** (`api/metrics.ts`):
```typescript
import { ValueOS } from '@valueos/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!
});

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    const metrics = await client.metrics.list();
    res.status(200).json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

**Environment variables** (`.env.local`):
```bash
VALUEOS_API_KEY=vos_your_api_key_here
```

---

### Netlify

**Install:**
```bash
npm install @valueos/sdk
```

**Function** (`netlify/functions/metrics.ts`):
```typescript
import { ValueOS } from '@valueos/sdk';
import { Handler } from '@netlify/functions';

const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!
});

export const handler: Handler = async (event, context) => {
  try {
    const metrics = await client.metrics.list();
    
    return {
      statusCode: 200,
      body: JSON.stringify(metrics)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

---

### Google Cloud Functions

**Install:**
```bash
npm install @valueos/sdk
```

**Function** (`index.ts`):
```typescript
import { ValueOS } from '@valueos/sdk';
import { Request, Response } from '@google-cloud/functions-framework';

const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!
});

export async function metrics(req: Request, res: Response) {
  try {
    const data = await client.metrics.list();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

---

## 🔒 Security Configuration

### API Key Storage

**Development:**
```bash
# .env (never commit)
VALUEOS_API_KEY=vos_dev_key_here
```

**Production:**

Use your platform's secret management:

**AWS Secrets Manager:**
```typescript
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManager({ region: 'us-east-1' });
const secret = await client.getSecretValue({ SecretId: 'valueos-api-key' });
const apiKey = JSON.parse(secret.SecretString).VALUEOS_API_KEY;
```

**Vercel:**
```bash
vercel env add VALUEOS_API_KEY
```

**Netlify:**
```bash
netlify env:set VALUEOS_API_KEY vos_your_key_here
```

---

### HTTPS Configuration

Always use HTTPS in production:

```typescript
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  baseURL: 'https://api.valueos.com/v1', // Always HTTPS
  timeout: 30000
});
```

---

## 🧪 Testing Setup

### Jest

**Install:**
```bash
npm install -D jest @types/jest ts-jest
```

**jest.config.js:**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup.ts']
};
```

**test/setup.ts:**
```typescript
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
```

---

### Vitest

**Install:**
```bash
npm install -D vitest
```

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts']
  }
});
```

---

## 📊 Monitoring Setup

### OpenTelemetry

```typescript
import { ValueOS } from '@valueos/sdk';
import { trace } from '@opentelemetry/api';

const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!,
  telemetry: {
    enabled: true,
    tracer: trace.getTracer('valueos-client')
  }
});
```

---

## 🔧 Troubleshooting

### Module Not Found

**Error:** `Cannot find module '@valueos/sdk'`

**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
npm install
```

---

### TypeScript Errors

**Error:** Type errors when importing SDK

**Solution:**
```bash
# Ensure TypeScript is installed
npm install -D typescript

# Check tsconfig.json includes:
{
  "compilerOptions": {
    "esModuleInterop": true,
    "moduleResolution": "node"
  }
}
```

---

### Environment Variables Not Loading

**Error:** `undefined` when accessing `process.env.VALUEOS_API_KEY`

**Solution:**
```typescript
// Install dotenv
npm install dotenv

// Load at app entry point
import * as dotenv from 'dotenv';
dotenv.config();

// Verify it's loaded
console.log('API Key loaded:', !!process.env.VALUEOS_API_KEY);
```

---

## 💡 Best Practices

### Version Pinning

```json
{
  "dependencies": {
    "@valueos/sdk": "1.2.3"  // Pin exact version
  }
}
```

### Dependency Updates

```bash
# Check for updates
npm outdated

# Update to latest
npm update @valueos/sdk

# Or use npm-check-updates
npx npm-check-updates -u @valueos/sdk
```

### Bundle Size Optimization

```typescript
// Import only what you need
import { ValueOS } from '@valueos/sdk';

// Instead of
import * as ValueOS from '@valueos/sdk';
```

---

## 🔗 Related Documentation

- [Quick Start](./quick-start.md) - Get started in 5 minutes
- [Configuration](./configuration.md) - Advanced configuration
- [Authentication](./authentication.md) - API authentication
- [API Reference](./api-reference.md) - Complete API docs

---

> **Note**: The SDK requires Node.js 18 or higher. For older versions, use the REST API directly.

> **Tip**: Use the staging environment for development and testing before deploying to production.

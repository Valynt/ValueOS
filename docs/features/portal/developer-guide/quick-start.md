# Quick Start

Build your first ValueOS integration in 5 minutes.

## 🎯 What You'll Build

A simple Node.js application that:
1. Connects to ValueOS API
2. Creates a value metric
3. Links it to a GitHub pull request
4. Retrieves and displays the metric

**Time required:** 5 minutes

---

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm, yarn, or pnpm
- ValueOS account with API key
- Basic TypeScript/JavaScript knowledge

---

## Step 1: Get Your API Key

1. Log in to [ValueOS Dashboard](https://app.valueos.com)
2. Navigate to **Settings** → **API Keys**
3. Click **Create API Key**
4. Name it "Quick Start"
5. Copy the key (starts with `vos_`)

> ⚠️ **Warning**: Store your API key securely. Never commit it to version control.

---

## Step 2: Create a New Project

```bash
# Create project directory
mkdir valueos-quickstart
cd valueos-quickstart

# Initialize npm project
npm init -y

# Install dependencies
npm install @valueos/sdk dotenv

# Install TypeScript (optional)
npm install -D typescript @types/node tsx
```

---

## Step 3: Configure Environment

Create `.env` file:

```bash
# .env
VALUEOS_API_KEY=vos_your_api_key_here
VALUEOS_ENVIRONMENT=production
```

Create `.gitignore`:

```bash
# .gitignore
node_modules/
.env
*.log
```

---

## Step 4: Write Your First Integration

### TypeScript Version

Create `index.ts`:

```typescript
import { ValueOS } from '@valueos/sdk';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  // Initialize ValueOS client
  const client = new ValueOS({
    apiKey: process.env.VALUEOS_API_KEY!,
    environment: process.env.VALUEOS_ENVIRONMENT as 'production' | 'staging'
  });

  console.log('🚀 ValueOS Quick Start\n');

  // Step 1: Create a metric
  console.log('📊 Creating metric...');
  const metric = await client.metrics.create({
    name: 'Quick Start Feature',
    description: 'Revenue impact from quick start feature',
    type: 'revenue',
    unit: 'USD',
    value: 10000,
    tags: ['quick-start', 'demo']
  });
  console.log(`✅ Created metric: ${metric.id}\n`);

  // Step 2: Link to GitHub PR (optional)
  if (process.env.GITHUB_REPO && process.env.GITHUB_PR) {
    console.log('🔗 Linking to GitHub PR...');
    await client.integrations.github.linkPullRequest({
      metricId: metric.id,
      repository: process.env.GITHUB_REPO,
      pullRequestNumber: parseInt(process.env.GITHUB_PR)
    });
    console.log('✅ Linked to GitHub PR\n');
  }

  // Step 3: Retrieve the metric
  console.log('📖 Retrieving metric...');
  const retrieved = await client.metrics.get(metric.id);
  console.log('✅ Retrieved metric:');
  console.log(JSON.stringify(retrieved, null, 2));

  // Step 4: List all metrics
  console.log('\n📋 Listing all metrics...');
  const metrics = await client.metrics.list({ limit: 5 });
  console.log(`✅ Found ${metrics.data.length} metrics`);
  metrics.data.forEach(m => {
    console.log(`  - ${m.name}: ${m.value} ${m.unit}`);
  });

  console.log('\n🎉 Quick start complete!');
  console.log(`\n👉 View your metric: https://app.valueos.com/metrics/${metric.id}`);
}

// Run the main function
main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
```

### JavaScript Version

Create `index.js`:

```javascript
const { ValueOS } = require('@valueos/sdk');
require('dotenv').config();

async function main() {
  // Initialize ValueOS client
  const client = new ValueOS({
    apiKey: process.env.VALUEOS_API_KEY,
    environment: process.env.VALUEOS_ENVIRONMENT
  });

  console.log('🚀 ValueOS Quick Start\n');

  // Step 1: Create a metric
  console.log('📊 Creating metric...');
  const metric = await client.metrics.create({
    name: 'Quick Start Feature',
    description: 'Revenue impact from quick start feature',
    type: 'revenue',
    unit: 'USD',
    value: 10000,
    tags: ['quick-start', 'demo']
  });
  console.log(`✅ Created metric: ${metric.id}\n`);

  // Step 2: Retrieve the metric
  console.log('📖 Retrieving metric...');
  const retrieved = await client.metrics.get(metric.id);
  console.log('✅ Retrieved metric:');
  console.log(JSON.stringify(retrieved, null, 2));

  // Step 3: List all metrics
  console.log('\n📋 Listing all metrics...');
  const metrics = await client.metrics.list({ limit: 5 });
  console.log(`✅ Found ${metrics.data.length} metrics`);
  metrics.data.forEach(m => {
    console.log(`  - ${m.name}: ${m.value} ${m.unit}`);
  });

  console.log('\n🎉 Quick start complete!');
  console.log(`\n👉 View your metric: https://app.valueos.com/metrics/${metric.id}`);
}

// Run the main function
main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
```

---

## Step 5: Run Your Integration

### TypeScript

```bash
npx tsx index.ts
```

### JavaScript

```bash
node index.js
```

### Expected Output

```
🚀 ValueOS Quick Start

📊 Creating metric...
✅ Created metric: metric_abc123def456

📖 Retrieving metric...
✅ Retrieved metric:
{
  "id": "metric_abc123def456",
  "name": "Quick Start Feature",
  "description": "Revenue impact from quick start feature",
  "type": "revenue",
  "unit": "USD",
  "value": 10000,
  "tags": ["quick-start", "demo"],
  "createdAt": "2024-03-01T12:00:00Z",
  "updatedAt": "2024-03-01T12:00:00Z"
}

📋 Listing all metrics...
✅ Found 5 metrics
  - Quick Start Feature: 10000 USD
  - Feature A: 25000 USD
  - Feature B: 15000 USD
  - Cost Reduction: -5000 USD
  - Customer Satisfaction: 8.5 NPS

🎉 Quick start complete!

👉 View your metric: https://app.valueos.com/metrics/metric_abc123def456
```

---

## 🎉 Success!

You've successfully:
- ✅ Installed the ValueOS SDK
- ✅ Authenticated with the API
- ✅ Created a value metric
- ✅ Retrieved metric data
- ✅ Listed all metrics

---

## 🚀 Next Steps

### Explore More Features

#### Create Different Metric Types

```typescript
// Cost reduction metric
const costMetric = await client.metrics.create({
  name: 'Infrastructure Optimization',
  type: 'cost',
  unit: 'USD',
  value: -5000, // Negative for cost reduction
  tags: ['infrastructure', 'optimization']
});

// Customer satisfaction metric
const satisfactionMetric = await client.metrics.create({
  name: 'NPS Improvement',
  type: 'satisfaction',
  unit: 'NPS',
  value: 8.5,
  tags: ['customer', 'satisfaction']
});

// Time savings metric
const timeMetric = await client.metrics.create({
  name: 'Automation Time Savings',
  type: 'time',
  unit: 'hours',
  value: 120,
  tags: ['automation', 'efficiency']
});
```

#### Update a Metric

```typescript
const updated = await client.metrics.update(metric.id, {
  value: 15000, // Increased value
  description: 'Updated revenue impact'
});
```

#### Add Metadata

```typescript
await client.metrics.update(metric.id, {
  metadata: {
    feature: 'quick-start',
    team: 'engineering',
    quarter: 'Q1-2024',
    confidence: 'high'
  }
});
```

#### Create a Dashboard

```typescript
const dashboard = await client.dashboards.create({
  name: 'Quick Start Dashboard',
  description: 'My first ValueOS dashboard',
  widgets: [
    {
      type: 'metric',
      metricId: metric.id,
      position: { x: 0, y: 0, w: 6, h: 4 }
    }
  ]
});
```

---

## 📚 Learn More

### Documentation
- [Installation Guide](./installation.md) - Detailed setup instructions
- [Configuration](./configuration.md) - Advanced configuration options
- [API Reference](./api-reference.md) - Complete API documentation
- [SDK Reference](./sdk-reference.md) - SDK methods and types

### Tutorials
- [GitHub Integration](./tutorials/github-integration.md) - Track value by PR
- [Jira Integration](./tutorials/jira-integration.md) - Track value by issue
- [Custom Dashboards](./tutorials/custom-dashboards.md) - Build custom views
- [Webhooks](./tutorials/webhooks.md) - Real-time notifications

### Examples
- [Express.js Integration](./examples/express.md)
- [Next.js Integration](./examples/nextjs.md)
- [GitHub Actions](./examples/github-actions.md)
- [CI/CD Pipeline](./examples/cicd.md)

---

## 🔧 Troubleshooting

### Authentication Error

**Error:** `Invalid API key`

**Solution:**
1. Verify API key is correct
2. Check key hasn't been revoked
3. Ensure key has required permissions
4. Try creating a new API key

### Network Error

**Error:** `ECONNREFUSED` or `ETIMEDOUT`

**Solution:**
1. Check internet connection
2. Verify firewall settings
3. Try using staging environment
4. Check [status page](https://status.valueos.com)

### Rate Limit Error

**Error:** `Rate limit exceeded`

**Solution:**
1. Implement exponential backoff
2. Reduce request frequency
3. Consider upgrading plan
4. Use webhooks instead of polling

### TypeScript Errors

**Error:** Type errors when using SDK

**Solution:**
```bash
# Install type definitions
npm install -D @types/node

# Ensure tsconfig.json includes:
{
  "compilerOptions": {
    "esModuleInterop": true,
    "moduleResolution": "node"
  }
}
```

---

## 💡 Best Practices

### Error Handling

```typescript
try {
  const metric = await client.metrics.create({
    name: 'My Metric',
    type: 'revenue',
    unit: 'USD',
    value: 1000
  });
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, 60000));
    // Retry logic here
  } else if (error.code === 'INVALID_REQUEST') {
    // Handle validation error
    console.error('Invalid request:', error.details);
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

### Retry Logic

```typescript
async function createMetricWithRetry(data: MetricCreateInput, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.metrics.create(data);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Exponential backoff
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### Batch Operations

```typescript
// Instead of creating metrics one by one
const metrics = await Promise.all([
  client.metrics.create({ name: 'Metric 1', type: 'revenue', unit: 'USD', value: 1000 }),
  client.metrics.create({ name: 'Metric 2', type: 'revenue', unit: 'USD', value: 2000 }),
  client.metrics.create({ name: 'Metric 3', type: 'revenue', unit: 'USD', value: 3000 })
]);
```

---

## 🤝 Get Help

### Community
- **Slack**: [valueos.slack.com](https://valueos.slack.com)
- **GitHub**: [github.com/valueos/sdk](https://github.com/valueos/sdk)
- **Stack Overflow**: Tag `valueos`

### Support
- **Email**: developers@valueos.com
- **Chat**: Available in dashboard
- **Docs**: [docs.valueos.com](https://docs.valueos.com)

---

## 🎓 What's Next?

### Beginner Path
1. ✅ Complete this quick start
2. [Installation Guide](./installation.md) - Set up for your environment
3. [Authentication](./authentication.md) - Understand API authentication
4. [First Tutorial](./tutorials/first-integration.md) - Build a real integration

### Intermediate Path
1. [API Reference](./api-reference.md) - Explore all endpoints
2. [SDK Reference](./sdk-reference.md) - Learn all SDK methods
3. [Webhooks](./webhooks.md) - Set up real-time notifications
4. [Custom Integrations](./custom-integrations.md) - Build custom integrations

### Advanced Path
1. [Advanced Patterns](./advanced-patterns.md) - Best practices
2. [Performance](./performance.md) - Optimize your integration
3. [Monitoring](./monitoring.md) - Track integration health
4. [Production Checklist](./production-checklist.md) - Go live

---

> **Note**: This quick start uses the production environment. For development, use the staging environment by setting `VALUEOS_ENVIRONMENT=staging`.

> **Tip**: Check out our [example repository](https://github.com/valueos/examples) for more complete examples and use cases.

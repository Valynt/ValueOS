# Sentry Integration Setup

## Overview

Sentry is integrated for error tracking and performance monitoring. The SDK is installed and ready to use.

## Installation Status

✅ **Installed Packages:**
- `@sentry/react` - React SDK for error tracking
- `@sentry/vite-plugin` - Vite plugin for source maps

## Configuration

### 1. Get Sentry DSN

1. Sign up at [sentry.io](https://sentry.io)
2. Create a new project (select "React")
3. Copy the DSN from project settings

### 2. Configure Environment Variables

Add to `.env.production`:

```bash
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
VITE_SENTRY_ENABLED=true
VITE_SENTRY_ENVIRONMENT=production
VITE_SENTRY_SAMPLE_RATE=1.0
SENTRY_AUTH_TOKEN=your-auth-token
```

### 3. Update Vite Configuration

Edit `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: 'your-org',
      project: 'valuecanvas',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        assets: './dist/**',
      },
    }),
  ],
  build: {
    sourcemap: true, // Required for Sentry
  },
});
```

### 4. Initialize in Application

The Sentry integration is already set up in `src/lib/sentry.ts`. To enable it:

1. Uncomment the Sentry initialization code in `src/lib/sentry.ts`
2. Import and initialize in your app entry point:

```typescript
import { initializeSentry } from './lib/sentry';
import { getConfig } from './config/environment';

const config = getConfig();

if (config.monitoring.sentry.enabled) {
  initializeSentry();
}
```

## Usage

### Automatic Error Capture

Errors are automatically captured in production:

```typescript
// Errors thrown anywhere in the app are automatically captured
throw new Error('Something went wrong');
```

### Manual Error Capture

```typescript
import { captureException } from './lib/sentry';

try {
  riskyOperation();
} catch (error) {
  captureException(error, {
    extra: {
      userId: user.id,
      action: 'save_document'
    }
  });
}
```

### Capture Messages

```typescript
import { captureMessage } from './lib/sentry';

captureMessage('User completed onboarding', {
  level: 'info',
  extra: {
    userId: user.id,
    plan: 'premium'
  }
});
```

### Set User Context

```typescript
import { setUser } from './lib/sentry';

// After user logs in
setUser({
  id: user.id,
  email: user.email,
  username: user.username
});

// After user logs out
setUser(null);
```

### Add Breadcrumbs

```typescript
import { addBreadcrumb } from './lib/sentry';

addBreadcrumb({
  category: 'navigation',
  message: 'User navigated to dashboard',
  level: 'info',
  data: {
    from: '/login',
    to: '/dashboard'
  }
});
```

### Performance Monitoring

```typescript
import { startTransaction } from './lib/sentry';

const transaction = startTransaction({
  name: 'Load Dashboard',
  op: 'navigation'
});

// ... perform operations ...

transaction.finish();
```

## Integration with Observability

Sentry integrates with the observability stack:

### 1. Alerting Service

The `AlertingService` sends critical alerts to Sentry:

```typescript
import { getAlertingService } from './services/AlertingService';

const alerting = getAlertingService(supabase);
alerting.start(); // Automatically sends alerts to Sentry
```

### 2. Logger Integration

The logger automatically sends errors to Sentry in production:

```typescript
import { logger } from './lib/logger';

logger.error('Operation failed', error, {
  context: 'additional info'
});
// Automatically sent to Sentry in production
```

### 3. Agent Errors

Agent errors are automatically tracked:

```typescript
import { traceAgentExecution } from './lib/observability';

await traceAgentExecution('execute', attributes, async (span) => {
  // Errors here are automatically sent to Sentry
  throw new Error('Agent execution failed');
});
```

## Features

### Error Tracking

- **Automatic capture** of unhandled errors
- **Stack traces** with source maps
- **User context** for debugging
- **Breadcrumbs** for error context
- **Release tracking** for version correlation

### Performance Monitoring

- **Transaction tracking** for key operations
- **Distributed tracing** integration with OpenTelemetry
- **Web Vitals** monitoring
- **Custom metrics** for business KPIs

### Session Replay

- **Video-like replay** of user sessions with errors
- **Privacy controls** (mask PII, block media)
- **Sampling** to control volume

## Configuration Options

### Sample Rates

Control data volume:

```typescript
{
  tracesSampleRate: 1.0,        // 100% of transactions
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0  // 100% of error sessions
}
```

### Filtering

Filter out noise:

```typescript
{
  beforeSend(event) {
    // Filter development errors
    if (event.environment === 'development') {
      return null;
    }
    return event;
  },
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
  ]
}
```

### Environment Detection

Sentry only runs in production:

```typescript
import { isSentryEnabled } from './lib/sentry';

if (isSentryEnabled()) {
  // Sentry is active
}
```

## Monitoring

### Sentry Dashboard

Access at [sentry.io](https://sentry.io):

1. **Issues** - View and triage errors
2. **Performance** - Monitor transaction performance
3. **Releases** - Track deployments
4. **Alerts** - Configure notifications

### Key Metrics

Monitor these metrics:

- **Error Rate** - Should be \u003c 1%
- **Crash-Free Sessions** - Should be \u003e 99.5%
- **Apdex Score** - Should be \u003e 0.9
- **P95 Response Time** - Should be \u003c 3s

### Alerts

Configure alerts for:

- **New Issues** - First occurrence of an error
- **Regression** - Previously resolved error returns
- **Spike** - Sudden increase in error rate
- **Threshold** - Error rate exceeds limit

## Best Practices

### 1. Add Context

Always add relevant context to errors:

```typescript
captureException(error, {
  extra: {
    userId: user.id,
    action: 'save',
    documentId: doc.id,
    timestamp: Date.now()
  }
});
```

### 2. Use Breadcrumbs

Add breadcrumbs for debugging:

```typescript
addBreadcrumb({ message: 'User clicked save button' });
addBreadcrumb({ message: 'Validation passed' });
addBreadcrumb({ message: 'API call started' });
// Error occurs here - breadcrumbs provide context
```

### 3. Set User Context

Always set user context after authentication:

```typescript
setUser({
  id: user.id,
  email: user.email,
  username: user.username
});
```

### 4. Tag Releases

Tag releases for tracking:

```bash
# In CI/CD
sentry-cli releases new "$VERSION"
sentry-cli releases set-commits "$VERSION" --auto
sentry-cli releases finalize "$VERSION"
```

### 5. Monitor Performance

Track critical operations:

```typescript
const transaction = startTransaction({
  name: 'Agent Execution',
  op: 'agent.execute'
});

// ... operation ...

transaction.setStatus('ok');
transaction.finish();
```

## Troubleshooting

### Errors Not Appearing

1. **Check environment:**
   ```typescript
   console.log('Sentry enabled:', isSentryEnabled());
   ```

2. **Verify DSN:**
   ```bash
   echo $VITE_SENTRY_DSN
   ```

3. **Check initialization:**
   ```typescript
   import { initializeSentry } from './lib/sentry';
   initializeSentry(); // Should log success
   ```

### Source Maps Not Working

1. **Enable source maps in build:**
   ```typescript
   // vite.config.ts
   build: { sourcemap: true }
   ```

2. **Upload source maps:**
   ```bash
   sentry-cli sourcemaps upload --org=your-org --project=valuecanvas ./dist
   ```

3. **Verify auth token:**
   ```bash
   sentry-cli info
   ```

### High Volume

Reduce data volume:

1. **Lower sample rates:**
   ```typescript
   tracesSampleRate: 0.1 // 10% of transactions
   ```

2. **Filter errors:**
   ```typescript
   ignoreErrors: ['NetworkError', 'TimeoutError']
   ```

3. **Use rate limiting** in Sentry project settings

## Resources

- [Sentry React Documentation](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Session Replay](https://docs.sentry.io/product/session-replay/)
- [Best Practices](https://docs.sentry.io/platforms/javascript/best-practices/)

## Support

For issues:
1. Check [Sentry Status](https://status.sentry.io/)
2. Review [Sentry Documentation](https://docs.sentry.io/)
3. Contact Sentry support
4. Open an issue in the repository

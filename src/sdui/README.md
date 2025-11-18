# SDUI Runtime Engine - Complete Implementation

## Overview

This is a production-ready **Server-Driven UI (SDUI) runtime engine** that dynamically renders UI components based on server-provided configurations. The implementation includes comprehensive schema validation, data hydration, error handling, and performance optimization.

## Table of Contents

- [Architecture](#architecture)
- [Core Features](#core-features)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Data Hydration](#data-hydration)
- [Error Handling](#error-handling)
- [Performance](#performance)
- [Testing](#testing)
- [Best Practices](#best-practices)

---

## Architecture

### Component Structure

```
src/sdui/
├── renderPage.tsx              # Core renderPage() function
├── schema.ts                   # Zod schemas and validation
├── registry.tsx                # Component registry
├── types.ts                    # TypeScript type definitions
├── hooks/
│   └── useDataHydration.ts    # Data hydration hook
├── components/
│   ├── ComponentErrorBoundary.tsx  # Error boundary
│   └── LoadingFallback.tsx         # Loading states
├── utils/
│   └── renderUtils.ts         # Utility functions
├── examples/
│   └── renderPageExamples.tsx # Usage examples
└── __tests__/
    └── renderPage.test.tsx    # Test suite
```

### Data Flow

```
Server Page Definition
        ↓
Schema Validation (Zod)
        ↓
Component Resolution (Registry)
        ↓
Data Hydration (Parallel Fetch)
        ↓
Component Rendering (React)
        ↓
Error Boundaries (Graceful Failures)
        ↓
Rendered UI
```

---

## Core Features

### ✅ Schema Validation

- **Zod-based validation** of entire page definition
- **Recursive validation** of nested components
- **Clear error messages** with field paths
- **Version normalization** and compatibility checks

### ✅ Dynamic Component Rendering

- **Registry-based lookup** for components
- **Version support** for component evolution
- **Props validation** and type safety
- **Nested component structures**

### ✅ Data Hydration System

- **Multiple endpoint support** (parallel fetching)
- **Automatic retry** with exponential backoff
- **Request timeout** protection
- **Data caching** with TTL
- **Loading states** during fetch
- **Error recovery** with fallbacks

### ✅ Error Boundaries & Fallbacks

- **Component-level error isolation**
- **Graceful degradation** for missing components
- **Custom fallback UI** support
- **Error logging** and reporting
- **Retry capability** for failed components

### ✅ Performance Optimization

- **Efficient re-rendering** strategies
- **Memoization** for expensive operations
- **Lazy loading** support
- **Request deduplication**
- **Cache management**

---

## API Reference

### `renderPage(pageDefinition, options?)`

Main function to render a server-driven UI page.

#### Parameters

**`pageDefinition: unknown`**
- The page structure from the server
- Must conform to `SDUIPageDefinition` schema
- Validated automatically

**`options?: RenderPageOptions`**
- Optional configuration object

```typescript
interface RenderPageOptions {
  // Debug mode
  debug?: boolean;

  // Error handlers
  onValidationError?: (errors: string[]) => void;
  onWarning?: (warnings: string[]) => void;
  onRenderError?: (error: Error, componentName: string) => void;
  onHydrationError?: (error: Error, endpoint: string) => void;

  // Custom components
  loadingComponent?: React.ComponentType<{ componentName: string }>;
  unknownComponentFallback?: React.ComponentType<{ componentName: string }>;
  errorFallback?: React.ComponentType<{ componentName: string; error?: Error }>;

  // Hydration configuration
  hydrationTimeout?: number;           // Default: 10000ms
  enableHydrationRetry?: boolean;      // Default: true
  hydrationRetryAttempts?: number;     // Default: 3
  dataFetcher?: (endpoint: string) => Promise<any>;
  enableHydrationCache?: boolean;      // Default: true

  // Callbacks
  onComponentRender?: (componentName: string, props: any) => void;
  onHydrationComplete?: (componentName: string, data: any) => void;
}
```

#### Returns

**`RenderPageResult`**

```typescript
interface RenderPageResult {
  element: ReactElement;           // The rendered React element
  warnings: string[];              // Validation warnings
  metadata: {
    componentCount: number;        // Total components
    hydratedComponentCount: number; // Components with hydration
    version: number;               // Page version
  };
}
```

#### Throws

**`SDUIValidationError`** - If page definition fails validation

---

## Usage Examples

### Basic Usage

```tsx
import { renderPage } from './sdui/renderPage';

const pageDefinition = {
  type: 'page',
  version: 1,
  sections: [
    {
      type: 'component',
      component: 'InfoBanner',
      version: 1,
      props: {
        title: 'Welcome',
        description: 'Server-driven UI example',
      },
    },
  ],
};

const result = renderPage(pageDefinition);

return result.element;
```

### With Data Hydration

```tsx
const pageDefinition = {
  type: 'page',
  version: 1,
  sections: [
    {
      type: 'component',
      component: 'UserProfile',
      version: 1,
      props: {
        title: 'User Profile',
      },
      hydrateWith: ['/api/user', '/api/settings'],
    },
  ],
};

const result = renderPage(pageDefinition, {
  onHydrationComplete: (componentName, data) => {
    console.log(`Loaded data for ${componentName}:`, data);
  },
  onHydrationError: (error, endpoint) => {
    console.error(`Failed to load ${endpoint}:`, error);
  },
});
```

### With Error Handling

```tsx
const result = renderPage(pageDefinition, {
  onValidationError: (errors) => {
    // Log validation errors
    logToService('validation_error', { errors });
  },
  onRenderError: (error, componentName) => {
    // Track component errors
    trackError(error, { component: componentName });
  },
  unknownComponentFallback: ({ componentName }) => (
    <div className="p-4 bg-yellow-50">
      Component "{componentName}" is not available
    </div>
  ),
});
```

### With Fallback Components

```tsx
const pageDefinition = {
  type: 'page',
  version: 1,
  sections: [
    {
      type: 'component',
      component: 'DataTable',
      version: 1,
      props: { title: 'Sales Data' },
      hydrateWith: ['/api/sales'],
      fallback: {
        message: 'Sales data temporarily unavailable',
        component: 'InfoBanner',
        props: {
          title: 'Data Unavailable',
          tone: 'warning',
        },
      },
    },
  ],
};
```

### Debug Mode

```tsx
const result = renderPage(pageDefinition, {
  debug: true, // Shows component metadata
  onComponentRender: (name, props) => {
    console.log(`Rendering ${name}`, props);
  },
});
```

### Custom Data Fetcher

```tsx
const authenticatedFetcher = async (endpoint: string) => {
  const token = getAuthToken();
  const response = await fetch(endpoint, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
};

const result = renderPage(pageDefinition, {
  dataFetcher: authenticatedFetcher,
});
```

---

## Data Hydration

### How It Works

1. **Endpoint Detection**: Components with `hydrateWith` array are identified
2. **Parallel Fetching**: All endpoints are fetched concurrently
3. **Data Merging**: Results are merged into component props
4. **Error Handling**: Failed requests trigger fallbacks or retries
5. **Caching**: Successful responses are cached with TTL

### Hydration Hook

The `useDataHydration` hook powers the hydration system:

```typescript
const { data, loading, error, retry, clearCache } = useDataHydration(
  ['/api/endpoint1', '/api/endpoint2'],
  {
    enabled: true,
    timeout: 10000,
    enableRetry: true,
    retryAttempts: 3,
    onSuccess: (data) => console.log('Loaded:', data),
    onError: (error) => console.error('Failed:', error),
  }
);
```

### Features

- **Concurrent requests** for multiple endpoints
- **Exponential backoff** retry strategy
- **Request timeout** protection
- **Abort on unmount** to prevent memory leaks
- **Cache management** with TTL
- **Loading states** for UI feedback

### Cache Management

```typescript
import { clearAllHydrationCache, getHydrationCacheStats } from './hooks/useDataHydration';

// Clear all cached data
clearAllHydrationCache();

// Get cache statistics
const stats = getHydrationCacheStats();
console.log(`Cache size: ${stats.size}`);
console.log('Entries:', stats.entries);
```

---

## Error Handling

### Error Boundary Hierarchy

```
Page Error Boundary (Fatal errors)
    ↓
Section Error Boundary (Component errors)
    ↓
Component Error Boundary (Render errors)
```

### Error Types

1. **Validation Errors** - Schema validation failures
2. **Component Errors** - Missing or broken components
3. **Hydration Errors** - Network or data fetch failures
4. **Render Errors** - Runtime errors during rendering

### Error Recovery

```tsx
// Automatic retry for hydration errors
const result = renderPage(pageDefinition, {
  enableHydrationRetry: true,
  retryAttempts: 3,
});

// Manual retry via hook
const { retry } = useDataHydration(endpoints);
<button onClick={retry}>Retry</button>
```

### Custom Error Fallbacks

```tsx
const CustomErrorFallback = ({ componentName, error }) => (
  <div className="error-container">
    <h3>Error in {componentName}</h3>
    <p>{error?.message}</p>
    <button onClick={() => window.location.reload()}>
      Reload Page
    </button>
  </div>
);

renderPage(pageDefinition, {
  errorFallback: CustomErrorFallback,
});
```

---

## Performance

### Optimization Strategies

1. **Memoization**: Expensive operations are memoized
2. **Lazy Loading**: Components loaded on-demand
3. **Request Deduplication**: Same endpoints fetched once
4. **Cache Management**: Reduce redundant network calls
5. **Efficient Re-renders**: React best practices

### Performance Monitoring

```tsx
const result = renderPage(pageDefinition, {
  onComponentRender: (name, props) => {
    performance.mark(`${name}-start`);
  },
  onHydrationComplete: (name, data) => {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
  },
});

// Access metadata
console.log('Total components:', result.metadata.componentCount);
console.log('Hydrated:', result.metadata.hydratedComponentCount);
```

### Best Practices

- **Minimize hydration endpoints** - Combine data when possible
- **Use caching** - Enable cache for frequently accessed data
- **Set appropriate timeouts** - Balance UX and reliability
- **Monitor performance** - Track render times and errors
- **Lazy load heavy components** - Split large components

---

## Testing

### Running Tests

```bash
npm run test                 # Run all tests
npm run test:watch          # Watch mode
npm run test -- renderPage  # Test specific file
```

### Test Coverage

The test suite covers:

- ✅ Schema validation (valid/invalid cases)
- ✅ Component rendering (registry lookup)
- ✅ Data hydration (success/failure)
- ✅ Error handling (boundaries, fallbacks)
- ✅ Debug mode functionality
- ✅ Custom options (fetchers, loaders)
- ✅ Metadata accuracy

### Example Test

```typescript
import { renderPage } from '../renderPage';

it('should validate and render a valid page', () => {
  const pageDefinition = {
    type: 'page',
    version: 1,
    sections: [
      {
        type: 'component',
        component: 'InfoBanner',
        version: 1,
        props: { title: 'Test' },
      },
    ],
  };

  const result = renderPage(pageDefinition);

  expect(result.element).toBeDefined();
  expect(result.metadata.componentCount).toBe(1);
});
```

---

## Best Practices

### 1. Always Validate Server Data

```tsx
try {
  const result = renderPage(serverData, {
    onValidationError: (errors) => {
      logErrors(errors);
      showUserNotification('Invalid page configuration');
    },
  });
} catch (error) {
  // Handle validation errors
}
```

### 2. Provide Fallbacks

```tsx
const pageDefinition = {
  sections: [
    {
      component: 'DataTable',
      hydrateWith: ['/api/data'],
      fallback: {
        component: 'InfoBanner',
        props: {
          title: 'Data Unavailable',
          tone: 'warning',
        },
      },
    },
  ],
};
```

### 3. Monitor Performance

```tsx
const result = renderPage(pageDefinition, {
  onComponentRender: (name) => {
    metrics.increment(`component.${name}.render`);
  },
  onHydrationError: (error, endpoint) => {
    metrics.increment('hydration.error');
    logError(error, { endpoint });
  },
});
```

### 4. Use Debug Mode in Development

```tsx
const result = renderPage(pageDefinition, {
  debug: process.env.NODE_ENV === 'development',
});
```

### 5. Implement Proper Error Tracking

```tsx
const result = renderPage(pageDefinition, {
  onRenderError: (error, componentName) => {
    // Send to error tracking service
    Sentry.captureException(error, {
      tags: { component: componentName },
    });
  },
});
```

### 6. Cache Strategically

```tsx
const result = renderPage(pageDefinition, {
  enableHydrationCache: true,
  // Clear cache when user logs out
  onUserLogout: () => clearAllHydrationCache(),
});
```

### 7. Handle Authentication

```tsx
const authenticatedFetcher = async (endpoint) => {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (response.status === 401) {
    redirectToLogin();
  }
  
  return response.json();
};

renderPage(pageDefinition, {
  dataFetcher: authenticatedFetcher,
});
```

---

## Advanced Topics

### Custom Component Registry

```typescript
import { registerComponent } from './registry';

registerComponent('CustomComponent', {
  component: MyCustomComponent,
  versions: [1, 2],
  requiredProps: ['title', 'data'],
  description: 'Custom component for special use case',
});
```

### Type-Safe Props

```typescript
import { HydratableProps } from './types';

interface MyComponentProps extends HydratableProps {
  title: string;
  data: any[];
}

const MyComponent: React.FC<MyComponentProps> = (props) => {
  // Access hydrated data
  const hydratedData = props._hydrated;
  
  return <div>{/* ... */}</div>;
};
```

### Performance Profiling

```typescript
import { calculatePerformanceMetrics } from './utils/renderUtils';

const metrics = calculatePerformanceMetrics(
  componentMetadata,
  validationTime
);

console.log('Total time:', metrics.totalTime);
console.log('Hydration time:', metrics.hydrationTime);
console.log('Render time:', metrics.renderTime);
```

---

## Troubleshooting

### Common Issues

**Issue**: Components not rendering
- **Solution**: Check component is registered in registry
- **Solution**: Verify component name matches exactly

**Issue**: Hydration timeout
- **Solution**: Increase `hydrationTimeout` option
- **Solution**: Check network connectivity
- **Solution**: Verify endpoint URLs are correct

**Issue**: Validation errors
- **Solution**: Check page definition matches schema
- **Solution**: Enable debug mode to see detailed errors
- **Solution**: Use TypeScript for type safety

**Issue**: Memory leaks
- **Solution**: Ensure components cleanup on unmount
- **Solution**: Clear cache periodically
- **Solution**: Abort pending requests

---

## Migration Guide

### From Old Renderer

```tsx
// Old
<SDUIRenderer schema={schema} debugOverlay={true} />

// New
const result = renderPage(schema, { debug: true });
return result.element;
```

### Adding Hydration

```tsx
// Before
{
  component: 'MyComponent',
  props: { data: staticData },
}

// After
{
  component: 'MyComponent',
  props: { title: 'My Component' },
  hydrateWith: ['/api/data'],
}
```

---

## Contributing

When adding new features:

1. Update type definitions in `types.ts`
2. Add tests in `__tests__/`
3. Update examples in `examples/`
4. Document in this README
5. Follow existing code patterns

---

## License

Part of the ValueCanvas project. See main LICENSE file.

---

## Support

For issues or questions:
- Check examples in `examples/renderPageExamples.tsx`
- Review tests in `__tests__/renderPage.test.tsx`
- See main project documentation

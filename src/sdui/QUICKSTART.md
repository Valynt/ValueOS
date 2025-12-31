# SDUI Runtime Engine - Quick Start Guide

Get started with the production-ready SDUI runtime engine in 5 minutes.

## Installation

The SDUI runtime engine is already included in the ValueCanvas project. No additional installation needed.

## Basic Usage

### 1. Import the Function

```tsx
import { renderPage } from './sdui';
```

### 2. Define Your Page

```tsx
const pageDefinition = {
  type: 'page',
  version: 1,
  sections: [
    {
      type: 'component',
      component: 'InfoBanner',
      version: 1,
      props: {
        title: 'Welcome to SDUI',
        description: 'This page is rendered dynamically',
        tone: 'info',
      },
    },
  ],
};
```

### 3. Render the Page

```tsx
function MyPage() {
  const result = renderPage(pageDefinition);
  return result.element;
}
```

That's it! You now have a working SDUI page.

---

## Adding Data Hydration

Fetch data from APIs and inject it into components:

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
      // Data will be fetched from these endpoints
      hydrateWith: ['/api/user', '/api/settings'],
    },
  ],
};

const result = renderPage(pageDefinition, {
  onHydrationComplete: (componentName, data) => {
    console.log(`Loaded ${componentName}:`, data);
  },
});
```

---

## Error Handling

Handle errors gracefully:

```tsx
const result = renderPage(pageDefinition, {
  onValidationError: (errors) => {
    console.error('Invalid page:', errors);
  },
  onRenderError: (error, componentName) => {
    console.error(`Error in ${componentName}:`, error);
  },
  onHydrationError: (error, endpoint) => {
    console.error(`Failed to load ${endpoint}:`, error);
  },
});
```

---

## Using Fallbacks

Provide fallback UI when data loading fails:

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
      // Fallback if hydration fails
      fallback: {
        component: 'InfoBanner',
        props: {
          title: 'Data Unavailable',
          description: 'Please try again later',
          tone: 'warning',
        },
      },
    },
  ],
};
```

---

## Debug Mode

Enable debug mode to see component metadata:

```tsx
const result = renderPage(pageDefinition, {
  debug: true, // Shows component info below each component
});
```

---

## Complete Example

Here's a complete example with all features:

```tsx
import React from 'react';
import { renderPage } from './sdui';

function MyDynamicPage() {
  // Page definition from server
  const pageDefinition = {
    type: 'page',
    version: 1,
    sections: [
      {
        type: 'component',
        component: 'InfoBanner',
        version: 1,
        props: {
          title: 'Dashboard',
          description: 'Welcome to your dashboard',
          tone: 'info',
        },
      },
      {
        type: 'component',
        component: 'ValueTreeCard',
        version: 1,
        props: {
          title: 'Value Drivers',
        },
        hydrateWith: ['/api/value-tree'],
        fallback: {
          message: 'Value tree data is loading...',
        },
      },
      {
        type: 'component',
        component: 'DiscoveryCard',
        version: 1,
        props: {
          title: 'Discovery Questions',
        },
        hydrateWith: ['/api/questions'],
      },
    ],
    metadata: {
      debug: process.env.NODE_ENV === 'development',
    },
  };

  // Render options
  const options = {
    onValidationError: (errors) => {
      console.error('Validation failed:', errors);
    },
    onHydrationError: (error, endpoint) => {
      console.error(`Failed to load ${endpoint}:`, error);
    },
    onComponentRender: (componentName, props) => {
      console.log(`Rendered ${componentName}`);
    },
    hydrationTimeout: 10000,
    enableHydrationRetry: true,
    retryAttempts: 3,
  };

  try {
    const result = renderPage(pageDefinition, options);

    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">My Dynamic Page</h1>
        {result.element}
        
        {/* Show metadata */}
        <div className="mt-4 text-sm text-gray-600">
          <p>Components: {result.metadata.componentCount}</p>
          <p>Hydrated: {result.metadata.hydratedComponentCount}</p>
          {result.warnings.length > 0 && (
            <p className="text-yellow-600">
              Warnings: {result.warnings.length}
            </p>
          )}
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-900">
          Failed to render page: {(error as Error).message}
        </p>
      </div>
    );
  }
}

export default MyDynamicPage;
```

---

## Next Steps

1. **Read the full documentation**: See [README.md](./README.md) for complete API reference
2. **Explore examples**: Check [examples/renderPageExamples.tsx](./examples/renderPageExamples.tsx)
3. **Run tests**: `npm run test` to see the test suite
4. **Register custom components**: Add your own components to the registry
5. **Customize behavior**: Use options to tailor the runtime to your needs

---

## Common Patterns

### Fetching from Multiple Endpoints

```tsx
{
  component: 'Dashboard',
  hydrateWith: [
    '/api/user',
    '/api/metrics',
    '/api/notifications',
  ],
}
```

### Custom Authentication

```tsx
const authenticatedFetcher = async (endpoint) => {
  const token = getAuthToken();
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
};

renderPage(pageDefinition, {
  dataFetcher: authenticatedFetcher,
});
```

### Loading States

```tsx
const CustomLoader = ({ componentName }) => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
  </div>
);

renderPage(pageDefinition, {
  loadingComponent: CustomLoader,
});
```

---

## Troubleshooting

**Q: My component isn't rendering**
- Check if the component is registered in the registry
- Verify the component name matches exactly (case-sensitive)

**Q: Data hydration is timing out**
- Increase `hydrationTimeout` in options
- Check if the API endpoint is accessible
- Enable debug mode to see detailed logs

**Q: Getting validation errors**
- Ensure page definition matches the schema
- Check that all required fields are present
- Use TypeScript for type safety

**Q: Components are rendering but data is missing**
- Verify `hydrateWith` endpoints are correct
- Check network tab for failed requests
- Add `onHydrationError` callback to see errors

---

## Support

- **Full Documentation**: [README.md](./README.md)
- **Examples**: [examples/renderPageExamples.tsx](./examples/renderPageExamples.tsx)
- **Tests**: [__tests__/renderPage.test.tsx](./__tests__/renderPage.test.tsx)
- **Type Definitions**: [types.ts](./types.ts)

Happy coding! 🚀

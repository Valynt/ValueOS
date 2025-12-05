# Migration Guide: SDUIRenderer → renderPage()

This guide helps you migrate from the legacy `SDUIRenderer` component to the new `renderPage()` function.

## Why Migrate?

The new `renderPage()` function provides:

- ✅ **Data Hydration**: Fetch data from APIs automatically
- ✅ **Better Error Handling**: Multiple layers of error protection
- ✅ **Performance**: Optimized rendering and caching
- ✅ **Type Safety**: Full TypeScript support
- ✅ **Flexibility**: More configuration options
- ✅ **Testing**: Easier to test and mock

## Quick Comparison

### Old Way (SDUIRenderer)

```tsx
import { SDUIRenderer } from './sdui';

function MyPage() {
  return (
    <SDUIRenderer
      schema={pageSchema}
      debugOverlay={true}
      onValidationError={(errors) => console.error(errors)}
    />
  );
}
```

### New Way (renderPage)

```tsx
import { renderPage } from './sdui';

function MyPage() {
  const result = renderPage(pageSchema, {
    debug: true,
    onValidationError: (errors) => console.error(errors),
  });
  
  return result.element;
}
```

## Step-by-Step Migration

### Step 1: Update Imports

**Before:**
```tsx
import { SDUIRenderer } from './sdui';
```

**After:**
```tsx
import { renderPage } from './sdui';
```

### Step 2: Replace Component with Function Call

**Before:**
```tsx
<SDUIRenderer schema={pageDefinition} />
```

**After:**
```tsx
const result = renderPage(pageDefinition);
return result.element;
```

### Step 3: Update Props to Options

**Before:**
```tsx
<SDUIRenderer
  schema={pageDefinition}
  debugOverlay={true}
  onValidationError={handleError}
  onHydrationWarning={handleWarning}
/>
```

**After:**
```tsx
const result = renderPage(pageDefinition, {
  debug: true,
  onValidationError: handleError,
  onWarning: handleWarning,
});
return result.element;
```

### Step 4: Access Metadata (Optional)

The new function returns metadata about the rendered page:

```tsx
const result = renderPage(pageDefinition);

console.log('Components:', result.metadata.componentCount);
console.log('Hydrated:', result.metadata.hydratedComponentCount);
console.log('Warnings:', result.warnings);

return result.element;
```

## Prop Mapping

| Old Prop (SDUIRenderer) | New Option (renderPage) | Notes |
|------------------------|------------------------|-------|
| `schema` | First parameter | Now called `pageDefinition` |
| `debugOverlay` | `debug` | Renamed for clarity |
| `onValidationError` | `onValidationError` | Same |
| `onHydrationWarning` | `onWarning` | Renamed |
| N/A | `onRenderError` | New callback |
| N/A | `onHydrationError` | New callback |
| N/A | `onComponentRender` | New callback |
| N/A | `onHydrationComplete` | New callback |
| N/A | `loadingComponent` | New customization |
| N/A | `unknownComponentFallback` | New customization |
| N/A | `errorFallback` | New customization |
| N/A | `hydrationTimeout` | New option |
| N/A | `enableHydrationRetry` | New option |
| N/A | `retryAttempts` | New option |
| N/A | `dataFetcher` | New option |
| N/A | `enableHydrationCache` | New option |

## Common Migration Patterns

### Pattern 1: Basic Page

**Before:**
```tsx
function OpportunityPage() {
  return (
    <div>
      <h1>Opportunity</h1>
      <SDUIRenderer schema={opportunitySchema} />
    </div>
  );
}
```

**After:**
```tsx
function OpportunityPage() {
  const result = renderPage(opportunitySchema);
  
  return (
    <div>
      <h1>Opportunity</h1>
      {result.element}
    </div>
  );
}
```

### Pattern 2: With Error Handling

**Before:**
```tsx
function MyPage() {
  const [error, setError] = useState(null);
  
  return (
    <>
      {error && <ErrorMessage error={error} />}
      <SDUIRenderer
        schema={schema}
        onValidationError={(errors) => setError(errors[0])}
      />
    </>
  );
}
```

**After:**
```tsx
function MyPage() {
  const [error, setError] = useState(null);
  
  try {
    const result = renderPage(schema, {
      onValidationError: (errors) => setError(errors[0]),
      onRenderError: (error) => setError(error.message),
    });
    
    return (
      <>
        {error && <ErrorMessage error={error} />}
        {result.element}
      </>
    );
  } catch (err) {
    return <ErrorMessage error={err.message} />;
  }
}
```

### Pattern 3: With Debug Mode

**Before:**
```tsx
<SDUIRenderer
  schema={schema}
  debugOverlay={process.env.NODE_ENV === 'development'}
/>
```

**After:**
```tsx
const result = renderPage(schema, {
  debug: process.env.NODE_ENV === 'development',
});
return result.element;
```

### Pattern 4: Dynamic Schema Updates

**Before:**
```tsx
function DynamicPage() {
  const [schema, setSchema] = useState(initialSchema);
  
  return (
    <>
      <button onClick={() => setSchema(newSchema)}>
        Update
      </button>
      <SDUIRenderer schema={schema} />
    </>
  );
}
```

**After:**
```tsx
function DynamicPage() {
  const [schema, setSchema] = useState(initialSchema);
  const result = renderPage(schema);
  
  return (
    <>
      <button onClick={() => setSchema(newSchema)}>
        Update
      </button>
      {result.element}
    </>
  );
}
```

## New Features to Adopt

### 1. Data Hydration

Add `hydrateWith` to your component sections:

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
        title: 'Profile',
      },
      // NEW: Fetch data from API
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

### 2. Fallback Components

Add fallbacks for when data loading fails:

```tsx
{
  type: 'component',
  component: 'DataTable',
  version: 1,
  props: { title: 'Data' },
  hydrateWith: ['/api/data'],
  // NEW: Fallback if hydration fails
  fallback: {
    component: 'InfoBanner',
    props: {
      title: 'Data Unavailable',
      tone: 'warning',
    },
  },
}
```

### 3. Custom Data Fetcher

Add authentication or custom headers:

```tsx
const authenticatedFetcher = async (endpoint) => {
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

### 4. Performance Monitoring

Track rendering performance:

```tsx
const result = renderPage(pageDefinition, {
  onComponentRender: (componentName, props) => {
    metrics.increment(`component.${componentName}.render`);
  },
  onHydrationComplete: (componentName, data) => {
    metrics.timing(`hydration.${componentName}`, Date.now());
  },
});

// Access metadata
console.log('Total components:', result.metadata.componentCount);
console.log('Hydrated components:', result.metadata.hydratedComponentCount);
```

## Backward Compatibility

The old `SDUIRenderer` component still works! You can migrate gradually:

```tsx
// Old code still works
<SDUIRenderer schema={schema} />

// New code can coexist
const result = renderPage(schema);
return result.element;
```

## Testing Changes

### Old Tests

```tsx
import { render } from '@testing-library/react';
import { SDUIRenderer } from './sdui';

it('renders page', () => {
  const { getByTestId } = render(
    <SDUIRenderer schema={testSchema} />
  );
  expect(getByTestId('sdui-renderer')).toBeInTheDocument();
});
```

### New Tests

```tsx
import { render } from '@testing-library/react';
import { renderPage } from './sdui';

it('renders page', () => {
  const result = renderPage(testSchema);
  const { getByTestId } = render(result.element);
  expect(getByTestId('sdui-page-renderer')).toBeInTheDocument();
});
```

## Common Issues

### Issue 1: "Cannot read property 'element' of undefined"

**Cause**: Forgot to access `.element` property

**Solution**:
```tsx
// Wrong
return renderPage(schema);

// Correct
const result = renderPage(schema);
return result.element;
```

### Issue 2: Validation errors not showing

**Cause**: Not catching the thrown error

**Solution**:
```tsx
try {
  const result = renderPage(schema);
  return result.element;
} catch (error) {
  if (error instanceof SDUIValidationError) {
    return <ErrorDisplay errors={error.errors} />;
  }
  throw error;
}
```

### Issue 3: Components not hydrating

**Cause**: Missing `hydrateWith` in component definition

**Solution**:
```tsx
{
  type: 'component',
  component: 'MyComponent',
  version: 1,
  props: { title: 'Test' },
  hydrateWith: ['/api/data'], // Add this
}
```

## Checklist

Use this checklist when migrating:

- [ ] Update imports from `SDUIRenderer` to `renderPage`
- [ ] Replace component usage with function call
- [ ] Update prop names to option names
- [ ] Access `.element` property from result
- [ ] Add error handling (try/catch)
- [ ] Consider adding data hydration
- [ ] Add fallback components for critical data
- [ ] Update tests
- [ ] Test in development mode
- [ ] Test error scenarios
- [ ] Monitor performance
- [ ] Update documentation

## Getting Help

- **Quick Start**: See `QUICKSTART.md`
- **Full Documentation**: See `README.md`
- **Examples**: See `examples/renderPageExamples.tsx`
- **Tests**: See `__tests__/renderPage.test.tsx`

## Timeline Recommendation

### Phase 1: Learn (Week 1)
- Read documentation
- Review examples
- Try in development environment

### Phase 2: Pilot (Week 2)
- Migrate one non-critical page
- Test thoroughly
- Gather feedback

### Phase 3: Rollout (Weeks 3-4)
- Migrate remaining pages
- Update tests
- Monitor performance

### Phase 4: Optimize (Week 5+)
- Add data hydration where beneficial
- Implement custom fetchers
- Optimize performance
- Remove old code

## Summary

The migration from `SDUIRenderer` to `renderPage()` is straightforward:

1. Change import
2. Replace component with function call
3. Access `.element` property
4. Update prop names
5. Add error handling

The new function provides more features and better performance while maintaining backward compatibility.

Happy migrating! 🚀

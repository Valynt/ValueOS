# SDUI Runtime Engine - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Server-Driven UI System                      │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Server Page Definition                        │
│  { type: 'page', version: 1, sections: [...] }                  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      renderPage() Function                       │
│                    (src/sdui/renderPage.tsx)                     │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
        ┌───────────────────┐     ┌──────────────────┐
        │ Schema Validation │     │  Error Handling  │
        │   (Zod Schemas)   │     │  (Try/Catch)     │
        └───────────────────┘     └──────────────────┘
                    │
                    ▼
        ┌───────────────────────────────┐
        │    Component Resolution       │
        │  (Registry Lookup by Name)    │
        └───────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────┐
        │    Data Hydration Check       │
        │  (hydrateWith present?)       │
        └───────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────┐        ┌──────────────────┐
│  No Hydration│        │  With Hydration  │
│  Render Now  │        │  Fetch Data First│
└──────────────┘        └──────────────────┘
        │                       │
        │                       ▼
        │           ┌───────────────────────┐
        │           │  useDataHydration()   │
        │           │  - Parallel Fetch     │
        │           │  - Retry Logic        │
        │           │  - Timeout Protection │
        │           │  - Caching            │
        │           └───────────────────────┘
        │                       │
        └───────────┬───────────┘
                    ▼
        ┌───────────────────────────────┐
        │   ComponentErrorBoundary      │
        │   (Isolate Component Errors)  │
        └───────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────┐
        │    Render Component           │
        │    (React Element)            │
        └───────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────┐
        │    Return Result              │
        │    { element, warnings,       │
        │      metadata }                │
        └───────────────────────────────┘
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         renderPage()                             │
│  Entry point for SDUI rendering                                 │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PageRenderer                                │
│  React component that orchestrates page rendering               │
│  - Manages render context                                       │
│  - Handles warnings display                                     │
│  - Coordinates section rendering                                │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SectionRenderer (per section)                 │
│  Renders individual component sections                          │
│  - Resolves component from registry                             │
│  - Triggers data hydration                                      │
│  - Handles loading states                                       │
│  - Manages error boundaries                                     │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
        ┌───────────────────┐     ┌──────────────────┐
        │ useDataHydration  │     │ Error Boundaries │
        │ - Fetch data      │     │ - Catch errors   │
        │ - Merge props     │     │ - Show fallbacks │
        │ - Cache results   │     │ - Log errors     │
        └───────────────────┘     └──────────────────┘
                    │
                    ▼
        ┌───────────────────────────────┐
        │    Actual Component           │
        │    (from Registry)            │
        └───────────────────────────────┘
```

## Data Flow

```
Server Definition
        │
        ▼
┌───────────────┐
│  Validation   │ ──────► Errors? ──► Throw SDUIValidationError
└───────────────┘              │
        │                      No
        ▼                      │
┌───────────────┐              │
│  Normalize    │ ◄────────────┘
│  - Versions   │
│  - Props      │
└───────────────┘
        │
        ▼
┌───────────────┐
│  For Each     │
│  Section      │
└───────────────┘
        │
        ▼
┌───────────────┐
│  Resolve      │ ──────► Not Found? ──► Show UnknownComponentFallback
│  Component    │              │
└───────────────┘              No
        │                      │
        ▼                      │
┌───────────────┐              │
│  Hydration?   │ ◄────────────┘
└───────────────┘
        │
    Yes │ No
        │  │
        │  └──────────────────┐
        ▼                     │
┌───────────────┐             │
│  Fetch Data   │             │
│  - Parallel   │             │
│  - Retry      │             │
│  - Timeout    │             │
│  - Cache      │             │
└───────────────┘             │
        │                     │
        ▼                     │
┌───────────────┐             │
│  Merge Props  │             │
└───────────────┘             │
        │                     │
        └──────────┬──────────┘
                   ▼
        ┌───────────────────┐
        │  Render Component │
        └───────────────────┘
                   │
                   ▼
        ┌───────────────────┐
        │  Return Element   │
        └───────────────────┘
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Error Handling Layers                        │
└─────────────────────────────────────────────────────────────────┘

Layer 1: Validation
┌─────────────────────────────────────────────────────────────────┐
│  validateSDUISchema()                                            │
│  - Checks page structure                                        │
│  - Validates component sections                                 │
│  - Returns errors or validated page                             │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼ (if invalid)
┌─────────────────────────────────────────────────────────────────┐
│  Throw SDUIValidationError                                       │
│  - Contains array of error messages                             │
│  - Caught by caller                                             │
└─────────────────────────────────────────────────────────────────┘

Layer 2: Page-Level Errors
┌─────────────────────────────────────────────────────────────────┐
│  ErrorBoundary (Page Level)                                      │
│  - Catches fatal rendering errors                               │
│  - Shows full-page error UI                                     │
│  - Logs to error tracking                                       │
└─────────────────────────────────────────────────────────────────┘

Layer 3: Component-Level Errors
┌─────────────────────────────────────────────────────────────────┐
│  ComponentErrorBoundary (Per Component)                          │
│  - Isolates component errors                                    │
│  - Shows component-specific fallback                            │
│  - Allows retry                                                 │
│  - Logs component errors                                        │
└─────────────────────────────────────────────────────────────────┘

Layer 4: Hydration Errors
┌─────────────────────────────────────────────────────────────────┐
│  useDataHydration Error Handling                                 │
│  - Catches network errors                                       │
│  - Implements retry logic                                       │
│  - Uses fallback components                                     │
│  - Shows loading states                                         │
└─────────────────────────────────────────────────────────────────┘

Layer 5: Unknown Components
┌─────────────────────────────────────────────────────────────────┐
│  UnknownComponentFallback                                        │
│  - Shows when component not in registry                         │
│  - Graceful degradation                                         │
│  - Doesn't break page                                           │
└─────────────────────────────────────────────────────────────────┘
```

## Hydration System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    useDataHydration Hook                         │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  Check if enabled      │
                    │  Check endpoints array │
                    └────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  For each endpoint:    │
                    │  1. Check cache        │
                    │  2. Create controller  │
                    │  3. Set timeout        │
                    └────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  Fetch in parallel     │
                    │  (Promise.allSettled)  │
                    └────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
        ┌───────────────────┐     ┌──────────────────┐
        │  Success          │     │  Failure         │
        │  - Cache result   │     │  - Retry?        │
        │  - Merge data     │     │  - Fallback?     │
        │  - Call onSuccess │     │  - Call onError  │
        └───────────────────┘     └──────────────────┘
                    │                         │
                    └────────────┬────────────┘
                                 ▼
                    ┌────────────────────────┐
                    │  Return:               │
                    │  - data                │
                    │  - loading             │
                    │  - error               │
                    │  - retry()             │
                    │  - clearCache()        │
                    └────────────────────────┘
```

## Registry System

```
┌─────────────────────────────────────────────────────────────────┐
│                      Component Registry                          │
│                    (Map<string, RegistryEntry>)                  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
        ┌───────────────────┐     ┌──────────────────┐
        │  Base Registry    │     │  Dynamic Registry│
        │  (Built-in)       │     │  (Runtime)       │
        │  - InfoBanner     │     │  - Custom comps  │
        │  - DiscoveryCard  │     │  - Hot-swapped   │
        │  - ValueTreeCard  │     │  - Registered    │
        │  - ExpansionBlock │     │    at runtime    │
        └───────────────────┘     └──────────────────┘
                    │
                    ▼
        ┌───────────────────────────────┐
        │  Registry Entry:              │
        │  {                            │
        │    component: React.Component │
        │    versions: [1, 2]           │
        │    requiredProps: [...]       │
        │    description: "..."         │
        │  }                            │
        └───────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────┐
        │  Resolution:                  │
        │  1. Lookup by name            │
        │  2. Check version support     │
        │  3. Validate props            │
        │  4. Return component          │
        └───────────────────────────────┘
```

## Performance Optimization

```
┌─────────────────────────────────────────────────────────────────┐
│                    Performance Strategies                        │
└─────────────────────────────────────────────────────────────────┘

1. Validation Layer
┌─────────────────────────────────────────────────────────────────┐
│  - useMemo for validation result                                │
│  - Only re-validate when schema changes                         │
│  - Fast Zod schema parsing                                      │
└─────────────────────────────────────────────────────────────────┘

2. Component Resolution
┌─────────────────────────────────────────────────────────────────┐
│  - O(1) Map lookup                                              │
│  - No array iteration                                           │
│  - Cached registry entries                                      │
└─────────────────────────────────────────────────────────────────┘

3. Data Hydration
┌─────────────────────────────────────────────────────────────────┐
│  - Parallel fetching (Promise.allSettled)                       │
│  - Request deduplication                                        │
│  - Response caching with TTL                                    │
│  - Abort on unmount (no memory leaks)                           │
└─────────────────────────────────────────────────────────────────┘

4. Rendering
┌─────────────────────────────────────────────────────────────────┐
│  - React.memo for expensive components                          │
│  - Efficient re-render strategies                               │
│  - Lazy loading support                                         │
│  - Virtual scrolling ready                                      │
└─────────────────────────────────────────────────────────────────┘

5. Error Handling
┌─────────────────────────────────────────────────────────────────┐
│  - Error boundaries prevent full re-renders                     │
│  - Isolated component failures                                  │
│  - Graceful degradation                                         │
└─────────────────────────────────────────────────────────────────┘
```

## State Management

```
┌─────────────────────────────────────────────────────────────────┐
│                         State Flow                               │
└─────────────────────────────────────────────────────────────────┘

renderPage() Function (Stateless)
        │
        ▼
PageRenderer Component
        │
        ├─► RenderPageContext (Options)
        │
        └─► For each section:
                │
                ▼
            SectionRenderer Component
                │
                ├─► useDataHydration Hook
                │       │
                │       ├─► data (state)
                │       ├─► loading (state)
                │       ├─► error (state)
                │       └─► retryCount (state)
                │
                └─► ComponentErrorBoundary
                        │
                        ├─► hasError (state)
                        ├─► error (state)
                        └─► errorInfo (state)
```

## Cache Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Hydration Cache                               │
│              Map<endpoint, CacheEntry>                           │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
        ┌───────────────────┐     ┌──────────────────┐
        │  Cache Entry      │     │  Cache Policy    │
        │  {                │     │  - TTL: 5 min    │
        │    data: any      │     │  - LRU eviction  │
        │    timestamp: ms  │     │  - Manual clear  │
        │  }                │     │  - Per-endpoint  │
        └───────────────────┘     └──────────────────┘
                    │
                    ▼
        ┌───────────────────────────────┐
        │  Cache Operations:            │
        │  - get(endpoint)              │
        │  - set(endpoint, data)        │
        │  - isValid(entry, ttl)        │
        │  - clear(endpoint)            │
        │  - clearAll()                 │
        │  - getStats()                 │
        └───────────────────────────────┘
```

## Type System

```
┌─────────────────────────────────────────────────────────────────┐
│                      Type Hierarchy                              │
└─────────────────────────────────────────────────────────────────┘

SDUIPageDefinition (Zod Schema)
        │
        ├─► type: 'page'
        ├─► version: number
        ├─► sections: SDUIComponentSection[]
        └─► metadata?: { debug?, cacheTtl?, experienceId? }

SDUIComponentSection (Zod Schema)
        │
        ├─► type: 'component'
        ├─► component: string
        ├─► version: number
        ├─► props: Record<string, any>
        ├─► hydrateWith?: string[]
        └─► fallback?: { message?, component?, props? }

RenderPageOptions (TypeScript)
        │
        ├─► debug?: boolean
        ├─► Error Handlers (4 callbacks)
        ├─► Custom Components (3 components)
        ├─► Hydration Config (6 options)
        └─► Callbacks (2 callbacks)

RenderPageResult (TypeScript)
        │
        ├─► element: ReactElement
        ├─► warnings: string[]
        └─► metadata: { componentCount, hydratedComponentCount, version }
```

## Execution Timeline

```
Time →

0ms     │ renderPage() called
        │
1ms     │ Schema validation starts
        │ └─► Zod parsing
        │
2ms     │ Validation complete
        │ └─► Normalized page definition
        │
3ms     │ PageRenderer component created
        │ └─► Context provider setup
        │
4ms     │ First SectionRenderer starts
        │ ├─► Component resolution (O(1))
        │ └─► Check for hydration
        │
5ms     │ Hydration detected
        │ └─► useDataHydration hook triggered
        │
6ms     │ Parallel fetch starts
        │ ├─► Endpoint 1: /api/user
        │ ├─► Endpoint 2: /api/settings
        │ └─► Endpoint 3: /api/preferences
        │
...     │ (Network time)
        │
150ms   │ First response received
        │ └─► Cache updated
        │
200ms   │ All responses received
        │ └─► Data merged
        │
201ms   │ Component props updated
        │ └─► Re-render triggered
        │
202ms   │ Component rendered
        │ └─► Success callback fired
        │
203ms   │ Next section starts
        │ └─► Repeat process
        │
...     │
        │
250ms   │ All sections rendered
        │ └─► Page complete
        │
251ms   │ Return result to caller
        │ └─► { element, warnings, metadata }
```

## Security Considerations

```
┌─────────────────────────────────────────────────────────────────┐
│                      Security Layers                             │
└─────────────────────────────────────────────────────────────────┘

1. Input Validation
┌─────────────────────────────────────────────────────────────────┐
│  - Zod schema validation                                        │
│  - Type checking                                                │
│  - Sanitize props                                               │
│  - Validate endpoints                                           │
└─────────────────────────────────────────────────────────────────┘

2. Component Isolation
┌─────────────────────────────────────────────────────────────────┐
│  - Error boundaries prevent cascade failures                    │
│  - Registry whitelist (only registered components)              │
│  - Props sanitization                                           │
└─────────────────────────────────────────────────────────────────┘

3. Network Security
┌─────────────────────────────────────────────────────────────────┐
│  - Custom fetcher for auth headers                              │
│  - HTTPS enforcement                                            │
│  - Timeout protection                                           │
│  - Abort controllers                                            │
└─────────────────────────────────────────────────────────────────┘

4. XSS Prevention
┌─────────────────────────────────────────────────────────────────┐
│  - React's built-in XSS protection                              │
│  - DOMPurify for user content (if needed)                       │
│  - No dangerouslySetInnerHTML                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

This architecture provides a robust, scalable, and maintainable foundation for server-driven UI in the ValueCanvas application.

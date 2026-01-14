# Fix Undefined l2Ttl Variable in AgentCache.set Method

Add the missing definition of `l2Ttl` variable in the `set` method of AgentCache to prevent runtime ReferenceError when L2 caching is enabled.

## Current Issue

In `AgentCache.ts` lines 208-210, the variable `l2Ttl` is used but never defined, causing a ReferenceError when attempting to set values in Redis cache.

## Proposed Solution

Define `l2Ttl` similar to how `ttl` is defined for L1 cache:

```typescript
const l2Ttl = options.ttl || this.config.l2DefaultTtl;
```

This should be added before the L2 cache logic (around line 205).

## Impact

- Fixes runtime error when L2 caching is enabled
- Ensures consistent TTL handling between L1 and L2 caches
- No breaking changes to existing API

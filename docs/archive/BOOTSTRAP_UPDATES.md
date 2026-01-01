# Bootstrap.ts Update Instructions

## Manual Updates Required

Due to file encoding issues, these updates must be applied manually to `src/bootstrap.ts`.

---

## Update 1: Sentry Initialization (Line ~243)

### Find this code:
```typescript
    try {
      // TODO: Initialize Sentry
      // await initializeSentry(config.monitoring.sentry);
      logger.info("   ⚠️  Sentry initialization not implemented yet");
      warnings.push("Sentry initialization not implemented");
      onWarning?.("Sentry initialization not implemented");
    }
```

### Replace with:
```typescript
    try {
      // Initialize Sentry with PII protection
      const { initializeSentry } = await import('./lib/sentry');
      initializeSentry();
      logger.info("   ✅ Sentry error tracking initialized");
    }
```

---

## Update 2: Database Connection Check (Line ~355)

### Find this code:
```typescript
  // Step 7: Verify database connection
  onProgress?.("Verifying database connection...");
  logger.info("\n🗄️  Step 7: Database Connection");
  try {
    // TODO: Check database connection
    // await checkDatabaseConnection();
    logger.info("   ⚠️  Database connection check not implemented yet");
    warnings.push("Database connection check not implemented");
    onWarning?.("Database connection check not implemented");
  }
```

### Replace with:
```typescript
  // Step 7: Verify database connection
  onProgress?.("Verifying database connection...");
  logger.info("\n🗄️  Step 7: Database Connection");
  try {
    // Check database connection with retry logic
    const { checkDatabaseConnection } = await import('./lib/database');
    const dbHealth = await checkDatabaseConnection();
    
    if (dbHealth.connected) {
      logger.info(`   ✅ Database connection verified (${dbHealth.latency}ms)`);
    } else {
      const errorMsg = `Database connection failed: ${dbHealth.error || 'Unknown error'}`;
      errors.push(errorMsg);
      onError?.(errorMsg);
      logger.error(`   ❌ ${errorMsg}`);
      
      if (failFast) {
        return {
          success: false,
          config,
          errors,
          warnings,
          duration: Date.now() - startTime,
        };
      }
    }
  }
```

---

## Update 3: Redis Cache Initialization (Line ~375)

### Find this code:
```typescript
  // Step 8: Initialize cache
  if (config.cache.enabled) {
    onProgress?.("Initializing cache...");
    logger.info("\n💾 Step 8: Cache Initialization");
    try {
      // TODO: Initialize Redis cache
      // await initializeCache(config.cache);
      logger.info("   ⚠️  Cache initialization not implemented yet");
      warnings.push("Cache initialization not implemented");
      onWarning?.("Cache initialization not implemented");
    }
  }
```

### Replace with:
```typescript
  // Step 8: Initialize cache
  if (config.cache.enabled) {
    onProgress?.("Initializing cache...");
    logger.info("\n💾 Step 8: Cache Initialization");
    try {
      // Initialize Redis cache with graceful degradation
      const { initializeRedisCache } = await import('./lib/redis');
      const cacheHealth = await initializeRedisCache(config.cache);
      
      if (cacheHealth.connected) {
        logger.info(`   ✅ Redis cache initialized (${cacheHealth.latency}ms)`);
      } else {
        logger.warn(`   ⚠️  Redis cache unavailable - continuing without cache`);
        warnings.push('Redis cache unavailable');
        onWarning?.('Redis cache unavailable');
      }
    } catch (error) {
      const errorMsg = `Cache initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      warnings.push(errorMsg);
      onWarning?.(errorMsg);
      logger.warn(`   ⚠️  ${errorMsg} - continuing without cache`);
    }
  } else {
    logger.info("\n💾 Step 8: Cache disabled");
  }
```

---

## Verification

After making these changes:

1. Run type check:
```bash
npm run typecheck
```

2. Test the bootstrap:
```bash
npm run dev
```

3. Check logs for:
- ✅ Sentry error tracking initialized
- ✅ Database connection verified
- ✅ Redis cache initialized (or warning if unavailable)

---

## Alternative: Use sed commands

If you prefer automated updates (Linux/Mac only):

```bash
# Backup first
cp src/bootstrap.ts src/bootstrap.ts.backup

# These commands would need to be customized based on exact line numbers
# Not recommended due to encoding issues
```

---

## Next Steps

After updating bootstrap.ts, proceed to Phase 2 (Security implementations).

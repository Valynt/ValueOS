# Login Screen Performance Analysis

**Date**: January 5, 2026  
**Issue**: Login screen takes forever to load  
**Status**: 🔴 **CRITICAL** - Multiple blocking operations

---

## Root Causes Identified

### 🔴 1. **7 Font Files Loaded Synchronously** (CRITICAL)

**Location**: `src/main.tsx` lines 11-17

**Issue**: Loading 7 font files synchronously blocks rendering:

```typescript
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
```

**Impact**: 
- Each font file is ~50-100KB
- Total: ~500KB of fonts loaded before anything renders
- Blocks initial render completely
- **Estimated delay: 2-5 seconds on slow connections**

---

### 🔴 2. **8-Step Bootstrap Sequence** (CRITICAL)

**Location**: `src/bootstrap.ts` (460 lines)

**Issue**: Complex 8-step initialization runs before showing login screen:

1. **Load environment configuration**
2. **Validate configuration**
3. **Check feature flags**
4. **Initialize security**
5. **Initialize monitoring (Sentry)**
6. **Initialize Agent Fabric** (with 5-30 second timeout!)
7. **Database connection check**
8. **Cache initialization**

**Impact**:
- Agent Fabric initialization: **5-30 seconds timeout**
- Database connection: **retry with exponential backoff**
- Total bootstrap time: **10-45 seconds** depending on network
- **All of this happens before the login screen appears!**

**Code**:
```typescript
// Step 6: Initialize Agent Fabric (with timeout to prevent blocking)
const timeoutPromise = new Promise<SystemHealth>((_, reject) => {
  setTimeout(() => {
    reject(
      new Error(`Agent health check timed out after ${agentCheckTimeout}ms`)
    );
  }, agentCheckTimeout); // 5000ms in dev, 30000ms in production!
});

agentHealth = await Promise.race([
  initializeAgents({
    healthCheckTimeout: Math.min(2000, agentCheckTimeout / 4),
    failFast: false,
    retryAttempts: isDevelopment() ? 1 : 3,
    retryDelay: 500,
    // ...
  }),
  timeoutPromise,
]);
```

---

### 🟡 3. **Heavy Imports in AuthContext** (MEDIUM)

**Location**: `src/contexts/AuthContext.tsx`

**Issue**: AuthContext imports multiple heavy dependencies:

```typescript
import { analyticsClient } from "../lib/analyticsClient";
import { secureTokenManager } from "../lib/auth/SecureTokenManager";
import { createLogger } from "../lib/logger";
import { UserClaims, computePermissions } from "../types/security";
```

**Impact**:
- Each import loads its dependencies
- Analytics client may make network calls
- Logger initializes monitoring
- **Estimated delay: 500ms-1s**

---

### 🟡 4. **Session Management Overhead** (MEDIUM)

**Location**: `src/contexts/AuthContext.tsx` lines 28-95

**Issue**: Complex session management with rotation and validation:

```typescript
class SecureSessionManager {
  private static readonly SESSION_KEY = "vc_session_v2";
  private static readonly MAX_SESSION_AGE = 8 * 60 * 60 * 1000; // 8 hours
  private static readonly ROTATION_INTERVAL = 15 * 60 * 1000; // 15 minutes

  static getSession(): Session | null {
    // Complex validation logic
    // Session age check
    // Rotation check
    // Multiple try-catch blocks
  }
}
```

**Impact**:
- Runs on every auth context initialization
- Multiple localStorage/sessionStorage reads
- **Estimated delay: 100-200ms**

---

## Performance Metrics

### Current State (Estimated)

| Operation | Time | Blocking |
|-----------|------|----------|
| **Font Loading** | 2-5s | ✅ Yes |
| **Bootstrap Step 1-3** | 100-500ms | ✅ Yes |
| **Bootstrap Step 4 (Security)** | 200-500ms | ✅ Yes |
| **Bootstrap Step 5 (Monitoring)** | 500ms-1s | ✅ Yes |
| **Bootstrap Step 6 (Agents)** | 5-30s | ✅ Yes |
| **Bootstrap Step 7 (Database)** | 1-5s | ✅ Yes |
| **Bootstrap Step 8 (Cache)** | 100-500ms | ✅ Yes |
| **AuthContext Init** | 500ms-1s | ✅ Yes |
| **Total** | **10-45s** | ✅ Yes |

### Target State

| Operation | Time | Blocking |
|-----------|------|----------|
| **Critical CSS** | 50-100ms | ✅ Yes |
| **Login Screen Render** | 100-200ms | ✅ Yes |
| **Font Loading** | 1-2s | ❌ No (async) |
| **Background Init** | 2-5s | ❌ No (async) |
| **Total to Interactive** | **150-300ms** | - |

---

## Recommended Fixes

### 🔴 Priority 1: Defer Font Loading (IMMEDIATE)

**Impact**: Reduce initial load by 2-5 seconds

**Solution**: Use `font-display: swap` and load fonts asynchronously

```typescript
// src/main.tsx - REMOVE synchronous imports
// ❌ DELETE THESE:
// import "@fontsource/inter/400.css";
// import "@fontsource/inter/500.css";
// ... etc

// ✅ ADD THIS instead:
// Load fonts asynchronously after initial render
const loadFonts = async () => {
  const fonts = [
    () => import("@fontsource/inter/400.css"),
    () => import("@fontsource/inter/500.css"),
    () => import("@fontsource/inter/600.css"),
    () => import("@fontsource/inter/700.css"),
    () => import("@fontsource/jetbrains-mono/400.css"),
    () => import("@fontsource/jetbrains-mono/500.css"),
    () => import("@fontsource/jetbrains-mono/600.css"),
  ];

  // Load fonts in parallel after initial render
  Promise.all(fonts.map(f => f())).catch(console.error);
};

// Call after React renders
setTimeout(loadFonts, 0);
```

**Alternative**: Use system fonts for initial render:

```css
/* index.css */
body {
  font-family: 
    /* System fonts for instant render */
    -apple-system, BlinkMacSystemFont, 
    "Segoe UI", "Roboto", "Oxygen",
    "Ubuntu", "Cantarell", "Fira Sans",
    "Droid Sans", "Helvetica Neue", sans-serif;
}

/* Load custom fonts asynchronously */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-400.woff2') format('woff2');
  font-weight: 400;
  font-display: swap; /* Show fallback immediately */
}
```

---

### 🔴 Priority 2: Defer Bootstrap Sequence (IMMEDIATE)

**Impact**: Reduce initial load by 10-45 seconds

**Solution**: Only run critical checks before login, defer the rest

```typescript
// src/bootstrap.ts - Add "minimal" mode
export interface BootstrapOptions {
  /**
   * Minimal mode: Only run critical checks for login screen
   * @default false
   */
  minimal?: boolean;
  // ... existing options
}

export async function bootstrap(options: BootstrapOptions = {}): Promise<BootstrapResult> {
  const { minimal = false } = options;

  if (minimal) {
    // MINIMAL MODE: Only what's needed for login
    // Step 1: Load config (required)
    // Step 2: Validate config (required)
    // Step 3: Feature flags (required)
    // Step 4: Basic security (required)
    // SKIP: Monitoring, Agent Fabric, Database, Cache
    
    return {
      success: true,
      config,
      errors: [],
      warnings: ['Running in minimal mode - full bootstrap deferred'],
      duration: Date.now() - startTime,
    };
  }

  // FULL MODE: Run all steps (after login)
  // ... existing code
}
```

**Usage**:

```typescript
// src/components/Common/BootstrapGuard.tsx
useEffect(() => {
  if (!hasStarted.current) {
    hasStarted.current = true;
    
    // Start with minimal bootstrap for fast login
    startBootstrap({ minimal: true }).catch(() => {
      // Errors handled by hook
    });
  }
}, [startBootstrap]);

// After successful login, run full bootstrap
const handleLoginSuccess = async () => {
  // User is logged in, now run full bootstrap in background
  bootstrap({ minimal: false }).catch(console.error);
};
```

---

### 🔴 Priority 3: Lazy Load AuthContext Dependencies (HIGH)

**Impact**: Reduce initial load by 500ms-1s

**Solution**: Lazy load heavy dependencies

```typescript
// src/contexts/AuthContext.tsx
import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { AuthService, AuthSession, LoginCredentials, SignupData } from "../services/AuthService";

// ✅ Lazy load heavy dependencies
const loadDependencies = async () => {
  const [
    { createLogger },
    { UserClaims, computePermissions },
    { analyticsClient },
    { secureTokenManager }
  ] = await Promise.all([
    import("../lib/logger"),
    import("../types/security"),
    import("../lib/analyticsClient"),
    import("../lib/auth/SecureTokenManager")
  ]);

  return { createLogger, UserClaims, computePermissions, analyticsClient, secureTokenManager };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [depsLoaded, setDepsLoaded] = useState(false);

  // Load dependencies asynchronously
  useEffect(() => {
    loadDependencies().then(() => {
      setDepsLoaded(true);
    });
  }, []);

  // ... rest of code
}
```

---

### 🟡 Priority 4: Optimize Session Management (MEDIUM)

**Impact**: Reduce initial load by 100-200ms

**Solution**: Simplify session validation

```typescript
// src/contexts/AuthContext.tsx
class SecureSessionManager {
  static getSession(): Session | null {
    try {
      const stored = sessionStorage.getItem(this.SESSION_KEY);
      if (!stored) return null;

      const sessionData = JSON.parse(stored);
      
      // ✅ Simple age check only
      if (Date.now() - sessionData.storedAt > this.MAX_SESSION_AGE) {
        this.clearSession();
        return null;
      }

      // ❌ REMOVE: Complex rotation logic (do this in background)
      // ❌ REMOVE: Multiple validation checks
      
      return sessionData;
    } catch {
      this.clearSession();
      return null;
    }
  }
}
```

---

### 🟢 Priority 5: Add Performance Monitoring (LOW)

**Impact**: Helps identify future issues

**Solution**: Add performance marks

```typescript
// src/main.tsx
function main() {
  performance.mark('app-start');
  
  // ... initialization
  
  performance.mark('app-render');
  performance.measure('app-init', 'app-start', 'app-render');
  
  const initTime = performance.getEntriesByName('app-init')[0].duration;
  console.log(`App initialized in ${initTime}ms`);
}
```

---

## Implementation Plan

### Phase 1: Quick Wins (1-2 days)

1. ✅ **Defer font loading** - Move to async
2. ✅ **Add minimal bootstrap mode** - Skip non-critical steps
3. ✅ **Update BootstrapGuard** - Use minimal mode for login

**Expected Result**: Login screen loads in **150-300ms** instead of 10-45s

### Phase 2: Optimization (3-5 days)

4. ✅ **Lazy load AuthContext dependencies**
5. ✅ **Simplify session management**
6. ✅ **Add performance monitoring**

**Expected Result**: Further reduce to **100-200ms**

### Phase 3: Full Bootstrap After Login (1 week)

7. ✅ **Run full bootstrap after login**
8. ✅ **Show progress indicator during full bootstrap**
9. ✅ **Handle bootstrap failures gracefully**

**Expected Result**: User can log in immediately, full features load in background

---

## Code Changes Required

### File 1: `src/main.tsx`

```diff
- import "@fontsource/inter/400.css";
- import "@fontsource/inter/500.css";
- import "@fontsource/inter/600.css";
- import "@fontsource/inter/700.css";
- import "@fontsource/jetbrains-mono/400.css";
- import "@fontsource/jetbrains-mono/500.css";
- import "@fontsource/jetbrains-mono/600.css";

+ // Load fonts asynchronously after initial render
+ const loadFonts = async () => {
+   const fonts = [
+     () => import("@fontsource/inter/400.css"),
+     () => import("@fontsource/inter/500.css"),
+     () => import("@fontsource/inter/600.css"),
+     () => import("@fontsource/inter/700.css"),
+     () => import("@fontsource/jetbrains-mono/400.css"),
+     () => import("@fontsource/jetbrains-mono/500.css"),
+     () => import("@fontsource/jetbrains-mono/600.css"),
+   ];
+   Promise.all(fonts.map(f => f())).catch(console.error);
+ };

  function main() {
    // ... existing code
    
    root.render(
      <StrictMode>
        <BootstrapGuard>
          <AppRoutes />
        </BootstrapGuard>
      </StrictMode>
    );

+   // Load fonts after render
+   setTimeout(loadFonts, 0);
  }
```

### File 2: `src/bootstrap.ts`

```diff
  export interface BootstrapOptions {
+   /**
+    * Minimal mode: Only run critical checks for login screen
+    * @default false
+    */
+   minimal?: boolean;
    // ... existing options
  }

  export async function bootstrap(options: BootstrapOptions = {}): Promise<BootstrapResult> {
+   const { minimal = false } = options;
+
+   if (minimal) {
+     // Only run critical steps
+     const config = getConfig();
+     const configErrors = validateEnvironmentConfig(config);
+     
+     return {
+       success: configErrors.length === 0,
+       config,
+       errors: configErrors,
+       warnings: ['Running in minimal mode'],
+       duration: Date.now() - startTime,
+     };
+   }

    // ... existing full bootstrap code
  }
```

### File 3: `src/components/Common/BootstrapGuard.tsx`

```diff
  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
-     startBootstrap().catch(() => {
+     startBootstrap({ minimal: true }).catch(() => {
        // Errors are handled by the hook's state
      });
    }
  }, [startBootstrap]);
```

### File 4: `src/index.css`

```diff
+ /* Use system fonts for instant render */
  body {
-   font-family: 'Inter', sans-serif;
+   font-family: 
+     -apple-system, BlinkMacSystemFont, 
+     "Segoe UI", "Roboto", "Oxygen",
+     "Ubuntu", "Cantarell", "Fira Sans",
+     "Droid Sans", "Helvetica Neue", sans-serif;
  }

+ /* Custom fonts will load asynchronously */
+ @font-face {
+   font-family: 'Inter';
+   src: url('/fonts/inter-400.woff2') format('woff2');
+   font-weight: 400;
+   font-display: swap;
+ }
```

---

## Testing Plan

### 1. Performance Testing

```bash
# Measure before changes
npm run build
npm run preview

# Open DevTools > Network > Throttle to "Slow 3G"
# Measure time to login screen

# Measure after changes
# Should see 10-45s reduced to 150-300ms
```

### 2. Functional Testing

- ✅ Login still works
- ✅ Session management still works
- ✅ Fonts load correctly (even if delayed)
- ✅ No console errors
- ✅ Full bootstrap runs after login

### 3. Edge Cases

- ✅ Slow network (3G)
- ✅ Offline mode
- ✅ Browser with disabled JavaScript
- ✅ Old browsers

---

## Success Metrics

### Before Optimization

- **Time to Login Screen**: 10-45 seconds
- **Time to Interactive**: 10-45 seconds
- **Blocking Operations**: 8 steps
- **Font Loading**: Synchronous (2-5s)

### After Optimization

- **Time to Login Screen**: 150-300ms ✅
- **Time to Interactive**: 150-300ms ✅
- **Blocking Operations**: 2-3 steps ✅
- **Font Loading**: Asynchronous (background) ✅

### Target Improvement

- **90-95% faster** initial load
- **User can log in immediately**
- **Full features load in background**

---

## Conclusion

The login screen slowness is caused by:

1. **7 synchronous font imports** (2-5s)
2. **8-step bootstrap sequence** (10-45s)
3. **Heavy AuthContext dependencies** (500ms-1s)

**Total delay: 10-45 seconds before login screen appears!**

By implementing the recommended fixes, we can reduce this to **150-300ms**, a **90-95% improvement**.

---

**Priority**: 🔴 **CRITICAL**  
**Effort**: 1-2 days for quick wins  
**Impact**: 90-95% faster login screen load

---

**Next Steps**:
1. Implement Phase 1 (defer fonts + minimal bootstrap)
2. Test on slow network
3. Measure improvement
4. Implement Phase 2 if needed

# Anti-Fragility Architecture

This document describes the "Beyond Graceful Degradation" features that make ValueOS development resilient to infrastructure failures.

## Overview

| Feature      | Standard                       | Beyond (Implemented)                    |
| ------------ | ------------------------------ | --------------------------------------- |
| Backend Down | Show "Degraded Mode" banner    | Auto-switch to MSW (Ghost Mode)         |
| Config       | .env baked at build time       | Runtime Injection (`window.__CONFIG__`) |
| Diagnostics  | Startup Screen                 | Persistent Dev HUD Overlay              |
| Resolution   | "Run this command in terminal" | "Fix It" Button in UI                   |

## Features

### 1. Ghost Mode (Auto-Mocking)

**Location:** `src/lib/startup/ghost-mode.ts`

When the backend is unreachable during startup, Ghost Mode automatically activates Mock Service Worker (MSW) to intercept network requests and return synthetic data.

**How it works:**

1. `StartupStatus` detects backend failure during dependency checks
2. Calls `shouldActivateGhostMode()` to verify backend is specifically down
3. Automatically calls `activateGhostMode()` which:
   - Dynamically imports MSW
   - Registers mock handlers from `src/mocks/handlers.ts`
   - Starts the service worker
4. Shows toast: "Backend unreachable. Switched to Ghost Mode (local mocks)"
5. All `/api/*` requests now return mock data

**Manual Control:**

```typescript
import {
  activateGhostMode,
  deactivateGhostMode,
  getGhostModeState,
} from "@/lib/startup";

// Activate manually
await activateGhostMode("Testing UI without backend");

// Check status
const state = getGhostModeState();
console.log(state.active, state.mockedEndpoints);

// Deactivate
await deactivateGhostMode();
```

**Mock Handlers:** `src/mocks/handlers.ts`

- `/api/health` - Returns ghost mode status
- `/api/user/me` - Mock user profile
- `/api/agents` - Mock agent list
- `/api/agents/:id/invoke` - Simulated agent responses
- `/api/settings` - Mock settings
- `/api/feature-flags` - Mock flags
- Catch-all returns 501 for unmocked endpoints

### 2. Dev HUD (Heads-Up Display)

**Location:** `src/components/dev/DevHUD.tsx`

A persistent, collapsible overlay in the corner of the app during development.

**Tabs:**

1. **🌐 Env** - Environment switching
   - Preset environments (Local, Staging, Mock)
   - Custom API URL input
   - Hot-swaps without reload

2. **🔐 Auth** - Authentication masquerade
   - Force login as test users (admin, user, guest)
   - Bypasses real auth by injecting fake JWT
   - Useful for testing role-based UI

3. **🚩 Flags** - Feature flag overrides
   - Toggle flags instantly
   - Persisted to localStorage
   - Dispatches `featureflags:changed` event

4. **🔧 Tools** - Developer utilities
   - Ghost Mode toggle
   - Nuke State (clear all storage)
   - Clear Console
   - Reload Page

5. **⚠️ Issues** - Smart remediation
   - Shows detected issues with "Fix It" buttons
   - Auto-refreshes every 30 seconds

**Activation:** Only renders in development mode (`isDevelopment()`)

### 3. Runtime Config Injection

**Location:** `src/lib/startup/runtime-config.ts`

Eliminates "wrong .env" issues by loading configuration at runtime instead of baking `VITE_*` variables at build time.

**Pattern:**

```
Build artifact (same everywhere)
       ↓
   index.html
       ↓
<script>window.__CONFIG__={...}</script>  ← Injected at deploy time
       ↓
   App reads window.__CONFIG__
```

**Usage:**

```typescript
import {
  getRuntimeConfig,
  getApiUrl,
  overrideRuntimeConfig,
} from "@/lib/startup";

// Get full config
const config = getRuntimeConfig();

// Get specific values
const apiUrl = getApiUrl();

// Override at runtime (Dev HUD uses this)
overrideRuntimeConfig({ api: "https://staging-api.example.com" });
```

**Build Integration:**

```bash
# Build and inject config for production
pnpm run build:prod

# Or manually inject after build
pnpm run build:inject-config -- --env staging
```

**Script:** `scripts/inject-runtime-config.js`

- Reads environment variables
- Generates `window.__CONFIG__` script
- Injects into `dist/index.html`

### 4. Smart Remediation

**Location:** `src/lib/startup/smart-remediation.ts`

Provides "Fix It" buttons for known failure scenarios instead of just reporting errors.

**Available Actions:**

| ID                  | Trigger                | Action                                                 |
| ------------------- | ---------------------- | ------------------------------------------------------ |
| `seed-database`     | DB connected but empty | Runs `pnpm run seed:demo`                              |
| `refresh-dev-token` | JWT expired            | Gets fresh dev token                                   |
| `run-migrations`    | Pending migrations     | Runs `pnpm run db:push`                                 |
| `clear-all-storage` | Always available       | Nukes localStorage, sessionStorage, IndexedDB, cookies |
| `restart-backend`   | Backend unresponsive   | Triggers server restart                                |
| `enable-ghost-mode` | Backend down           | Activates MSW mocking                                  |

**Backend Routes:** `src/backend/routes/dev.ts`

- `GET /api/dev/status` - Dev server status
- `GET /api/dev/db/status` - Database connection status
- `POST /api/dev/seed` - Run database seed
- `GET /api/dev/db/migrations/status` - Check pending migrations
- `POST /api/dev/db/migrations/run` - Apply migrations
- `POST /api/dev/auth/dev-token` - Get fake dev JWT
- `POST /api/dev/restart` - Trigger server restart
- `POST /api/dev/clear-cache` - Flush Redis cache

**Note:** Dev routes are disabled in production (`NODE_ENV=production`).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        main.tsx                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ RootErrorBoundary                                       ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │ StartupStatus                                       │││
│  │  │  - Checks dependencies                              │││
│  │  │  - Auto-activates Ghost Mode if backend down        │││
│  │  │  ┌─────────────────────────────────────────────────┐│││
│  │  │  │ BootstrapGuard → AppRoutes                      ││││
│  │  │  └─────────────────────────────────────────────────┘│││
│  │  └─────────────────────────────────────────────────────┘││
│  │  {isDevelopment() && <DevHUD />}  ← Persistent overlay  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Feature Flags (Dev HUD)

Override flags are stored in `localStorage` under `dev-feature-flag-overrides`.

Listen for changes:

```typescript
window.addEventListener("featureflags:changed", (e) => {
  console.log("Flags changed:", e.detail);
});
```

### Ghost Mode Events

```typescript
window.addEventListener("ghostmode:activated", (e) => {
  console.log("Ghost Mode on:", e.detail);
});

window.addEventListener("ghostmode:deactivated", () => {
  console.log("Ghost Mode off");
});
```

### Runtime Config Events

```typescript
window.addEventListener("config:changed", (e) => {
  console.log("Config changed:", e.detail);
});
```

## Adding New Mock Handlers

Edit `src/mocks/handlers.ts`:

```typescript
import { http, HttpResponse, delay } from "msw";

export const handlers = [
  // ... existing handlers

  http.get("/api/my-new-endpoint", () => {
    return HttpResponse.json({ data: "mock" });
  }),

  http.post("/api/my-new-endpoint", async ({ request }) => {
    await delay(200); // Simulate latency
    const body = await request.json();
    return HttpResponse.json({ received: body });
  }),
];
```

## Adding New Remediation Actions

Edit `src/lib/startup/smart-remediation.ts`:

```typescript
export const REMEDIATION_ACTIONS: RemediationAction[] = [
  // ... existing actions

  {
    id: "my-new-fix",
    label: "Fix Something",
    description: "Description shown in Dev HUD",
    icon: "🔧",
    severity: "warning",
    devOnly: true,
    condition: async () => {
      // Return true if this issue is detected
      return someConditionCheck();
    },
    action: async () => {
      // Perform the fix
      try {
        await doSomething();
        return { success: true, message: "Fixed!" };
      } catch (e) {
        return { success: false, message: e.message };
      }
    },
  },
];
```

## Troubleshooting

### Ghost Mode not activating

1. Check if MSW is installed: `pnpm list msw`
2. Verify `mockServiceWorker.js` exists in `public/`
3. Check browser console for MSW errors

### Dev HUD not showing

1. Verify `isDevelopment()` returns true
2. Check if `NODE_ENV` is set correctly
3. Look for React errors in console

### Runtime config not loading

1. Check if `window.__CONFIG__` exists in browser console
2. Verify `inject-runtime-config.js` ran during build
3. Check for script injection in `dist/index.html`

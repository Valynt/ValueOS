# Dev: Anti-Fragility & Resilience

## 1. Ghost Mode (Auto-Mocking)

Ghost Mode ensures the frontend remains functional even if the backend is down.

- **Trigger:** `StartupStatus` detects backend failure during dependency checks.
- **Action:** Automatically activates Mock Service Worker (MSW).
- **Handlers:** Located in `src/mocks/handlers.ts`, covering health, auth, agents, and settings.
- **Manual Control:** Toggleable via the Dev HUD or `activateGhostMode()` utility.

## 2. Dev HUD (Heads-Up Display)

A persistent overlay (`DevHUD.tsx`) available in development mode.

- **Env:** Hot-swap between Local, Staging, and Mock environments.
- **Auth:** Masquerade as `admin`, `user`, or `guest` by injecting fake JWTs.
- **Flags:** Toggle feature flags instantly (persisted to `localStorage`).
- **Issues:** Real-time detection of environment issues with "Fix It" buttons.

## 3. Runtime Config Injection

Eliminates build-time environment mismatches.

- **Pattern:** `index.html` contains a `<script>` tag that injects `window.__CONFIG__` at runtime.
- **Usage:** App reads config via `getRuntimeConfig()` instead of `import.meta.env`.
- **Benefit:** The same build artifact can be deployed to any environment by simply changing the injected script.

## 4. Smart Remediation

Provides actionable fixes for common development hurdles:

- **`seed-database`**: Runs `npm run seed:demo` if the DB is empty.
- **`run-migrations`**: Applies pending migrations via `pnpm run db:push`.
- **`refresh-dev-token`**: Obtains a fresh development JWT.
- **`enable-ghost-mode`**: Manually triggers MSW mocking.

## 5. Architecture

The `BootstrapGuard` and `StartupStatus` components orchestrate the anti-fragility flow, ensuring dependencies are checked before the app fully mounts.

---

**Last Updated:** 2026-01-28
**Related:** `src/lib/startup/`, `src/components/dev/DevHUD.tsx`

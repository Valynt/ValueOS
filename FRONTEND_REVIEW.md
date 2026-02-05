# Frontend Systems Lead Review

## 🎨 UI/UX Blockers
**Issues that slow down visual iteration or break the HMR loop.**

*   **[MISSING] Zero-Manual-Mock Automation:**
    *   While `msw` is listed in `devDependencies`, there is no evidence of a `setupWorker` or `setupServer` entry point being automatically seeded or started.
    *   **Impact:** Developers likely see empty states or loading spinners upon first launch, requiring manual data entry to see "real" UI.
    *   **Recommendation:** Implement a `postCreateCommand` script that runs a "seed" specifically for MSW handlers (e.g., generating a `src/mocks/db.json`) so the UI populates immediately.

*   **[MISSING] Visual Extension Hygiene:**
    *   The `.devcontainer/devcontainer.json` lacks essential visual debugging extensions.
    *   **Missing:** `usernamehw.errorlens` (instant visual feedback on type errors), `jock.svg` (SVG preview), and `kisstkondoros.vscode-gutter-preview` (image previews in code).
    *   **Impact:** Slower feedback loop for visual assets and linting errors.

*   **[MISSING] Headed Browser Support:**
    *   The `Dockerfile.optimized` is based on `mcr.microsoft.com/vscode/devcontainers/base:ubuntu-22.04` but lacks the necessary dependencies (GTK, ALSA, NSS, etc.) to run a "Headed" browser for Playwright/Cypress.
    *   **Impact:** Visual regression testing requires a separate environment or invisible "headless" debugging, which is painful for UI tuning.

## ⚡ Build Performance
**Improvements for faster npm install and faster container startup.**

*   **[PASS] Node_Modules Caching:**
    *   **Status:** ✅ Excellent.
    *   `Dockerfile.optimized` correctly uses `RUN --mount=type=cache` and copies `package.json`/`pnpm-lock.yaml` before the source code. This ensures fast rebuilds when only code changes.

*   **[PASS] HMR Port Forwarding:**
    *   **Status:** ✅ Excellent.
    *   `apps/ValyntApp/vite.config.ts` correctly detects `isDockerMode` and configures `server.hmr.clientPort`.
    *   `devcontainer.json` explicitly forwards port `5173`.
    *   **Observation:** This prevents the common "WebSocket connection failed" loop in containers.

*   **[IMPROVE] Pre-build Storybook:**
    *   `scripts/dev/setup.sh` waits for the DB but does not warm up the UI cache.
    *   **Recommendation:** Add a background step in `postCreateCommand` to run `pnpm build-storybook` (or at least `vite optimize`) to pre-compile dependencies, saving the developer ~30s on first load.

## 💎 DX/Consistency
**Ensuring every developer sees the exact same linting, formatting, and theme.**

*   **[PASS] Design-to-Code Integrity:**
    *   **Status:** ✅ Excellent.
    *   `.vscode/settings.json` (and `devcontainer.json` customizations) strictly enforce:
        *   `"editor.formatOnSave": true`
        *   `"editor.defaultFormatter": "esbenp.prettier-vscode"`
        *   `"editor.bracketPairColorization.enabled": true`
    *   This eliminates "Git Noise" from formatting wars.

*   **[PASS] Design Token Validation:**
    *   **Status:** ✅ Excellent.
    *   The presence of `lint:design-tokens` in `package.json` suggests an advanced setup where token usage is mechanically verified.

## Summary & Next Steps
The current setup is **Infrastructure-Strong** but **UI-Leaning**. The Docker and Network configurations are mature, but the "Visual Onboarding" experience is manual.

**Immediate Actions for Excellence:**
1.  **Add MSW Seeding:** create a `scripts/dev/seed-msw.ts` and run it in `post-create.sh`.
2.  **Enhance Dockerfile:** Add "Headed" browser dependencies for true visual debugging.
3.  **Boost Extensions:** Add `usernamehw.errorlens` to `devcontainer.json`.

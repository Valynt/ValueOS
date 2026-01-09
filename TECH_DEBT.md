# Tech Debt Report

This document outlines identified technical debt in the repository as of the current date. It serves as a guide for future refactoring, security hardening, and maintenance efforts.

## 1. Critical Security & Compliance (In Progress)

Several areas in the codebase contained "TODO" comments indicating missing security controls. These are being addressed.

*   **[RESOLVED] Missing RBAC Integration**: `src/config/secretsManager.v2.ts` now integrates with `RbacService` and Supabase `user_roles`.
*   **[RESOLVED] Audit Logging**: `src/config/secretsManager.v2.ts`, `AWSSecretProvider.ts`, and `VaultSecretProvider.ts` now write to `secret_audit_logs` table.

## 2. Code Maintainability & Architecture

### "God Classes" and Large Files
Files exceeding 1000 lines of code are difficult to maintain and test.
*   `src/components/ChatCanvas/ChatCanvasLayout.tsx` (~2100 lines): Likely handles too much UI logic and state.
*   `src/types/structural-data.ts` (~1900 lines): Huge type definition file, should be split by domain.
*   `src/services/UnifiedAgentOrchestrator.ts` (~1600 lines): Central orchestration logic that may become a bottleneck.
*   `src/causal/business-case-generator-enhanced.ts` (~1500 lines): Complex business logic.
*   `src/lib/agent-fabric/agents/BaseAgent.ts` (~977 lines): The base class for agents is becoming very heavy, potentially violating the Single Responsibility Principle.

### Logic Duplication
*   **[RESOLVED]** `src/causal/business-case-generator.ts` has been deleted in favor of `src/causal/business-case-generator-enhanced.ts`.

### High Volume of Pending Work
*   There are **many TODO/FIXME comments** remaining in the `src/` directory.
*   Critical missing implementations in `src/views/DealsView.tsx`:
    *   `// TODO: Implement export functionality`
    *   `// TODO: Show error toast`
*   `src/bootstrap.ts` has pending initialization for Sentry and Redis.

## 3. Configuration Sprawl

The project suffers from configuration fragmentation, making the build and test environment hard to understand and debug.

### Vite Configuration
Multiple configuration files exist, likely for debugging or partial builds, but they add maintenance overhead:
*   `vite.config.ts`
*   `vite.config.minimal.ts`
*   `vite.config.ts.bare`
*   `vite.config.ts.react-only`
*   `vite.config.ts.ultra-minimal`
*   `vite-debug.config.ts`

### Vitest Configuration
Similar fragmentation exists for the test runner:
*   `vitest.config.ts`
*   `vitest.config.bfa.ts`
*   `vitest.config.fast.ts`
*   `vitest.config.integration.ts`
*   `vitest.config.resilience.ts`
*   `vitest.config.ui.ts`
*   `vitest.config.unit.ts`

### Package Files
*   `package.json`
*   `package.json.billing-deps`
*   `package.json.epic006`
*   `package.together-ai-scripts.json`
*   Multiple `tsconfig.*.json` files.

## 4. Testing Architecture

### Directory Confusion
Tests are scattered across multiple top-level directories, making it unclear where new tests should go:
*   `tests/`: Likely Playwright/E2E tests.
*   `test/`: Contains performance, testcafe, and some unit tests.
*   `src/test/`: Possibly co-located unit tests.

### Dependency Management
*   The project uses versions of `vite` (^7.x) and `vitest` (^4.x) that appear to be non-standard or from a custom registry (standard public versions are lower). This creates confusion for new developers and potential lock-in.

## Recommendations

1.  **Security Audit**: [DONE] Address the RBAC and Audit Logging TODOs in `src/config`.
2.  **Consolidate Config**: Merge the various `vite.config.*` and `vitest.config.*` files into single, conditional configurations or standard presets.
3.  **Refactor Large Components**: Break down `ChatCanvasLayout.tsx` and `UnifiedAgentOrchestrator.ts` into smaller, composed parts.
4.  **Standardize Testing**: Choose one directory structure for tests (e.g., `src/**/*.test.ts` for unit, `e2e/` for functional) and move files accordingly.
5.  **Clean Up**: [PARTIAL] Remove `business-case-generator.ts`. Continue to evaluate `package.json.*` variants.

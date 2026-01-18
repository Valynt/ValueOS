# 📘 Project Best Practices

## 1. Project Purpose
ValueOS is a TypeScript monorepo for building, analyzing, and operationalizing business value cases. It provides a React/Vite front-end, services and shared packages, and optional backend/runtime components with strong emphasis on security, observability, testing, and reproducibility. Domain features include SDUI-driven workflows, agent orchestration, audit trails, and integrations (e.g., Supabase, Stripe, Redis, Kafka).

## 2. Project Structure
- apps/
  - Frontend applications (e.g., ValyntApp) built with Vite + React.
- packages/
  - Backend, shared types, services, components, and infra packages used across apps.
- src/
  - Root-level source code and utilities used by the primary app; types, views, and test utilities.
- tests/
  - Top-level tests (smoke, e2e, performance, accessibility), plus domain-specific suites.
- scripts/
  - Developer experience, validation, CI helpers, seeding, and operational scripts. Many scripts enforce security/quality (env validation, RLS checks, design tokens, console log cleanup).
- infra/
  - Docker, Kubernetes, Supabase, billing, observability, and deployment assets.
- docs/
  - Architecture, operations, runbooks, audits, and guides.
- .config/
  - Centralized configuration for Vitest, Playwright, and TypeScript variants.
- Root config files
  - package.json (workspace + scripts), pnpm-workspace.yaml, eslint.config.js, prettier.config.cjs, tailwind.config.js, tsconfig*.json, postcss.config.js, README.md.

Entry points and configuration
- Frontend entry via Vite in apps/ValyntApp.
- Backend/server entry in packages/backend (e.g., src/server.ts). Build script emits dist/backend.
- Environment and setup via scripts/dx (env compiler/doctor/health) and .env.* files.
- Observability and error monitoring via OpenTelemetry, prom-client, and Sentry plugin.

## 3. Test Strategy
Frameworks and setup
- Unit/Integration: Vitest (+ @testing-library/*, happy-dom/jsdom).
- E2E/Accessibility/Smoke: Playwright.
- DB/Integration: Testcontainers for Postgres where applicable.
- Preflight: scripts/test-preflight.ts validates environment before running tests.

Organization and naming
- Co-located tests: src/__tests__/** and feature-specific folders under tests/** (smoke, e2e, accessibility, performance, security, etc.).
- Test files use *.test.ts or *.test.tsx naming.
- Separate configs: .config/configs/vitest.config.unit.ts and .config/configs/vitest.integration.config.ts.

Mocking guidelines
- Prefer @testing-library patterns for React (user-event, queries by role/label).
- Use vi.spyOn/vi.mock and test-utils wrappers to isolate side effects.
- For network calls, prefer MSW when applicable; otherwise, inject dependencies and mock at boundaries.

When to write unit vs integration
- Unit tests: pure functions, hooks, components without external I/O.
- Integration tests: cross-module flows, data persistence, or external services (use Testcontainers or stable fakes).
- E2E/Smoke: critical golden-path flows, accessibility checks, and environment verifications.

Coverage expectations
- Avoid chasing 100% blanket coverage; focus on critical paths, error handling, and security-sensitive logic.

## 4. Code Style
Language and typing
- TypeScript-first. Favor explicit types and generics; avoid any, prefer unknown + runtime validation (zod).
- Use async/await over promise chains; propagate errors with context.
- Use Zod schemas for input validation and to derive inferred types.

Naming conventions
- Files: kebab-case for scripts; .tsx for React components; .ts for logic/utilities; test files *.test.ts(x).
- Components: PascalCase; hooks: useCamelCase; constants: UPPER_SNAKE_CASE; variables/functions: camelCase.
- Types/Interfaces: PascalCase; DTO/Schema names match domain terms.

Commenting and documentation
- Keep comments minimal and purpose-driven (explain why, not what).
- Use JSDoc for exported functions/components when intent or usage is non-obvious.
- Maintain docs in src/types/* and domain-specific files as the source of truth.

Error and exception handling
- No console.log in production code; use a structured logger (winston) and Sentry for error reporting.
- Validate external inputs with zod; fail closed on security-sensitive paths.
- Add contextual metadata to errors; avoid swallowing exceptions silently.

Imports and modules
- Use path aliases (e.g., @/) where configured; avoid deep imports across package boundaries.
- Keep modules cohesive; avoid circular dependencies.

State and data fetching
- Prefer React Query (TanStack) for async server state; colocate hooks per feature.
- Use Zustand for local app state when needed; keep stores minimal and typed.

Security and data handling
- Never log secrets or PII. Respect RLS/tenant isolation in backend queries.
- Sanitize user-provided HTML using DOMPurify; validate and encode user inputs.
- Use environment variables via Vite (import.meta.env) safely; do not expose secrets to the client.

## 5. Common Patterns
- Schema-first validation: zod schemas accompany domain entities and API contracts.
- Adapter and boundary segregation: tools/, gateways/, and services/ isolate external APIs (LLMs, search, billing).
- SDUI actions + routers: canonical action types, atomic UI updates, and page definitions for predictable orchestration.
- Observability-by-default: prom-client metrics, OpenTelemetry traces, and structured logs.
- Circuit breaker/fault tolerance: opossum and safe guards for remote calls.
- Test harnesses: preflight checks, testcontainers for DB, and MSW/spy-based mocks.

## 6. Do's and Don'ts
✅ Do
- Use TypeScript types + zod schemas at boundaries.
- Add unit tests for new logic and integration tests for cross-module flows.
- Use the shared logger (winston) and capture errors with Sentry.
- Keep React components pure and focused; extract hooks/utilities for reuse.
- Sanitize and validate all user inputs.
- Write small, composable modules; prefer dependency injection for testability.
- Keep environment-specific behavior behind explicit flags.

❌ Don't
- Don’t use console.log in production code (tests/scripts are exceptions where appropriate).
- Don’t hardcode URLs, secrets, or tenant IDs.
- Don’t bypass RLS or multi-tenant isolation guarantees.
- Don’t rely on implicit any or dynamic shapes without validation.
- Don’t introduce side effects in render paths or hooks without guards.

## 7. Tools & Dependencies
Key libraries
- Frontend: React 18, Vite, Tailwind, TanStack Query, Zustand, React Router, Testing Library.
- Types/Validation: TypeScript, Zod.
- Backend/Services: Express, prom-client, OpenTelemetry, Winston, Sentry, Redis, BullMQ, KafkaJS, Stripe, Supabase JS.
- Testing: Vitest, Playwright, Testcontainers, happy-dom/jsdom, MSW.

Setup
- Install: pnpm i
- Development (primary app): npm run dev --workspace=ValyntApp
- Build: npm run build --workspace=ValyntApp
- Lint/Format: npm run lint && npm run format
- Tests:
  - Unit: npm run test:unit
  - Integration: npm run test:integration
  - All: npm run test:all
  - Playwright (smoke/a11y/SAML): see package.json scripts

## 8. Other Notes
- Monorepo: prefer adding shared logic to packages/shared or appropriate package directories.
- Path aliases: use configured @/ imports; keep boundaries clean between apps and packages.
- Quality gates: leverage scripts under scripts/ for env validation, design tokens, console log cleanup, RLS checks, and deployment verification.
- Observability: instrument new features with metrics/traces; add meaningful labels and error tags.
- Security: keep fail-closed defaults; review RLS and multi-tenant behavior when touching data access.
- LLM codegen: adhere to types and zod schemas; avoid adding runtime-only secrets; prefer small, typed functions and pure helpers for easy testing.

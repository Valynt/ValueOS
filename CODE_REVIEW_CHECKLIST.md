# Code Review Checklist

This checklist is a framework for ensuring code quality, consistency, and adherence to architectural principles.

---

## Code Style & Consistency (TypeScript/JavaScript)

- **ESLint Compliance**: Code passes `npm run lint` with no errors. Avoid disabling rules without justification.
- **Prettier Formatting**: Code is formatted automatically by Prettier (if configured). Consistency is key.
- **Type Safety**:
    - Use TypeScript throughout. Avoid `any` type unless absolutely necessary and justified.
    - Use utility types (`Partial`, `Omit`, `Pick`, etc.) to create robust types.
    - Interfaces and types are well-defined and organized, preferably in `src/types`.
- **Import Organization**: Imports are grouped (e.g., external libs, absolute paths from `src`, relative paths). An ESLint rule should enforce this.
- **Naming Conventions**:
    - `PascalCase` for components, classes, and types (e.g., `MyComponent`, `class UserService`, `type UserProfile`).
    - `camelCase` for functions, variables, and methods (e.g., `getUser`, `const userData`).
    - Constants can be `UPPER_SNAKE_CASE` (e.g., `const MAX_RETRIES = 3`).
- **Component Organization**:
    - React components are functional components using hooks.
    - One component per file (unless they are very small, related sub-components).
    - Props are defined with a `type` or `interface`.
- **Async/Await Patterns**:
    - Use `async/await` for all asynchronous operations. Avoid `.then()` chaining where possible for better readability.
    - Proper `try/catch` error handling is used for all awaited calls.

---

## Performance & Optimization

- **Database Queries**:
    - Avoid making database calls inside loops (N+1 problem).
    - Use Supabase's query features to select only the columns you need (`select('id, name')`).
    - Fetch data server-side or in loaders (e.g., React Router loaders) where possible to avoid waterfalls.
- **Caching**:
    - For expensive queries, consider a Redis cache layer with tenant-prefixed keys.
    - Client-side data fetching libraries (like TanStack Query) should be used to cache data and avoid redundant requests.
- **Bundle Size & Code Splitting**:
    - Use dynamic `import()` for large components or libraries that are not needed on the initial page load.
    - Regularly analyze the bundle with a tool like `vite-bundle-visualizer`.
- **Unused Dependencies**: Run `npx depcheck` or similar tools to identify and remove unused packages from `package.json`.
- **React Performance**:
    - Use `React.memo` for components that re-render unnecessarily.
    - Use `useCallback` and `useMemo` to memoize functions and values, especially when passed as props to memoized children.
    - Avoid anonymous functions in props (`<div onClick={() => ...} />`).

---

## Security Vulnerabilities

- **Supabase RLS**: All tables containing tenant data **must** have Row-Level Security enabled and policies that enforce tenant isolation.
- **XSS Prevention**:
    - When using `dangerouslySetInnerHTML`, the content must be sanitized with a library like `dompurify`.
    - Never construct HTML from user input directly.
- **Authentication & Authorization**:
    - All API routes and server-side logic must be protected and verify the user's JWT.
    - Business logic must check user roles or permissions where necessary (e.g., an 'admin' role).
- **Secret Management**:
    - No hardcoded secrets (API keys, JWT secrets) in the frontend or backend code.
    - All secrets must be loaded from environment variables and managed via a secure secret manager (e.g., Supabase Vault, AWS Secrets Manager).
- **Dependency Vulnerabilities**: Run `npm audit` or `snyk test` regularly and fix high-severity vulnerabilities.
- **Rate Limiting**: API endpoints exposed to the public (including the billing webhook) must have rate limiting.

---

## Testing Coverage

- **Unit Tests**: Aim for >80% code coverage on critical services, utilities, and business logic. Use Vitest.
- **Integration Tests**: Write tests that interact with a real (or dockerized) Supabase instance to verify RLS policies and data integrity.
- **E2E Tests**: Use Playwright to automate critical user flows, such as login, creating a model, and checking multi-tenant access restrictions.
- **Mocking**: External services (like Stripe or an LLM API) should be mocked in unit and integration tests.
- **Test Isolation**: Tests should be runnable independently and should clean up after themselves.

---

## Documentation

- **README**: Must contain clear, up-to-date instructions for setup, running tests, and deploying.
- **API Documentation**: The backend API (even if minimal) should be documented. If using a framework that supports OpenAPI, generate a spec.
- **Architecture Decisions**: Important decisions should be documented in ADRs (Architecture Decision Records) in the `docs/adr` folder.
- **Component Library**: If using Storybook, components should have stories that document their props and states.

---

## Multi-Tenancy & Architecture

- **Tenant Isolation**: `organization_id` must be the primary key for all tenant-scoped data access and caching.
- **Agent Orchestration**: Agents must receive tenant context (`organizationId`) and should not be able to access data outside their scope.
- **Configuration Management**: Use the centralized `Settings` object (`src/config.ts` or similar) and do not spread `process.env` access across the codebase.
- **Structured Logging**: Use a centralized logger (e.g., Pino, Winston) that injects context (`org_id`, `user_id`, `requestId`) into every log message. Avoid `console.log`.
- **Error Handling**: Use centralized error handling middleware and custom error classes. Frontend should have Error Boundaries.

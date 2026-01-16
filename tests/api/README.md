# API Endpoint Tests

This directory contains comprehensive API endpoint tests for the ValueOS application.

## Test Files

- **health.test.ts** - Health check endpoints (/health, /health/ready, /health/live)
- **workflows.test.ts** - Workflow CRUD operations, pagination, tenant isolation
- **agent-sessions.test.ts** - Agent session management, filtering, status updates
- **error-scenarios.test.ts** - HTTP error responses (400, 401, 403, 404, 500)
- **rate-limiting.test.ts** - Rate limiting behavior, burst protection, 429 responses

### Value Modeling API Tests (packages/backend)

- **valueCases.test.ts** - Value case CRUD, validation, auth, error handling
- **valueDrivers.test.ts** - Value driver CRUD, formula validation, persona tags, usage tracking

## Running Tests

```bash
# Run all API tests
npm test tests/api

# Run specific test file
npm test tests/api/workflows.test.ts

# Run with coverage
npm test -- --coverage tests/api

# Watch mode
npm run test:watch tests/api
```

## Test Coverage

- ✅ Health check endpoints
- ✅ Workflow CRUD (Create, Read, Update, Delete)
- ✅ Agent session management
- ✅ Pagination and filtering
- ✅ Tenant isolation (RLS enforcement)
- ✅ Error handling (4xx and 5xx responses)
- ✅ Rate limiting (basic structure)
- ✅ Value Cases API (CRUD, validation, auth)
- ✅ Value Drivers API (CRUD, formula validation, usage tracking)
- ✅ Authentication middleware tests
- ✅ Authorization/RBAC tests

## Missing Coverage (To-Do)

- [ ] File upload endpoints
- [ ] Webhook endpoints
- [ ] Billing/subscription endpoints

## Notes

- Tests use `testAdminClient` from setup.ts for database operations
- Each test file includes setup/teardown for data isolation
- Tests are designed to run independently (no execution order dependency)
- Placeholders exist for features not yet implemented (e.g., advanced rate limiting)

## Environment Setup

Ensure `.env.test` is configured with:

```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

Initialize test database:

```bash
npm run db:test:setup
```

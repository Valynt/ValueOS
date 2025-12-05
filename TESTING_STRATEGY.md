# Testing Strategy for Multi-Tenant SaaS with AI Agents

This document outlines the testing strategy to ensure the reliability, security, and correctness of the application, with a focus on its multi-tenant architecture and AI agent fabric.

---

## The Testing Pyramid

Our strategy follows the classic testing pyramid model to balance coverage, speed, and cost.

```
        △
       / \\
      / E2E \\       (5%)  - Playwright: Slow, expensive, but essential for critical user flows.
     /-------\\\
    / Integration \\  (25%) - Vitest: Test service interactions, DB queries (with a test DB), and RLS policies.
   /---------------\\\
  /    Unit Tests   \\ (70%) - Vitest: Fast, isolated tests for components, utilities, and individual functions.
 /-------------------\\
```

---

## 1. Unit Tests (Target: >80% coverage)

**Framework:** [Vitest](https://vitest.dev/) with `jsdom` environment.
**Location:** `src/**/*.test.ts` or `src/**/__tests__`
**Goal:** Verify individual units of logic in isolation.

### Example: DAO/Repository Unit Test (with mocking)

This tests that a repository method constructs the correct Supabase query.

```typescript
// src/repositories/ModelRepository.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ModelRepository } from './ModelRepository';

// Mock the global supabase client
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: { id: 'model-1' }, error: null }),
};
vi.mock('../lib/supabase', () => ({supabase: mockSupabase }));


describe('ModelRepository', () => {
  it('should call findById with correct organization_id filter', async () => {
    const orgId = 'org-abc-123';
    const modelId = 'model-xyz-789';
    const repo = new ModelRepository(orgId);

    await repo.findById(modelId);

    // Verify the query chain was called correctly
    expect(mockSupabase.from).toHaveBeenCalledWith('models');
    expect(mock.select).toHaveBeenCalledWith('*');
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', modelId);
    // CRITICAL: Verify tenant isolation is being applied
    expect(mockSupabase.eq).toHaveBeenCalledWith('organization_id', orgId);
    expect(mockSupabase.single).toHaveBeenCalled();
  });
});
```

### Example: Business Logic (Service) Unit Test

This tests the service layer's logic, mocking the data layer.

```typescript
// src/services/ModelService.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ModelService } from './ModelService';

// Mock the repositories
vi.mock('../repositories/ModelRepository', () => ({
  ModelRepository: vi.fn(() => ({
    findById: vi.fn().mockResolvedValue({ data: { id: 'model-1', name: 'Test Model' }, error: null }),
  })),
}));
vi.mock('../repositories/KpiRepository'); // Mock other dependencies

describe('ModelService', () => {
  it('should retrieve a model and its KPIs', async () => {
    const orgId = 'org-abc-123';
    const modelId = 'model-xyz-789';
    const service = new ModelService(orgId);

    const result = await service.getModelWithKpis(modelId);

    expect(result.name).toBe('Test Model');
    // Further assertions on how the service combines the data...
  });
});
```

---

## 2. Integration Tests (Target: >50% coverage of critical paths)

**Framework:** Vitest with a live (Dockerized) test database.
**Location:** `test/integration/**/*.test.ts`
**Goal:** Verify interactions between services and the database, especially RLS policies.

The `vitest.setup.ts` or a similar file should manage the test database, ensuring it's migrated and cleaned between runs. Use the `supabase test db` functionality.

### Example: RLS Policy Integration Test

This test verifies that one tenant cannot access another tenant's data.

```typescript
// test/integration/rls.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// These would be loaded from a test-specific env file
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!; // Admin key
const USER_A_JWT = '...jwt for user in org A...';
const USER_B_JWT = '...jwt for user in org B...';

describe('Row-Level Security Policies', () => {
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

  beforeAll(async () => {
    // Seed data: Create two orgs and a model in org A
    const { data: orgA } = await adminClient.from('organizations').insert({ name: 'Org A' }).select().single();
    await adminClient.from('organizations').insert({ name: 'Org B' });
    await adminClient.from('models').insert({ name: 'Org A Model', organization_id: orgA.id });
  });

  it('User from Org B should not be able to select models from Org A', async () => {
    // Create a client authenticated as a user from Org B
    const userBClient = createClient(SUPABASE_URL, USER_B_JWT);

    const { data, error } = await userBClient.from('models').select('*');
    
    // RLS is working if no error is thrown and data is an empty array
    expect(error).toBeNull();
    expect(data).toBeInstanceOf(Array);
    expect(data.length).toBe(0);
  });
  
  it('User from Org A should be able to see their own models', async () => {
    // Create a client authenticated as a user from Org A
    const userAClient = createClient(SUPABASE_URL, USER_A_JWT);

    const { data, error } = await userAClient.from('models').select('*');
    
    expect(error).toBeNull();
    expect(data).toBeInstanceOf(Array);
    expect(data.length).toBe(1);
    expect(data[0].name).toBe('Org A Model');
  });

  afterAll(async () => {
    // Clean up test data
    await adminClient.from('organizations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });
});
```

---

## 3. End-to-End (E2E) Tests (Target: 5-10 critical user flows)

**Framework:** [Playwright](https://playwright.dev/)
**Location:** `test/e2e/**/*.spec.ts`
**Goal:** Simulate real user behavior in a browser, covering complete user journeys.

### Example: Multi-Tenant Login and Data Visibility E2E Test

```typescript
// test/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Multi-Tenant Data Isolation', () => {
  
  test('User from Org A sees their own data after login', async ({ page }) => {
    // Step 1: Login as User A
    await page.goto('/login');
    await page.fill('input[name="email"]', 'user-a@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Step 2: Navigate to dashboard
    await page.waitForURL('/dashboard');
    
    // Step 3: Verify data from Org A is visible
    const modelCard = page.locator('.model-card:has-text("Org A Model")');
    await expect(modelCard).toBeVisible();
    
    // Step 4: Verify data from Org B is NOT visible
    const otherModelCard = page.locator('.model-card:has-text("Org B Model")');
    await expect(otherModelCard).not.toBeVisible();
  });
  
  test('User from Org B sees their own data after login', async ({ page }) => {
    // Login as User B and perform similar checks
    await page.goto('/login');
    await page.fill('input[name="email"]', 'user-b@example.com');
    // ...
  });
});
```

# E2E Golden Path Tests

End-to-end tests for critical user workflows using Playwright.

## Test Files

### 1. Research Company Flow (research-company.spec.ts)

Tests the complete research company workflow:

- Enter company name → Generate hypotheses → Drill down → View details
- Loading states, error handling, session persistence
- 5 test cases covering happy path and edge cases

### 2. Target ROI Flow (target-roi.spec.ts)

Tests ROI calculation and visualization:

- Enter deal parameters → Calculate ROI → View breakdown → Adjust & recalculate
- Input validation, visualization, calculation history
- 5 test cases covering calculation workflow

### 3. Realization Dashboard (realization-dashboard.spec.ts)

Tests dashboard functionality:

- View metrics → Filter opportunities → Navigate details → Export data
- Charts, filtering, data refresh
- 7 test cases covering dashboard features

### 4. Admin Workflows (admin-workflows.spec.ts)

Tests admin functionality:

- User management (list, create, update)
- Tenant configuration (settings, feature flags)
- Audit log (view, filter, export)
- 8 test cases across 3 admin areas

## Running E2E Tests

```bash
# Run all E2E tests
npx playwright test

# Run specific workflow
npx playwright test research-company
npx playwright test target-roi
npx playwright test realization-dashboard
npx playwright test admin-workflows

# Run in headed mode (see browser)
npx playwright test --headed

# Run in UI mode (interactive)
npx playwright test --ui

# Run with specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Coverage

✅ Research Company Flow (5 tests)
✅ Target ROI Flow (5 tests)
✅ Realization Dashboard (7 tests)
✅ Admin Workflows (8 tests)

**Total: 25 E2E tests** across 4 critical workflows

## Test Patterns

### Page Object Model

Consider creating page objects for common interactions:

```typescript
class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/dashboard");
  }

  async getTotalValue() {
    return this.page
      .locator('[data-testid="metric-total-value"]')
      .textContent();
  }
}
```

### Authentication

Tests requiring authentication use storage state:

```typescript
test.use({
  storageState: "test/playwright/.auth/admin.json",
});
```

### Data Test IDs

All tests use `data-testid` attributes for stable selectors:

```html
<div data-testid="hypothesis-card">...</div>
```

## CI Integration

E2E tests run in GitHub Actions workflow:

- Chromium (headless) in CI
- Screenshots on failure
- Video recordings for debugging
- Parallel execution across workers

## Best Practices

1. **Wait for network idle** before interactions
2. **Use data-testid** instead of CSS selectors
3. **Assert visibility** before clicking
4. **Handle loading states** with proper timeouts
5. **Test error scenarios** in addition to happy paths
6. **Keep tests independent** - each test should work in isolation

## Debugging

```bash
# Show trace viewer for failed tests
npx playwright show-trace trace.zip

# Generate and view HTML report
npx playwright show-report

# Run in debug mode
npx playwright test --debug
```

## Next Steps

Additional E2E test considerations:

- Mobile viewport tests
- Cross-browser compatibility verification
- Performance monitoring during E2E
- Visual regression testing
- Accessibility scanning with axe

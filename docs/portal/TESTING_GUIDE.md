# Documentation Portal Testing Guide

Comprehensive testing guide for the in-product documentation portal.

## 🧪 Testing Strategy

### Test Pyramid

```
        /\
       /  \      E2E Tests (10%)
      /____\     - User flows
     /      \    - Integration
    /________\   Integration Tests (20%)
   /          \  - Component integration
  /____________\ Unit Tests (70%)
                 - Component logic
                 - Utilities
```

---

## 🔬 Unit Tests

### Testing Components

```typescript
// src/components/docs/__tests__/DocsViewer.test.tsx
import { render, screen } from '@testing-library/react';
import { DocsViewer } from '../DocsViewer';
import { DocSection } from '../types';

describe('DocsViewer', () => {
  const mockSection: DocSection = {
    id: 'test-section',
    title: 'Test Section',
    path: '/docs/test.md',
    category: 'user-guide',
    version: '1.0.0',
    lastUpdated: '2024-01-01T00:00:00Z',
    content: '# Test\n\nThis is a test.'
  };

  it('renders section title', () => {
    render(
      <DocsViewer 
        section={mockSection} 
        userRole="business" 
        onNavigate={() => {}} 
      />
    );
    
    expect(screen.getByText('Test Section')).toBeInTheDocument();
  });

  it('renders markdown content', () => {
    render(
      <DocsViewer 
        section={mockSection} 
        userRole="business" 
        onNavigate={() => {}} 
      />
    );
    
    expect(screen.getByText('This is a test.')).toBeInTheDocument();
  });

  it('hides code blocks for business users', () => {
    const sectionWithCode: DocSection = {
      ...mockSection,
      content: '```typescript\nconst x = 1;\n```'
    };
    
    render(
      <DocsViewer 
        section={sectionWithCode} 
        userRole="business" 
        onNavigate={() => {}} 
      />
    );
    
    expect(screen.queryByText('const x = 1;')).not.toBeInTheDocument();
    expect(screen.getByText(/Developer Note/)).toBeInTheDocument();
  });

  it('shows code blocks for developers', () => {
    const sectionWithCode: DocSection = {
      ...mockSection,
      content: '```typescript\nconst x = 1;\n```'
    };
    
    render(
      <DocsViewer 
        section={sectionWithCode} 
        userRole="developer" 
        onNavigate={() => {}} 
      />
    );
    
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
  });
});
```

### Testing Hooks

```typescript
// src/hooks/__tests__/useDocumentation.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useDocumentation } from '../useDocumentation';

describe('useDocumentation', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('fetches sections successfully', async () => {
    const mockSections = [
      { id: 'section-1', title: 'Section 1' }
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockSections })
    });

    const { result } = renderHook(() => useDocumentation());

    await waitFor(() => {
      expect(result.current.sections).toEqual(mockSections);
    });
  });

  it('handles fetch errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network error')
    );

    const { result } = renderHook(() => useDocumentation());

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });
  });

  it('searches documentation', async () => {
    const { result } = renderHook(() => useDocumentation());

    // Set up sections
    result.current.sections = [
      {
        id: 'test',
        title: 'Getting Started',
        content: 'This is a guide to getting started'
      }
    ];

    await result.current.searchDocs('getting started');

    expect(result.current.searchResults).toHaveLength(1);
    expect(result.current.searchResults[0].section.title).toBe('Getting Started');
  });
});
```

---

## 🔗 Integration Tests

### Testing Component Integration

```typescript
// src/components/docs/__tests__/DocsPortal.integration.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DocsPortal } from '../DocsPortal';
import { AuthProvider } from '../../../contexts/AuthContext';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('DocsPortal Integration', () => {
  it('navigates between sections', async () => {
    renderWithProviders(<DocsPortal />);

    // Click on a section in navigation
    const navLink = await screen.findByText('Getting Started');
    fireEvent.click(navLink);

    // Verify section loads
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Getting Started' }))
        .toBeInTheDocument();
    });
  });

  it('searches and displays results', async () => {
    renderWithProviders(<DocsPortal />);

    // Type in search box
    const searchInput = screen.getByPlaceholderText('Search documentation...');
    fireEvent.change(searchInput, { target: { value: 'SSO' } });

    // Verify search results appear
    await waitFor(() => {
      expect(screen.getByText(/Search Results/)).toBeInTheDocument();
    });
  });

  it('filters content by role', async () => {
    renderWithProviders(<DocsPortal role="business" />);

    // Business users should not see developer content
    expect(screen.queryByText('API Reference')).not.toBeInTheDocument();
    
    // But should see business content
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
  });
});
```

---

## 🎭 E2E Tests (Playwright)

### User Flow Tests

```typescript
// tests/e2e/documentation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Documentation Portal', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to docs
    await page.goto('/docs');
  });

  test('loads documentation portal', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Documentation');
    await expect(page.locator('nav')).toBeVisible();
  });

  test('searches documentation', async ({ page }) => {
    // Type in search
    await page.fill('input[type="search"]', 'getting started');
    
    // Wait for results
    await page.waitForSelector('.search-results');
    
    // Verify results
    const results = page.locator('.search-results article');
    await expect(results).toHaveCount(1, { timeout: 5000 });
  });

  test('navigates to section', async ({ page }) => {
    // Click navigation item
    await page.click('text=Getting Started');
    
    // Verify URL changed
    await expect(page).toHaveURL(/\/docs\/user-guide-getting-started/);
    
    // Verify content loaded
    await expect(page.locator('article')).toBeVisible();
  });

  test('copies code example', async ({ page }) => {
    // Navigate to developer docs
    await page.goto('/docs/dev-guide-quick-start');
    
    // Hover over code block
    const codeBlock = page.locator('pre').first();
    await codeBlock.hover();
    
    // Click copy button
    await page.click('button:has-text("Copy")');
    
    // Verify copied feedback
    await expect(page.locator('button:has-text("Copied!")')).toBeVisible();
  });

  test('mobile navigation works', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Open mobile menu
    await page.click('[aria-label="Toggle menu"]');
    
    // Verify menu is visible
    await expect(page.locator('aside')).toBeVisible();
    
    // Click navigation item
    await page.click('text=User Guide');
    
    // Verify menu closes
    await expect(page.locator('aside')).not.toBeVisible();
  });

  test('admin dashboard accessible to admins', async ({ page }) => {
    // Assuming logged in as admin
    await page.click('button:has-text("Admin Dashboard")');
    
    // Verify dashboard loads
    await expect(page.locator('h1')).toContainText('Documentation Health');
    await expect(page.locator('text=Coverage')).toBeVisible();
  });
});
```

---

## ♿ Accessibility Tests

### Automated Accessibility Testing

```typescript
// tests/a11y/documentation.spec.ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Documentation Accessibility', () => {
  test('documentation portal is accessible', async ({ page }) => {
    await page.goto('/docs');
    await injectAxe(page);
    
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true
      }
    });
  });

  test('keyboard navigation works', async ({ page }) => {
    await page.goto('/docs');
    
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    
    // Navigate with arrow keys
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    
    // Verify navigation occurred
    await expect(page).toHaveURL(/\/docs\/.+/);
  });

  test('screen reader landmarks present', async ({ page }) => {
    await page.goto('/docs');
    
    // Check for proper landmarks
    await expect(page.locator('nav')).toHaveAttribute('aria-label');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('header')).toBeVisible();
  });
});
```

---

## 📊 Performance Tests

### Load Time Testing

```typescript
// tests/performance/documentation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Documentation Performance', () => {
  test('portal loads within 1 second', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/docs');
    await page.waitForSelector('h1');
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(1000);
  });

  test('search responds within 300ms', async ({ page }) => {
    await page.goto('/docs');
    
    const startTime = Date.now();
    await page.fill('input[type="search"]', 'test');
    await page.waitForSelector('.search-results');
    
    const searchTime = Date.now() - startTime;
    expect(searchTime).toBeLessThan(300);
  });

  test('navigation is smooth', async ({ page }) => {
    await page.goto('/docs');
    
    const startTime = Date.now();
    await page.click('text=Getting Started');
    await page.waitForSelector('article');
    
    const navTime = Date.now() - startTime;
    expect(navTime).toBeLessThan(200);
  });
});
```

---

## 🎯 Test Coverage

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test DocsViewer.test.tsx

# Run in watch mode
npm test -- --watch

# Run E2E tests
npm run test:e2e

# Run accessibility tests
npm run test:a11y
```

### Coverage Goals

| Type | Target |
|------|--------|
| Unit Tests | 80%+ |
| Integration Tests | 70%+ |
| E2E Tests | Critical paths |
| Accessibility | 100% WCAG 2.1 AA |

---

## 🐛 Debugging Tests

### Debug Unit Tests

```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/vitest run

# Use VS Code debugger
# Add breakpoint and press F5
```

### Debug E2E Tests

```bash
# Run in headed mode
npm run test:e2e -- --headed

# Run with debugger
npm run test:e2e -- --debug

# Slow down execution
npm run test:e2e -- --slow-mo=1000
```

---

## 📝 Test Checklist

### Before Committing

- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] No console errors
- [ ] Coverage meets targets
- [ ] Accessibility tests pass

### Before Deploying

- [ ] E2E tests pass
- [ ] Performance tests pass
- [ ] Cross-browser testing done
- [ ] Mobile testing done
- [ ] Accessibility audit complete

---

## 🔗 Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright Documentation](https://playwright.dev/)
- [Axe Accessibility Testing](https://www.deque.com/axe/)

---

**Questions?** See the [Integration Guide](./IN_PRODUCT_INTEGRATION.md) or contact the development team.

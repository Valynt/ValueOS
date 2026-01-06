# In-Product Documentation Portal - Integration Guide

Complete guide to integrating the documentation portal into ValueOS.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install react-markdown react-syntax-highlighter remark-gfm
npm install --save-dev @types/react-syntax-highlighter
```

### 2. Add Route

In your main routing file (e.g., `src/AppRoutes.tsx`):

```tsx
import { Routes, Route } from 'react-router-dom';
import { DocsPortal } from './components/docs/DocsPortal';

export function AppRoutes() {
  return (
    <Routes>
      {/* Existing routes */}
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/settings" element={<Settings />} />
      
      {/* Documentation portal */}
      <Route path="/docs" element={<DocsPortal />} />
      <Route path="/docs/:sectionId" element={<DocsPortal />} />
      
      {/* Other routes */}
    </Routes>
  );
}
```

### 3. Add Navigation Link

In your main navigation (e.g., sidebar or header):

```tsx
<nav>
  <a href="/dashboard">Dashboard</a>
  <a href="/settings">Settings</a>
  <a href="/docs">Documentation</a> {/* Add this */}
</nav>
```

### 4. Start Backend Server

The documentation API must be running:

```bash
npm run backend:dev
```

### 5. Test

Navigate to `http://localhost:5173/docs` to see the documentation portal.

---

## 📋 Complete Integration Steps

### Step 1: Verify Backend Integration

The documentation API is already integrated into the Express backend (`src/backend/server.ts`).

Verify it's working:

```bash
# Start backend
npm run backend:dev

# Test API
curl http://localhost:3000/api/docs/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "sections": 12,
    "mappings": 30,
    "outdated": 0,
    "coverage": "100%"
  }
}
```

### Step 2: Install Frontend Dependencies

```bash
npm install react-markdown@^9.0.0 \
  react-syntax-highlighter@^15.5.0 \
  remark-gfm@^4.0.0

npm install --save-dev \
  @types/react-syntax-highlighter@^15.5.0
```

### Step 3: Configure Vite (if needed)

If you encounter module resolution issues, update `vite.config.ts`:

```typescript
export default defineConfig({
  // ... existing config
  optimizeDeps: {
    include: [
      'react-markdown',
      'react-syntax-highlighter',
      'remark-gfm'
    ]
  }
});
```

### Step 4: Add to Main App

Update `src/App.tsx` or your main app component:

```tsx
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './AppRoutes';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
```

### Step 5: Create Documentation Route

Create or update `src/AppRoutes.tsx`:

```tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { DocsPortal } from './components/docs/DocsPortal';

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      
      {/* Protected routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      
      {/* Documentation portal */}
      <Route path="/docs" element={
        <ProtectedRoute>
          <DocsPortal />
        </ProtectedRoute>
      } />
      
      <Route path="/docs/:sectionId" element={
        <ProtectedRoute>
          <DocsPortal />
        </ProtectedRoute>
      } />
      
      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
```

### Step 6: Add Navigation Links

Update your main navigation component:

```tsx
// src/components/Navigation.tsx
import { Link, useLocation } from 'react-router-dom';

export function Navigation() {
  const location = useLocation();
  
  return (
    <nav className="flex flex-col gap-2">
      <Link 
        to="/dashboard"
        className={location.pathname === '/dashboard' ? 'active' : ''}
      >
        Dashboard
      </Link>
      
      <Link 
        to="/settings"
        className={location.pathname === '/settings' ? 'active' : ''}
      >
        Settings
      </Link>
      
      <Link 
        to="/docs"
        className={location.pathname.startsWith('/docs') ? 'active' : ''}
      >
        📚 Documentation
      </Link>
    </nav>
  );
}
```

### Step 7: Add Help Button (Optional)

Add a contextual help button that opens relevant documentation:

```tsx
// src/components/HelpButton.tsx
import { useNavigate } from 'react-router-dom';

interface HelpButtonProps {
  sectionId?: string;
}

export function HelpButton({ sectionId }: HelpButtonProps) {
  const navigate = useNavigate();
  
  const handleClick = () => {
    if (sectionId) {
      navigate(`/docs/${sectionId}`);
    } else {
      navigate('/docs');
    }
  };
  
  return (
    <button
      onClick={handleClick}
      className="fixed bottom-4 right-4 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700"
      aria-label="Help"
    >
      ?
    </button>
  );
}

// Usage in any component:
<HelpButton sectionId="user-guide-getting-started" />
```

---

## 🎨 Customization

### Theme Integration

Match your app's theme by customizing Tailwind classes:

```tsx
// src/components/docs/DocsPortal.tsx
// Update color classes to match your theme

// Example: Change primary color from blue to purple
className="bg-blue-600" → className="bg-purple-600"
className="text-blue-600" → className="text-purple-600"
```

### Custom Styling

Create a custom CSS file for documentation-specific styles:

```css
/* src/components/docs/docs.css */

/* Custom prose styling */
.docs-content {
  @apply prose prose-lg max-w-none;
}

.docs-content h2 {
  @apply text-3xl font-bold mt-8 mb-4;
}

.docs-content code {
  @apply bg-gray-100 px-1 py-0.5 rounded text-sm;
}

/* Custom callout styles */
.docs-callout {
  @apply border-l-4 p-4 my-4 rounded-r-lg;
}

.docs-callout-warning {
  @apply bg-yellow-50 border-yellow-400;
}

.docs-callout-tip {
  @apply bg-blue-50 border-blue-400;
}
```

### Role-Based Landing Pages

Customize default sections per role:

```tsx
// src/components/docs/DocsPortal.tsx

function getDefaultSection(role: UserRole): string {
  switch (role) {
    case 'business':
      return 'overview-welcome';
    case 'admin':
      return 'user-guide-getting-started';
    case 'developer':
      return 'dev-guide-quick-start';
    default:
      return 'overview-welcome';
  }
}
```

---

## 🔧 Configuration

### Environment Variables

Add to `.env`:

```bash
# Documentation API
VITE_DOCS_API_URL=http://localhost:3000/api/docs

# Feature flags
VITE_DOCS_SEARCH_ENABLED=true
VITE_DOCS_ADMIN_DASHBOARD_ENABLED=true
```

### Documentation Config

The portal reads from `/docs/portal/.docsconfig.json`. Customize:

```json
{
  "automation": {
    "enabled": true,
    "triggers": {
      "onCommit": true,
      "onPullRequest": true
    }
  },
  "notifications": {
    "slack": {
      "enabled": false,
      "channel": "#documentation"
    }
  }
}
```

---

## 🧪 Testing

### Unit Tests

```bash
# Test documentation components
npm test src/components/docs/

# Test with coverage
npm test src/components/docs/ -- --coverage
```

### E2E Tests

Create Playwright test:

```typescript
// tests/e2e/documentation.spec.ts
import { test, expect } from '@playwright/test';

test('documentation portal loads', async ({ page }) => {
  await page.goto('/docs');
  await expect(page.locator('h1')).toContainText('Documentation');
});

test('search works', async ({ page }) => {
  await page.goto('/docs');
  await page.fill('input[type="search"]', 'getting started');
  await expect(page.locator('.search-results')).toBeVisible();
});

test('navigation works', async ({ page }) => {
  await page.goto('/docs');
  await page.click('text=User Guide');
  await expect(page).toHaveURL(/\/docs\/user-guide/);
});
```

Run tests:

```bash
npm run test:e2e
```

---

## 📊 Monitoring

### Analytics Integration

Track documentation usage:

```tsx
// src/components/docs/DocsPortal.tsx
import { useEffect } from 'react';
import { analytics } from './lib/analytics';

export const DocsPortal: React.FC<DocsPortalProps> = (props) => {
  useEffect(() => {
    analytics.track('Documentation Viewed', {
      section: currentSection?.id,
      role: userRole
    });
  }, [currentSection, userRole]);
  
  // ... rest of component
};
```

### Error Tracking

Add error boundary:

```tsx
// src/components/docs/DocsErrorBoundary.tsx
import React from 'react';

export class DocsErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Documentation error:', error, errorInfo);
    // Send to error tracking service
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <h2>Something went wrong</h2>
          <button onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}

// Usage:
<DocsErrorBoundary>
  <DocsPortal />
</DocsErrorBoundary>
```

---

## 🚀 Deployment

### Build for Production

```bash
# Build frontend
npm run build

# Build includes documentation portal
# Output: dist/
```

### Environment-Specific Config

```bash
# Production
VITE_DOCS_API_URL=https://api.valueos.com/api/docs

# Staging
VITE_DOCS_API_URL=https://api-staging.valueos.com/api/docs
```

### CDN Optimization

For faster loading, serve markdown files from CDN:

```typescript
// Update DocsViewer to fetch from CDN
const contentUrl = `${CDN_URL}/docs/${section.path}`;
const response = await fetch(contentUrl);
```

---

## 🐛 Troubleshooting

### Common Issues

**Issue**: Documentation not loading

**Solution**:
1. Verify backend is running: `curl http://localhost:3000/api/docs/health`
2. Check browser console for errors
3. Verify user is authenticated
4. Check network tab for failed requests

**Issue**: Search not working

**Solution**:
1. Ensure search query is > 2 characters
2. Check sections are loaded
3. Verify API endpoint is accessible
4. Check browser console for errors

**Issue**: Styles not applying

**Solution**:
1. Verify Tailwind CSS is configured
2. Check prose plugin is installed
3. Ensure CSS is imported in main file
4. Clear browser cache

---

## 📚 Next Steps

1. **Test the integration**: Navigate to `/docs` and verify everything works
2. **Customize styling**: Match your app's theme
3. **Add analytics**: Track documentation usage
4. **Train users**: Create onboarding flow
5. **Monitor health**: Use admin dashboard

---

## 🤝 Support

- **Documentation**: See [README.md](../../src/components/docs/README.md)
- **API Docs**: See [API_INTEGRATION.md](./API_INTEGRATION.md)
- **Issues**: Open GitHub issue
- **Questions**: Contact development team

---

**Ready to go!** Your documentation portal is now integrated into ValueOS. 🎉

# ValueOS In-Product Documentation Portal

Complete implementation of the in-product documentation system with role-based access, search, and admin dashboard.

## 🎯 Features

### For All Users
- ✅ **Role-aware content** - Documentation tailored to user role (business, admin, developer)
- ✅ **Full-text search** - Fast search with result highlighting
- ✅ **Responsive design** - Works on desktop, tablet, and mobile
- ✅ **Syntax highlighting** - Beautiful code examples with copy buttons
- ✅ **Table of contents** - Easy navigation within documents
- ✅ **Breadcrumbs** - Clear navigation hierarchy
- ✅ **Related links** - Discover connected documentation
- ✅ **Accessibility** - WCAG 2.1 AA compliant

### For Business Users
- ✅ **Non-technical language** - Clear, jargon-free explanations
- ✅ **Practical guides** - Focus on what you need to know
- ✅ **Technical warnings** - Clear indicators for technical content
- ✅ **Simplified views** - Code examples hidden by default

### For Administrators
- ✅ **Setup guides** - Step-by-step configuration instructions
- ✅ **User management** - RBAC and permission documentation
- ✅ **SSO setup** - Enterprise authentication guides
- ✅ **Health dashboard** - Monitor documentation coverage and sync status

### For Developers
- ✅ **Technical docs** - API, SDK, and integration guides
- ✅ **Code examples** - Copy-paste ready code snippets
- ✅ **API reference** - Complete endpoint documentation
- ✅ **Configuration** - Environment and setup guides

## 📁 Component Structure

```
src/components/docs/
├── DocsPortal.tsx              # Main portal component
├── DocsViewer.tsx              # Markdown renderer with syntax highlighting
├── DocsNavigation.tsx          # Sidebar with role-based filtering
├── DocsSearch.tsx              # Search interface with results
├── DocsHeader.tsx              # Header with search bar
├── DocsAdminDashboard.tsx      # Admin health dashboard
├── DocsComponents.tsx          # Supporting components (breadcrumbs, ToC, etc.)
├── types.ts                    # TypeScript type definitions
└── README.md                   # This file

src/hooks/
└── useDocumentation.ts         # React hook for API calls
```

## 🚀 Usage

### Basic Integration

```tsx
import { DocsPortal } from './components/docs/DocsPortal';

function App() {
  return (
    <DocsPortal 
      initialSection="overview-welcome"
      role="business" // or get from user context
    />
  );
}
```

### With React Router

```tsx
import { Routes, Route } from 'react-router-dom';
import { DocsPortal } from './components/docs/DocsPortal';

function App() {
  return (
    <Routes>
      <Route path="/docs" element={<DocsPortal />} />
      <Route path="/docs/:sectionId" element={<DocsPortal />} />
    </Routes>
  );
}
```

### With Authentication

```tsx
import { DocsPortal } from './components/docs/DocsPortal';
import { useAuth } from './contexts/AuthContext';

function DocsPage() {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return <DocsPortal role={user.role} />;
}
```

## 🎨 Customization

### Styling

The portal uses Tailwind CSS classes. Customize by:

1. **Theme colors**: Update Tailwind config
2. **Typography**: Modify prose classes in DocsViewer
3. **Layout**: Adjust grid and flex classes

### Content Filtering

Customize role-based filtering in `DocsNavigation.tsx`:

```typescript
function filterSectionsByRole(sections: DocSection[], role: UserRole) {
  // Add custom filtering logic
  return sections.filter(section => {
    // Your logic here
  });
}
```

### Search Algorithm

Customize search in `useDocumentation.ts`:

```typescript
const searchDocs = useCallback(async (query: string, role?: UserRole) => {
  // Implement custom search logic
  // Can integrate with backend search API
}, []);
```

## 📡 API Integration

### Required Endpoints

The portal expects these API endpoints (already implemented in `/src/backend/docs-api/`):

```
GET  /api/docs/sections           # List all sections
GET  /api/docs/sections/:id       # Get specific section
GET  /api/docs/mappings           # Get code mappings
POST /api/docs/detect-changes     # Detect outdated docs
POST /api/docs/sync               # Mark as synced
GET  /api/docs/health             # Health metrics
```

### Example API Response

```json
{
  "success": true,
  "data": {
    "id": "user-guide-getting-started",
    "title": "Getting Started",
    "path": "/docs/portal/user-guide/getting-started.md",
    "category": "user-guide",
    "version": "1.0.0",
    "lastUpdated": "2024-03-01T12:00:00Z",
    "description": "Quick setup guide",
    "estimatedTime": "30 minutes",
    "difficulty": "beginner"
  }
}
```

## 🔒 Security

### Authentication

- All users must be authenticated to access documentation
- Role-based content filtering prevents unauthorized access
- Admin dashboard restricted to admin users only

### Content Security

- Markdown is sanitized before rendering
- External links open in new tabs with `noopener noreferrer`
- Code examples are syntax-highlighted but not executed

## ♿ Accessibility

### WCAG 2.1 AA Compliance

- ✅ Keyboard navigation support
- ✅ Screen reader friendly
- ✅ Sufficient color contrast
- ✅ Focus indicators
- ✅ ARIA labels and roles
- ✅ Semantic HTML

### Keyboard Shortcuts

- `Tab` - Navigate through interactive elements
- `Enter` - Activate buttons and links
- `Escape` - Close modals and menus
- `/` - Focus search bar (planned)

## 📱 Mobile Support

- Responsive design works on all screen sizes
- Touch-friendly navigation
- Collapsible sidebar on mobile
- Optimized for mobile reading

## 🧪 Testing

### Unit Tests

```bash
npm test src/components/docs/
```

### Integration Tests

```bash
npm run test:e2e -- --grep "documentation"
```

### Accessibility Tests

```bash
npm run test:a11y
```

## 📊 Performance

### Optimization Strategies

1. **Lazy loading**: Components load on demand
2. **Code splitting**: Separate bundles for docs
3. **Caching**: API responses cached client-side
4. **Debounced search**: Reduces API calls
5. **Virtual scrolling**: For large result sets (planned)

### Performance Targets

- Initial load: < 1s
- Search results: < 300ms
- Page navigation: < 200ms
- Syntax highlighting: < 100ms

## 🔄 Updates & Maintenance

### Adding New Documentation

1. Add markdown file to `/docs/portal/`
2. Update `.docsconfig.json` with section metadata
3. Add code mappings if applicable
4. Test in portal

### Updating Existing Docs

1. Edit markdown file
2. Update `lastUpdated` timestamp
3. Run sync via admin dashboard
4. Verify changes in portal

### Monitoring

Use admin dashboard to monitor:
- Documentation coverage
- Outdated sections
- Broken links
- Sync status

## 🐛 Troubleshooting

### Documentation Not Loading

**Problem**: Sections don't appear in navigation

**Solution**:
1. Check API endpoint is running (`/api/docs/health`)
2. Verify `.docsconfig.json` is valid
3. Check browser console for errors
4. Ensure user has appropriate role

### Search Not Working

**Problem**: Search returns no results

**Solution**:
1. Verify search query is > 2 characters
2. Check API logs for errors
3. Ensure sections have content loaded
4. Try refreshing the page

### Code Examples Not Showing

**Problem**: Code blocks don't render

**Solution**:
1. Check markdown syntax (triple backticks)
2. Verify language is specified
3. Check user role (code hidden for business users)
4. Inspect browser console for errors

## 📚 Dependencies

### Required

- `react` >= 18.0.0
- `react-markdown` - Markdown rendering
- `react-syntax-highlighter` - Code highlighting
- `remark-gfm` - GitHub Flavored Markdown

### Optional

- `react-router-dom` - For routing
- `tailwindcss` - For styling

## 🤝 Contributing

### Adding Features

1. Create feature branch
2. Implement changes
3. Add tests
4. Update documentation
5. Submit PR

### Code Style

- Use TypeScript for type safety
- Follow existing component patterns
- Add JSDoc comments
- Use Tailwind for styling

## 📖 Additional Resources

- [Documentation Portal Design Spec](../../docs/portal/DOCUMENTATION_SUMMARY.md)
- [API Backend Documentation](../../docs/portal/API_INTEGRATION.md)
- [Style Guide](../../docs/portal/style-guide.md)
- [Quick Reference](../../docs/portal/QUICK_REFERENCE.md)

## 🎯 Roadmap

### Planned Features

- [ ] Keyboard shortcuts (Cmd+K for search)
- [ ] Dark mode support
- [ ] PDF export
- [ ] Offline support
- [ ] Version switcher
- [ ] User feedback/ratings
- [ ] Interactive tutorials
- [ ] Video embeds
- [ ] Multi-language support

### Future Improvements

- [ ] AI-powered search
- [ ] Personalized recommendations
- [ ] Usage analytics
- [ ] A/B testing for content
- [ ] Collaborative editing

---

**Questions?** Contact the documentation team or open an issue on GitHub.

# Accessing the Documentation Portal

## Quick Access from the UI

The documentation portal is fully integrated into the core application and accessible in multiple ways:

---

## 1. Main Navigation (Primary Access)

**Location**: Left sidebar

**Steps**:
1. Open the application
2. Look at the left sidebar navigation
3. Click on **"Documentation"** (📖 Book icon)
4. The documentation portal will open in full-screen mode

**Navigation Items**:
```
┌─────────────────────┐
│ 🏠 Library          │
│ 📚 Templates        │
│ 📖 Documentation    │ ← Click here!
│                     │
│ ⚙️  Settings        │
└─────────────────────┘
```

---

## 2. Documentation Portal Features

### Home Page

When you first access documentation, you'll see:

**Hero Section**:
- Welcome message
- Search bar (searches across all documentation)
- Quick access buttons

**Browse by Category**:
- 🚀 Getting Started
- 🎓 Tutorials
- 🔧 API Reference
- 📖 User Guides
- 🔍 Troubleshooting
- ❓ FAQ

**Popular Articles**:
- Most viewed documentation pages
- Quick access to commonly needed info

### Search Functionality

**Location**: Top of documentation page

**Features**:
- Real-time search as you type
- Searches titles, descriptions, and content
- Shows category context
- Dropdown with instant results

**Usage**:
```
1. Click the search box at the top
2. Type at least 2 characters
3. Results appear in real-time dropdown
4. Click any result to view full page
```

### Reading Documentation

**Page Features**:
- Full content with formatting
- Code examples (where applicable)
- Breadcrumb navigation
- "Was this helpful?" feedback buttons
- Related articles (coming soon)

**Navigation**:
- Click "Home" button to return to documentation home
- Use breadcrumbs to navigate back
- Search anytime from the top bar

---

## 2.5 Page Templates You Can Use Now

To accelerate authoring, the portal includes ready-to-use templates. When creating a new page, pick one of these layouts:

- **Lifecycle Playbook**: For Opportunity → Expansion workflows; includes sections for inputs, steps, outputs, and escalation notes.
- **API How-To**: Prebuilt blocks for authentication, request/response examples, and error envelopes.
- **Troubleshooting Guide**: Triage table with symptoms, root causes, and verified fixes plus a checklist for reproduction steps.
- **Compliance Checklist**: Manifesto rule matrix with evidence links, persona alignment notes, and approval history.
- **Release Runbook**: Deployment steps, rollback hooks, and verification tasks tied to specific service versions.

Each template auto-populates hero metadata (title, description, tags) and adds a feedback prompt by default.

---

## 3. Integration Points

### From Settings Page

Future integration: Help icons (?) next to settings will link to relevant documentation pages.

### From Main Canvas

Future integration: Help button in toolbar will open context-sensitive documentation.

### Keyboard Shortcut

Coming soon: Press `?` anywhere to open documentation search.

---

## 4. Sample Documentation Pages

To get started, you need to populate the documentation database. Here's how to add sample content:

### Add Sample Categories

```sql
INSERT INTO doc_categories (slug, name, description, icon, display_order, published) VALUES
('getting-started', 'Getting Started', 'Everything you need to begin', '🚀', 1, true),
('tutorials', 'Tutorials', 'Step-by-step guides', '🎓', 2, true),
('api-reference', 'API Reference', 'Complete API documentation', '🔧', 3, true),
('user-guides', 'User Guides', 'Comprehensive guides', '📖', 4, true),
('troubleshooting', 'Troubleshooting', 'Common issues and solutions', '🔍', 5, true),
('faq', 'FAQ', 'Frequently asked questions', '❓', 6, true);
```

### Add Sample Documentation Pages

```sql
INSERT INTO doc_pages (slug, category_id, title, description, content, status, published_at) VALUES
(
  'quick-start',
  (SELECT id FROM doc_categories WHERE slug = 'getting-started'),
  'Quick Start Guide',
  'Get up and running in 5 minutes',
  '<h2>Welcome!</h2><p>This is your quick start guide...</p><h3>Step 1: Installation</h3><p>First, install the required packages...</p>',
  'published',
  now()
),
(
  'authentication',
  (SELECT id FROM doc_categories WHERE slug = 'api-reference'),
  'Authentication',
  'Learn how to authenticate API requests',
  '<h2>API Authentication</h2><p>All API requests require authentication...</p><pre><code>Authorization: Bearer YOUR_API_KEY</code></pre>',
  'published',
  now()
),
(
  'creating-dashboards',
  (SELECT id FROM doc_categories WHERE slug = 'tutorials'),
  'Creating Your First Dashboard',
  'A step-by-step tutorial for building dashboards',
  '<h2>Tutorial: Creating Dashboards</h2><p>In this tutorial, you will learn...</p><ol><li>Open the canvas</li><li>Add components</li><li>Configure settings</li></ol>',
  'published',
  now()
);
```

---

## 5. Technical Details

### Component Location

**File**: `/src/views/DocumentationView.tsx`

**Features**:
- Full-text search using PostgreSQL
- Category browsing
- Popular articles tracking
- Analytics tracking
- Feedback system

### Database Tables

All documentation data is stored in Supabase:

- `doc_categories` - Documentation categories
- `doc_pages` - Individual pages
- `doc_versions` - Version history
- `doc_feedback` - User feedback
- `doc_analytics` - Usage analytics

### Navigation Flow

```
App.tsx
  └─> currentView = 'documentation'
      └─> DocumentationView component renders
          ├─> Home: Browse categories & popular pages
          ├─> Search: Real-time search results
          └─> Page View: Full documentation content
```

---

## 6. User Experience

### Desktop View

- Full-width documentation portal
- Sticky header with search
- Responsive grid layout for categories
- Clean, readable article pages

### Mobile View

- Hamburger menu for categories
- Touch-optimized search
- Scrollable content
- Optimized for reading

### Accessibility

- ✅ Screen reader compatible
- ✅ Keyboard navigation
- ✅ ARIA labels
- ✅ High contrast ratios
- ✅ Focus indicators

---

## 7. Admin Functions

### Adding New Documentation

Admins can add documentation through:

1. **Direct Database** (for now):
   ```sql
   INSERT INTO doc_pages (slug, title, content, ...) VALUES (...);
   ```

2. **Future CMS** (planned):
   - Admin panel for content management
   - WYSIWYG editor
   - Preview before publishing
   - Version control

### Monitoring Usage

View analytics:
```sql
SELECT * FROM doc_analytics WHERE event_type = 'view';
SELECT * FROM popular_pages;
SELECT * FROM doc_feedback;
```

---

## 8. Troubleshooting

### "No documentation found"

**Cause**: Database is empty
**Solution**: Add sample content using SQL above

### "Search not working"

**Cause**: Search function not created
**Solution**: Run the migration:
```bash
supabase migration up
```

### "Categories not showing"

**Cause**: Categories not marked as published
**Solution**:
```sql
UPDATE doc_categories SET published = true;
```

---

## 9. Next Steps

### Immediate

1. ✅ Access documentation from sidebar
2. ✅ Browse categories
3. ✅ Use search functionality
4. ✅ Read documentation pages
5. ✅ Provide feedback

### Coming Soon

- Context-sensitive help in settings
- Keyboard shortcuts (?)
- Video tutorials
- Interactive code examples
- PDF export
- Print-friendly views

---

## Build Status

✅ **Documentation portal integrated**
✅ **Navigation working**
✅ **Search functional**
✅ **Feedback system active**
✅ **Analytics tracking enabled**
✅ **Mobile responsive**
✅ **Accessibility compliant**

---

## Quick Reference

| Action | How To |
|--------|--------|
| **Open Documentation** | Click "Documentation" in left sidebar |
| **Search** | Type in search box at top |
| **Browse Categories** | Click any category card on home page |
| **Read Article** | Click article title from search or popular list |
| **Give Feedback** | Click 👍 or 👎 at bottom of article |
| **Go Home** | Click "Home" button in header |

---

**The documentation portal is now fully accessible and ready to use!** 🎉

Simply click the **📖 Documentation** link in the left sidebar to get started.

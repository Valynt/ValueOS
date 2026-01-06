# Admin UI Guide - Configuration Management

## Overview

Admin UI components for managing organization configurations through a visual interface.

## Components Created

### 1. ConfigurationPanel (Main Component)
**File**: `components/admin/ConfigurationPanel.tsx`

**Features**:
- Tabbed interface for 6 configuration categories
- Real-time configuration loading
- Save/update functionality
- Cache clearing
- Loading states
- Error handling with toast notifications

**Usage**:
```tsx
import { ConfigurationPanel } from '@/components/admin/ConfigurationPanel';

<ConfigurationPanel 
  organizationId="org-123"
  userRole="tenant_admin"
/>
```

### 2. OrganizationSettings
**File**: `components/admin/configuration/OrganizationSettings.tsx`

**Features**:
- Tenant provisioning (status, resource limits)
- Custom branding (logo, colors, fonts)
- Data residency (region selection, compliance)
- Visual color pickers
- Badge-based compliance selection

**Sections**:
- Tenant Provisioning
- Custom Branding
- Data Residency

### 3. AISettings
**File**: `components/admin/configuration/AISettings.tsx`

**Features**:
- LLM spending limits with visual inputs
- Model routing configuration
- Agent toggles with switches
- HITL thresholds with sliders
- Real-time value display

**Sections**:
- LLM Spending Limits
- Model Routing
- Agent Toggles
- HITL Thresholds

### 4. Placeholder Components
**Files**:
- `components/admin/configuration/IAMSettings.tsx`
- `components/admin/configuration/OperationalSettings.tsx`
- `components/admin/configuration/SecuritySettings.tsx`
- `components/admin/configuration/BillingSettings.tsx`

**Status**: Placeholder UI ready for implementation

## UI Structure

```
ConfigurationPanel
├── Header (Title, Actions)
├── Tabs (6 categories)
│   ├── Organization
│   │   ├── Tenant Provisioning Card
│   │   ├── Custom Branding Card
│   │   └── Data Residency Card
│   ├── IAM (Placeholder)
│   ├── AI
│   │   ├── LLM Spending Limits Card
│   │   ├── Model Routing Card
│   │   ├── Agent Toggles Card
│   │   └── HITL Thresholds Card
│   ├── Operational (Placeholder)
│   ├── Security (Placeholder)
│   └── Billing (Placeholder)
└── Toast Notifications
```

## Integration

### 1. Add to Admin Dashboard

```tsx
// app/admin/configurations/page.tsx
import { ConfigurationPanel } from '@/components/admin/ConfigurationPanel';
import { getCurrentUser } from '@/lib/auth';

export default async function ConfigurationsPage() {
  const user = await getCurrentUser();
  
  return (
    <div className="container mx-auto py-6">
      <ConfigurationPanel 
        organizationId={user.organizationId}
        userRole={user.role}
      />
    </div>
  );
}
```

### 2. Add Navigation Link

```tsx
// components/admin/Sidebar.tsx
<NavLink href="/admin/configurations">
  <Settings className="mr-2 h-4 w-4" />
  Configurations
</NavLink>
```

### 3. Protect Route

```tsx
// middleware.ts
if (pathname.startsWith('/admin/configurations')) {
  if (!['tenant_admin', 'vendor_admin'].includes(user.role)) {
    return NextResponse.redirect('/unauthorized');
  }
}
```

## Features

### Real-time Updates
- Configurations load on mount
- Updates save immediately
- Cache invalidation on save
- Optimistic UI updates

### Access Control
- Role-based UI rendering
- Disabled states for read-only fields
- Vendor admin sees all options
- Tenant admin sees limited options

### User Experience
- Loading spinners during fetch/save
- Toast notifications for success/error
- Validation before save
- Confirmation for destructive actions

### Performance
- Lazy loading of configuration data
- Debounced save operations
- Cached API responses
- Minimal re-renders

## Styling

Uses shadcn/ui components:
- Card, CardHeader, CardTitle, CardDescription, CardContent
- Tabs, TabsList, TabsTrigger, TabsContent
- Button, Input, Label, Switch, Select, Slider
- Badge, Toast

**Theme**: Follows ValueOS design system

## API Integration

### Fetch Configurations
```typescript
GET /api/admin/configurations?organizationId={id}

Response:
{
  organizationId: string;
  configurations: {
    organization: {...},
    iam: {...},
    ai: {...},
    operational: {...},
    security: {...},
    billing: {...}
  }
}
```

### Update Configuration
```typescript
PUT /api/admin/configurations

Body:
{
  organizationId: string;
  category: string;
  setting: string;
  value: any;
}

Response:
{
  success: boolean;
  data: {...}
}
```

### Clear Cache
```typescript
DELETE /api/admin/configurations/cache?organizationId={id}

Response:
{
  success: boolean;
  message: string;
}
```

## Future Enhancements

### Phase 2 - Complete All Tabs
- [ ] Implement IAM Settings UI
- [ ] Implement Operational Settings UI
- [ ] Implement Security Settings UI
- [ ] Implement Billing Settings UI

### Phase 3 - Advanced Features
- [ ] Configuration history/versioning
- [ ] Bulk import/export
- [ ] Configuration templates
- [ ] Validation rules UI
- [ ] Webhook configuration UI
- [ ] Advanced routing rules builder

### Phase 4 - Enhanced UX
- [ ] Inline editing
- [ ] Drag-and-drop reordering
- [ ] Search/filter configurations
- [ ] Configuration comparison
- [ ] Audit log viewer
- [ ] Real-time collaboration

## Testing

### Component Tests

```typescript
// ConfigurationPanel.test.tsx
describe('ConfigurationPanel', () => {
  it('should load configurations on mount', async () => {
    render(<ConfigurationPanel organizationId="test" userRole="tenant_admin" />);
    await waitFor(() => {
      expect(screen.getByText('Configuration Management')).toBeInTheDocument();
    });
  });

  it('should update configuration', async () => {
    render(<ConfigurationPanel organizationId="test" userRole="tenant_admin" />);
    
    const input = screen.getByLabelText('Max Users');
    fireEvent.change(input, { target: { value: '100' } });
    
    const saveButton = screen.getByText('Save Provisioning');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Configuration updated successfully')).toBeInTheDocument();
    });
  });
});
```

### Integration Tests

```typescript
// configurations.e2e.test.ts
describe('Configuration Management E2E', () => {
  it('should allow tenant admin to update settings', async () => {
    await page.goto('/admin/configurations');
    await page.click('[data-tab="organization"]');
    await page.fill('[id="maxUsers"]', '100');
    await page.click('button:has-text("Save Provisioning")');
    await expect(page.locator('text=Configuration updated successfully')).toBeVisible();
  });
});
```

## Troubleshooting

### Issue: Configurations not loading
**Solution**: 
- Check API endpoint is accessible
- Verify authentication token
- Check browser console for errors
- Verify organizationId is valid

### Issue: Save not working
**Solution**:
- Check network tab for API errors
- Verify user has correct permissions
- Check validation errors
- Verify request payload format

### Issue: UI not updating after save
**Solution**:
- Check cache invalidation
- Verify state updates
- Check React DevTools
- Force refresh configurations

## Accessibility

- Keyboard navigation supported
- ARIA labels on all inputs
- Focus management
- Screen reader friendly
- High contrast mode compatible

## Mobile Responsiveness

- Responsive grid layouts
- Touch-friendly controls
- Collapsible sections
- Mobile-optimized tabs

## Related Documentation

- [Configuration Matrix Implementation](./CONFIGURATION_MATRIX_IMPLEMENTATION.md)
- [API Documentation](./api/configurations.md)
- [Component Library](./components/README.md)
- [Design System](./design-system.md)

---

**Components Created**: 7

**Status**: Phase 1 Complete (Organization & AI tabs)

**Next Phase**: Complete remaining tabs (IAM, Operational, Security, Billing)

**Last Updated**: December 30, 2024

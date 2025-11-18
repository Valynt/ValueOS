# Settings Migration Status

## Overview

The enterprise SaaS settings schema migration is **already created** and ready for application.

**Migration File**: `supabase/migrations/20251117151356_create_enterprise_saas_settings_schema.sql`

## Migration Details

### File Information
- **Lines**: 915
- **Created**: November 17, 2025
- **Status**: ✅ Ready to apply

### Schema Components

The migration creates a comprehensive 15-table schema for enterprise SaaS applications:

#### Core User & Organization Management (3 tables)
1. **users** - Extended user profiles with preferences and metadata
2. **organizations** - Company/organization entities
3. **teams** - Workspaces/teams within organizations

#### Security & Access Control (4 tables)
4. **roles** - Role definitions with permissions
5. **user_roles** - Junction table for user-role assignments
6. **organization_members** - Organization membership and roles
7. **team_members** - Team membership

#### Session & Audit Management (2 tables)
8. **user_sessions** - Active user sessions for security tracking
9. **audit_logs** - Comprehensive action audit trail

#### Integrations & API Management (3 tables)
10. **integrations** - Third-party integrations
11. **api_keys** - Organization API keys
12. **webhooks** - Webhook configurations

#### User Experience & Billing (2 tables)
13. **notification_preferences** - User notification settings
14. **billing_invoices** - Invoice history

#### Policy & Compliance (1 table)
15. **policy_enforcement** - Organization security policies

## Features

### Multi-Tenancy
- Organization-level isolation
- Team-based workspaces
- User membership across multiple organizations

### Security
- Row Level Security (RLS) enabled on all tables
- Permission-based access control
- Session management
- API key hashing
- Webhook secret management

### Compliance
- Comprehensive audit trail
- Immutable audit logs
- SOC2 and GDPR ready
- Policy enforcement

### Performance
- Optimized indexes on all foreign keys
- Efficient query patterns
- Proper data types for performance

## Default System Roles

The migration includes 5 default system roles:

1. **Organization Owner**
   - Permissions: Full access to all organization settings and resources
   - Includes: organization.manage, members.manage, team.manage, billing.manage, api_keys.manage, webhooks.manage, integrations.manage, security.manage, audit.view

2. **Organization Admin**
   - Permissions: Can manage members, teams, and integrations
   - Includes: members.manage, team.manage, integrations.manage, audit.view

3. **Organization Member**
   - Permissions: Standard organization member with basic access
   - Includes: team.view

4. **Team Admin**
   - Permissions: Can manage specific teams
   - Includes: team.manage

5. **Team Member**
   - Permissions: Standard team member
   - Includes: (no special permissions)

## Row Level Security (RLS) Policies

### Users Table
- Users can view and update their own profile
- Org members can view other members in their organization

### Organizations Table
- Users can view organizations they belong to
- Org admins can manage their organization

### Teams Table
- Team members can view their teams
- Team admins can manage their teams

### Roles Table
- All authenticated users can view system roles
- Org admins can manage custom roles in their organization

### User Roles Table
- Users can view their own roles
- Org admins can manage role assignments

### Organization Members Table
- Org members can view other members
- Org admins can manage membership

### Team Members Table
- Team members can view team membership
- Team admins can manage team membership

### User Sessions Table
- Users can view and manage their own sessions

### Audit Logs Table
- Users can view audit logs for their organization (with permission)

### Integrations Table
- Users can view integrations in their organization
- Users can manage their own integrations
- Org admins can manage org integrations

### API Keys Table
- Users can view API keys in their organization (with permission)
- Org admins can manage API keys

### Webhooks Table
- Users can view webhooks in their organization (with permission)
- Org admins can manage webhooks

### Notification Preferences Table
- Users can manage their own notification preferences

### Billing Invoices Table
- Users can view invoices in their organization (with permission)

### Policy Enforcement Table
- Org members can view policy enforcement
- Org admins can manage policy enforcement

## Helper Functions

The migration includes helper functions for RLS policies:

### user_is_org_member(user_id, org_id)
Checks if a user is a member of an organization.

### user_has_org_permission(user_id, org_id, permission)
Checks if a user has a specific permission in an organization.

### user_is_team_member(user_id, team_id)
Checks if a user is a member of a team.

### user_has_team_permission(user_id, team_id, permission)
Checks if a user has a specific permission in a team.

## Application Instructions

### Option 1: Using Supabase CLI (Recommended)

```bash
# Navigate to project root
cd /workspaces/ValueCanvas

# Apply migration
supabase db push

# Or apply specific migration
supabase migration up
```

### Option 2: Using Supabase Dashboard

1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Copy contents of migration file
4. Execute SQL

### Option 3: Programmatic Application

```typescript
import { supabase } from './lib/supabase';
import fs from 'fs';

const migrationSQL = fs.readFileSync(
  'supabase/migrations/20251117151356_create_enterprise_saas_settings_schema.sql',
  'utf-8'
);

await supabase.rpc('exec_sql', { sql: migrationSQL });
```

## Verification

After applying the migration, verify:

### 1. Tables Created

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'users', 'organizations', 'teams', 'roles', 'user_roles',
  'organization_members', 'team_members', 'user_sessions',
  'audit_logs', 'integrations', 'api_keys', 'webhooks',
  'notification_preferences', 'billing_invoices', 'policy_enforcement'
);
```

Expected: 15 tables

### 2. RLS Enabled

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'users', 'organizations', 'teams', 'roles', 'user_roles',
  'organization_members', 'team_members', 'user_sessions',
  'audit_logs', 'integrations', 'api_keys', 'webhooks',
  'notification_preferences', 'billing_invoices', 'policy_enforcement'
);
```

Expected: All tables should have `rowsecurity = true`

### 3. Default Roles Created

```sql
SELECT role_name, is_custom_role 
FROM roles 
WHERE is_custom_role = false;
```

Expected: 5 system roles

### 4. Helper Functions Created

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'user_is_org_member',
  'user_has_org_permission',
  'user_is_team_member',
  'user_has_team_permission'
);
```

Expected: 4 helper functions

## Integration with Application

### 1. Update SettingsService

The existing `SettingsService.ts` needs to be updated to use the new schema:

```typescript
// Current: Uses generic 'settings' table
// New: Uses specific tables (users, organizations, teams, etc.)
```

### 2. Update settingsRegistry.ts

The existing `settingsRegistry.ts` already defines the UI structure. It needs to be extended with:
- Default settings loading
- Tenant override merging
- useSettings() hook

### 3. Update Settings UI Components

Existing components in `src/views/Settings/` need to be connected to the new schema:
- UserProfile.tsx
- UserSecurity.tsx
- TeamSettings.tsx
- TeamPermissions.tsx
- OrganizationGeneral.tsx
- OrganizationRoles.tsx
- OrganizationSecurity.tsx
- OrganizationUsers.tsx
- OrganizationBilling.tsx

## Next Steps

1. ✅ Migration file exists and is comprehensive
2. ⏳ Apply migration to Supabase database
3. ⏳ Extend settingsRegistry.ts with tenant overrides and useSettings hook
4. ⏳ Connect Settings UI components to new schema
5. ⏳ Implement caching layer for settings
6. ⏳ Add Storybook stories and tests

## Notes

- The migration is idempotent and safe to run multiple times
- All tables have proper indexes for performance
- RLS policies ensure data isolation
- Default roles provide a starting point for permissions
- Helper functions simplify RLS policy definitions

## References

- Migration File: `supabase/migrations/20251117151356_create_enterprise_saas_settings_schema.sql`
- Settings Service: `src/services/SettingsService.ts`
- Settings Registry: `src/lib/settingsRegistry.ts`
- Settings Views: `src/views/Settings/`

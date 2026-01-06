# User Management

Manage users, roles, and permissions for your ValueOS organization.

## 🎯 Overview

ValueOS uses role-based access control (RBAC) to ensure users have appropriate access to features and data. This guide covers everything you need to manage users effectively.

---

## 👥 User Roles

### Admin

**Full access** to all organization features and settings.

**Permissions:**
- Manage users and roles
- Configure integrations
- Modify organization settings
- Access billing and subscription
- Create and delete workspaces
- View all data across organization

**Best for:**
- Organization administrators
- IT managers
- Security officers

**Limitations:**
- None - full access to everything

---

### Member

**Standard access** for day-to-day value tracking.

**Permissions:**
- Create and edit metrics
- Build dashboards
- View all organization data
- Invite users (with approval)
- Manage own workspaces
- Access API with personal tokens

**Best for:**
- Engineering managers
- Product managers
- Team leads
- Business analysts

**Limitations:**
- Cannot modify organization settings
- Cannot manage billing
- Cannot delete other users' workspaces

---

### Viewer

**Read-only access** to dashboards and reports.

**Permissions:**
- View dashboards
- Export reports
- Comment on metrics
- Create personal views

**Best for:**
- Executives
- Stakeholders
- External consultants
- Finance teams

**Limitations:**
- Cannot create or edit metrics
- Cannot modify dashboards
- Cannot access integrations
- No API access

---

### Custom Roles

**Enterprise plan only** - Create custom roles with specific permissions.

**Available permissions:**
- Metric management
- Dashboard creation
- Integration access
- User management
- Billing access
- API access
- Data export
- Workspace management

Contact your CSM to set up custom roles.

---

## ➕ Inviting Users

### Single User Invitation

1. Navigate to **Settings** → **Users**
2. Click **Invite User**
3. Fill in the form:

```
Email: alice@acme-corp.com
Role: Member
Workspaces: Engineering, Product
Message: Welcome to ValueOS! Check out our team dashboard.
```

4. Click **Send Invitation**

The user will receive an email with a signup link valid for 7 days.

---

### Bulk Invitation

For inviting multiple users at once:

1. Click **Settings** → **Users** → **Bulk Invite**
2. Choose your method:

**Option A: Paste Emails**
```
alice@acme-corp.com, Member
bob@acme-corp.com, Member
carol@acme-corp.com, Viewer
```

**Option B: Upload CSV**
Download template, fill in details, and upload:
```csv
email,role,workspaces,message
alice@acme-corp.com,Member,"Engineering,Product",Welcome!
bob@acme-corp.com,Member,Engineering,Welcome!
carol@acme-corp.com,Viewer,All,Welcome!
```

3. Review the preview
4. Click **Send Invitations**

---

### Invitation Settings

Configure invitation behavior:

**Settings** → **Users** → **Invitation Settings**

- **Auto-approve domain**: Automatically approve users from your email domain
- **Require approval**: Admin must approve all invitations
- **Default role**: Role assigned to auto-approved users
- **Expiration**: How long invitation links remain valid (1-30 days)

**Example configuration:**
```
Auto-approve domain: @acme-corp.com
Default role: Member
Require approval: No
Expiration: 7 days
```

---

## 🔄 Managing Existing Users

### Viewing Users

**Settings** → **Users** shows all organization users:

| Column | Description |
|--------|-------------|
| **Name** | User's full name |
| **Email** | User's email address |
| **Role** | Current role |
| **Status** | Active, Invited, Suspended |
| **Last Active** | Last login timestamp |
| **Workspaces** | Assigned workspaces |

**Filters:**
- By role
- By status
- By workspace
- By last active date

---

### Editing User Details

1. Click on a user in the list
2. Modify details:
   - Name
   - Role
   - Workspaces
   - Status

3. Click **Save Changes**

> ⚠️ **Warning**: Changing a user's role takes effect immediately. They may lose access to features they were using.

---

### Changing User Roles

1. Select user from list
2. Click **Change Role**
3. Select new role
4. Add reason for change (audit trail)
5. Click **Confirm**

**Role change effects:**

| From | To | Effect |
|------|-----|--------|
| Admin → Member | Loses admin privileges immediately |
| Member → Viewer | Loses edit access, keeps view access |
| Viewer → Member | Gains edit access to metrics and dashboards |
| Any → Admin | Gains full access immediately |

---

### Suspending Users

Temporarily disable access without removing the user:

1. Select user
2. Click **Suspend**
3. Add reason (optional)
4. Click **Confirm**

**Effects:**
- User cannot log in
- API tokens are disabled
- User remains in seat count
- Data and workspaces are preserved

**To reactivate:**
1. Select suspended user
2. Click **Reactivate**
3. User can log in immediately

---

### Removing Users

Permanently remove a user from your organization:

1. Select user
2. Click **Remove User**
3. Choose what to do with their data:
   - **Transfer to another user**: Assign their metrics and dashboards
   - **Delete all data**: Permanently remove their work
   - **Archive**: Keep data but mark as archived

4. Click **Confirm Removal**

> ⚠️ **Warning**: Removing a user is permanent. They will need a new invitation to rejoin.

**Seat billing:**
- Removed users free up seats immediately
- Billing adjusts at next cycle
- No refunds for partial months

---

## 👨‍👩‍👧‍👦 Teams & Workspaces

### Creating Teams

Organize users into teams for easier permission management:

1. **Settings** → **Teams** → **Create Team**
2. Fill in details:

```
Team Name: Engineering
Description: Engineering team workspace
Members: Select from user list
Default Role: Member
```

3. Click **Create Team**

---

### Workspace Management

Workspaces isolate data and dashboards for different teams:

**Creating a Workspace:**
1. **Settings** → **Workspaces** → **Create Workspace**
2. Configure:

```
Workspace Name: Mobile Team
Description: Mobile app development metrics
Team: Engineering
Visibility: Team only
```

3. Click **Create**

**Workspace Visibility:**
- **Private**: Only assigned users
- **Team**: All team members
- **Organization**: All users

---

## 🔐 Permission Management

### Permission Levels

Permissions are hierarchical:

```
Organization
  └── Workspace
      └── Dashboard
          └── Metric
```

**Inheritance:**
- Organization admins have access to all workspaces
- Workspace members have access to all dashboards in that workspace
- Dashboard viewers can see all metrics in that dashboard

---

### Granular Permissions

**Enterprise only** - Set specific permissions per resource:

1. Navigate to resource (workspace, dashboard, or metric)
2. Click **Permissions**
3. Add users or teams with specific access:

```
User: alice@acme-corp.com
Permission: Edit
Expires: Never

Team: Finance
Permission: View
Expires: 2024-12-31
```

4. Click **Save**

---

## 🔑 Password & Security

### Password Requirements

Default requirements:
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Admins can configure:**
- Minimum length (8-32 characters)
- Complexity requirements
- Password expiration (30-365 days)
- Password history (prevent reuse)

---

### Password Reset

**User-initiated:**
1. Click **Forgot Password** on login page
2. Enter email address
3. Check email for reset link
4. Create new password

**Admin-initiated:**
1. **Settings** → **Users** → Select user
2. Click **Reset Password**
3. User receives reset email

---

### Two-Factor Authentication (2FA)

**User setup:**
1. **Profile** → **Security** → **Enable 2FA**
2. Scan QR code with authenticator app
3. Enter verification code
4. Save backup codes

**Admin enforcement:**
1. **Settings** → **Security** → **Require 2FA**
2. Set grace period (0-30 days)
3. Users must enable 2FA by deadline

---

### Session Management

**Settings** → **Security** → **Sessions**

Configure:
- **Session timeout**: 15 minutes to 24 hours
- **Remember me**: Allow extended sessions
- **Concurrent sessions**: Maximum active sessions per user
- **Force logout**: Immediately end all user sessions

---

## 📊 User Analytics

### Activity Monitoring

Track user engagement:

**Settings** → **Analytics** → **User Activity**

**Metrics:**
- Login frequency
- Feature usage
- Dashboard views
- Metric creation
- API calls

**Use cases:**
- Identify inactive users
- Measure adoption
- Plan training needs
- Optimize seat allocation

---

### Audit Logs

Track all user actions:

**Settings** → **Audit Logs**

**Logged events:**
- User login/logout
- Role changes
- Permission modifications
- Data access
- Configuration changes
- Integration activity

**Retention:**
- Starter: 30 days
- Professional: 1 year
- Enterprise: Unlimited

**Export:**
- CSV format
- JSON format
- API access

---

## 🆘 Common Scenarios

### Onboarding New Team Member

1. Invite user with Member role
2. Assign to relevant workspaces
3. Add to team(s)
4. Share onboarding dashboard
5. Schedule training session

---

### Offboarding Departing Employee

1. Suspend user immediately
2. Review their data and dashboards
3. Transfer ownership to manager
4. Remove user after transfer complete
5. Revoke API tokens
6. Document in audit log

---

### Contractor Access

1. Invite with Viewer role
2. Set expiration date on invitation
3. Limit to specific workspace
4. Enable audit logging
5. Remove access when contract ends

---

### Department Reorganization

1. Create new teams/workspaces
2. Bulk update user assignments
3. Transfer data between workspaces
4. Update permission groups
5. Notify affected users

---

## 💡 Best Practices

### Security
- ✅ Enable 2FA for all users
- ✅ Use SSO when available
- ✅ Review permissions quarterly
- ✅ Monitor audit logs regularly
- ✅ Remove inactive users promptly

### Organization
- ✅ Use teams for permission management
- ✅ Create workspaces by department
- ✅ Document role assignments
- ✅ Maintain user directory
- ✅ Regular access reviews

### Onboarding
- ✅ Create onboarding checklist
- ✅ Provide training materials
- ✅ Assign mentor/buddy
- ✅ Share relevant dashboards
- ✅ Schedule follow-up

---

## 🔗 Related Documentation

- [SSO Setup](./sso-setup.md) - Configure enterprise authentication
- [Security Settings](./settings.md#security) - Organization security
- [API Access](../developer-guide/authentication.md) - API authentication
- [Billing](./billing.md) - Manage seats and subscription

---

> **Note**: User management features vary by plan. See [pricing](../overview/pricing.md) for details.

> **Tip**: Use teams and workspaces to simplify permission management as your organization grows.

> ⚠️ **Warning**: Always transfer or archive user data before removing users. Deletion is permanent and cannot be undone.

# SSO Setup

Configure Single Sign-On (SSO) for seamless enterprise authentication with ValueOS.

## 🎯 Overview

SSO allows your team to access ValueOS using your organization's identity provider. This provides:
- **Single set of credentials** across all tools
- **Centralized access control** through your IdP
- **Automatic provisioning** and deprovisioning
- **Enhanced security** with your existing policies

**Available on:** Professional and Enterprise plans

---

## 🔐 Supported Providers

ValueOS supports industry-standard authentication protocols:

| Provider | Protocol | Auto-Provisioning | Notes |
|----------|----------|-------------------|-------|
| **Okta** | SAML 2.0 | ✅ (with SCIM) | Recommended |
| **Azure AD** | SAML 2.0, OAuth | ✅ (with SCIM) | Full support |
| **Google Workspace** | OAuth 2.0 | ✅ | Easy setup |
| **OneLogin** | SAML 2.0 | ✅ (with SCIM) | Full support |
| **Auth0** | SAML 2.0, OAuth | ✅ | Full support |
| **Custom SAML** | SAML 2.0 | ❌ | Manual provisioning |
| **Custom OAuth** | OAuth 2.0 | ❌ | Manual provisioning |

---

## ⚡ Quick Start

### Prerequisites

Before starting, ensure you have:
- [ ] Admin access to your identity provider
- [ ] Admin access to ValueOS
- [ ] Professional or Enterprise plan
- [ ] List of users to provision

### Setup Time

- **Okta/Azure AD**: 15-20 minutes
- **Google Workspace**: 10-15 minutes
- **Custom SAML**: 30-45 minutes

---

## 🔵 Okta Setup

### Step 1: Create Application in Okta

1. Log in to Okta Admin Console
2. Navigate to **Applications** → **Applications**
3. Click **Create App Integration**
4. Select **SAML 2.0**
5. Click **Next**

### Step 2: Configure General Settings

```
App name: ValueOS
App logo: [Upload ValueOS logo]
App visibility: Show in Okta dashboard
```

Click **Next**

### Step 3: Configure SAML Settings

**Single sign-on URL:**
```
https://app.valueos.com/auth/saml/callback
```

**Audience URI (SP Entity ID):**
```
https://app.valueos.com/auth/saml/metadata
```

**Name ID format:**
```
EmailAddress
```

**Application username:**
```
Email
```

**Attribute Statements:**
| Name | Value |
|------|-------|
| email | user.email |
| firstName | user.firstName |
| lastName | user.lastName |
| groups | user.groups |

Click **Next** → **Finish**

### Step 4: Get Okta Metadata

1. In your new app, go to **Sign On** tab
2. Right-click **Identity Provider metadata**
3. Copy link address
4. Save this URL for ValueOS configuration

### Step 5: Configure ValueOS

1. Log in to ValueOS as Admin
2. Navigate to **Settings** → **Authentication** → **SSO**
3. Click **Configure SSO**
4. Select **Okta**
5. Fill in details:

```
Provider: Okta
Metadata URL: [Paste from Step 4]
Default Role: Member
Auto-provision: Enabled
Domain: acme-corp.com
```

6. Click **Save and Test**

### Step 6: Test Connection

1. Click **Test SSO Connection**
2. You'll be redirected to Okta
3. Log in with your Okta credentials
4. Verify successful authentication
5. Check that user is created in ValueOS

### Step 7: Assign Users in Okta

1. In Okta, go to your ValueOS app
2. Click **Assignments** tab
3. Click **Assign** → **Assign to People** or **Assign to Groups**
4. Select users/groups
5. Click **Assign** → **Done**

---

## 🔷 Azure AD Setup

### Step 1: Create Enterprise Application

1. Log in to Azure Portal
2. Navigate to **Azure Active Directory** → **Enterprise Applications**
3. Click **New application**
4. Click **Create your own application**
5. Name it "ValueOS"
6. Select **Integrate any other application you don't find in the gallery**
7. Click **Create**

### Step 2: Configure Single Sign-On

1. In your ValueOS app, click **Single sign-on**
2. Select **SAML**
3. Click **Edit** on Basic SAML Configuration

**Identifier (Entity ID):**
```
https://app.valueos.com/auth/saml/metadata
```

**Reply URL (Assertion Consumer Service URL):**
```
https://app.valueos.com/auth/saml/callback
```

**Sign on URL:**
```
https://app.valueos.com
```

4. Click **Save**

### Step 3: Configure Attributes

**User Attributes & Claims:**

| Claim name | Source attribute |
|------------|------------------|
| email | user.mail |
| givenname | user.givenname |
| surname | user.surname |
| groups | user.groups |

### Step 4: Download Metadata

1. Scroll to **SAML Signing Certificate**
2. Click **Download** next to **Federation Metadata XML**
3. Save the file

### Step 5: Configure ValueOS

1. Log in to ValueOS as Admin
2. Navigate to **Settings** → **Authentication** → **SSO**
3. Click **Configure SSO**
4. Select **Azure AD**
5. Upload the metadata XML file from Step 4
6. Configure:

```
Provider: Azure AD
Metadata: [Upload XML file]
Default Role: Member
Auto-provision: Enabled
Domain: acme-corp.com
```

7. Click **Save and Test**

### Step 6: Assign Users

1. In Azure AD, go to your ValueOS app
2. Click **Users and groups**
3. Click **Add user/group**
4. Select users or groups
5. Click **Assign**

---

## 🔴 Google Workspace Setup

### Step 1: Configure OAuth Consent

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Navigate to **APIs & Services** → **OAuth consent screen**
4. Select **Internal** (for workspace users)
5. Fill in application details:

```
App name: ValueOS
User support email: support@acme-corp.com
Developer contact: dev@acme-corp.com
```

6. Add scopes:
   - `openid`
   - `email`
   - `profile`

7. Click **Save and Continue**

### Step 2: Create OAuth Credentials

1. Navigate to **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application**
4. Configure:

```
Name: ValueOS
Authorized redirect URIs:
  https://app.valueos.com/auth/google/callback
```

5. Click **Create**
6. Save **Client ID** and **Client Secret**

### Step 3: Configure ValueOS

1. Log in to ValueOS as Admin
2. Navigate to **Settings** → **Authentication** → **SSO**
3. Click **Configure SSO**
4. Select **Google Workspace**
5. Fill in details:

```
Provider: Google Workspace
Client ID: [From Step 2]
Client Secret: [From Step 2]
Domain: acme-corp.com
Default Role: Member
Auto-provision: Enabled
```

6. Click **Save and Test**

---

## 🔧 Advanced Configuration

### SCIM Provisioning

**Enterprise plan only** - Automatically sync users from your IdP.

#### Enable SCIM in ValueOS

1. **Settings** → **Authentication** → **SSO** → **SCIM**
2. Click **Enable SCIM**
3. Copy the **SCIM Base URL** and **API Token**

```
SCIM Base URL: https://app.valueos.com/scim/v2
API Token: scim_abc123def456...
```

#### Configure SCIM in Okta

1. In Okta, go to your ValueOS app
2. Click **Provisioning** tab
3. Click **Configure API Integration**
4. Check **Enable API integration**
5. Enter:
   - **Base URL**: [From ValueOS]
   - **API Token**: [From ValueOS]
6. Click **Test API Credentials**
7. Click **Save**

#### Enable Provisioning Features

1. Click **To App** under Provisioning
2. Click **Edit**
3. Enable:
   - ✅ Create Users
   - ✅ Update User Attributes
   - ✅ Deactivate Users
4. Click **Save**

---

### Just-In-Time (JIT) Provisioning

Automatically create users on first login:

**Settings** → **Authentication** → **SSO** → **JIT Provisioning**

```
Enable JIT: Yes
Default Role: Member
Default Workspaces: Engineering, Product
Require email verification: No
```

**Attribute Mapping:**
| ValueOS Field | SAML Attribute |
|---------------|----------------|
| Email | email |
| First Name | firstName |
| Last Name | lastName |
| Department | department |
| Manager | manager |

---

### Group Mapping

Map IdP groups to ValueOS roles:

**Settings** → **Authentication** → **SSO** → **Group Mapping**

| IdP Group | ValueOS Role | Workspaces |
|-----------|--------------|------------|
| engineering-leads | Admin | All |
| engineering | Member | Engineering |
| product-managers | Member | Product, Engineering |
| executives | Viewer | All |

---

### Domain Restriction

Limit SSO to specific email domains:

**Settings** → **Authentication** → **SSO** → **Domain Restriction**

```
Allowed Domains:
  acme-corp.com
  acme.com
  
Block non-SSO login: Yes
Allow admin bypass: Yes
```

---

## 🔒 Security Settings

### Session Configuration

**Settings** → **Authentication** → **SSO** → **Session**

```
Session timeout: 8 hours
Idle timeout: 30 minutes
Remember me: Disabled
Force re-authentication: Every 24 hours
```

### Certificate Management

**Settings** → **Authentication** → **SSO** → **Certificates**

- View current certificate
- Upload new certificate
- Set certificate expiration alerts
- Rotate certificates

> ⚠️ **Warning**: Certificate expiration will break SSO. Set up alerts 30 days before expiration.

---

## 🧪 Testing SSO

### Test Checklist

Before enabling SSO for all users:

- [ ] Admin can log in via SSO
- [ ] New user is auto-provisioned
- [ ] User attributes are mapped correctly
- [ ] Groups are assigned properly
- [ ] Session timeout works as expected
- [ ] Logout redirects correctly
- [ ] Certificate is valid and not expiring soon

### Test User Flow

1. Create a test user in your IdP
2. Assign to ValueOS application
3. Navigate to ValueOS login page
4. Click **Sign in with SSO**
5. Enter email address
6. Verify redirect to IdP
7. Log in with test credentials
8. Verify redirect back to ValueOS
9. Check user is created with correct role
10. Verify access to appropriate workspaces

---

## 🆘 Troubleshooting

### SSO Login Fails

**Symptom**: Error message when trying to log in via SSO

**Common causes:**
1. **Incorrect metadata**: Re-download and upload metadata
2. **Certificate expired**: Update certificate in IdP
3. **URL mismatch**: Verify callback URLs match exactly
4. **User not assigned**: Check user is assigned to app in IdP

**Debug steps:**
1. Check SSO logs: **Settings** → **Authentication** → **SSO** → **Logs**
2. Verify metadata: Click **View Metadata** in ValueOS
3. Test connection: Click **Test SSO Connection**
4. Contact support with error details

---

### User Not Auto-Provisioned

**Symptom**: User can log in but account isn't created

**Solutions:**
1. Verify JIT provisioning is enabled
2. Check domain is in allowed list
3. Verify attribute mapping is correct
4. Check user has required attributes in IdP

---

### Wrong Role Assigned

**Symptom**: User has incorrect permissions

**Solutions:**
1. Check group mapping configuration
2. Verify user's groups in IdP
3. Review default role setting
4. Manually adjust role if needed

---

### SCIM Sync Failing

**Symptom**: Users not syncing from IdP

**Solutions:**
1. Verify SCIM token is valid
2. Check SCIM base URL is correct
3. Review SCIM logs in ValueOS
4. Test API credentials in IdP
5. Verify provisioning features are enabled

---

## 📊 Monitoring SSO

### SSO Analytics

**Settings** → **Authentication** → **SSO** → **Analytics**

**Metrics:**
- SSO login success rate
- Average login time
- Failed login attempts
- Active SSO sessions
- User provisioning rate

### Audit Logs

Track all SSO-related events:

**Settings** → **Audit Logs** → Filter by "SSO"

**Logged events:**
- SSO configuration changes
- Login attempts (success/failure)
- User provisioning
- Group mapping changes
- Certificate updates

---

## 💡 Best Practices

### Security
- ✅ Enable SCIM for automatic deprovisioning
- ✅ Use group mapping for role assignment
- ✅ Set appropriate session timeouts
- ✅ Monitor failed login attempts
- ✅ Rotate certificates before expiration

### User Experience
- ✅ Use JIT provisioning for seamless onboarding
- ✅ Configure appropriate default roles
- ✅ Map all relevant user attributes
- ✅ Test thoroughly before rollout
- ✅ Provide fallback authentication method

### Maintenance
- ✅ Review SSO logs weekly
- ✅ Update certificates proactively
- ✅ Audit group mappings quarterly
- ✅ Document configuration changes
- ✅ Test after IdP updates

---

## 🔗 Related Documentation

- [User Management](./user-management.md) - Managing users and roles
- [Security Settings](./settings.md#security) - Organization security
- [API Authentication](../developer-guide/authentication.md) - API access with SSO

---

> **Note**: SSO configuration requires admin access to both ValueOS and your identity provider.

> **Tip**: Start with a small test group before enabling SSO for your entire organization.

> ⚠️ **Warning**: Enabling "Block non-SSO login" will prevent users from logging in with passwords. Ensure SSO is working correctly first.

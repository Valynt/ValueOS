# Getting Started

Your quick path to value with ValueOS. Complete these four steps to set up your organization and start tracking business impact.

## ⏱️ Time Required

**30 minutes** from signup to first value metric.

## 🎯 What You'll Accomplish

By the end of this guide, you'll have:
- ✅ Created your organization
- ✅ Connected your first integration
- ✅ Defined your first value metric
- ✅ Invited your team members

---

## Step 1: Create Your Organization

### Sign Up

1. Navigate to [https://app.valueos.com/signup](https://app.valueos.com/signup)
2. Enter your work email address
3. Create a secure password (minimum 12 characters)
4. Verify your email address

> **Tip**: Use your work email to automatically connect with teammates from your domain.

### Organization Setup

After email verification, you'll be prompted to set up your organization:

1. **Organization Name**: Your company name (e.g., "Acme Corp")
2. **Organization Slug**: URL-friendly identifier (e.g., "acme-corp")
3. **Industry**: Select your primary industry
4. **Team Size**: Approximate number of engineers

**Example:**
```
Organization Name: Acme Corporation
Organization Slug: acme-corp
Industry: SaaS
Team Size: 50-100 engineers
```

Click **Create Organization** to continue.

---

## Step 2: Connect Your First Integration

ValueOS works best when connected to your existing tools. Start with your source control system.

### GitHub Integration

1. Click **Settings** in the left sidebar
2. Navigate to **Integrations**
3. Click **Connect** next to GitHub
4. Authorize ValueOS to access your repositories
5. Select the repositories you want to track

**Permissions required:**
- Read access to repositories
- Read access to pull requests
- Read access to commits

> **Note**: ValueOS only reads data. We never write to your repositories.

### Alternative Integrations

If you don't use GitHub, connect one of these instead:

- **GitLab**: Similar setup to GitHub
- **Jira**: Track value by issue and epic
- **Linear**: Connect engineering work to outcomes

You can add more integrations later.

---

## Step 3: Define Your First Value Metric

Value metrics connect technical work to business outcomes. Start with one metric that matters to your organization.

### Choose a Metric Type

Common first metrics:

| Metric Type | Example | Best For |
|-------------|---------|----------|
| **Revenue Impact** | Feature X increased MRR by $50K | SaaS, E-commerce |
| **Cost Reduction** | Infrastructure optimization saved $10K/month | All industries |
| **Customer Satisfaction** | Bug fixes improved NPS by 5 points | Customer-focused orgs |
| **Time Savings** | Automation reduced manual work by 20 hours/week | Operations-heavy orgs |

### Create Your Metric

1. Click **Metrics** in the left sidebar
2. Click **Create Metric**
3. Fill in the details:

**Example: Revenue Impact Metric**
```
Metric Name: Feature Revenue Impact
Description: Track MRR increase from new features
Type: Revenue
Unit: USD
Calculation: Manual entry or API integration
Update Frequency: Monthly
Owner: Product Team
```

4. Click **Create Metric**

### Link to Engineering Work

Connect your metric to actual work:

1. In your new metric, click **Link Work**
2. Select the integration (e.g., GitHub)
3. Choose how to link:
   - By repository
   - By pull request labels
   - By commit messages
   - By custom rules

**Example:**
```
Link all pull requests with label "revenue-impact" 
from repository "acme-corp/api" to this metric
```

4. Click **Save Linking Rules**

---

## Step 4: Invite Your Team

Bring your team onboard to start collaborative value tracking.

### Invite Users

1. Click **Settings** → **Users**
2. Click **Invite Users**
3. Enter email addresses (one per line or comma-separated)
4. Select a role for each user:

**Role Options:**

| Role | Permissions | Best For |
|------|-------------|----------|
| **Admin** | Full access to all settings | Organization admins |
| **Member** | Create metrics, view all data | Team leads, PMs |
| **Viewer** | Read-only access | Executives, stakeholders |

5. Add a personal message (optional)
6. Click **Send Invitations**

**Example invitation:**
```
Emails: 
  alice@acme-corp.com
  bob@acme-corp.com
  carol@acme-corp.com

Role: Member

Message:
  Welcome to ValueOS! We're using this to track 
  the business impact of our engineering work. 
  Check out the "Feature Revenue Impact" metric 
  to see how we're measuring value.
```

### Bulk Import

For larger teams:

1. Click **Bulk Import** instead of manual entry
2. Download the CSV template
3. Fill in user details
4. Upload the completed CSV
5. Review and confirm

---

## ✅ Verification Checklist

Before moving on, verify you've completed:

- [ ] Organization created and configured
- [ ] At least one integration connected
- [ ] First value metric defined and linked
- [ ] Team members invited
- [ ] Received confirmation emails

---

## 🎯 Next Steps

### Immediate (Next 24 Hours)

1. **Wait for data collection**: Integrations need time to sync historical data
2. **Review your dashboard**: Check the default dashboard for initial insights
3. **Refine your metric**: Adjust linking rules based on initial data

### Short Term (First Week)

1. **Add more metrics**: Create 2-3 additional value metrics
2. **Create a dashboard**: Build a custom dashboard for your team
3. **Schedule a review**: Set up weekly metric review meetings

### Long Term (First Month)

1. **Expand integrations**: Connect additional tools
2. **Train your team**: Ensure everyone understands value tracking
3. **Measure impact**: Review the business impact of your engineering work

---

## 💡 Quick Wins

### Pre-Built Templates

Use templates to get started faster:

1. Click **Metrics** → **Templates**
2. Browse templates by industry
3. Click **Use Template** on relevant metrics
4. Customize for your organization

**Popular templates:**
- SaaS Revenue Impact
- Cost Reduction Tracking
- Customer Satisfaction Metrics
- Engineering Efficiency

### Sample Data

Enable sample data to explore features:

1. Go to **Settings** → **Organization**
2. Toggle **Enable Sample Data**
3. Explore dashboards with realistic data
4. Disable when ready to use real data

---

## 🆘 Common Issues

### Integration Not Syncing

**Problem**: GitHub integration shows "Pending" status

**Solution**:
1. Check that you authorized all required permissions
2. Verify repository access in GitHub settings
3. Click **Reconnect** in ValueOS integrations
4. Contact support if issue persists

### No Data Appearing

**Problem**: Metrics show no data after 24 hours

**Solution**:
1. Verify linking rules are correct
2. Check that work items have required labels/tags
3. Ensure integration has synced (check last sync time)
4. Review integration logs for errors

### Invitation Not Received

**Problem**: Team member didn't receive invitation email

**Solution**:
1. Check spam/junk folders
2. Verify email address is correct
3. Resend invitation from user management
4. Use direct signup link as alternative

---

## 📚 Additional Resources

### Video Tutorials
- [Getting Started Walkthrough](https://valueos.com/videos/getting-started) (15 min)
- [Creating Your First Metric](https://valueos.com/videos/first-metric) (8 min)
- [Integration Setup](https://valueos.com/videos/integrations) (12 min)

### Documentation
- [User Management Guide](./user-management.md)
- [Integration Details](./integrations.md)
- [Metric Best Practices](./metrics-best-practices.md)

### Support
- **Email**: support@valueos.com
- **Chat**: Click the chat icon in the bottom right
- **Community**: [Slack workspace](https://valueos.slack.com)

---

## 🎓 What's Next?

Now that you're set up, dive deeper into specific areas:

### For Admins
- [User Management](./user-management.md) - Manage permissions and access
- [SSO Setup](./sso-setup.md) - Configure enterprise authentication
- [Billing](./billing.md) - Manage subscription and invoices

### For Team Leads
- [Dashboards](./dashboards.md) - Create custom views
- [Reports](./reports.md) - Generate and schedule reports
- [Metrics](./metrics-best-practices.md) - Advanced metric strategies

### For Developers
- [Developer Guide](../developer-guide/README.md) - API and SDK documentation
- [API Reference](../developer-guide/api-reference.md) - Complete API docs
- [Webhooks](../developer-guide/webhooks.md) - Real-time integrations

---

> **Note**: Your first metric may take 24-48 hours to show meaningful data as integrations sync historical information.

> **Tip**: Start with one well-defined metric rather than many vague ones. You can always add more later.

> ⚠️ **Warning**: Ensure you have permission to connect organizational tools before setting up integrations. Check with your IT or security team if unsure.

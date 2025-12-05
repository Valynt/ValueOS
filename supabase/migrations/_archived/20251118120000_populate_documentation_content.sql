/*
  # Populate Documentation Content
  
  Inserts initial categories and sample pages for the documentation portal.
  
  Categories:
  - Getting Started
  - Tutorials
  - API Reference
  - User Guides
  - Troubleshooting
  - FAQ
*/

-- Insert Documentation Categories
INSERT INTO doc_categories (slug, name, description, icon, display_order, published) VALUES
  ('getting-started', 'Getting Started', 'Quick start guides and initial setup', '🚀', 1, true),
  ('tutorials', 'Tutorials', 'Step-by-step tutorials and walkthroughs', '🎓', 2, true),
  ('api-reference', 'API Reference', 'Complete API documentation and examples', '🔧', 3, true),
  ('user-guides', 'User Guides', 'Comprehensive guides for all features', '📖', 4, true),
  ('troubleshooting', 'Troubleshooting', 'Common issues and solutions', '🔍', 5, true),
  ('faq', 'FAQ', 'Frequently asked questions', '❓', 6, true)
ON CONFLICT (slug) DO NOTHING;

-- Insert Sample Pages for Getting Started
INSERT INTO doc_pages (
  slug,
  category_id,
  title,
  description,
  content,
  content_type,
  status,
  featured,
  tags,
  published_at
) VALUES
  (
    'quick-start-guide',
    (SELECT id FROM doc_categories WHERE slug = 'getting-started'),
    'Quick Start Guide',
    'Get up and running with ValueCanvas in 5 minutes',
    '# Quick Start Guide

Welcome to ValueCanvas! This guide will help you get started in just a few minutes.

## Step 1: Create Your Account

1. Navigate to the sign-up page
2. Enter your email and password
3. Verify your email address

## Step 2: Set Up Your Organization

1. Click on "Create Organization"
2. Enter your organization name
3. Invite team members

## Step 3: Create Your First Value Case

1. Go to the Library
2. Click "New Value Case"
3. Follow the guided workflow

## Step 4: Explore Features

- **Templates**: Browse pre-built templates
- **Documentation**: Access comprehensive guides
- **Settings**: Customize your workspace

## Next Steps

- [Complete the tutorial](#)
- [Explore templates](#)
- [Join our community](#)

## Need Help?

Contact support at support@valuecanvas.com',
    'markdown',
    'published',
    true,
    ARRAY['getting-started', 'quick-start', 'setup'],
    now()
  ),
  (
    'installation',
    (SELECT id FROM doc_categories WHERE slug = 'getting-started'),
    'Installation & Setup',
    'Complete installation guide for all platforms',
    '# Installation & Setup

## System Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection
- Email address for account creation

## Browser Setup

### Recommended Browsers

- **Chrome**: Version 90+
- **Firefox**: Version 88+
- **Safari**: Version 14+
- **Edge**: Version 90+

### Enable JavaScript

Ensure JavaScript is enabled in your browser settings.

## Account Creation

### Step 1: Sign Up

1. Visit [https://app.valuecanvas.com](https://app.valuecanvas.com)
2. Click "Sign Up"
3. Enter your details:
   - Email address
   - Password (min 8 characters)
   - Full name

### Step 2: Verify Email

1. Check your email inbox
2. Click the verification link
3. You''ll be redirected to the app

### Step 3: Complete Profile

1. Add your job title
2. Select your industry
3. Set your timezone

## Organization Setup

### Create Organization

1. Click "Create Organization"
2. Enter organization details:
   - Organization name
   - Industry
   - Company size

### Invite Team Members

1. Go to Settings → Team
2. Click "Invite Members"
3. Enter email addresses
4. Assign roles

## Configuration

### User Preferences

- **Theme**: Light, Dark, or System
- **Language**: Select your preferred language
- **Notifications**: Configure notification preferences

### Organization Settings

- **Currency**: Set default currency
- **Fiscal Year**: Define fiscal year start
- **Working Hours**: Set business hours

## Troubleshooting

### Can''t Receive Verification Email?

1. Check spam folder
2. Verify email address is correct
3. Request new verification email

### Browser Compatibility Issues?

1. Clear browser cache
2. Update to latest browser version
3. Try a different browser

## Next Steps

- [Quick Start Guide](#)
- [First Value Case Tutorial](#)
- [Team Collaboration Guide](#)',
    'markdown',
    'published',
    true,
    ARRAY['installation', 'setup', 'getting-started'],
    now()
  );

-- Insert Sample Pages for Tutorials
INSERT INTO doc_pages (
  slug,
  category_id,
  title,
  description,
  content,
  content_type,
  status,
  featured,
  tags,
  published_at
) VALUES
  (
    'creating-first-value-case',
    (SELECT id FROM doc_categories WHERE slug = 'tutorials'),
    'Creating Your First Value Case',
    'Step-by-step tutorial for creating a value case',
    '# Creating Your First Value Case

Learn how to create a comprehensive value case from scratch.

## What You''ll Learn

- How to define value opportunities
- Setting KPI targets
- Building financial models
- Tracking realization

## Prerequisites

- Active ValueCanvas account
- Basic understanding of ROI concepts

## Step 1: Define the Opportunity

1. Navigate to Library → New Value Case
2. Enter opportunity details:
   - **Title**: Descriptive name
   - **Description**: Brief overview
   - **Industry**: Select industry
   - **Use Case**: Choose use case type

### Example

```
Title: Sales Productivity Improvement
Description: Increase sales team efficiency through automation
Industry: Technology
Use Case: Sales Enablement
```

## Step 2: Set KPI Targets

1. Click "Add KPI Target"
2. Define baseline and target values
3. Set measurement period

### Common KPIs

- Revenue increase
- Cost reduction
- Time savings
- Efficiency gains

## Step 3: Build Financial Model

1. Enter cost assumptions
2. Define benefit calculations
3. Set timeline

### Financial Metrics

- **ROI**: Return on Investment
- **NPV**: Net Present Value
- **Payback Period**: Time to break even

## Step 4: Track Realization

1. Set up tracking dashboard
2. Define milestones
3. Configure alerts

## Best Practices

- Start with clear objectives
- Use realistic assumptions
- Document all sources
- Review regularly

## Next Steps

- [Advanced Value Modeling](#)
- [Collaboration Features](#)
- [Reporting & Analytics](#)',
    'markdown',
    'published',
    true,
    ARRAY['tutorial', 'value-case', 'beginner'],
    now()
  );

-- Insert Sample Pages for API Reference
INSERT INTO doc_pages (
  slug,
  category_id,
  title,
  description,
  content,
  content_type,
  status,
  tags,
  published_at
) VALUES
  (
    'api-authentication',
    (SELECT id FROM doc_categories WHERE slug = 'api-reference'),
    'API Authentication',
    'How to authenticate with the ValueCanvas API',
    '# API Authentication

Learn how to authenticate your API requests.

## Authentication Methods

ValueCanvas API supports two authentication methods:

1. **API Keys** (Recommended for server-to-server)
2. **OAuth 2.0** (Recommended for user-facing apps)

## API Keys

### Generating an API Key

1. Go to Settings → API Keys
2. Click "Generate New Key"
3. Copy and store securely

### Using API Keys

Include the API key in the `Authorization` header:

```bash
curl -X GET https://api.valuecanvas.com/v1/value-cases \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"
```

### Security Best Practices

- Never commit API keys to version control
- Rotate keys regularly
- Use environment variables
- Restrict key permissions

## OAuth 2.0

### Authorization Flow

1. **Authorization Request**
```
GET https://api.valuecanvas.com/oauth/authorize?
  client_id=YOUR_CLIENT_ID&
  redirect_uri=YOUR_REDIRECT_URI&
  response_type=code&
  scope=read write
```

2. **Token Exchange**
```bash
curl -X POST https://api.valuecanvas.com/oauth/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=authorization_code" \\
  -d "code=AUTHORIZATION_CODE" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET"
```

3. **Use Access Token**
```bash
curl -X GET https://api.valuecanvas.com/v1/value-cases \\
  -H "Authorization: Bearer ACCESS_TOKEN"
```

## Rate Limiting

- **Free Tier**: 100 requests/hour
- **Pro Tier**: 1,000 requests/hour
- **Enterprise**: Custom limits

### Rate Limit Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Error Responses

### 401 Unauthorized

```json
{
  "error": "unauthorized",
  "message": "Invalid or expired API key"
}
```

### 429 Too Many Requests

```json
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded. Try again in 3600 seconds"
}
```

## Next Steps

- [API Endpoints Reference](#)
- [SDKs and Libraries](#)
- [Webhooks](#)',
    'markdown',
    'published',
    false,
    ARRAY['api', 'authentication', 'security'],
    now()
  );

-- Insert Sample Pages for User Guides
INSERT INTO doc_pages (
  slug,
  category_id,
  title,
  description,
  content,
  content_type,
  status,
  tags,
  published_at
) VALUES
  (
    'team-collaboration',
    (SELECT id FROM doc_categories WHERE slug = 'user-guides'),
    'Team Collaboration Guide',
    'How to collaborate effectively with your team',
    '# Team Collaboration Guide

Learn how to work together effectively in ValueCanvas.

## Team Structure

### Roles and Permissions

- **Owner**: Full access to all features
- **Admin**: Manage team and settings
- **Member**: Create and edit value cases
- **Viewer**: Read-only access

## Inviting Team Members

### Step 1: Send Invitations

1. Go to Settings → Team → Members
2. Click "Invite Members"
3. Enter email addresses
4. Select role
5. Click "Send Invitations"

### Step 2: Manage Invitations

- View pending invitations
- Resend invitations
- Cancel invitations

## Sharing Value Cases

### Share with Team

1. Open value case
2. Click "Share"
3. Select team members
4. Set permissions (View/Edit)

### Share Externally

1. Click "Generate Share Link"
2. Set expiration date
3. Copy link
4. Share with stakeholders

## Real-Time Collaboration

### Simultaneous Editing

- Multiple users can edit simultaneously
- Changes sync in real-time
- See who''s currently viewing

### Comments and Feedback

1. Select text or component
2. Click "Add Comment"
3. Type your comment
4. Tag team members with @mention

## Version Control

### Automatic Versioning

- Every save creates a version
- View version history
- Restore previous versions

### Manual Snapshots

1. Click "Create Snapshot"
2. Add description
3. Save snapshot

## Notifications

### Configure Notifications

- Email notifications
- In-app notifications
- Slack integration

### Notification Types

- Mentions
- Comments
- Approvals
- Updates

## Best Practices

- Use clear naming conventions
- Add descriptions to value cases
- Comment on changes
- Review regularly
- Archive completed cases

## Next Steps

- [Approval Workflows](#)
- [Reporting & Analytics](#)
- [Integration Guide](#)',
    'markdown',
    'published',
    false,
    ARRAY['collaboration', 'team', 'sharing'],
    now()
  );

-- Insert Sample Pages for Troubleshooting
INSERT INTO doc_pages (
  slug,
  category_id,
  title,
  description,
  content,
  content_type,
  status,
  tags,
  published_at
) VALUES
  (
    'common-issues',
    (SELECT id FROM doc_categories WHERE slug = 'troubleshooting'),
    'Common Issues and Solutions',
    'Solutions to frequently encountered problems',
    '# Common Issues and Solutions

Quick solutions to common problems.

## Login Issues

### Can''t Log In

**Symptoms:**
- "Invalid credentials" error
- Login page keeps reloading

**Solutions:**
1. Verify email and password
2. Clear browser cache
3. Try password reset
4. Check browser compatibility

### Forgot Password

1. Click "Forgot Password"
2. Enter email address
3. Check email for reset link
4. Create new password

## Performance Issues

### Slow Loading

**Symptoms:**
- Pages take long to load
- Spinning loader persists

**Solutions:**
1. Check internet connection
2. Clear browser cache
3. Disable browser extensions
4. Try different browser

### Timeout Errors

**Symptoms:**
- "Request timeout" error
- Operations fail to complete

**Solutions:**
1. Refresh the page
2. Check network connection
3. Try again in a few minutes
4. Contact support if persists

## Data Issues

### Missing Data

**Symptoms:**
- Value cases not showing
- Data appears incomplete

**Solutions:**
1. Refresh the page
2. Check filters and search
3. Verify permissions
4. Check archive status

### Sync Issues

**Symptoms:**
- Changes not saving
- Data out of sync

**Solutions:**
1. Check internet connection
2. Refresh the page
3. Clear browser cache
4. Log out and log back in

## Integration Issues

### API Errors

**Symptoms:**
- API calls failing
- Authentication errors

**Solutions:**
1. Verify API key
2. Check rate limits
3. Review API documentation
4. Test with curl/Postman

### Webhook Failures

**Symptoms:**
- Webhooks not triggering
- Missing notifications

**Solutions:**
1. Verify webhook URL
2. Check endpoint availability
3. Review webhook logs
4. Test webhook manually

## Browser Compatibility

### Supported Browsers

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Unsupported Features

- Internet Explorer (not supported)
- Very old browser versions

## Still Need Help?

### Contact Support

- **Email**: support@valuecanvas.com
- **Chat**: Available in-app
- **Phone**: +1 (555) 123-4567

### Before Contacting

1. Check this troubleshooting guide
2. Review relevant documentation
3. Gather error messages
4. Note steps to reproduce

## Next Steps

- [System Status](#)
- [Report a Bug](#)
- [Feature Requests](#)',
    'markdown',
    'published',
    true,
    ARRAY['troubleshooting', 'issues', 'solutions'],
    now()
  );

-- Insert Sample Pages for FAQ
INSERT INTO doc_pages (
  slug,
  category_id,
  title,
  description,
  content,
  content_type,
  status,
  featured,
  tags,
  published_at
) VALUES
  (
    'frequently-asked-questions',
    (SELECT id FROM doc_categories WHERE slug = 'faq'),
    'Frequently Asked Questions',
    'Answers to common questions about ValueCanvas',
    '# Frequently Asked Questions

## General Questions

### What is ValueCanvas?

ValueCanvas is a comprehensive platform for creating, managing, and tracking customer value across the entire lifecycle. It helps teams define value opportunities, set KPI targets, build financial models, and track realization.

### Who should use ValueCanvas?

ValueCanvas is designed for:
- Sales teams
- Customer success teams
- Product managers
- Value engineers
- Executive leadership

### How much does it cost?

We offer three pricing tiers:
- **Free**: For individuals and small teams
- **Pro**: $49/user/month
- **Enterprise**: Custom pricing

[View detailed pricing](#)

## Account & Billing

### How do I upgrade my plan?

1. Go to Settings → Billing
2. Click "Upgrade Plan"
3. Select desired plan
4. Enter payment information

### Can I cancel anytime?

Yes, you can cancel your subscription at any time. Your access will continue until the end of your billing period.

### Do you offer refunds?

We offer a 30-day money-back guarantee for annual plans.

## Features

### Can I import existing data?

Yes, we support importing from:
- CSV files
- Excel spreadsheets
- Salesforce
- HubSpot

### Is there a mobile app?

Currently, ValueCanvas is web-based and mobile-responsive. Native mobile apps are coming soon.

### Can I customize templates?

Yes, all templates are fully customizable. You can also create your own templates.

## Security & Privacy

### Is my data secure?

Yes, we use industry-standard security measures:
- 256-bit encryption
- SOC 2 Type II certified
- GDPR compliant
- Regular security audits

### Where is data stored?

Data is stored in secure data centers in the US and EU. Enterprise customers can choose their data region.

### Who can access my data?

Only authorized team members can access your data. We never share data with third parties without your consent.

## Integration

### What integrations are available?

We integrate with:
- Salesforce
- HubSpot
- Slack
- Microsoft Teams
- Google Workspace
- Zapier

### Can I use the API?

Yes, we provide a comprehensive REST API. [View API documentation](#)

### Do you support webhooks?

Yes, webhooks are available on Pro and Enterprise plans.

## Support

### How do I get help?

- **Documentation**: Browse our comprehensive docs
- **Email**: support@valuecanvas.com
- **Chat**: Available in-app (Pro and Enterprise)
- **Phone**: Enterprise customers only

### What are your support hours?

- **Email**: 24/7
- **Chat**: Monday-Friday, 9am-5pm EST
- **Phone**: Monday-Friday, 9am-5pm EST

### Do you offer training?

Yes, we offer:
- Self-paced online courses
- Live webinars
- Custom training (Enterprise)

## Still Have Questions?

Contact us at support@valuecanvas.com or use the in-app chat.',
    'markdown',
    'published',
    true,
    ARRAY['faq', 'questions', 'answers'],
    now()
  );

-- Update view counts for popular pages
UPDATE doc_pages SET view_count = 150 WHERE slug = 'quick-start-guide';
UPDATE doc_pages SET view_count = 120 WHERE slug = 'creating-first-value-case';
UPDATE doc_pages SET view_count = 95 WHERE slug = 'common-issues';
UPDATE doc_pages SET view_count = 85 WHERE slug = 'frequently-asked-questions';
UPDATE doc_pages SET view_count = 75 WHERE slug = 'installation';
UPDATE doc_pages SET view_count = 60 WHERE slug = 'api-authentication';

# Billing & Subscription Management

Manage your ValueOS subscription, billing, and payment methods.

## 🎯 Overview

This guide covers everything related to billing, from viewing invoices to upgrading your plan.

**Access:** Admin role required for all billing operations.

---

## 💳 Payment Methods

### Adding a Payment Method

1. Navigate to **Settings** → **Billing** → **Payment Methods**
2. Click **Add Payment Method**
3. Choose method type:
   - **Credit Card** (All plans)
   - **ACH Transfer** (Enterprise only)
   - **Wire Transfer** (Enterprise only)
   - **Purchase Order** (Enterprise only)

#### Credit Card

```
Card Number: •••• •••• •••• 4242
Expiration: 12/25
CVC: •••
Billing ZIP: 94105
```

4. Click **Add Card**
5. Card is verified immediately

#### ACH Transfer (Enterprise)

1. Select **ACH Transfer**
2. Provide bank details:

```
Account Holder: Acme Corporation
Routing Number: 123456789
Account Number: 987654321
Account Type: Checking
```

3. Click **Verify Account**
4. Verification takes 1-2 business days

---

### Setting Default Payment Method

1. Go to **Settings** → **Billing** → **Payment Methods**
2. Click **•••** next to payment method
3. Select **Set as Default**
4. Confirm change

> **Note**: Default payment method is used for all automatic charges.

---

### Updating Payment Method

1. Go to **Settings** → **Billing** → **Payment Methods**
2. Click **•••** next to payment method
3. Select **Edit**
4. Update details
5. Click **Save Changes**

---

### Removing Payment Method

1. Go to **Settings** → **Billing** → **Payment Methods**
2. Click **•••** next to payment method
3. Select **Remove**
4. Confirm removal

> ⚠️ **Warning**: Cannot remove the default payment method. Set a different default first.

---

## 📄 Invoices

### Viewing Invoices

**Settings** → **Billing** → **Invoices**

| Invoice # | Date | Amount | Status | Actions |
|-----------|------|--------|--------|---------|
| INV-2024-001 | Jan 1, 2024 | $4,950 | Paid | View, Download |
| INV-2024-002 | Feb 1, 2024 | $4,950 | Paid | View, Download |
| INV-2024-003 | Mar 1, 2024 | $4,950 | Pending | View, Pay Now |

---

### Downloading Invoices

**Single Invoice:**
1. Click **Download** next to invoice
2. Choose format:
   - PDF (default)
   - CSV (line items)
   - JSON (API format)

**Bulk Download:**
1. Select multiple invoices
2. Click **Download Selected**
3. Receives ZIP file with all invoices

---

### Invoice Details

Click on any invoice to view details:

```
Invoice #: INV-2024-003
Date: March 1, 2024
Due Date: March 15, 2024
Status: Pending

Bill To:
  Acme Corporation
  123 Main Street
  San Francisco, CA 94105
  Tax ID: 12-3456789

Line Items:
  ValueOS Professional - 50 seats × $99    $4,950.00
  Additional API calls - 50K               $500.00
  ─────────────────────────────────────────────────
  Subtotal                                 $5,450.00
  Tax (8.5%)                               $463.25
  ─────────────────────────────────────────────────
  Total                                    $5,913.25

Payment Method: •••• 4242
```

---

### Paying Outstanding Invoices

For invoices with "Pending" status:

1. Click **Pay Now** next to invoice
2. Verify payment method
3. Click **Confirm Payment**
4. Receive confirmation email

---

### Invoice Settings

**Settings** → **Billing** → **Invoice Settings**

```
Company Name: Acme Corporation
Billing Address:
  123 Main Street
  San Francisco, CA 94105
  United States

Tax ID: 12-3456789
PO Number: PO-2024-Q1
Email Recipients:
  billing@acme-corp.com
  finance@acme-corp.com

Invoice Delivery: Email + Dashboard
Invoice Format: PDF
```

---

## 📊 Current Subscription

### Viewing Subscription Details

**Settings** → **Billing** → **Subscription**

```
Plan: Professional
Billing Cycle: Monthly
Seats: 50
Price per Seat: $99/month
Monthly Total: $4,950

Next Billing Date: April 1, 2024
Payment Method: •••• 4242

Add-ons:
  - Extended Data Retention: $500/month
  - Additional API Calls (50K): $100/month
```

---

### Subscription Status

| Status | Description | Actions Available |
|--------|-------------|-------------------|
| **Active** | Subscription is current | Upgrade, Downgrade, Cancel |
| **Past Due** | Payment failed | Update payment, Retry |
| **Canceled** | Canceled, active until period end | Reactivate |
| **Expired** | Subscription ended | Resubscribe |
| **Trial** | In trial period | Upgrade, Cancel |

---

## 🔄 Managing Seats

### Adding Seats

1. **Settings** → **Billing** → **Subscription**
2. Click **Manage Seats**
3. Enter new seat count
4. Review prorated charge
5. Click **Add Seats**

**Example:**
```
Current Seats: 50
New Seats: 60
Additional Seats: 10
Price per Seat: $99/month
Days Remaining in Cycle: 15

Prorated Charge: 10 seats × $99 × (15/30) = $495
```

**Billing:**
- Charged immediately for prorated amount
- Full amount on next billing cycle

---

### Removing Seats

1. **Settings** → **Billing** → **Subscription**
2. Click **Manage Seats**
3. Enter new seat count (must be ≥ active users)
4. Review change
5. Click **Remove Seats**

**Effective Date:**
- Takes effect at next billing cycle
- No prorated refunds
- Must be ≥ number of active users

> **Tip**: Remove users before reducing seats to avoid errors.

---

### Seat Usage

**Settings** → **Billing** → **Seat Usage**

```
Total Seats: 50
Active Users: 45
Available Seats: 5

Utilization: 90%

Recent Changes:
  - Mar 15: Added 5 seats
  - Mar 10: Removed user alice@acme-corp.com
  - Mar 5: Added user bob@acme-corp.com
```

**Alerts:**
- 90% utilization: Consider adding seats
- 100% utilization: Cannot invite new users
- Over limit: Must add seats or remove users

---

## ⬆️ Upgrading Your Plan

### Upgrade Process

1. **Settings** → **Billing** → **Subscription**
2. Click **Upgrade Plan**
3. Select new plan:
   - Starter → Professional
   - Professional → Enterprise

4. Review changes:

```
Current Plan: Starter
New Plan: Professional

Changes:
  ✅ SSO enabled
  ✅ Advanced dashboards
  ✅ 10K API calls/day
  ✅ 24/5 support
  ✅ 1-year data retention

Price Change:
  Current: $49/user/month × 10 = $490/month
  New: $99/user/month × 10 = $990/month
  Difference: +$500/month

Prorated Charge Today: $250
  (15 days remaining × $500/30)
```

5. Click **Confirm Upgrade**

**Effective Immediately:**
- New features available instantly
- Prorated charge applied
- Full price at next billing cycle

---

### Enterprise Upgrade

For Enterprise plan:

1. Click **Contact Sales** in upgrade flow
2. Fill in requirements form:

```
Company: Acme Corporation
Current Seats: 50
Expected Seats: 100-150
Required Features:
  ☑ SCIM provisioning
  ☑ Custom SLA
  ☑ Dedicated CSM
  ☑ On-premise option
  ☑ Custom integrations

Timeline: Q2 2024
```

3. Sales team contacts within 24 hours
4. Custom quote provided
5. Contract negotiation
6. Implementation planning

---

## ⬇️ Downgrading Your Plan

### Downgrade Process

1. **Settings** → **Billing** → **Subscription**
2. Click **Change Plan**
3. Select lower plan
4. Review impact:

```
Current Plan: Professional
New Plan: Starter

Features You'll Lose:
  ❌ SSO
  ❌ Advanced dashboards
  ❌ Custom integrations
  ❌ 24/5 support

Data Impact:
  ⚠️ Data retention reduced to 90 days
  ⚠️ Historical data archived
  ⚠️ Custom metrics limited to 5

API Impact:
  ⚠️ Rate limit reduced to 1K/day
  ⚠️ Webhooks disabled

Effective Date: April 1, 2024 (next billing cycle)
```

5. Confirm understanding
6. Click **Schedule Downgrade**

**Important:**
- Takes effect at next billing cycle
- No refunds for current period
- Export data before downgrade if needed

---

### Data Export Before Downgrade

1. **Settings** → **Data** → **Export**
2. Select data to export:
   - ☑ Metrics
   - ☑ Dashboards
   - ☑ Historical data
   - ☑ User data
   - ☑ Audit logs

3. Choose format: JSON, CSV, or SQL
4. Click **Export Data**
5. Download when ready (email notification)

---

## ❌ Canceling Subscription

### Cancellation Process

1. **Settings** → **Billing** → **Subscription**
2. Click **Cancel Subscription**
3. Select reason (optional):
   - Too expensive
   - Missing features
   - Not using enough
   - Switching to competitor
   - Other

4. Review cancellation terms:

```
Current Plan: Professional
Seats: 50
Monthly Cost: $4,950

Cancellation Details:
  - Access continues until: March 31, 2024
  - No refund for current period
  - Data retained for: 30 days
  - Can reactivate until: April 30, 2024

After Cancellation:
  - All users lose access
  - Integrations stop syncing
  - API access disabled
  - Data available for export for 30 days
```

5. Type "CANCEL" to confirm
6. Click **Cancel Subscription**

---

### Reactivating Canceled Subscription

Within 30 days of cancellation:

1. **Settings** → **Billing** → **Subscription**
2. Click **Reactivate Subscription**
3. Verify payment method
4. Click **Reactivate**

**Restoration:**
- All data restored
- Users can log in immediately
- Integrations resume syncing
- Charged for full month

---

## 💰 Billing Cycle & Timing

### Monthly Billing

**Billing Date:** 1st of each month

**Timeline:**
```
Day 1:  Invoice generated
Day 1:  Payment attempted
Day 3:  Payment retry if failed
Day 5:  Payment retry if failed
Day 7:  Account suspended if payment fails
Day 14: Account canceled if payment fails
```

**Prorated Charges:**
- Adding seats: Charged immediately for remaining days
- Upgrading: Charged immediately for difference
- Removing seats: Takes effect next cycle
- Downgrading: Takes effect next cycle

---

### Annual Billing

**Billing Date:** Anniversary of subscription start

**Benefits:**
- 20% discount vs monthly
- Single annual invoice
- Predictable costs
- Priority support

**Switching to Annual:**
1. **Settings** → **Billing** → **Subscription**
2. Click **Switch to Annual**
3. Review savings:

```
Current: $4,950/month × 12 = $59,400/year
Annual: $4,950/month × 12 × 0.8 = $47,520/year
Savings: $11,880/year (20%)

Charged Today: $47,520
Next Billing: March 1, 2025
```

4. Click **Switch to Annual Billing**

---

## 📧 Billing Notifications

### Email Notifications

Configure in **Settings** → **Billing** → **Notifications**

| Event | Default | Configurable |
|-------|---------|--------------|
| Invoice generated | ✅ | ✅ |
| Payment successful | ✅ | ✅ |
| Payment failed | ✅ | ❌ |
| Subscription expiring | ✅ | ✅ |
| Seat limit reached | ✅ | ✅ |
| Usage threshold | ❌ | ✅ |

**Recipients:**
- Add multiple email addresses
- Separate billing and technical contacts
- CC external accountants

---

### Usage Alerts

Set up alerts for usage thresholds:

**Settings** → **Billing** → **Usage Alerts**

```
API Calls:
  Alert at: 80% of limit
  Recipients: engineering@acme-corp.com

Seats:
  Alert at: 90% utilization
  Recipients: admin@acme-corp.com

Storage:
  Alert at: 75% of limit
  Recipients: admin@acme-corp.com
```

---

## 📊 Usage Monitoring

### Current Usage

**Settings** → **Billing** → **Usage**

```
Billing Period: March 1 - March 31, 2024

Seats:
  Included: 50
  Used: 45
  Available: 5
  Utilization: 90%

API Calls:
  Included: 10,000/day
  Average: 7,500/day
  Peak: 9,200/day
  Utilization: 75%

Storage:
  Included: 100 GB
  Used: 65 GB
  Available: 35 GB
  Utilization: 65%
```

---

### Usage History

View historical usage:

**Settings** → **Billing** → **Usage History**

| Month | Seats | API Calls | Storage | Overage Charges |
|-------|-------|-----------|---------|-----------------|
| Jan 2024 | 45 | 6.2K/day | 58 GB | $0 |
| Feb 2024 | 48 | 7.8K/day | 62 GB | $0 |
| Mar 2024 | 50 | 8.5K/day | 65 GB | $0 |

**Export:**
- Download as CSV
- API access available
- Custom date ranges

---

## 🌍 Tax & Compliance

### Tax Information

**Settings** → **Billing** → **Tax Information**

```
Tax ID: 12-3456789
Tax Type: EIN
Country: United States
State: California
Tax Exempt: No
```

**Tax Rates:**
- Calculated based on billing address
- Applied to all charges
- Shown separately on invoices

---

### Tax Exemption

If your organization is tax-exempt:

1. **Settings** → **Billing** → **Tax Information**
2. Click **Apply for Tax Exemption**
3. Upload exemption certificate
4. Provide details:

```
Exemption Type: Non-profit
Certificate Number: NP-123456
Expiration Date: December 31, 2025
Issuing State: California
```

5. Submit for review
6. Approval within 3-5 business days

---

### Compliance Documents

**Settings** → **Billing** → **Compliance**

Available documents:
- W-9 form
- SOC 2 Type II report
- GDPR compliance statement
- Data processing agreement
- Service level agreement

---

## 🆘 Common Issues

### Payment Failed

**Symptom:** Email notification of failed payment

**Solutions:**
1. Verify card is not expired
2. Check sufficient funds available
3. Contact bank to authorize charge
4. Update payment method
5. Click **Retry Payment** in dashboard

---

### Incorrect Invoice Amount

**Symptom:** Invoice amount doesn't match expectations

**Common causes:**
1. Prorated charges for seat changes
2. Add-on services
3. Overage charges
4. Tax applied

**Resolution:**
1. Review invoice line items
2. Check usage history
3. Contact support if still unclear

---

### Cannot Add Seats

**Symptom:** Error when trying to add seats

**Solutions:**
1. Verify payment method is valid
2. Check account is not past due
3. Ensure not exceeding plan limits
4. Contact support for Enterprise limits

---

## 💡 Best Practices

### Cost Optimization
- ✅ Review seat utilization monthly
- ✅ Remove inactive users promptly
- ✅ Monitor API usage to avoid overages
- ✅ Consider annual billing for 20% savings
- ✅ Right-size your plan based on actual usage

### Financial Management
- ✅ Set up usage alerts
- ✅ Download invoices monthly
- ✅ Review charges before payment
- ✅ Keep payment method current
- ✅ Maintain accurate tax information

### Planning
- ✅ Forecast seat needs quarterly
- ✅ Budget for growth
- ✅ Plan upgrades during low-usage periods
- ✅ Export data before downgrades
- ✅ Review contract terms annually

---

## 🔗 Related Documentation

- [Pricing](../overview/pricing.md) - Plan comparison and pricing
- [User Management](./user-management.md) - Managing seats and users
- [API Usage](../developer-guide/rate-limits.md) - API rate limits

---

> **Note**: Billing features and options vary by plan. See [pricing](../overview/pricing.md) for details.

> **Tip**: Set up usage alerts to avoid unexpected charges and ensure you're on the right plan for your needs.

> ⚠️ **Warning**: Failed payments can result in service suspension. Keep your payment method current and monitor billing notifications.

# Beta Provisioning & Onboarding Automations

## Tenant provisioning script
Use the new helper to bootstrap beta tenants with premium limits and seeded data:

```bash
npm run beta:provision -- --email=user@company.com --plan=enterprise_beta
```

What the script does:
- Creates or updates an `enterprise` tier organization with the `beta_core` and `advanced_export` feature flags.
- Applies premium limits immediately (high user/agent/API ceilings) to avoid any throttling during onboarding.
- Seeds a "Welcome Project" template to give the new tenant a starting canvas.
- Generates an invite URL that bypasses the public waitlist and prints temporary credentials for the owner.

Environment variables required:
- `VITE_SUPABASE_URL` or `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`)
- Optional: `VITE_APP_URL`/`APP_URL` to shape the invite link

## Onboarding drip campaign hooks
The `DripCampaignService` translates app events into provider-friendly payloads for HubSpot or Customer.io. It:
- Sends Day 0 welcome emails on `user.created`
- Schedules a Day 3 checklist nudge if the `onboarding_completed` event has **not** been seen
- Sends the Week 1 survey on completion or at day 7 with survey links that pre-fill `user_id` and `email`

Configure via environment variables:
- `DRIP_PROVIDER` (`hubspot` | `customerio`)
- `DRIP_API_KEY`
- `DRIP_WORKSPACE` (optional, defaults to `beta-onboarding`)

Call `dripCampaignService.handleEvent` when key app events occur to keep the drip logic synchronized with real-time usage.

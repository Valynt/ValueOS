// packages/backend/src/services/billing/config/billing.ts
export interface BillingConfig {
  stripeSecretKey: string;
  stripePublishableKey: string;
  defaultCurrency: string;
  trialPeriodDays: number;
}

export const billingConfig: BillingConfig = {
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  defaultCurrency: 'usd',
  trialPeriodDays: 14,
};
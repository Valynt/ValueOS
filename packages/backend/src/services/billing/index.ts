/**
 * Billing V2 — Service exports
 */

// Core Stripe integration
export { default as StripeService } from "./StripeService.js";
export { default as CustomerService } from "./CustomerService.js";
export { default as WebhookService } from "./WebhookService.js";
export { default as InvoiceService } from "./InvoiceService.js";
export { default as UsageMeteringService } from "./UsageMeteringService.js";
export { default as SubscriptionService } from "./SubscriptionService.js";

// V2: Versioned pricing + entitlements
export { default as BillingMetersCatalog } from "./BillingMetersCatalog.js";
export { default as PriceVersionService } from "./PriceVersionService.js";
export { default as EntitlementSnapshotService } from "./EntitlementSnapshotService.js";

// V2: Subscription state machine
export {
  SubscriptionStateMachine,
  InvalidTransitionError,
} from "./SubscriptionStateMachine.js";
export type { SubscriptionEvent } from "./SubscriptionStateMachine.js";

// V2: Types re-exports
export type { BillingMeter } from "./BillingMetersCatalog.js";
export type {
  PriceVersion,
  PriceVersionDefinition,
  MeterPricing,
} from "./PriceVersionService.js";
export type {
  EntitlementSnapshot,
  MeterEntitlement,
} from "./EntitlementSnapshotService.js";

/**
 * Checkout API
 * Creates Stripe Checkout sessions for subscriptions
 */

import express, { Request, Response } from "express";
import CustomerService from "../../services/billing/CustomerService";
import StripeService from "../../services/billing/StripeService";
import { PLANS, type PlanTier } from "../../config/billing";
import { createLogger } from "../../lib/logger";

const router = express.Router();
const logger = createLogger({ component: "BillingCheckoutAPI" });

const withRequestContext = (req: Request, res: Response, meta?: Record<string, unknown>) => ({
  requestId: (req as any).requestId || res.locals.requestId,
  ...meta,
});

/**
 * POST /api/billing/checkout
 * Body: { planTier }
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { planTier } = req.body as { planTier?: PlanTier };
    if (!planTier || !["free", "standard", "enterprise"].includes(planTier)) {
      return res.status(400).json({ error: "Invalid or missing planTier" });
    }

    // Ensure customer exists for tenant
    let customer = await CustomerService.getCustomerByTenantId(tenantId);
    if (!customer) {
      const user = (req as any).user;
      const email = user?.email || res.locals?.user?.email || req.body?.email || "";
      const organizationName =
        res.locals?.organizationName ||
        user?.user_metadata?.full_name ||
        user?.name ||
        req.body?.name ||
        "Organization";

      customer = await CustomerService.createCustomer(tenantId, organizationName, email);
    }

    const plan = PLANS[planTier];

    const stripe = StripeService.getInstance().getClient();

    const baseUrl =
      (res.locals && res.locals.baseUrl) ||
      process.env.FRONTEND_BASE_URL ||
      "https://app.example.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.stripe_customer_id,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: plan.name },
            unit_amount: Math.round((plan.price || 0) * 100),
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/billing/cancel`,
    });

    return res.json({ url: session.url });
  } catch (error) {
    logger.error("Error creating checkout session", error as Error, withRequestContext(req, res));
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
});

export default router;

/**
 * Billing API Router
 * Main router for all billing endpoints
 */

import express from "express";
import subscriptionsRouter from "./subscriptions";
import usageRouter from "./usage";
import invoicesRouter from "./invoices";
import webhooksRouter from "./webhooks";
import checkoutRouter from "./checkout";
import { securityHeadersMiddleware } from "../../middleware/securityMiddleware";
import { serviceIdentityMiddleware } from "../../middleware/serviceIdentityMiddleware";
import { requirePermission } from "../../middleware/rbac";
import { requireAuth } from "../../middleware/auth";
import { tenantContextMiddleware } from "../../middleware/tenantContext";

const router = express.Router();

// Baseline protections applied to all billing routes
router.use(securityHeadersMiddleware);
router.use(serviceIdentityMiddleware);

// Public webhook endpoints (Stripe verification handles its own validation)
router.use("/webhooks", webhooksRouter);

// RBAC-protected billing routes
router.use(
  "/subscription",
  requireAuth,
  tenantContextMiddleware(),
  requirePermission("billing.manage"),
  subscriptionsRouter
);
router.use(
  "/usage",
  requireAuth,
  tenantContextMiddleware(),
  requirePermission("billing.read"),
  usageRouter
);
router.use(
  "/invoices",
  requireAuth,
  tenantContextMiddleware(),
  requirePermission("billing.read"),
  invoicesRouter
);
router.use(
  "/checkout",
  requireAuth,
  tenantContextMiddleware(),
  requirePermission("billing.manage"),
  checkoutRouter
);

export default router;

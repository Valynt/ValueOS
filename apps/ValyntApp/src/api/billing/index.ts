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
import { requestSanitizationMiddleware } from "../../middleware/requestSanitizationMiddleware";

const router = express.Router();

// Baseline protections applied to all billing routes
router.use(securityHeadersMiddleware);
router.use(requestSanitizationMiddleware({ params: { tenantId: { maxLength: 128 } } }));

// Public webhook endpoints (Stripe verification handles its own validation)
router.use("/webhooks", webhooksRouter);

// RBAC-protected billing routes
router.use(
  "/subscription",
  serviceIdentityMiddleware,
  requireAuth,
  tenantContextMiddleware(),
  requirePermission("billing.manage"),
  subscriptionsRouter
);
router.use(
  "/usage",
  serviceIdentityMiddleware,
  requireAuth,
  tenantContextMiddleware(),
  requirePermission("billing.read"),
  usageRouter
);
router.use(
  "/invoices",
  serviceIdentityMiddleware,
  requireAuth,
  tenantContextMiddleware(),
  requirePermission("billing.read"),
  invoicesRouter
);
router.use(
  "/checkout",
  serviceIdentityMiddleware,
  requireAuth,
  tenantContextMiddleware(),
  requirePermission("billing.manage"),
  checkoutRouter
);

export default router;

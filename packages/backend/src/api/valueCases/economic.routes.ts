import { NextFunction, Request, Response, Router } from "express";
import { v4 as uuidv4 } from "uuid";
import Decimal from "decimal.js";
import { z } from "zod";

import { logger } from "../../lib/logger.js";
import { getRequestSupabaseClient } from "../../lib/supabase.js";
import { AuthenticatedRequest, requireRole } from "../../middleware/auth.js";
import { FinancialModelSnapshotRepository } from "../../repositories/FinancialModelSnapshotRepository.js";
import {
  calculateIRR,
  calculateNPV,
  calculatePayback,
  calculateROI,
  discountCashFlows,
} from "../../domain/economic-kernel/economic_kernel.js";

import { CalculateRequestSchema, ScenarioRequestSchema } from "./types";
import { validateBody, validateUuidParam } from "./middleware.js";
import { ValueCasesRouteLimiters } from "./crud.routes.js";

async function calculateCase(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const organizationId =
    authReq.tenantId ?? (authReq.user?.tenant_id as string | undefined);

  if (!organizationId) {
    res.status(401).json({ error: "Missing tenant context" });
    return;
  }

  try {
    const body = CalculateRequestSchema.parse(req.body);
    const discountRate = new Decimal(body.discountRate);

    const flows = body.cashFlows
      .sort((a, b) => a.period - b.period)
      .map(cf => new Decimal(cf.amount));

    const dcfResult = discountCashFlows(flows, discountRate);
    const irrResult = calculateIRR(flows);
    const paybackResult = calculatePayback(flows);

    const totalOutflows = flows
      .filter(f => f.lt(0))
      .reduce((sum, f) => sum.plus(f.abs()), new Decimal(0));
    const totalInflows = flows
      .filter(f => f.gt(0))
      .reduce((sum, f) => sum.plus(f), new Decimal(0));
    const roiResult = calculateROI(totalInflows, totalOutflows);

    const result = {
      npv: dcfResult.npv.toString(),
      irr: irrResult.rate.toString(),
      roi: roiResult.toString(),
      paybackMonths: paybackResult.period ?? -1,
      paybackFractional: paybackResult.fractionalPeriod?.toString() ?? "-1",
      presentValues: dcfResult.presentValues.map(pv => pv.toString()),
      irrConverged: irrResult.converged,
      irrIterations: irrResult.iterations,
    };

    res.json({
      data: result,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid calculation request",
        details: err.errors,
      });
      return;
    }
    next(err);
  }
}

async function generateScenarios(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { caseId } = req.params;
  const organizationId =
    authReq.tenantId ?? (authReq.user?.tenant_id as string | undefined);

  if (!organizationId) {
    res.status(401).json({ error: "Missing tenant context" });
    return;
  }

  try {
    const body = ScenarioRequestSchema.parse(req.body);
    const mode = body.mode ?? "manual";

    if (mode === "rerun") {
      const agentRunId = uuidv4();
      logger.info(
        "generateScenarios: rerun requested (agent dispatch deferred)",
        {
          caseId,
          organizationId,
          agentRunId,
        }
      );
      res.json({
        data: {
          snapshotId: null,
          agentRunId,
          source: "agent",
          status: "running",
        },
        requestId: authReq.correlationId,
      });
      return;
    }

    const discountRate = new Decimal(body.discountRate);
    const conservativeMultipliers =
      body.scenarioMultipliers?.conservative ?? {};
    const upsideMultipliers = body.scenarioMultipliers?.upside ?? {};
    const baseAssumptions = body.baseAssumptions;

    const applyMultipliers = (
      assumptions: typeof baseAssumptions,
      multipliers: Record<string, string>
    ): typeof baseAssumptions =>
      assumptions.map(ass => {
        const m = multipliers[ass.id];
        if (!m) return ass;
        return {
          ...ass,
          value: new Decimal(ass.value).times(new Decimal(m)).toString(),
        };
      });

    const conservativeAssumptions = applyMultipliers(
      baseAssumptions,
      conservativeMultipliers
    );
    const upsideAssumptions = applyMultipliers(
      baseAssumptions,
      upsideMultipliers
    );

    const netMultiplier = (
      adjustedAssumptions: typeof baseAssumptions
    ): Decimal => {
      const baseTotal = baseAssumptions.reduce(
        (s, a) => s.plus(new Decimal(a.value)),
        new Decimal(0)
      );
      if (baseTotal.isZero()) return new Decimal(1);
      const adjTotal = adjustedAssumptions.reduce(
        (s, a) => s.plus(new Decimal(a.value)),
        new Decimal(0)
      );
      return adjTotal.div(baseTotal);
    };

    const deriveCashFlows = (
      assumptions: typeof baseAssumptions
    ): Decimal[] => {
      if (body.cashFlows && body.cashFlows.length >= 2) {
        const scale = netMultiplier(assumptions);
        return body.cashFlows.map((cf, i) => {
          const amount = new Decimal(cf.amount);
          return i === 0 ? amount : amount.times(scale);
        });
      }
      const total = assumptions.reduce(
        (sum, a) => sum.plus(new Decimal(a.value)),
        new Decimal(0)
      );
      return [total.negated(), total];
    };

    const runKernel = (
      assumptions: typeof baseAssumptions,
      label: "conservative" | "base" | "upside"
    ) => {
      const flows = deriveCashFlows(assumptions);
      const npv = calculateNPV(flows, discountRate);
      const irrResult = calculateIRR(flows);
      const totalInflow = flows
        .slice(1)
        .reduce((s, f) => s.plus(f.gt(0) ? f : new Decimal(0)), new Decimal(0));
      const totalOutflow = flows[0].abs();
      const roi = calculateROI(totalInflow, totalOutflow);
      const payback = calculatePayback(flows);

      return {
        scenario: label,
        npv: npv.toString(),
        irr: irrResult.toString(),
        roi: roi.toString(),
        payback_months:
          payback.fractionalPeriod !== null
            ? Math.round(payback.fractionalPeriod.toNumber() * 12)
            : null,
        assumptions: assumptions.map(a => {
          const base = baseAssumptions.find(ba => ba.id === a.id)!;
          const multiplier =
            label === "conservative"
              ? (conservativeMultipliers[a.id] ?? "1.0")
              : label === "upside"
                ? (upsideMultipliers[a.id] ?? "1.0")
                : "1.0";
          return {
            id: a.id,
            name: a.name,
            baseValue: base.value,
            adjustedValue: a.value,
            multiplier,
          };
        }),
      };
    };

    const baseResult = runKernel(baseAssumptions, "base");
    const conservativeResult = runKernel(
      conservativeAssumptions,
      "conservative"
    );
    const upsideResult = runKernel(upsideAssumptions, "upside");
    const scenarios = [conservativeResult, baseResult, upsideResult];
    const generatedAt = new Date().toISOString();

    const repo = new FinancialModelSnapshotRepository(
      getRequestSupabaseClient(req)
    );
    const snapshot = await repo.createSnapshot({
      case_id: caseId,
      organization_id: organizationId,
      roi: baseResult.roi !== null ? parseFloat(baseResult.roi) : undefined,
      npv: baseResult.npv !== null ? parseFloat(baseResult.npv) : undefined,
      payback_period_months: baseResult.payback_months ?? undefined,
      assumptions_json: baseAssumptions,
      outputs_json: {
        scenarios,
        mode: "manual",
        generatedAt,
        discountRate: body.discountRate,
      },
      source_agent: "manual",
    });

    const agentRunId = mode === "both" ? uuidv4() : undefined;
    if (mode === "both") {
      logger.info(
        "generateScenarios: both mode — manual snapshot persisted, agent rerun deferred",
        {
          caseId,
          organizationId,
          snapshotId: snapshot.id,
          agentRunId,
        }
      );
    }

    res.json({
      data: {
        snapshotId: snapshot.id,
        scenarios,
        source: "manual",
        generatedAt,
        ...(agentRunId ? { agentRunId } : {}),
      },
      requestId: authReq.correlationId,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid scenario request",
        details: err.errors,
      });
      return;
    }
    next(err);
  }
}

const UpdateAssumptionSchema = z
  .object({
    value: z.string().optional(),
    sensitivity_low: z.string().optional(),
    sensitivity_high: z.string().optional(),
    recalc: z.boolean().default(true),
  })
  .strict();

async function updateAssumption(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { caseId, assumptionId } = req.params;
  const organizationId =
    authReq.tenantId ?? (authReq.user?.tenant_id as string | undefined);

  if (!organizationId) {
    res.status(401).json({ error: "Missing tenant context" });
    return;
  }

  try {
    const body = UpdateAssumptionSchema.parse(req.body);

    const repo = new FinancialModelSnapshotRepository(
      getRequestSupabaseClient(req)
    );
    const snapshot = await repo.getLatestSnapshotForCase(
      caseId,
      organizationId
    );

    if (!snapshot) {
      res.status(404).json({
        error: "NO_SNAPSHOT",
        message:
          "No financial model snapshot found. Run the financial model first.",
      });
      return;
    }

    const assumptions = snapshot.assumptions_json as Array<
      Record<string, unknown>
    >;
    const assumptionIndex = assumptions.findIndex(
      a => a["id"] === assumptionId
    );

    if (assumptionIndex === -1) {
      res.status(404).json({
        error: "ASSUMPTION_NOT_FOUND",
        message: `Assumption ${assumptionId} not found in the latest snapshot.`,
      });
      return;
    }

    const existing = assumptions[assumptionIndex];
    const updatedAssumption = {
      ...existing,
      ...(body.value !== undefined ? { value: body.value } : {}),
      ...(body.sensitivity_low !== undefined
        ? { sensitivity_low: body.sensitivity_low }
        : {}),
      ...(body.sensitivity_high !== undefined
        ? { sensitivity_high: body.sensitivity_high }
        : {}),
      version: ((existing["version"] as number | undefined) ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };

    const updatedAssumptions = [
      ...assumptions.slice(0, assumptionIndex),
      updatedAssumption,
      ...assumptions.slice(assumptionIndex + 1),
    ];

    let recalcResult: {
      snapshotId: string;
      npv: string | null;
      irr: string | null;
      roi: string | null;
      payback_months: number | null;
    } | null = null;

    if (body.recalc) {
      const storedRate = (snapshot.outputs_json as Record<string, unknown>)?.[
        "discountRate"
      ];
      const discountRate = new Decimal(
        typeof storedRate === "string" ? storedRate : "0.10"
      );
      const total = updatedAssumptions.reduce(
        (sum, a) => sum.plus(new Decimal(String(a["value"] ?? "0"))),
        new Decimal(0)
      );
      const flows = [total.negated(), total];

      const npv = calculateNPV(flows, discountRate);
      const irrResult = calculateIRR(flows);
      const roi = calculateROI(
        flows
          .slice(1)
          .reduce(
            (s, f) => s.plus(f.gt(0) ? f : new Decimal(0)),
            new Decimal(0)
          ),
        flows[0].abs()
      );
      const payback = calculatePayback(flows);

      const newSnapshot = await repo.createSnapshot({
        case_id: caseId,
        organization_id: organizationId,
        roi: parseFloat(roi.toString()),
        npv: parseFloat(npv.toString()),
        payback_period_months:
          payback.fractionalPeriod !== null
            ? Math.round(payback.fractionalPeriod.toNumber() * 12)
            : undefined,
        assumptions_json: updatedAssumptions,
        outputs_json: {
          ...(snapshot.outputs_json as Record<string, unknown>),
          recalc_triggered_by: assumptionId,
          recalcAt: new Date().toISOString(),
        },
        source_agent: "manual",
      });

      recalcResult = {
        snapshotId: newSnapshot.id,
        npv: npv.toString(),
        irr: irrResult.toString(),
        roi: roi.toString(),
        payback_months:
          payback.fractionalPeriod !== null
            ? Math.round(payback.fractionalPeriod.toNumber() * 12)
            : null,
      };
    } else {
      await repo.createSnapshot({
        case_id: caseId,
        organization_id: organizationId,
        roi: snapshot.roi ?? undefined,
        npv: snapshot.npv ?? undefined,
        payback_period_months: snapshot.payback_period_months ?? undefined,
        assumptions_json: updatedAssumptions,
        outputs_json: {
          ...(snapshot.outputs_json as Record<string, unknown>),
          assumption_updated: assumptionId,
          updatedAt: new Date().toISOString(),
        },
        source_agent: "manual",
      });
    }

    res.json({
      data: {
        assumption: updatedAssumption,
        recalculation: recalcResult,
      },
      requestId: authReq.correlationId,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid assumption update",
        details: err.errors,
      });
      return;
    }
    next(err);
  }
}

export function registerEconomicRoutes(
  router: Router,
  { standardLimiter }: Pick<ValueCasesRouteLimiters, "standardLimiter">
): void {
  router.post(
    "/:caseId/calculate",
    standardLimiter,
    requireRole(["admin", "member"]),
    validateUuidParam("caseId"),
    validateBody(CalculateRequestSchema),
    calculateCase
  );

  router.post(
    "/:caseId/scenarios",
    standardLimiter,
    requireRole(["admin", "member"]),
    validateUuidParam("caseId"),
    validateBody(ScenarioRequestSchema),
    generateScenarios
  );

  router.patch(
    "/:caseId/assumptions/:assumptionId",
    standardLimiter,
    requireRole(["admin", "member"]),
    validateUuidParam("caseId"),
    validateUuidParam("assumptionId"),
    updateAssumption
  );
}

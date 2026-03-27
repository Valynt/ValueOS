/**
 * Value Cases API Routes
 *
 * Production-grade CRUD endpoints for value case management.
 *
 * Features:
 * - Input validation with Zod (strict mode, reject unknown fields)
 * - JWT authentication with role-based access
 * - Rate limiting (per-IP + per-user)
 * - Structured JSON logging with correlation IDs
 * - Proper HTTP status codes
 * - Graceful error handling (no stack trace leaks)
 */

import { NextFunction, Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z, ZodError } from 'zod';
import Decimal from 'decimal.js';

import { logger } from '../../lib/logger.js'
import { AuthenticatedRequest, requireAuth, requireRole } from '../../middleware/auth.js'
import { createRateLimiter, RateLimitTier } from '../../middleware/rateLimiter.js'
import { tenantContextMiddleware } from '../../middleware/tenantContext.js'
import { tenantDbContextMiddleware } from '../../middleware/tenantDbContext.js'
import { FinancialModelSnapshotRepository } from '../../repositories/FinancialModelSnapshotRepository.js'
import { integrityOutputRepository } from '../../repositories/IntegrityOutputRepository.js'
import { ValueTreeRepository } from '../../repositories/ValueTreeRepository.js'
import { caseValueTreeService, ValueTreeNodeInputSchema } from '../../services/value/CaseValueTreeService.js'
import { hypothesisOutputService } from '../../services/value/HypothesisOutputService.js'
import { ReadinessScorer } from '../../services/integrity/ReadinessScorer.js';
import {
  calculateIRR,
  calculateNPV,
  calculatePayback,
  calculateROI,
  discountCashFlows,
  sensitivityAnalysis,
} from '../../domain/economic-kernel/economic_kernel.js';

import {
  ConflictError,
  DatabaseError,
  NotFoundError,
  ValueCasesRepository,
} from './repository';
import {
  ApiErrorResponse,
  CalculateRequestSchema,
  CreateValueCaseSchema,
  ListValueCasesQuerySchema,
  ScenarioRequestSchema,
  UpdateValueCaseSchema,
} from './types';
import { requireOrganizationContext } from './requireOrganizationContext';


// ============================================================================
// Router Setup
// ============================================================================

const router = Router();

// Rate limiters
const standardLimiter = createRateLimiter(RateLimitTier.STANDARD);
const strictLimiter = createRateLimiter(RateLimitTier.STRICT);

// ============================================================================
// Middleware
// ============================================================================

/**
 * Add correlation ID to request
 */
function correlationId(req: Request, _res: Response, next: NextFunction): void {
  (req as AuthenticatedRequest).correlationId =
    (req.headers['x-correlation-id'] as string) || `req-${uuidv4()}`;
  next();
}

/**
 * Request logging middleware
 */
function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const authReq = req as AuthenticatedRequest;

  res.on('finish', () => {
    const latencyMs = Date.now() - startTime;
    logger.info('API request completed', {
      requestId: authReq.correlationId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      latencyMs,
      tenantId: authReq.tenantId,
      userId: authReq.user?.id,
      userAgent: req.headers['user-agent']?.substring(0, 100),
    });
  });

  next();
}

/**
 * Validate request body against schema
 */
function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: { errors },
          requestId: (req as AuthenticatedRequest).correlationId,
        } satisfies ApiErrorResponse);
        return;
      }
      next(err);
    }
  };
}

/**
 * Validate query params against schema
 */
function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as unknown as typeof req.query;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: { errors },
          requestId: (req as AuthenticatedRequest).correlationId,
        } satisfies ApiErrorResponse);
        return;
      }
      next(err);
    }
  };
}

/**
 * Validate UUID path parameter
 */
function validateUuidParam(paramName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!value || !uuidRegex.test(value)) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `Invalid ${paramName}: must be a valid UUID`,
        requestId: (req as AuthenticatedRequest).correlationId,
      } satisfies ApiErrorResponse);
      return;
    }
    next();
  };
}

// ============================================================================
// Error Handler
// ============================================================================

/**
 * Map repository errors to HTTP responses
 */
function handleError(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  const requestId = authReq.correlationId;

  // Known repository errors
  if (err instanceof NotFoundError) {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: err.message,
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  if (err instanceof ConflictError) {
    res.status(409).json({
      error: 'CONFLICT',
      message: err.message,
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  if (err instanceof DatabaseError) {
    logger.error('Database error', {
      requestId,
      error: err.message,
      code: err.code,
      // Never log the cause stack trace
    });

    res.status(503).json({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Database temporarily unavailable. Please retry.',
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  // Unexpected errors - log but don't leak details
  logger.error('Unexpected error in value cases API', {
    requestId,
    error: err instanceof Error ? err.message : 'Unknown error',
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    requestId,
  } satisfies ApiErrorResponse);
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * POST /api/v1/cases
 * Create a new value case
 */
async function createCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  try {
    const repository = ValueCasesRepository.fromRequest(req);
    const valueCase = await repository.create(
      req.organizationId!,
      authReq.user!.id,
      req.body
    );

    res.status(201).json({
      data: valueCase,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/cases
 * List value cases with pagination
 */
async function listCases(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  try {
    const repository = ValueCasesRepository.fromRequest(req);
    const result = await repository.list(req.organizationId!, ListValueCasesQuerySchema.parse(req.query));

    res.status(200).json({
      ...result,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/cases/:caseId
 * Get a single value case
 */
async function getCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { caseId } = req.params;

  try {
    const repository = ValueCasesRepository.fromRequest(req);
    const valueCase = await repository.getById(req.organizationId!, caseId);

    res.status(200).json({
      data: valueCase,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/cases/:caseId
 * Update a value case
 *
 * Status gate: transitions to 'in_review' are blocked when open critical
 * integrity violations exist. Warnings are surfaced but non-blocking unless
 * bypassWarnings is explicitly false (default: warnings are bypassed).
 */
async function updateCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { caseId } = req.params;

  try {
    // Integrity gate: enforce before any in_review transition.
    const requestedStatus = (req.body as Record<string, unknown>)?.status;
    if (requestedStatus === 'in_review') {
      const organizationId = req.organizationId;
      if (!req.supabase) {
        // Gate cannot run without a DB client — log so the bypass is observable.
        logger.warn('Integrity gate skipped: req.supabase not available', { caseId });
      } else if (organizationId) {
        try {
          const { valueIntegrityService } = await import(
            '../../services/integrity/ValueIntegrityService.js'
          );
          const accessToken =
            (req.headers.authorization?.replace('Bearer ', '') ?? '');
          const blockResult = await valueIntegrityService.checkHardBlocks(
            caseId,
            organizationId,
            accessToken,
          );
          if (blockResult.blocked) {
            res.status(422).json({
              error: 'IntegrityHardBlock',
              message: 'This case has open critical integrity violations that must be resolved before advancing to in_review.',
              blocked: true,
              violations: blockResult.violations,
              soft_warnings: blockResult.soft_warnings,
            });
            return;
          }
        } catch (integrityErr) {
          // Non-fatal: log and allow the update to proceed if the integrity
          // service is unavailable (fail-open to avoid blocking legitimate work).
          logger.warn('Integrity gate check failed — proceeding without gate', {
            caseId,
            error: integrityErr instanceof Error ? integrityErr.message : String(integrityErr),
          });
        }
      }
    }

    const repository = ValueCasesRepository.fromRequest(req);
    const valueCase = await repository.update(req.organizationId!, caseId, req.body);

    res.status(200).json({
      data: valueCase,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/cases/:caseId
 * Delete a value case
 */
async function deleteCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { caseId } = req.params;

  try {
    const repository = ValueCasesRepository.fromRequest(req);
    await repository.delete(req.organizationId!, caseId);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// Route Definitions
// ============================================================================

// Apply common middleware
router.use(correlationId);
router.use(requestLogger);

// All routes require authentication
router.use(requireAuth);
router.use(tenantContextMiddleware(), tenantDbContextMiddleware());
router.use(requireOrganizationContext);

// POST /cases - Create
router.post(
  '/',
  strictLimiter,
  requireRole(['admin', 'member']),
  validateBody(CreateValueCaseSchema),
  createCase
);

// GET /cases - List
router.get(
  '/',
  standardLimiter,
  requireRole(['admin', 'member', 'viewer']),
  validateQuery(ListValueCasesQuerySchema),
  listCases
);

// GET /cases/:caseId - Get one
router.get(
  '/:caseId',
  standardLimiter,
  requireRole(['admin', 'member', 'viewer']),
  validateUuidParam('caseId'),
  getCase
);

// PATCH /cases/:caseId - Update
router.patch(
  '/:caseId',
  standardLimiter,
  requireRole(['admin', 'member']),
  validateUuidParam('caseId'),
  validateBody(UpdateValueCaseSchema),
  updateCase
);

// DELETE /cases/:caseId - Delete
router.delete(
  '/:caseId',
  strictLimiter,
  requireRole(['admin']),
  validateUuidParam('caseId'),
  deleteCase
);

// ============================================================================
// Hypothesis Output Routes
// ============================================================================

// GET /cases/:caseId/hypothesis — latest hypothesis output for a case
router.get(
  '/:caseId/hypothesis',
  standardLimiter,
  requireRole(['admin', 'member', 'viewer']),
  validateUuidParam('caseId'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { caseId } = req.params;
    const organizationId = req.organizationId!;

    try {
      const output = await hypothesisOutputService.getLatestForCase(caseId, organizationId);
      if (!output) {
        res.status(404).json({ data: null, message: 'No hypothesis output found for this case' });
        return;
      }
      res.json({ data: output });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// Value Tree Routes
// ============================================================================

// GET /cases/:caseId/value-tree — all nodes for a case
router.get(
  '/:caseId/value-tree',
  standardLimiter,
  requireRole(['admin', 'member', 'viewer']),
  validateUuidParam('caseId'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { caseId } = req.params;
    const organizationId = req.organizationId!;

    try {
      const repo = new ValueTreeRepository();
      const nodes = await repo.getNodesForCase(caseId, organizationId);
      res.json({ data: nodes });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /cases/:caseId/value-tree — replace full tree or upsert a single node
router.patch(
  '/:caseId/value-tree',
  standardLimiter,
  requireRole(['admin', 'member']),
  validateUuidParam('caseId'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { caseId } = req.params;
    const organizationId = req.organizationId!;

    try {
      const body = req.body as unknown;

      // If body has a `nodes` array, replace the full tree
      if (
        body !== null &&
        typeof body === 'object' &&
        'nodes' in body &&
        Array.isArray((body as Record<string, unknown>).nodes)
      ) {
        const { nodes } = body as { nodes: unknown[] };
        const validated = nodes.map((n) =>
          ValueTreeNodeInputSchema.omit({ case_id: true, organization_id: true }).parse(n)
        );
        const result = await caseValueTreeService.replaceTree(caseId, organizationId, validated);
        res.json({ data: result });
        return;
      }

      // Otherwise treat body as a single node upsert
      const node = ValueTreeNodeInputSchema.parse({
        ...(body as object),
        case_id: caseId,
        organization_id: organizationId,
      });
      const result = await caseValueTreeService.upsertNode(node);
      res.json({ data: result });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Invalid node data', details: err.errors });
        return;
      }
      next(err);
    }
  }
);

// ============================================================================
// Financial Model Snapshot Routes
// ============================================================================

// GET /cases/:caseId/model-snapshots/latest — most recent snapshot for a case
router.get(
  '/:caseId/model-snapshots/latest',
  standardLimiter,
  requireRole(['admin', 'member', 'viewer']),
  validateUuidParam('caseId'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { caseId } = req.params;
    const organizationId = req.organizationId!;

    try {
      const repo = new FinancialModelSnapshotRepository();
      const snapshot = await repo.getLatestSnapshotForCase(caseId, organizationId);
      if (!snapshot) {
        res.status(404).json({ data: null, message: 'No financial model snapshot found for this case' });
        return;
      }
      res.json({ data: snapshot });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// Integrity Routes
// ============================================================================

// GET /cases/:caseId/integrity — latest integrity output for a case
// Returns { data: IntegrityOutputRow | null } — never 404, empty state is data: null
router.get(
  '/:caseId/integrity',
  standardLimiter,
  requireRole(['admin', 'member', 'viewer']),
  validateUuidParam('caseId'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { caseId } = req.params;
    const organizationId = req.organizationId!;

    try {
      const output = await integrityOutputRepository.getForCase(caseId, organizationId);
      res.json({ data: output });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// Readiness Routes
// ============================================================================

const readinessScorer = new ReadinessScorer();

// GET /cases/:caseId/readiness — readiness score for a case
router.get(
  '/:caseId/readiness',
  standardLimiter,
  requireRole(['admin', 'member', 'viewer']),
  validateUuidParam('caseId'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { caseId } = req.params;
    const organizationId = req.organizationId!;

    try {
      const readiness = await readinessScorer.calculateReadiness(caseId, organizationId);
      res.json({ data: readiness });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// ModelStage API Routes (Economic Kernel Integration)
// ============================================================================

/**
 * POST /cases/:caseId/calculate
 * Real-time Economic Kernel calculation for a value case
 */
async function calculateCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { caseId } = req.params;
  const organizationId = req.organizationId!;

  try {
    const body = CalculateRequestSchema.parse(req.body);
    const discountRate = new Decimal(body.discountRate);

    // Convert cash flows to Decimal array
    const flows = body.cashFlows
      .sort((a, b) => a.period - b.period)
      .map(cf => new Decimal(cf.amount));

    // Run Economic Kernel calculations
    const dcfResult = discountCashFlows(flows, discountRate);
    const irrResult = calculateIRR(flows);
    const paybackResult = calculatePayback(flows);

    // Calculate ROI (total benefits - costs) / costs
    const totalOutflows = flows
      .filter(f => f.lt(0))
      .reduce((sum, f) => sum.plus(f.abs()), new Decimal(0));
    const totalInflows = flows
      .filter(f => f.gt(0))
      .reduce((sum, f) => sum.plus(f), new Decimal(0));
    const roiResult = calculateROI(totalInflows, totalOutflows);

    // Build response
    const result = {
      npv: dcfResult.npv.toString(),
      irr: irrResult.rate.toString(),
      roi: roiResult.toString(),
      paybackMonths: paybackResult.period ?? -1,
      paybackFractional: paybackResult.fractionalPeriod?.toString() ?? '-1',
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
        error: 'VALIDATION_ERROR',
        message: 'Invalid calculation request',
        details: err.errors,
      });
      return;
    }
    next(err);
  }
}

/**
 * POST /cases/:caseId/scenarios
 * Generate conservative, base, and upside scenarios
 */
async function generateScenarios(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { caseId } = req.params;
  const organizationId = req.organizationId!;

  try {
    const body = ScenarioRequestSchema.parse(req.body);
    const mode = body.mode ?? 'manual';

    // ── rerun: fire-and-forget agent dispatch (stub — full wiring is a future sprint) ──
    if (mode === 'rerun') {
      const agentRunId = uuidv4();
      logger.info('generateScenarios: rerun requested (agent dispatch deferred)', {
        caseId,
        organizationId,
        agentRunId,
      });
      res.json({
        data: { snapshotId: null, agentRunId, source: 'agent', status: 'running' },
        requestId: authReq.correlationId,
      });
      return;
    }

    // ── manual / both: compute via Economic Kernel and persist ──
    const discountRate = new Decimal(body.discountRate);
    const conservativeMultipliers = body.scenarioMultipliers?.conservative ?? {};
    const upsideMultipliers = body.scenarioMultipliers?.upside ?? {};
    const baseAssumptions = body.baseAssumptions;

    // Apply multipliers to produce adjusted assumption sets per scenario.
    const applyMultipliers = (
      assumptions: typeof baseAssumptions,
      multipliers: Record<string, string>,
    ): typeof baseAssumptions =>
      assumptions.map(ass => {
        const m = multipliers[ass.id];
        if (!m) return ass;
        return { ...ass, value: new Decimal(ass.value).times(new Decimal(m)).toString() };
      });

    const conservativeAssumptions = applyMultipliers(baseAssumptions, conservativeMultipliers);
    const upsideAssumptions = applyMultipliers(baseAssumptions, upsideMultipliers);

    // Compute the net revenue multiplier for a scenario: the ratio of the
    // adjusted assumption total to the base assumption total. This is applied
    // to inflow periods (period > 0) when explicit cashFlows are provided,
    // so that scenario differentiation is preserved even with explicit flows.
    // Period 0 (investment outflow) is left unchanged — it represents cost.
    const netMultiplier = (adjustedAssumptions: typeof baseAssumptions): Decimal => {
      const baseTotal = baseAssumptions.reduce(
        (s, a) => s.plus(new Decimal(a.value)),
        new Decimal(0),
      );
      if (baseTotal.isZero()) return new Decimal(1);
      const adjTotal = adjustedAssumptions.reduce(
        (s, a) => s.plus(new Decimal(a.value)),
        new Decimal(0),
      );
      return adjTotal.div(baseTotal);
    };

    // Derive cash flows from an assumption set.
    // When explicit cashFlows are provided, inflow periods are scaled by the
    // net multiplier so conservative/base/upside produce differentiated NPV.
    // Period 0 (outflow) is never scaled — it represents the investment cost.
    const deriveCashFlows = (assumptions: typeof baseAssumptions): Decimal[] => {
      if (body.cashFlows && body.cashFlows.length >= 2) {
        const scale = netMultiplier(assumptions);
        return body.cashFlows.map((cf, i) => {
          const amount = new Decimal(cf.amount);
          // Period 0 is the investment outflow — do not scale it.
          return i === 0 ? amount : amount.times(scale);
        });
      }
      const total = assumptions.reduce(
        (sum, a) => sum.plus(new Decimal(a.value)),
        new Decimal(0),
      );
      return [total.negated(), total];
    };

    // Run Economic Kernel for each scenario.
    const runKernel = (assumptions: typeof baseAssumptions, label: 'conservative' | 'base' | 'upside') => {
      const flows = deriveCashFlows(assumptions);
      const npv = calculateNPV(flows, discountRate);
      const irrResult = calculateIRR(flows);
      const totalInflow = flows.slice(1).reduce((s, f) => s.plus(f.gt(0) ? f : new Decimal(0)), new Decimal(0));
      const totalOutflow = flows[0].abs();
      const roi = calculateROI(totalInflow, totalOutflow);
      const payback = calculatePayback(flows);

      return {
        scenario: label,
        npv: npv.toString(),
        irr: irrResult.toString(),
        roi: roi.toString(),
        payback_months: payback.fractionalPeriod !== null
          ? Math.round(payback.fractionalPeriod.toNumber() * 12)
          : null,
        assumptions: assumptions.map(a => {
          const base = baseAssumptions.find(ba => ba.id === a.id)!;
          const multiplier =
            label === 'conservative'
              ? (conservativeMultipliers[a.id] ?? '1.0')
              : label === 'upside'
                ? (upsideMultipliers[a.id] ?? '1.0')
                : '1.0';
          return { id: a.id, name: a.name, baseValue: base.value, adjustedValue: a.value, multiplier };
        }),
      };
    };

    const baseResult = runKernel(baseAssumptions, 'base');
    const conservativeResult = runKernel(conservativeAssumptions, 'conservative');
    const upsideResult = runKernel(upsideAssumptions, 'upside');
    const scenarios = [conservativeResult, baseResult, upsideResult];
    const generatedAt = new Date().toISOString();

    // Persist snapshot — base scenario values become the top-level metrics.
    const repo = new FinancialModelSnapshotRepository();
    const snapshot = await repo.createSnapshot({
      case_id: caseId,
      organization_id: organizationId,
      roi: baseResult.roi !== null ? parseFloat(baseResult.roi) : undefined,
      npv: baseResult.npv !== null ? parseFloat(baseResult.npv) : undefined,
      payback_period_months: baseResult.payback_months ?? undefined,
      assumptions_json: baseAssumptions,
      outputs_json: { scenarios, mode: 'manual', generatedAt, discountRate: body.discountRate },
      source_agent: 'manual',
    });

    // For mode "both", log the deferred agent rerun intent.
    const agentRunId = mode === 'both' ? uuidv4() : undefined;
    if (mode === 'both') {
      logger.info('generateScenarios: both mode — manual snapshot persisted, agent rerun deferred', {
        caseId,
        organizationId,
        snapshotId: snapshot.id,
        agentRunId,
      });
    }

    res.json({
      data: {
        snapshotId: snapshot.id,
        scenarios,
        source: 'manual',
        generatedAt,
        ...(agentRunId ? { agentRunId } : {}),
      },
      requestId: authReq.correlationId,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid scenario request',
        details: err.errors,
      });
      return;
    }
    next(err);
  }
}

/**
 * PATCH /cases/:caseId/assumptions/:assumptionId
 * Update an assumption and trigger recalculation
 */
const UpdateAssumptionSchema = z.object({
  value: z.string().optional(),
  sensitivity_low: z.string().optional(),
  sensitivity_high: z.string().optional(),
  recalc: z.boolean().default(true),
}).strict();

async function updateAssumption(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { caseId, assumptionId } = req.params;
  const organizationId = req.organizationId!;

  try {
    const body = UpdateAssumptionSchema.parse(req.body);

    // Fetch the latest snapshot — assumptions live in snapshots, not a separate table.
    const repo = new FinancialModelSnapshotRepository();
    const snapshot = await repo.getLatestSnapshotForCase(caseId, organizationId);

    if (!snapshot) {
      res.status(404).json({
        error: 'NO_SNAPSHOT',
        message: 'No financial model snapshot found. Run the financial model first.',
      });
      return;
    }

    // Locate the assumption within the snapshot.
    const assumptions = snapshot.assumptions_json as Array<Record<string, unknown>>;
    const assumptionIndex = assumptions.findIndex(a => a['id'] === assumptionId);

    if (assumptionIndex === -1) {
      res.status(404).json({
        error: 'ASSUMPTION_NOT_FOUND',
        message: `Assumption ${assumptionId} not found in the latest snapshot.`,
      });
      return;
    }

    // Merge the update and increment version.
    const existing = assumptions[assumptionIndex];
    const updatedAssumption = {
      ...existing,
      ...(body.value !== undefined ? { value: body.value } : {}),
      ...(body.sensitivity_low !== undefined ? { sensitivity_low: body.sensitivity_low } : {}),
      ...(body.sensitivity_high !== undefined ? { sensitivity_high: body.sensitivity_high } : {}),
      version: ((existing['version'] as number | undefined) ?? 0) + 1,
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
      // Re-derive cash flows from the updated assumption set and recompute metrics.
      // Recover the discount rate used when the snapshot was originally generated.
      // Falls back to 0.10 only if the snapshot pre-dates this field being stored.
      const storedRate = (snapshot.outputs_json as Record<string, unknown>)?.['discountRate'];
      const discountRate = new Decimal(typeof storedRate === 'string' ? storedRate : '0.10');
      const total = updatedAssumptions.reduce(
        (sum, a) => sum.plus(new Decimal(String(a['value'] ?? '0'))),
        new Decimal(0),
      );
      const flows = [total.negated(), total];

      const npv = calculateNPV(flows, discountRate);
      const irrResult = calculateIRR(flows);
      const roi = calculateROI(
        flows.slice(1).reduce((s, f) => s.plus(f.gt(0) ? f : new Decimal(0)), new Decimal(0)),
        flows[0].abs(),
      );
      const payback = calculatePayback(flows);

      const newSnapshot = await repo.createSnapshot({
        case_id: caseId,
        organization_id: organizationId,
        roi: parseFloat(roi.toString()),
        npv: parseFloat(npv.toString()),
        payback_period_months: payback.fractionalPeriod !== null
          ? Math.round(payback.fractionalPeriod.toNumber() * 12)
          : undefined,
        assumptions_json: updatedAssumptions,
        outputs_json: {
          ...(snapshot.outputs_json as Record<string, unknown>),
          recalc_triggered_by: assumptionId,
          recalcAt: new Date().toISOString(),
        },
        source_agent: 'manual',
      });

      recalcResult = {
        snapshotId: newSnapshot.id,
        npv: npv.toString(),
        irr: irrResult.toString(),
        roi: roi.toString(),
        payback_months: payback.fractionalPeriod !== null
          ? Math.round(payback.fractionalPeriod.toNumber() * 12)
          : null,
      };
    } else {
      // Persist updated assumptions without recalculating metrics.
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
        source_agent: 'manual',
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
        error: 'VALIDATION_ERROR',
        message: 'Invalid assumption update',
        details: err.errors,
      });
      return;
    }
    next(err);
  }
}

// ModelStage routes
router.post(
  '/:caseId/calculate',
  standardLimiter,
  requireRole(['admin', 'member']),
  validateUuidParam('caseId'),
  validateBody(CalculateRequestSchema),
  calculateCase
);

router.post(
  '/:caseId/scenarios',
  standardLimiter,
  requireRole(['admin', 'member']),
  validateUuidParam('caseId'),
  validateBody(ScenarioRequestSchema),
  generateScenarios
);

router.patch(
  '/:caseId/assumptions/:assumptionId',
  standardLimiter,
  requireRole(['admin', 'member']),
  validateUuidParam('caseId'),
  validateUuidParam('assumptionId'),
  updateAssumption
);

// ============================================================================
// Discovery Agent Routes
// ============================================================================

import { getDiscoveryAgent } from '../../lib/agent-fabric/agents/DiscoveryAgent.js';

const StartDiscoverySchema = z.object({
  companyName: z.string().min(1).max(200),
  industryContext: z.string().max(500).optional(),
}).strict();

async function startDiscovery(req: Request, res: Response) {
  try {
    const { caseId } = req.params;
    const organizationId = req.organizationId!;
    const body = StartDiscoverySchema.safeParse(req.body);

    if (!body.success) {
      return res.status(400).json({
        error: 'Invalid discovery request',
        details: body.error.flatten(),
      });
    }

    const discoveryAgent = getDiscoveryAgent();
    const result = await discoveryAgent.startDiscovery({
      organizationId,
      valueCaseId: caseId,
      companyName: body.data.companyName,
      industryContext: body.data.industryContext,
    });

    logger.info('Discovery started', { runId: result.runId, caseId, organizationId });
    return res.status(202).json({
      runId: result.runId,
      status: 'started',
      message: 'Discovery workflow initiated',
    });
  } catch (err) {
    logger.error('Discovery start failed', {
      error: err instanceof Error ? err.message : String(err),
      caseId: req.params.caseId,
    });
    return res.status(500).json({ error: 'Failed to start discovery' });
  }
}

async function getDiscoveryStatus(req: Request, res: Response) {
  try {
    const { runId } = req.params;
    const discoveryAgent = getDiscoveryAgent();
    const runState = discoveryAgent.getRunState(runId);

    if (!runState) {
      return res.status(404).json({ error: 'Discovery run not found' });
    }

    return res.json({
      runId: runState.runId,
      status: runState.status,
      startedAt: runState.startedAt,
      completedAt: runState.completedAt,
      error: runState.error,
    });
  } catch (err) {
    logger.error('Discovery status check failed', {
      error: err instanceof Error ? err.message : String(err),
      runId: req.params.runId,
    });
    return res.status(500).json({ error: 'Failed to get discovery status' });
  }
}

async function cancelDiscovery(req: Request, res: Response) {
  try {
    const { runId } = req.params;
    const discoveryAgent = getDiscoveryAgent();
    await discoveryAgent.cancelDiscovery(runId);
    return res.json({ message: 'Discovery run cancelled' });
  } catch (err) {
    logger.error('Discovery cancel failed', {
      error: err instanceof Error ? err.message : String(err),
      runId: req.params.runId,
    });
    return res.status(500).json({ error: 'Failed to cancel discovery' });
  }
}

router.post(
  '/:caseId/discovery',
  standardLimiter,
  requireRole(['admin', 'member']),
  validateUuidParam('caseId'),
  startDiscovery
);

router.get(
  '/discovery/:runId',
  standardLimiter,
  requireRole(['admin', 'member']),
  validateUuidParam('runId'),
  getDiscoveryStatus
);

router.delete(
  '/discovery/:runId',
  standardLimiter,
  requireRole(['admin', 'member']),
  validateUuidParam('runId'),
  cancelDiscovery
);

// Error handler
router.use(handleError);

// Back-half value loop endpoints (integrity, narrative, realization)
import { backHalfRouter } from './backHalf.js';
router.use('/', backHalfRouter);

// Promise baseline and handoff endpoints
import baselineRouter from './baseline.js';
router.use('/', baselineRouter);

export default router;
export { router as valueCasesRouter };

import { Router } from 'express';
import { securityHeadersMiddleware } from '../../middleware/securityMiddleware';
import { requestSanitizationMiddleware } from '../../middleware/requestSanitizationMiddleware';
import { getCustomerMetrics } from './metrics';
import { getCustomerValueCase } from './value-case';
import { getCustomerBenchmarks } from './benchmarks';

const router = Router();

router.use(securityHeadersMiddleware);
router.use(
  requestSanitizationMiddleware({
    params: {
      token: { maxLength: 256 },
    },
    query: {
      period: { maxLength: 16 },
      metric_type: { maxLength: 32 },
      kpi_name: { maxLength: 128 },
      industry: { maxLength: 128 },
    },
  })
);

router.get('/metrics/:token', getCustomerMetrics);
router.get('/value-case/:token', getCustomerValueCase);
router.get('/benchmarks/:token', getCustomerBenchmarks);

export default router;

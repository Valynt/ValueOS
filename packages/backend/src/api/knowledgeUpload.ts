import { Request, Response, Router } from 'express';

import {
  getCanonicalSubjectFromRequest,
  requireConsent,
} from '../middleware/consentMiddleware';
import { enforceLineage } from '../middleware/lineageValidationMiddleware';
import { requirePermission } from '../middleware/rbac';
import { securityHeadersMiddleware } from '../middleware/securityMiddleware';
import { consentRegistry } from '../services/auth/consentRegistry';
import { logger } from '../utils/logger';

const router = Router();
router.use(securityHeadersMiddleware);
router.use(requirePermission('data.import'));

router.post(
  '/upload',
  enforceLineage(),
  requireConsent('knowledge.upload', consentRegistry, getCanonicalSubjectFromRequest),
  async (req: Request, res: Response) => {
    const { source_origin, data_sensitivity_level, ...rest } = req.body;

    logger.info('Knowledge upload received', {
      source_origin,
      data_sensitivity_level,
      metadataKeys: Object.keys(rest),
    });

    res.status(201).json({
      success: true,
      data: {
        source_origin,
        data_sensitivity_level,
        metadata: rest,
      },
    });
  }
);

export default router;

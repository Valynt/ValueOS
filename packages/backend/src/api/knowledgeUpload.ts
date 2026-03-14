import { Request, Response, Router } from 'express';

import { requireConsent } from '../middleware/consentMiddleware.js'
import { enforceLineage } from '../middleware/lineageValidationMiddleware.js'
import { requirePermission } from '../middleware/rbac.js'
import { securityHeadersMiddleware } from '../middleware/securityMiddleware.js'
import { consentRegistry } from '../services/auth/consentRegistry.js'
import { logger } from '../utils/logger.js'

const router = Router();
router.use(securityHeadersMiddleware);
router.use(requirePermission('data.import'));

router.post(
  '/upload',
  enforceLineage(),
  requireConsent('knowledge.upload', consentRegistry),
  async (req: Request, res: Response) => {
    const { source_origin, data_sensitivity_level, ...rest } = req.body;

    logger.info('Knowledge upload received', {
      source_origin,
      data_sensitivity_level,
      metadataKeys: Object.keys(rest)
    });

    res.status(201).json({
      success: true,
      data: {
        source_origin,
        data_sensitivity_level,
        metadata: rest
      }
    });
  }
);

export default router;

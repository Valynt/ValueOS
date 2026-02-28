import { Request, Response, Router } from 'express';

import { requireConsent } from '../middleware/consentMiddleware';
import { enforceLineage } from '../middleware/lineageValidationMiddleware';
import { requirePermission } from '../middleware/rbac';
import { requestSanitizationMiddleware } from '../middleware/requestSanitizationMiddleware';
import { securityHeadersMiddleware } from '../middleware/securityMiddleware';
import { consentRegistry } from '../services/consentRegistry';
import { logger } from '../utils/logger';

const router = Router();
router.use(securityHeadersMiddleware);
router.use(requestSanitizationMiddleware({ body: { notes: { allowHtml: true, allowedTags: ['p','br','strong','em'], maxLength: 4000 } } }));
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

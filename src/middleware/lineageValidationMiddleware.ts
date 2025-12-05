import { Request, Response, NextFunction, RequestHandler } from 'express';

export interface LineageRequirements {
  requiredTags: string[];
}

const defaultRequirements: LineageRequirements = {
  requiredTags: ['source_origin', 'data_sensitivity_level']
};

export function enforceLineage(
  requirements: LineageRequirements = defaultRequirements
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body || {};
    const missing = requirements.requiredTags.filter(tag => !payload[tag]);

    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Lineage tags required',
        message: `Missing lineage tags: ${missing.join(', ')}`
      });
    }

    return next();
  };
}

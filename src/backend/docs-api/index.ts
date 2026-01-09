/**
 * Documentation API Backend
 * 
 * Provides API endpoints for mapping documentation to codebase sections.
 * Enables agent-driven documentation updates based on code changes.
 */

import express, { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { createLogger } from '../../lib/logger';
import { sanitizeForLogging } from '../../lib/piiFilter';
import { settings } from '../../config/settings';

const logger = createLogger({ component: 'DocsAPI' });
const router = express.Router();

// ============================================================================
// Types and Schemas
// ============================================================================

const DocSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  path: z.string(),
  category: z.enum(['overview', 'user-guide', 'developer-guide', 'api-reference']),
  version: z.string(),
  lastUpdated: z.string().datetime(),
  mappings: z.array(z.object({
    type: z.enum(['file', 'directory', 'function', 'class', 'component']),
    path: z.string(),
    description: z.string().optional()
  }))
});

const CodeMappingSchema = z.object({
  filePath: z.string(),
  lineStart: z.number().optional(),
  lineEnd: z.number().optional(),
  docSections: z.array(z.string()),
  lastSync: z.string().datetime(),
  changeDetected: z.boolean().optional()
});

type DocSection = z.infer<typeof DocSectionSchema>;
type CodeMapping = z.infer<typeof CodeMappingSchema>;

// ============================================================================
// In-Memory Storage (Replace with database in production)
// ============================================================================

const docSections: Map<string, DocSection> = new Map();
const codeMappings: Map<string, CodeMapping> = new Map();

// Initialize with documentation structure
const initializeDocMappings = () => {
  // Overview section mappings
  docSections.set('overview-welcome', {
    id: 'overview-welcome',
    title: 'Welcome to ValueOS',
    path: '/docs/portal/overview/README.md',
    category: 'overview',
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    mappings: [
      { type: 'file', path: '/README.md', description: 'Main project README' },
      { type: 'file', path: '/package.json', description: 'Project metadata' }
    ]
  });

  docSections.set('overview-use-cases', {
    id: 'overview-use-cases',
    title: 'Use Cases',
    path: '/docs/portal/overview/use-cases.md',
    category: 'overview',
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    mappings: [
      { type: 'directory', path: '/src/services', description: 'Business logic services' },
      { type: 'directory', path: '/src/integrations', description: 'Third-party integrations' }
    ]
  });

  docSections.set('overview-pricing', {
    id: 'overview-pricing',
    title: 'Pricing',
    path: '/docs/portal/overview/pricing.md',
    category: 'overview',
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    mappings: [
      { type: 'directory', path: '/src/services/billing', description: 'Billing service' },
      { type: 'file', path: '/src/config/plans.ts', description: 'Plan configuration' }
    ]
  });

  // User Guide mappings
  docSections.set('user-guide-getting-started', {
    id: 'user-guide-getting-started',
    title: 'Getting Started',
    path: '/docs/portal/user-guide/getting-started.md',
    category: 'user-guide',
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    mappings: [
      { type: 'directory', path: '/scripts/dx', description: 'Setup scripts' },
      { type: 'file', path: '/src/components/onboarding', description: 'Onboarding UI' }
    ]
  });

  docSections.set('user-guide-user-management', {
    id: 'user-guide-user-management',
    title: 'User Management',
    path: '/docs/portal/user-guide/user-management.md',
    category: 'user-guide',
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    mappings: [
      { type: 'directory', path: '/src/services/auth', description: 'Authentication service' },
      { type: 'directory', path: '/src/components/users', description: 'User management UI' },
      { type: 'file', path: '/src/types/user.ts', description: 'User types' }
    ]
  });

  docSections.set('user-guide-sso', {
    id: 'user-guide-sso',
    title: 'SSO Setup',
    path: '/docs/portal/user-guide/sso-setup.md',
    category: 'user-guide',
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    mappings: [
      { type: 'directory', path: '/src/services/auth/sso', description: 'SSO implementation' },
      { type: 'file', path: '/src/config/auth.ts', description: 'Auth configuration' }
    ]
  });

  docSections.set('user-guide-billing', {
    id: 'user-guide-billing',
    title: 'Billing & Subscription',
    path: '/docs/portal/user-guide/billing.md',
    category: 'user-guide',
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    mappings: [
      { type: 'directory', path: '/src/services/billing', description: 'Billing service' },
      { type: 'directory', path: '/src/components/billing', description: 'Billing UI' },
      { type: 'file', path: '/src/integrations/stripe', description: 'Stripe integration' }
    ]
  });

  // Developer Guide mappings
  docSections.set('dev-guide-quick-start', {
    id: 'dev-guide-quick-start',
    title: 'Quick Start',
    path: '/docs/portal/developer-guide/quick-start.md',
    category: 'developer-guide',
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    mappings: [
      { type: 'directory', path: '/src/api', description: 'API implementation' },
      { type: 'file', path: '/src/api/client', description: 'API client' }
    ]
  });

  docSections.set('dev-guide-installation', {
    id: 'dev-guide-installation',
    title: 'Installation',
    path: '/docs/portal/developer-guide/installation.md',
    category: 'developer-guide',
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    mappings: [
      { type: 'file', path: '/package.json', description: 'Dependencies' },
      { type: 'file', path: '/.devcontainer/devcontainer.json', description: 'Dev container config' },
      { type: 'directory', path: '/scripts', description: 'Setup scripts' }
    ]
  });

  docSections.set('dev-guide-configuration', {
    id: 'dev-guide-configuration',
    title: 'Configuration',
    path: '/docs/portal/developer-guide/configuration.md',
    category: 'developer-guide',
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    mappings: [
      { type: 'file', path: '/.env.example', description: 'Environment variables' },
      { type: 'directory', path: '/src/config', description: 'Configuration files' },
      { type: 'file', path: '/vite.config.ts', description: 'Build configuration' }
    ]
  });

  // Create reverse mappings (code -> docs)
  docSections.forEach(section => {
    section.mappings.forEach(mapping => {
      const existing = codeMappings.get(mapping.path) || {
        filePath: mapping.path,
        docSections: [],
        lastSync: new Date().toISOString(),
        changeDetected: false
      };
      
      if (!existing.docSections.includes(section.id)) {
        existing.docSections.push(section.id);
      }
      
      codeMappings.set(mapping.path, existing);
    });
  });
};

// Initialize on module load
initializeDocMappings();

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * GET /api/docs/sections
 * List all documentation sections
 */
router.get('/sections', (req: Request, res: Response) => {
  const { category, search } = req.query;
  
  let sections = Array.from(docSections.values());
  
  if (category) {
    sections = sections.filter(s => s.category === category);
  }
  
  if (search) {
    const searchLower = String(search).toLowerCase();
    sections = sections.filter(s => 
      s.title.toLowerCase().includes(searchLower) ||
      s.path.toLowerCase().includes(searchLower)
    );
  }
  
  res.json({
    success: true,
    data: sections,
    meta: {
      total: sections.length,
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * GET /api/docs/sections/:id
 * Get a specific documentation section
 */
router.get('/sections/:id', (req: Request, res: Response) => {
  const section = docSections.get(req.params.id);
  
  if (!section) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Documentation section not found'
      }
    });
  }
  
  res.json({
    success: true,
    data: section
  });
});

/**
 * GET /api/docs/mappings
 * Get code-to-documentation mappings
 */
router.get('/mappings', (req: Request, res: Response) => {
  const { path, changesOnly } = req.query;
  
  let mappings = Array.from(codeMappings.values());
  
  if (path) {
    mappings = mappings.filter(m => m.filePath.includes(String(path)));
  }
  
  if (changesOnly === 'true') {
    mappings = mappings.filter(m => m.changeDetected);
  }
  
  res.json({
    success: true,
    data: mappings,
    meta: {
      total: mappings.length,
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * GET /api/docs/mappings/:path
 * Get documentation sections for a specific file/directory
 */
router.get('/mappings/*', (req: Request, res: Response) => {
  const filePath = '/' + req.params[0];
  const mapping = codeMappings.get(filePath);
  
  if (!mapping) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'No documentation mappings found for this path'
      }
    });
  }
  
  // Get full section details
  const sections = mapping.docSections
    .map(id => docSections.get(id))
    .filter(Boolean);
  
  res.json({
    success: true,
    data: {
      ...mapping,
      sections
    }
  });
});

/**
 * POST /api/docs/detect-changes
 * Detect changes in codebase that may require documentation updates
 */
router.post('/detect-changes', async (req: Request, res: Response) => {
  const { files } = req.body;
  
  if (!Array.isArray(files)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'files must be an array'
      }
    });
  }
  
  const affectedDocs: Set<string> = new Set();
  const changedMappings: CodeMapping[] = [];
  
  files.forEach((file: string) => {
    const mapping = codeMappings.get(file);
    if (mapping) {
      mapping.changeDetected = true;
      mapping.lastSync = new Date().toISOString();
      changedMappings.push(mapping);
      
      mapping.docSections.forEach(sectionId => {
        affectedDocs.add(sectionId);
      });
    }
  });
  
  const affectedSections = Array.from(affectedDocs)
    .map(id => docSections.get(id))
    .filter(Boolean);
  
  res.json({
    success: true,
    data: {
      changedFiles: files.length,
      affectedMappings: changedMappings.length,
      affectedSections: affectedSections.length,
      sections: affectedSections
    }
  });
});

/**
 * POST /api/docs/sync
 * Mark documentation as synced with code
 */
router.post('/sync', (req: Request, res: Response) => {
  const { sectionId, filePath } = req.body;
  
  if (sectionId) {
    const section = docSections.get(sectionId);
    if (section) {
      section.lastUpdated = new Date().toISOString();
      section.mappings.forEach(mapping => {
        const codeMapping = codeMappings.get(mapping.path);
        if (codeMapping) {
          codeMapping.changeDetected = false;
          codeMapping.lastSync = new Date().toISOString();
        }
      });
    }
  }
  
  if (filePath) {
    const mapping = codeMappings.get(filePath);
    if (mapping) {
      mapping.changeDetected = false;
      mapping.lastSync = new Date().toISOString();
    }
  }
  
  res.json({
    success: true,
    data: {
      synced: true,
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * GET /api/docs/health
 * Health check for documentation API
 */
router.get('/health', (req: Request, res: Response) => {
  const totalSections = docSections.size;
  const totalMappings = codeMappings.size;
  const outdatedMappings = Array.from(codeMappings.values())
    .filter(m => m.changeDetected).length;
  
  res.json({
    success: true,
    data: {
      status: 'healthy',
      sections: totalSections,
      mappings: totalMappings,
      outdated: outdatedMappings,
      coverage: totalMappings > 0 ? 
        ((totalMappings - outdatedMappings) / totalMappings * 100).toFixed(2) + '%' : 
        '0%'
    }
  });
});

// ============================================================================
// Error Handler
// ============================================================================

router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const sanitizedError = sanitizeForLogging(err);
  logger.error('Documentation API Error', err, { context: sanitizedError as any });
  
  const message =
    settings.NODE_ENV === "development"
      ? err.message
      : undefined;

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: message || 'Internal server error'
    }
  });
});

// ============================================================================
// Export
// ============================================================================

export default router;
export { DocSection, CodeMapping, docSections, codeMappings };

/**
 * API Documentation Endpoints
 * 
 * Serves OpenAPI specification and interactive documentation
 */

import fs from 'fs';
import path from 'path';

import { Router } from 'express';
import YAML from 'js-yaml';
import swaggerUi from 'swagger-ui-express';

// import { logger } from '../utils/logger';
import { requestAuditMiddleware } from '../middleware/requestAuditMiddleware.js'
import { securityHeadersMiddleware } from '../middleware/securityMiddleware.js'
import { serviceIdentityMiddleware } from '../middleware/serviceIdentityMiddleware.js'
import { DOCS_BRANDING, renderDocsLandingPage, renderReDocPage } from './docsContent.js'

const router = Router();
router.use(requestAuditMiddleware());
router.use(securityHeadersMiddleware);
router.use(serviceIdentityMiddleware);

// Load OpenAPI specification
const openApiPath = path.join(__dirname, '../../openapi.yaml');
const openApiSpec = YAML.load(fs.readFileSync(openApiPath, 'utf8'));

/**
 * Serve OpenAPI specification as JSON
 */
router.get('/openapi.json', (_req, res) => {
  return res.json(openApiSpec);
});

/**
 * Serve OpenAPI specification as YAML
 */
router.get('/openapi.yaml', (_req, res) => {
  res.type('text/yaml');
  return res.send(YAML.dump(openApiSpec, { indent: 2 }));
});

/**
 * Serve Swagger UI documentation
 */
router.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: DOCS_BRANDING.apiTitle,
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
  })
);

/**
 * Serve ReDoc documentation (alternative)
 */
router.get('/redoc', (_req, res) => {
  return res.send(renderReDocPage());
});

/**
 * API documentation landing page
 */
router.get('/', (_req, res) => {
  return res.send(renderDocsLandingPage());
});

/**
 * Generate client SDKs
 */
router.get('/sdk/:language', (req, res) => {
  const { language } = req.params;
  
  const supportedLanguages = [
    'typescript',
    'javascript',
    'python',
    'go',
    'java',
    'ruby',
    'php',
    'csharp'
  ];
  
  if (!supportedLanguages.includes(language)) {
    return res.status(400).json({
      error: 'Unsupported language',
      supported: supportedLanguages
    });
  }
  
  // In production, this would generate actual SDK code
  return res.json({
    message: `SDK generation for ${language}`,
    instructions: `Use OpenAPI Generator to generate ${language} SDK`,
    command: `openapi-generator-cli generate -i /api/openapi.json -g ${language} -o ./sdk/${language}`
  });
});

export default router;

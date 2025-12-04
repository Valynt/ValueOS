/**
 * API Documentation Endpoints
 * 
 * Serves OpenAPI specification and interactive documentation
 */

import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { logger } from '../utils/logger';
import { securityHeadersMiddleware } from '../middleware/securityMiddleware';
import { serviceIdentityMiddleware } from '../middleware/serviceIdentityMiddleware';
import { requestAuditMiddleware } from '../middleware/requestAuditMiddleware';

const router = Router();
router.use(requestAuditMiddleware());
router.use(securityHeadersMiddleware);
router.use(serviceIdentityMiddleware);

// Load OpenAPI specification
const openApiPath = path.join(__dirname, '../../openapi.yaml');
const openApiSpec = YAML.load(openApiPath);

/**
 * Serve OpenAPI specification as JSON
 */
router.get('/openapi.json', (req, res) => {
  res.json(openApiSpec);
});

/**
 * Serve OpenAPI specification as YAML
 */
router.get('/openapi.yaml', (req, res) => {
  res.type('text/yaml');
  res.send(YAML.stringify(openApiSpec, 10));
});

/**
 * Serve Swagger UI documentation
 */
router.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'ValueCanvas API Documentation',
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
router.get('/redoc', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
  <head>
    <title>ValueCanvas API Documentation</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
      body {
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <redoc spec-url='/api/openapi.json'></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>
  `);
});

/**
 * API documentation landing page
 */
router.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
  <head>
    <title>ValueCanvas API</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        max-width: 800px;
        margin: 0 auto;
        padding: 40px 20px;
        line-height: 1.6;
      }
      h1 {
        color: #333;
        border-bottom: 2px solid #4CAF50;
        padding-bottom: 10px;
      }
      .card {
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
        background: #f9f9f9;
      }
      .card h2 {
        margin-top: 0;
        color: #4CAF50;
      }
      a {
        color: #4CAF50;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      .button {
        display: inline-block;
        padding: 10px 20px;
        background: #4CAF50;
        color: white;
        border-radius: 4px;
        margin: 10px 10px 10px 0;
      }
      .button:hover {
        background: #45a049;
        text-decoration: none;
      }
      code {
        background: #f4f4f4;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
      }
      pre {
        background: #f4f4f4;
        padding: 15px;
        border-radius: 4px;
        overflow-x: auto;
      }
    </style>
  </head>
  <body>
    <h1>ValueCanvas API</h1>
    
    <p>Welcome to the ValueCanvas API documentation. This API provides AI-powered business model canvas generation and refinement.</p>
    
    <div class="card">
      <h2>📚 Documentation</h2>
      <p>Choose your preferred documentation format:</p>
      <a href="/api/docs" class="button">Swagger UI</a>
      <a href="/api/redoc" class="button">ReDoc</a>
      <a href="/api/openapi.json" class="button">OpenAPI JSON</a>
      <a href="/api/openapi.yaml" class="button">OpenAPI YAML</a>
    </div>
    
    <div class="card">
      <h2>🚀 Quick Start</h2>
      <p>Get started with the API in minutes:</p>
      <pre><code># 1. Get your API token
curl -X POST https://api.valuecanvas.com/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "your@email.com", "password": "your-password"}'

# 2. Generate a canvas
curl -X POST https://api.valuecanvas.com/api/canvas/generate \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "businessDescription": "A SaaS platform for project management",
    "industry": "Technology",
    "targetMarket": "SMBs"
  }'</code></pre>
    </div>
    
    <div class="card">
      <h2>🔑 Authentication</h2>
      <p>All API endpoints require Bearer token authentication:</p>
      <pre><code>Authorization: Bearer YOUR_TOKEN</code></pre>
    </div>
    
    <div class="card">
      <h2>⚡ Rate Limits</h2>
      <ul>
        <li><strong>Free:</strong> 10 requests/day</li>
        <li><strong>Basic:</strong> 50 requests/day</li>
        <li><strong>Pro:</strong> 500 requests/day</li>
        <li><strong>Enterprise:</strong> 5000 requests/day</li>
      </ul>
    </div>
    
    <div class="card">
      <h2>📊 Status</h2>
      <p>Check API status: <a href="/health/ready">Health Check</a></p>
      <p>View metrics: <a href="/metrics">Metrics</a></p>
    </div>
    
    <div class="card">
      <h2>💬 Support</h2>
      <p>Need help? Contact us:</p>
      <ul>
        <li>Email: <a href="mailto:api@valuecanvas.com">api@valuecanvas.com</a></li>
        <li>Docs: <a href="https://docs.valuecanvas.com">docs.valuecanvas.com</a></li>
        <li>Status: <a href="https://status.valuecanvas.com">status.valuecanvas.com</a></li>
      </ul>
    </div>
  </body>
</html>
  `);
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
  res.json({
    message: `SDK generation for ${language}`,
    instructions: `Use OpenAPI Generator to generate ${language} SDK`,
    command: `openapi-generator-cli generate -i /api/openapi.json -g ${language} -o ./sdk/${language}`
  });
});

export default router;

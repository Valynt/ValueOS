export const DOCS_BRANDING = {
  productName: 'ValueOS',
  apiTitle: 'ValueOS API',
  marketingSiteUrl: 'https://valueos.com',
  appUrl: 'https://app.valueos.com',
  apiBaseUrl: 'https://api.valueos.com',
  docsUrl: 'https://docs.valueos.com',
  statusUrl: 'https://status.valueos.com',
  supportEmail: 'support@valueos.com',
  docsEmail: 'docs@valueos.com',
} as const;

export const API_EXAMPLES = {
  loginEndpoint: '/api/auth/login',
  createCaseEndpoint: '/api/v1/cases',
  healthEndpoint: '/health',
  metricsEndpoint: '/metrics',
} as const;

export function renderReDocPage(): string {
  return `
<!DOCTYPE html>
<html>
  <head>
    <title>${DOCS_BRANDING.apiTitle}</title>
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
  `;
}

export function renderDocsLandingPage(): string {
  return `
<!DOCTYPE html>
<html>
  <head>
    <title>${DOCS_BRANDING.apiTitle}</title>
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
        color: #1f2937;
        border-bottom: 2px solid #2563eb;
        padding-bottom: 10px;
      }
      .card {
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
        background: #f9fafb;
      }
      .card h2 {
        margin-top: 0;
        color: #2563eb;
      }
      a {
        color: #2563eb;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      .button {
        display: inline-block;
        padding: 10px 20px;
        background: #2563eb;
        color: white;
        border-radius: 4px;
        margin: 10px 10px 10px 0;
      }
      .button:hover {
        background: #1d4ed8;
        text-decoration: none;
      }
      code {
        background: #f3f4f6;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
      }
      pre {
        background: #f3f4f6;
        padding: 15px;
        border-radius: 4px;
        overflow-x: auto;
      }
    </style>
  </head>
  <body>
    <h1>${DOCS_BRANDING.apiTitle}</h1>

    <p>
      Welcome to the ${DOCS_BRANDING.productName} API documentation. The API powers the
      ${DOCS_BRANDING.productName} value engineering platform for authenticated product,
      sales, and customer success workflows.
    </p>

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
      <pre><code># 1. Sign in and retrieve a bearer token
curl -X POST ${DOCS_BRANDING.apiBaseUrl}${API_EXAMPLES.loginEndpoint} \\
  -H "Content-Type: application/json" \\
  -d '{"email": "you@company.com", "password": "your-password"}'

# 2. Create a value case
curl -X POST ${DOCS_BRANDING.apiBaseUrl}${API_EXAMPLES.createCaseEndpoint} \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Cloud cost optimization",
    "description": "Model ROI and rollout checkpoints for a FinOps initiative",
    "industry": "SaaS",
    "companySize": "1000-5000"
  }'</code></pre>
    </div>

    <div class="card">
      <h2>🔑 Authentication</h2>
      <p>All protected API endpoints require Bearer token authentication:</p>
      <pre><code>Authorization: Bearer YOUR_TOKEN</code></pre>
      <p>
        Start from the ${DOCS_BRANDING.productName} application at
        <a href="${DOCS_BRANDING.appUrl}">${DOCS_BRANDING.appUrl}</a>.
      </p>
    </div>

    <div class="card">
      <h2>⚡ Platform Links</h2>
      <ul>
        <li><strong>Marketing site:</strong> <a href="${DOCS_BRANDING.marketingSiteUrl}">${DOCS_BRANDING.marketingSiteUrl}</a></li>
        <li><strong>Application:</strong> <a href="${DOCS_BRANDING.appUrl}">${DOCS_BRANDING.appUrl}</a></li>
        <li><strong>API:</strong> <a href="${DOCS_BRANDING.apiBaseUrl}">${DOCS_BRANDING.apiBaseUrl}</a></li>
      </ul>
    </div>

    <div class="card">
      <h2>📊 Status</h2>
      <p>Check API status: <a href="${API_EXAMPLES.healthEndpoint}">${API_EXAMPLES.healthEndpoint}</a></p>
      <p>View metrics: <a href="${API_EXAMPLES.metricsEndpoint}">${API_EXAMPLES.metricsEndpoint}</a></p>
      <p>Public status page: <a href="${DOCS_BRANDING.statusUrl}">${DOCS_BRANDING.statusUrl}</a></p>
    </div>

    <div class="card">
      <h2>💬 Support</h2>
      <p>Need help? Contact us:</p>
      <ul>
        <li>Email: <a href="mailto:${DOCS_BRANDING.supportEmail}">${DOCS_BRANDING.supportEmail}</a></li>
        <li>Documentation: <a href="${DOCS_BRANDING.docsUrl}">${DOCS_BRANDING.docsUrl}</a></li>
        <li>Docs team: <a href="mailto:${DOCS_BRANDING.docsEmail}">${DOCS_BRANDING.docsEmail}</a></li>
      </ul>
    </div>
  </body>
</html>
  `;
}

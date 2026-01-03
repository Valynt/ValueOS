# Documentation API Integration

The documentation API is integrated into the ValueOS Express backend server, which runs separately from the Vite frontend.

## 🏗️ Architecture

ValueOS uses a dual-server architecture:

- **Frontend**: Vite dev server (`npm run dev`) - runs on port 5173
- **Backend**: Express API server (`npm run backend:dev`) - runs on port 3000

The documentation API is part of the backend server.

## 🚀 Quick Start

### Start Both Servers

```bash
# Terminal 1: Start the backend server
npm run backend:dev

# Terminal 2: Start the frontend (optional, for UI)
npm run dev
```

The documentation API will be available at: `http://localhost:3000/api/docs`

### Or Start Backend Only

If you only need the API (for CI/CD, scripts, etc.):

```bash
npm run backend:dev
```

## 📡 Available Endpoints

### List All Documentation Sections
```bash
GET /api/docs/sections

# With filters
GET /api/docs/sections?category=user-guide
GET /api/docs/sections?search=sso
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user-guide-sso",
      "title": "SSO Setup",
      "path": "/docs/portal/user-guide/sso-setup.md",
      "category": "user-guide",
      "version": "1.0.0",
      "lastUpdated": "2024-03-01T12:00:00Z",
      "mappings": [
        {
          "type": "directory",
          "path": "/src/services/auth/sso",
          "description": "SSO implementation"
        }
      ]
    }
  ],
  "meta": {
    "total": 12,
    "timestamp": "2024-03-01T12:00:00Z"
  }
}
```

### Get Specific Section
```bash
GET /api/docs/sections/:id

# Example
GET /api/docs/sections/user-guide-sso
```

### Get Code Mappings
```bash
GET /api/docs/mappings

# With filters
GET /api/docs/mappings?path=src/services
GET /api/docs/mappings?changesOnly=true
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "filePath": "/src/services/auth/sso",
      "docSections": ["user-guide-sso"],
      "lastSync": "2024-03-01T12:00:00Z",
      "changeDetected": false
    }
  ]
}
```

### Get Documentation for Specific File
```bash
GET /api/docs/mappings/src/services/auth/sso

# Returns all documentation sections that reference this path
```

### Detect Changes
```bash
POST /api/docs/detect-changes
Content-Type: application/json

{
  "files": [
    "/src/services/auth/sso/okta.ts",
    "/src/services/billing/stripe.ts"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "changedFiles": 2,
    "affectedMappings": 2,
    "affectedSections": 2,
    "sections": [
      {
        "id": "user-guide-sso",
        "title": "SSO Setup",
        "path": "/docs/portal/user-guide/sso-setup.md"
      },
      {
        "id": "user-guide-billing",
        "title": "Billing & Subscription",
        "path": "/docs/portal/user-guide/billing.md"
      }
    ]
  }
}
```

### Mark as Synced
```bash
POST /api/docs/sync
Content-Type: application/json

{
  "sectionId": "user-guide-sso"
}

# Or sync by file path
{
  "filePath": "/src/services/auth/sso"
}
```

### Health Check
```bash
GET /api/docs/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "sections": 12,
    "mappings": 30,
    "outdated": 0,
    "coverage": "100%"
  }
}
```

## 🔧 Integration with CI/CD

### GitHub Actions Example

Create `.github/workflows/docs-check.yml`:

```yaml
name: Documentation Check

on:
  pull_request:
    paths:
      - 'src/**'
      - 'docs/**'

jobs:
  check-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start backend server (background)
        run: npm run backend:dev &
        env:
          NODE_ENV: test
        
      - name: Wait for server to be ready
        run: |
          timeout 30 bash -c 'until curl -f http://localhost:3000/api/docs/health; do sleep 1; done'
      
      - name: Detect documentation changes
        run: |
          FILES=$(git diff --name-only origin/main...HEAD | grep '^src/' | jq -R -s -c 'split("\n")[:-1]')
          curl -X POST http://localhost:3000/api/docs/detect-changes \
            -H "Content-Type: application/json" \
            -d "{\"files\": $FILES}" \
            -o response.json
          
          cat response.json
          
          # Check if any docs are affected
          AFFECTED=$(jq '.data.affectedSections' response.json)
          if [ "$AFFECTED" -gt 0 ]; then
            echo "⚠️ Code changes affect $AFFECTED documentation sections"
            jq '.data.sections' response.json
            exit 1
          fi
```

### Pre-commit Hook

Create `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Get changed files
CHANGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '^src/')

if [ -n "$CHANGED_FILES" ]; then
  echo "Checking documentation coverage..."
  
  # Start server if not running
  if ! curl -s http://localhost:3000/api/docs/health > /dev/null; then
    echo "Backend server not running. Start with: npm run backend:dev"
    exit 1
  fi
  
  # Check for affected docs
  FILES_JSON=$(echo "$CHANGED_FILES" | jq -R -s -c 'split("\n")[:-1]')
  RESPONSE=$(curl -s -X POST http://localhost:3000/api/docs/detect-changes \
    -H "Content-Type: application/json" \
    -d "{\"files\": $FILES_JSON}")
  
  AFFECTED=$(echo "$RESPONSE" | jq '.data.affectedSections')
  
  if [ "$AFFECTED" -gt 0 ]; then
    echo "⚠️  Warning: Your changes affect $AFFECTED documentation sections:"
    echo "$RESPONSE" | jq -r '.data.sections[].title'
    echo ""
    echo "Consider updating the documentation before committing."
    echo "Continue anyway? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
      exit 1
    fi
  fi
fi
```

## 🤖 Agent Integration

### Automated Documentation Updates

The API is designed to work with AI agents for automated documentation updates:

```typescript
import { ValueOS } from '@valueos/sdk';

// Initialize client
const client = new ValueOS({
  apiKey: process.env.VALUEOS_API_KEY!
});

// Detect changes
const changes = await fetch('http://localhost:3000/api/docs/detect-changes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    files: ['/src/services/auth/sso/okta.ts']
  })
});

const result = await changes.json();

if (result.data.affectedSections > 0) {
  // Agent can now:
  // 1. Read the affected documentation sections
  // 2. Analyze the code changes
  // 3. Generate updated documentation
  // 4. Create a PR with the updates
  
  for (const section of result.data.sections) {
    console.log(`Update needed: ${section.title}`);
    console.log(`Path: ${section.path}`);
  }
}
```

## 📊 Monitoring

### Health Monitoring

Add to your monitoring system:

```typescript
// Check documentation health
const health = await fetch('http://localhost:3000/api/docs/health');
const status = await health.json();

if (status.data.outdated > 0) {
  // Alert: Documentation is outdated
  console.warn(`${status.data.outdated} documentation sections need updates`);
}

if (parseFloat(status.data.coverage) < 90) {
  // Alert: Documentation coverage is low
  console.warn(`Documentation coverage: ${status.data.coverage}`);
}
```

### Metrics

The API automatically tracks:
- Number of documentation sections
- Number of code mappings
- Outdated documentation count
- Coverage percentage
- Last sync timestamps

## 🔒 Security

### Authentication

Add authentication middleware if needed:

```typescript
// In src/backend/server.ts
import { authMiddleware } from '../middleware/auth';

app.use('/api/docs', authMiddleware, docsApiRouter);
```

### Rate Limiting

The API inherits rate limiting from the main server configuration.

## 🧪 Testing

### Test the API

```bash
# Health check
curl http://localhost:3000/api/docs/health

# List sections
curl http://localhost:3000/api/docs/sections

# Get specific section
curl http://localhost:3000/api/docs/sections/user-guide-sso

# Detect changes
curl -X POST http://localhost:3000/api/docs/detect-changes \
  -H "Content-Type: application/json" \
  -d '{"files": ["/src/services/auth/sso"]}'
```

## 📝 Configuration

The API uses configuration from `/docs/portal/.docsconfig.json`:

```json
{
  "automation": {
    "enabled": true,
    "triggers": {
      "onCommit": true,
      "onPullRequest": true,
      "onRelease": true
    }
  },
  "notifications": {
    "slack": {
      "enabled": false,
      "channel": "#documentation"
    }
  }
}
```

## 🔗 Related Documentation

- [Documentation Summary](./DOCUMENTATION_SUMMARY.md) - Complete overview
- [Style Guide](./style-guide.md) - Writing guidelines
- [Getting Started](./GETTING_STARTED_WITH_DOCS.md) - Navigation guide

---

**Questions?** The API is ready to use with the existing backend server. Just start the server and the endpoints will be available at `/api/docs`.

---
name: openapi-validate
description: Validates and fixes OpenAPI specs using recommended tools and parsers
---

# OpenAPI Validate

This skill provides comprehensive validation and fixing procedures for OpenAPI specifications using industry-standard tools and parsers.

## When to Run

Run this skill when:
- Creating or updating OpenAPI specifications
- Before deploying API changes
- During CI/CD pipeline validation
- Generating API documentation
- Fixing API specification issues
- Preparing for API client generation

## OpenAPI Specification Standards

### Supported Versions
- **OpenAPI 3.0.x**: Legacy support
- **OpenAPI 3.1.x**: Current standard (recommended)
- **JSON/YAML**: Both formats supported

### Required Fields
```yaml
openapi: 3.1.0
info:
  title: ValueOS API
  version: 1.0.0
  description: ValueOS platform API
  contact:
    name: Platform Team
    email: platform@valueos.com
servers:
  - url: https://api.valueos.com/v1
    description: Production server
paths: {}
components:
  schemas: {}
  securitySchemes: {}
```

## Validation Tools

### Spectral (Primary Validator)
```bash
# Install Spectral
npm install -g @stoplight/spectral-cli

# Basic validation
spectral lint openapi.yaml

# Validate with custom rules
spectral lint openapi.yaml --ruleset .spectral.yml

# Validate specific rules
spectral lint openapi.yaml --ruleset https://www.googleapis.com/drive/v3/openapi.yaml
```

#### Spectral Ruleset (`.spectral.yml`)
```yaml
extends:
  - spectral:oas
  - spectral:asyncapi

rules:
  # Custom ValueOS rules
  info-contact:
    description: Info object must have contact information
    given: $.info
    then:
      field: contact
      function: truthy

  operation-summary:
    description: Operations must have a summary
    given: $.paths[*][*]
    then:
      field: summary
      function: truthy

  schema-description:
    description: Schemas must have descriptions
    given: $.components.schemas[*]
    then:
      field: description
      function: truthy
```

### OpenAPI CLI Tools
```bash
# Install OpenAPI CLI
npm install -g openapi-cli-tooling

# Validate specification
openapi validate openapi.yaml

# Bundle multiple files
openapi bundle openapi-parts/ --output openapi.yaml

# Generate TypeScript types
openapi generate-types typescript openapi.yaml > types.ts
```

### Swagger/OpenAPI Validator
```bash
# Online validation (swagger.io)
curl -X POST \
  https://validator.swagger.io/validator/debug \
  -H 'Content-Type: application/yaml' \
  -d @openapi.yaml

# Docker validation
docker run --rm -v $(pwd):/tmp \
  openapitools/openapi-generator-cli validate \
  -i /tmp/openapi.yaml
```

## Fixing Common Issues

### Structural Issues

#### Missing Required Fields
```yaml
# Problem
paths:
  /users:
    get: {}  # Missing operationId, summary, responses

# Fixed
paths:
  /users:
    get:
      operationId: getUsers
      summary: Retrieve users
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'
```

#### Invalid References
```yaml
# Problem
responses:
  '200':
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/InvalidSchema'

# Fixed - Ensure schema exists
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
```

### Schema Issues

#### Type Mismatches
```yaml
# Problem - Missing type for object
components:
  schemas:
    User:
      properties:
        id: integer  # Should be {type: integer}

# Fixed
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
```

#### Required Fields
```yaml
# Problem - Required fields not specified
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
        email:
          type: string

# Fixed - Specify required fields
components:
  schemas:
    User:
      type: object
      required:
        - id
        - email
      properties:
        id:
          type: integer
        name:
          type: string
        email:
          type: string
```

### Security Issues

#### Missing Authentication
```yaml
# Problem - Public endpoint without security
paths:
  /admin/users:
    get:
      summary: Admin get users
      # Missing security definition

# Fixed - Add security requirements
paths:
  /admin/users:
    get:
      summary: Admin get users
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Success
```

#### Insecure Parameter Handling
```yaml
# Problem - NoSQL injection risk
parameters:
  - name: query
    in: query
    schema:
      type: string  # No validation

# Fixed - Add validation
parameters:
  - name: query
    in: query
    schema:
      type: string
      pattern: '^[a-zA-Z0-9_-]+$'
      maxLength: 100
```

## Automated Fixing Scripts

### Validation Script (`scripts/validate-openapi.mjs`)
```javascript
#!/usr/bin/env node

import { readFileSync } from 'fs'
import { validate } from '@apidevtools/swagger-parser'

async function validateOpenAPI(filePath) {
  try {
    const spec = JSON.parse(readFileSync(filePath, 'utf8'))
    await validate(spec)
    console.log('✅ OpenAPI specification is valid')
    return true
  } catch (error) {
    console.error('❌ Validation failed:', error.message)
    return false
  }
}

// Usage
const filePath = process.argv[2] || 'openapi.yaml'
validateOpenAPI(filePath)
```

### Auto-fix Script (`scripts/fix-openapi.mjs`)
```javascript
#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'
import yaml from 'js-yaml'

function fixOpenAPISpec(spec) {
  // Add missing operationIds
  Object.keys(spec.paths).forEach(path => {
    Object.keys(spec.paths[path]).forEach(method => {
      const operation = spec.paths[path][method]
      if (!operation.operationId) {
        const pathParts = path.split('/').filter(p => p && !p.startsWith('{'))
        const methodPrefix = method.toUpperCase()
        operation.operationId = methodPrefix + pathParts.map(p =>
          p.charAt(0).toUpperCase() + p.slice(1)
        ).join('')
      }
    })
  })

  // Ensure all schemas have descriptions
  if (spec.components?.schemas) {
    Object.keys(spec.components.schemas).forEach(schemaName => {
      const schema = spec.components.schemas[schemaName]
      if (!schema.description) {
        schema.description = `Schema for ${schemaName}`
      }
    })
  }

  return spec
}

// Usage
const inputFile = process.argv[2] || 'openapi.yaml'
const outputFile = process.argv[3] || inputFile

const spec = yaml.load(readFileSync(inputFile, 'utf8'))
const fixedSpec = fixOpenAPISpec(spec)
writeFileSync(outputFile, yaml.dump(fixedSpec, { indent: 2 }))
console.log(`Fixed OpenAPI spec saved to ${outputFile}`)
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: OpenAPI Validation
on:
  push:
    paths:
      - 'openapi.yaml'
      - 'docs/api/**'
  pull_request:
    paths:
      - 'openapi.yaml'
      - 'docs/api/**'

jobs:
  validate-openapi:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18.17.0'

      - name: Install dependencies
        run: npm install -g @stoplight/spectral-cli openapi-cli-tooling

      - name: Validate OpenAPI spec
        run: spectral lint openapi.yaml

      - name: Generate API documentation
        run: openapi generate-docs markdown openapi.yaml > docs/api/README.md

      - name: Generate TypeScript types
        run: openapi generate-types typescript openapi.yaml > packages/shared/src/types/api.ts
```

### Pre-commit Hooks
```bash
# .husky/pre-commit
#!/bin/sh

# Validate OpenAPI spec
if [ -f "openapi.yaml" ]; then
  spectral lint openapi.yaml
  if [ $? -ne 0 ]; then
    echo "OpenAPI validation failed"
    exit 1
  fi
fi
```

## Testing OpenAPI Specs

### Contract Testing
```bash
# Install Dredd for API contract testing
npm install -g dredd

# Run contract tests against live API
dredd openapi.yaml https://api.valueos.com/v1 --hookfiles=./test/hooks.js
```

### Mock Server Generation
```bash
# Generate mock server
npm install -g prism
prism mock openapi.yaml --host 0.0.0.0 --port 4010

# Test against mock server
curl http://localhost:4010/users
```

## Best Practices

### Documentation Standards
- **Clear Descriptions**: Every operation and schema must have a description
- **Example Values**: Provide examples for complex schemas
- **Consistent Naming**: Use camelCase for property names, PascalCase for schema names
- **Versioning**: Include API version in paths and info object

### Security Standards
- **Authentication**: Define security schemes clearly
- **Authorization**: Specify required scopes for operations
- **Input Validation**: Use schema validation extensively
- **Rate Limiting**: Document rate limits in operation descriptions

### Maintainability
- **Modular Design**: Split large specs into multiple files and bundle them
- **Reusable Components**: Define common schemas in components section
- **Consistent Structure**: Follow RESTful conventions
- **Deprecation Notices**: Mark deprecated operations clearly

## Troubleshooting

### Common Validation Errors

#### Reference Resolution Issues
```bash
# Check for broken $ref links
spectral lint openapi.yaml --ruleset spectral:oas --verbose

# Use online validator for complex references
curl -X POST https://validator.swagger.io/validator/debug -d @openapi.yaml
```

#### Schema Validation Issues
```bash
# Validate specific schema
openapi validate-schema openapi.yaml --schema '#/components/schemas/User'

# Check for type inconsistencies
spectral lint openapi.yaml --rules 'oas3-schema,oas3-valid-schema-example'
```

#### Tool Compatibility Issues
```bash
# Test with multiple validators
spectral lint openapi.yaml
swagger-cli validate openapi.yaml
openapi validate openapi.yaml
```

## Integration with Development Workflow

### IDE Support
- **VS Code Extensions**: OpenAPI (Swagger) Editor, OpenAPI Preview
- **Language Server**: OpenAPI Language Server for autocomplete
- **Live Validation**: Real-time validation as you type

### Team Collaboration
- **Review Process**: Include OpenAPI changes in code reviews
- **Version Control**: Treat OpenAPI specs as code with proper versioning
- **Documentation**: Generate API docs from specs automatically
- **Client Generation**: Auto-generate API clients for multiple languages

This comprehensive validation and fixing approach ensures your OpenAPI specifications are accurate, secure, and maintainable.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';
import yaml from 'js-yaml';

const SPEC_PATH = resolve('openapi.yaml');

const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];

function hasExample(media) {
  if (!media) return false;
  if (media.example) return true;
  if (media.examples && Object.keys(media.examples).length > 0) return true;
  if (media.schema && media.schema.example) return true;
  return false;
}

function collectOperations(spec) {
  const operations = [];
  const paths = spec.paths || {};

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!httpMethods.includes(method)) continue;
      operations.push({ method, pathKey, operation });
    }
  }

  return operations;
}

async function main() {
  const specRaw = readFileSync(SPEC_PATH, 'utf8');
  const spec = yaml.load(specRaw);

  await SwaggerParser.validate(spec);

  const errors = [];
  const operations = collectOperations(spec);

  for (const { method, pathKey, operation } of operations) {
    const operationLabel = `${method.toUpperCase()} ${pathKey}`;
    if (!operation.description || !operation.description.trim()) {
      errors.push(`Missing description for ${operationLabel}`);
    }

    const requestContents = operation.requestBody?.content || {};
    for (const [contentType, media] of Object.entries(requestContents)) {
      if (!hasExample(media)) {
        errors.push(`Request body for ${operationLabel} (${contentType}) requires an example`);
      }
    }

    const responses = operation.responses || {};
    for (const [statusCode, response] of Object.entries(responses)) {
      const responseContents = response?.content || {};
      for (const [contentType, media] of Object.entries(responseContents)) {
        if (!hasExample(media)) {
          errors.push(
            `Response ${statusCode} for ${operationLabel} (${contentType}) requires an example`
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error('\nOpenAPI validation failed:');
    for (const error of errors) {
      console.error(` - ${error}`);
    }
    process.exit(1);
  }

  console.log('OpenAPI schema validation passed with complete descriptions and examples.');
}

main().catch((error) => {
  console.error('OpenAPI validation encountered an unexpected error:', error);
  process.exit(1);
});

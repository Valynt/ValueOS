import SwaggerParser from '@apidevtools/swagger-parser';
import { resolve } from 'node:path';

const SPEC_PATH = resolve(process.cwd(), 'packages/backend/openapi.yaml');

async function main() {
  await SwaggerParser.validate(SPEC_PATH);
  console.log(`OpenAPI structural validation passed for ${SPEC_PATH}.`);
}

main().catch((error) => {
  console.error('OpenAPI structural validation failed:', error?.message ?? error);
  process.exit(1);
});

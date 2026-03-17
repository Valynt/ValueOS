import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SPEC_PATH = resolve(process.cwd(), 'packages/backend/openapi.yaml');

function countTopLevelOpenapiRoots(source) {
  return source
    .split(/\r?\n/)
    .filter((line) => /^openapi:\s+/.test(line))
    .length;
}

function main() {
  const raw = readFileSync(SPEC_PATH, 'utf8');
  const rootCount = countTopLevelOpenapiRoots(raw);

  if (rootCount !== 1) {
    console.error(
      `OpenAPI spec root invalid in ${SPEC_PATH}: expected exactly 1 top-level "openapi:" entry, found ${rootCount}.`
    );
    process.exit(1);
  }

  console.log(`OpenAPI single-root check passed (${rootCount} root found).`);
}

main();

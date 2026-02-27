import { build } from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../..');
const p = (rel) => resolve(rootDir, rel);

// Path aliases matching tsconfig.app.json paths
const alias = {
  '@shared':              p('packages/shared/src'),
  '@valueos/shared':      p('packages/shared/src'),
  '@valueos/infra':       p('packages/infra'),
  '@valueos/memory':      p('packages/memory'),
  '@valueos/sdui':        p('packages/sdui/src'),
  '@valueos/sdui-types':  p('packages/sdui-types'),
  '@valueos/integrations':p('packages/integrations'),
  '@valueos/mcp':         p('packages/mcp'),
  '@valueos/agents':      p('packages/agents'),
  '@valueos/components':  p('packages/components'),
  '@backend':             p('packages/backend/src'),
  '@infra':               p('packages/infra'),
  '@memory':              p('packages/memory'),
  '@agents':              p('packages/agents'),
  '@integrations':        p('packages/integrations'),
  '@mcp':                 p('packages/mcp'),
  '@mcp-common':          p('packages/mcp/common'),
  '@sdui':                p('packages/sdui/src'),
  '@lib':                 p('packages/backend/src/lib'),
};

await build({
  entryPoints: [resolve(__dirname, 'src/server.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outdir: resolve(__dirname, 'dist'),
  outExtension: { '.js': '.js' },
  sourcemap: true,
  minify: false,
  keepNames: true,
  // Mark node_modules as external — don't bundle dependencies
  packages: 'external',
  alias,
  banner: {
    // ESM compat shim for __dirname / __filename / require
    js: [
      'import { createRequire as __createRequire } from "module";',
      'import { fileURLToPath as __fileURLToPath } from "url";',
      'import { dirname as __dirnameFn } from "path";',
      'const require = __createRequire(import.meta.url);',
      'const __filename = __fileURLToPath(import.meta.url);',
      'const __dirname = __dirnameFn(__filename);',
    ].join('\n'),
  },
  logLevel: 'info',
});

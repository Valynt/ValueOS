export const workspaceVitestProjects = [
  {
    id: 'apps-valynt-app',
    dir: 'apps/ValyntApp',
    label: 'valynt-app',
    coverageDir: 'coverage/apps-ValyntApp',
  },
  {
    id: 'apps-mcp-dashboard',
    dir: 'apps/mcp-dashboard',
    label: 'mcp-dashboard',
    coverageDir: 'coverage/apps-mcp-dashboard',
  },
  {
    id: 'packages-backend',
    dir: 'packages/backend',
    label: '@valueos/backend',
    coverageDir: 'coverage/packages-backend',
  },
  {
    id: 'packages-components',
    dir: 'packages/components',
    label: '@valueos/components',
    coverageDir: 'coverage/packages-components',
  },
  {
    id: 'packages-infra',
    dir: 'packages/infra',
    label: '@valueos/infra',
    coverageDir: 'coverage/packages-infra',
  },
  {
    id: 'packages-integrations',
    dir: 'packages/integrations',
    label: '@valueos/integrations',
    coverageDir: 'coverage/packages-integrations',
  },
  {
    id: 'packages-mcp',
    dir: 'packages/mcp',
    label: '@valueos/mcp',
    coverageDir: 'coverage/packages-mcp',
  },
  {
    id: 'packages-memory',
    dir: 'packages/memory',
    label: '@valueos/memory',
    coverageDir: 'coverage/packages-memory',
  },
  {
    id: 'packages-sdui',
    dir: 'packages/sdui',
    label: '@valueos/sdui',
    coverageDir: 'coverage/packages-sdui',
  },
  {
    id: 'packages-services-domain-validator',
    dir: 'packages/services/domain-validator',
    label: '@valuecanvas/domain-validator',
    coverageDir: 'coverage/packages-services-domain-validator',
  },
  {
    id: 'packages-services-github-code-optimizer',
    dir: 'packages/services/github-code-optimizer',
    label: 'github-code-optimizer',
    coverageDir: 'coverage/packages-services-github-code-optimizer',
  },
  {
    id: 'packages-shared',
    dir: 'packages/shared',
    label: '@valueos/shared',
    coverageDir: 'coverage/packages-shared',
  },
];

export const rootVitestProjects = workspaceVitestProjects.map((project) => project.dir);

export const packageTopologyNotes = [
  {
    dir: 'apps/mcp-dashboard',
    role: 'production deliverable',
    testing: 'Owns a package-local Vitest config and is included in the root workspace because it contains React route/security tests.',
  },
  {
    dir: 'packages/config-v2',
    role: 'internal library',
    testing: 'Configuration-only workspace package; intentionally testless until it exposes runtime code beyond shared ESLint/Prettier/TS config assets.',
  },
  {
    dir: 'packages/mcp',
    role: 'production deliverable',
    testing: 'The workspace package owns the MCP server test suite and now includes crm, ground-truth, and memory-write coverage through its package-local Vitest config.',
  },
  {
    dir: 'packages/mcp/common',
    role: 'internal library',
    testing: 'Common primitives are exercised transitively by the packages/mcp test suite; there is no standalone test package today.',
  },
  {
    dir: 'packages/mcp/crm',
    role: 'production deliverable',
    testing: 'Tested through the packages/mcp workspace project because crm is shipped as part of the MCP deliverable.',
  },
  {
    dir: 'packages/mcp/ground-truth',
    role: 'production deliverable',
    testing: 'Tested through the packages/mcp workspace project because ground-truth is shipped as part of the MCP deliverable.',
  },
  {
    dir: 'packages/mcp/ground-truth/examples',
    role: 'example',
    testing: 'Examples stay outside the root Vitest workspace and document usage rather than shipping runtime guarantees.',
  },
];

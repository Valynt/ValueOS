import path from 'path';

export function createBackendResolveAliases(root: string) {
  return [
    // Workspace package aliases — keep in sync with tsconfig.app.json paths.
    { find: '@shared', replacement: path.resolve(root, 'packages/shared/src') },
    { find: '@valueos/shared', replacement: path.resolve(root, 'packages/shared/src') },
    { find: '@valueos/sdui', replacement: path.resolve(root, 'packages/sdui/src') },
    { find: /^@sdui\/(.+)$/, replacement: path.resolve(root, 'packages/sdui/src/$1') },
    { find: '@backend', replacement: path.resolve(root, 'packages/backend/src') },
    { find: '@mcp', replacement: path.resolve(root, 'packages/mcp') },
    { find: '@valueos/integrations', replacement: path.resolve(root, 'packages/integrations/index.ts') },
    // @valueos/memory sub-path exports: @valueos/memory/<sub> → packages/memory/<sub>/index.ts
    // Must be listed before the bare @valueos/memory entry so the more-specific
    // pattern matches first.
    {
      find: /^@valueos\/memory\/(.+)$/,
      replacement: path.resolve(root, 'packages/memory/$1/index.ts'),
    },
    { find: '@valueos/memory', replacement: path.resolve(root, 'packages/memory/index.ts') },
  ];
}

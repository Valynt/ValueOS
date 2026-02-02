/**
 * Strict Zones Configuration
 *
 * These paths MUST remain at 0 TypeScript errors.
 * CI will block if any error is found in these directories.
 *
 * To add a zone:
 * 1. Ensure `pnpm run typecheck` passes for that specific package/folder
 * 2. Add the path relative to workspace root here.
 */
export default {
  zones: [
    // Future Green Islands:
    // "packages/sdui-types",
    // "packages/agent-fabric"
  ],
};

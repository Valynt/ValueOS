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
      "packages/services/domain-validator",
    "packages/services/github-code-optimizer",
    "packages/integrations",
    "packages/config-v2",
    "packages/components/design-system",
    "packages/agents/integrity",
    "packages/agents/value-eval",
    "packages/agents/narrative",
    "packages/agents/groundtruth",
    "packages/agents/intervention-designer",
    "packages/agents/financial-modeling",
    "packages/agents/benchmark",
    "packages/agents/communicator",
    "packages/agents/base",
    "packages/agents",
    "packages/agents/expansion",
    "packages/agents/opportunity",
    "packages/agents/outcome-engineer",
    "packages/agents/system-mapper",
    "packages/agents/realization",
    "packages/agents/coordinator",
    "packages/agents/research",
    "packages/agents/company-intelligence",
    "packages/agents/target",
    "packages/agents/value-mapping",
    "packages/memory",
    "apps/VOSAcademy/packages/shared",
],
};

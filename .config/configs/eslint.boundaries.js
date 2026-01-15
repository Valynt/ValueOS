/**
 * ESLint Boundary Rules for ValueOS Monorepo
 *
 * Enforces the dependency graph:
 *
 *   apps
 *     ↓
 *   backend
 *     ↓
 *   agents → memory → infra
 *     ↓
 *   integrations
 *     ↓
 *   shared / mcp / sdui-types
 *
 * NEVER invert. NEVER shortcut.
 */

/** @type {import('eslint').Linter.Config} */
module.exports = {
  plugins: ["import"],
  rules: {
    "import/no-restricted-paths": [
      "error",
      {
        zones: [
          // ═══════════════════════════════════════════════════════════════════
          // FRONTEND (apps/ValyntApp) RESTRICTIONS
          // Frontend can NEVER import infrastructure, agents, memory, or backend
          // ═══════════════════════════════════════════════════════════════════
          {
            target: "./ValyntApp/**/*",
            from: "./packages/infra/**/*",
            message: "Frontend cannot import infrastructure. Use API calls instead.",
          },
          {
            target: "./ValyntApp/**/*",
            from: "./packages/agents/**/*",
            message: "Frontend cannot import agents. Agents run server-side only.",
          },
          {
            target: "./ValyntApp/**/*",
            from: "./packages/memory/**/*",
            message: "Frontend cannot import memory layer. Memory is server-side only.",
          },
          {
            target: "./ValyntApp/**/*",
            from: "./packages/backend/**/*",
            message: "Frontend cannot import backend. Use HTTP API instead.",
          },
          {
            target: "./ValyntApp/**/*",
            from: "./packages/integrations/**/*",
            message: "Frontend cannot import integrations. Integrations run server-side.",
          },

          // ═══════════════════════════════════════════════════════════════════
          // BACKEND RESTRICTIONS
          // Backend should not import from apps
          // ═══════════════════════════════════════════════════════════════════
          {
            target: "./packages/backend/**/*",
            from: "./ValyntApp/**/*",
            message: "Backend cannot import from frontend apps.",
          },
          {
            target: "./packages/backend/**/*",
            from: "./apps/**/*",
            message: "Backend cannot import from frontend apps.",
          },

          // ═══════════════════════════════════════════════════════════════════
          // AGENTS RESTRICTIONS
          // Agents cannot import backend or apps
          // ═══════════════════════════════════════════════════════════════════
          {
            target: "./packages/agents/**/*",
            from: "./packages/backend/**/*",
            message: "Agents cannot import backend. Backend calls agents, not vice versa.",
          },
          {
            target: "./packages/agents/**/*",
            from: "./ValyntApp/**/*",
            message: "Agents cannot import frontend apps.",
          },

          // ═══════════════════════════════════════════════════════════════════
          // MEMORY RESTRICTIONS
          // Memory cannot import agents, backend, or apps
          // ═══════════════════════════════════════════════════════════════════
          {
            target: "./packages/memory/**/*",
            from: "./packages/agents/**/*",
            message: "Memory cannot import agents. Agents call memory, not vice versa.",
          },
          {
            target: "./packages/memory/**/*",
            from: "./packages/backend/**/*",
            message: "Memory cannot import backend.",
          },

          // ═══════════════════════════════════════════════════════════════════
          // INFRA RESTRICTIONS
          // Infra cannot import agents, memory, backend, or apps
          // ═══════════════════════════════════════════════════════════════════
          {
            target: "./packages/infra/**/*",
            from: "./packages/agents/**/*",
            message: "Infra cannot import agents.",
          },
          {
            target: "./packages/infra/**/*",
            from: "./packages/memory/**/*",
            message: "Infra cannot import memory.",
          },
          {
            target: "./packages/infra/**/*",
            from: "./packages/backend/**/*",
            message: "Infra cannot import backend.",
          },

          // ═══════════════════════════════════════════════════════════════════
          // INTEGRATIONS RESTRICTIONS
          // Integrations cannot import agents, memory, backend, or apps
          // ═══════════════════════════════════════════════════════════════════
          {
            target: "./packages/integrations/**/*",
            from: "./packages/agents/**/*",
            message: "Integrations cannot import agents.",
          },
          {
            target: "./packages/integrations/**/*",
            from: "./packages/memory/**/*",
            message: "Integrations cannot import memory.",
          },
          {
            target: "./packages/integrations/**/*",
            from: "./packages/backend/**/*",
            message: "Integrations cannot import backend.",
          },
          {
            target: "./packages/integrations/**/*",
            from: "./packages/infra/**/*",
            message: "Integrations cannot import infra directly.",
          },

          // ═══════════════════════════════════════════════════════════════════
          // SHARED/MCP/SDUI-TYPES RESTRICTIONS
          // These are leaf packages - cannot import anything above them
          // ═══════════════════════════════════════════════════════════════════
          {
            target: "./packages/shared/**/*",
            from: "./packages/backend/**/*",
            message: "Shared cannot import backend.",
          },
          {
            target: "./packages/shared/**/*",
            from: "./packages/agents/**/*",
            message: "Shared cannot import agents.",
          },
          {
            target: "./packages/shared/**/*",
            from: "./packages/memory/**/*",
            message: "Shared cannot import memory.",
          },
          {
            target: "./packages/shared/**/*",
            from: "./packages/infra/**/*",
            message: "Shared cannot import infra.",
          },
          {
            target: "./packages/shared/**/*",
            from: "./packages/integrations/**/*",
            message: "Shared cannot import integrations.",
          },

          // ═══════════════════════════════════════════════════════════════════
          // COMPONENTS RESTRICTIONS
          // UI components cannot import backend, agents, memory, infra
          // ═══════════════════════════════════════════════════════════════════
          {
            target: "./packages/components/**/*",
            from: "./packages/backend/**/*",
            message: "Components cannot import backend. Keep components pure.",
          },
          {
            target: "./packages/components/**/*",
            from: "./packages/agents/**/*",
            message: "Components cannot import agents.",
          },
          {
            target: "./packages/components/**/*",
            from: "./packages/memory/**/*",
            message: "Components cannot import memory.",
          },
          {
            target: "./packages/components/**/*",
            from: "./packages/infra/**/*",
            message: "Components cannot import infra.",
          },
          {
            target: "./packages/components/**/*",
            from: "./packages/integrations/**/*",
            message: "Components cannot import integrations.",
          },
        ],
      },
    ],
  },
};

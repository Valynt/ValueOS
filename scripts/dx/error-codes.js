/**
 * DX Error Codes with actionable diagnostics
 */

export const DX_ERRORS = {
  ERR_001: {
    code: "DX_ERR_001",
    message: "Missing observability module",
    cause: "Code imports from ../lib/observability but directory doesn't exist",
    fix: "Run: pnpm run dx:validate-imports to identify missing modules",
    docsUrl: "docs/DX_TROUBLESHOOTING.md#err-001",
  },
  ERR_002: {
    code: "DX_ERR_002",
    message: "Port conflict detected",
    cause: "Required port is already in use by another process",
    fix: "Run: lsof -ti:PORT | xargs kill -9 (replace PORT with actual port number)",
    docsUrl: "docs/DX_TROUBLESHOOTING.md#err-002",
  },
  ERR_003: {
    code: "DX_ERR_003",
    message: "Backend health check failed",
    cause: "Backend service is not responding or returning errors",
    fix: "Check logs: tail -f /tmp/dx-backend.log",
    docsUrl: "docs/DX_TROUBLESHOOTING.md#err-003",
  },
  ERR_004: {
    code: "DX_ERR_004",
    message: "Database connection refused",
    cause: "Postgres container is not reachable or not started",
    fix: "Run: docker ps | grep postgres && docker logs valueos-postgres",
    docsUrl: "docs/DX_TROUBLESHOOTING.md#err-004",
  },
  ERR_005: {
    code: "DX_ERR_005",
    message: "Supabase DB port binding failed",
    cause: "Supabase container failed to bind port 54322",
    fix: "Run: lsof -ti:54322 | xargs kill -9 && supabase start --workdir infra/supabase",
    docsUrl: "docs/DX_TROUBLESHOOTING.md#err-005",
  },
  ERR_006: {
    code: "DX_ERR_006",
    message: "Migration TLS error",
    cause: "DB client attempting TLS connection but postgres doesn't support it",
    fix: "Run: export PGSSLMODE=disable && pnpm run db:setup",
    docsUrl: "docs/DX_TROUBLESHOOTING.md#err-006",
  },
  ERR_007: {
    code: "DX_ERR_007",
    message: "Module not found",
    cause: "TypeScript import path cannot be resolved at runtime",
    fix: "Check file exists and casing matches exactly. Run: pnpm run dx:validate-imports",
    docsUrl: "docs/DX_TROUBLESHOOTING.md#err-007",
  },
  ERR_008: {
    code: "DX_ERR_008",
    message: "Docker daemon not available",
    cause: "Docker is not running or socket is not accessible",
    fix: "Start Docker Desktop or check Docker daemon status",
    docsUrl: "docs/DX_TROUBLESHOOTING.md#err-008",
  },
  ERR_009: {
    code: "DX_ERR_009",
    message: "Environment variable not set",
    cause: "Required environment variable is missing from .env.local",
    fix: "Run: pnpm run dx:env to regenerate environment files",
    docsUrl: "docs/DX_TROUBLESHOOTING.md#err-009",
  },
  ERR_010: {
    code: "DX_ERR_010",
    message: "Supabase containers not running",
    cause: "Supabase start command failed or containers stopped unexpectedly",
    fix: "Run: supabase stop --workdir infra/supabase && supabase start --workdir infra/supabase --debug",
    docsUrl: "docs/DX_TROUBLESHOOTING.md#err-010",
  },
};

export function formatError(errorCode, context) {
  const error = DX_ERRORS[errorCode];
  if (!error) {
    return `Unknown error code: ${errorCode}`;
  }

  return `
❌ ${error.code}: ${error.message}

🔍 Cause: ${error.cause}

💡 Fix: ${error.fix}

${context ? `📋 Context: ${JSON.stringify(context, null, 2)}` : ""}

${error.docsUrl ? `📖 Docs: ${error.docsUrl}` : ""}
`.trim();
}

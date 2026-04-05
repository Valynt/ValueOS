export const MCP_INTEGRATION_EVENTS = {
  CONNECT_STARTED: "connect_started",
  CONNECT_SUCCEEDED: "connect_succeeded",
  CONNECT_FAILED: "connect_failed",
  WEBHOOK_REJECTED: "webhook_rejected",
  SYNC_DEGRADED: "sync_degraded",
  SYNC_RECOVERED: "sync_recovered",
  REAUTH_REQUIRED: "reauth_required",
} as const;

export type MCPIntegrationEvent =
  (typeof MCP_INTEGRATION_EVENTS)[keyof typeof MCP_INTEGRATION_EVENTS];

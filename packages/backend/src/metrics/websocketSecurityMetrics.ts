import { Counter } from "prom-client";

import { getMetricsRegistry } from "../middleware/metricsMiddleware.js";

type DroppedFrameLabelNames = "reason";
type ThrottledClientLabelNames = "tenant_id";

const registry = getMetricsRegistry();

const websocketDroppedFramesTotal = new Counter<DroppedFrameLabelNames>({
  name: "valueos_websocket_dropped_frames_total",
  help: "Total inbound websocket frames dropped due to policy checks",
  labelNames: ["reason"],
  registers: [registry],
});

const websocketThrottledClientsTotal = new Counter<ThrottledClientLabelNames>({
  name: "valueos_websocket_throttled_clients_total",
  help: "Total websocket clients closed due to websocket abuse throttling",
  labelNames: ["tenant_id"],
  registers: [registry],
});

export function recordDroppedFrame(reason: "rate_limit_exceeded" | "payload_too_large"): void {
  websocketDroppedFramesTotal.labels({ reason }).inc();
}

export function recordThrottledClient(tenantId: string): void {
  websocketThrottledClientsTotal.labels({ tenant_id: tenantId }).inc();
}

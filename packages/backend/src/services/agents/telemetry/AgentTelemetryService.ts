import { AgentType } from "../../agent-types.js";
import { logger } from "../../../lib/logger.js";

type TelemetrySeverity = "debug" | "info" | "warning" | "error";

type TelemetryEvent = {
  type: string;
  agentType: AgentType;
  sessionId?: string;
  userId?: string;
  data?: Record<string, unknown>;
  severity?: TelemetrySeverity;
};

class AgentTelemetryService {
  recordTelemetryEvent(event: TelemetryEvent): void {
    logger.debug("Agent telemetry event", {
      type: event.type,
      agentType: event.agentType,
      severity: event.severity,
      data: event.data,
    });
  }
}

export const agentTelemetryService = new AgentTelemetryService();

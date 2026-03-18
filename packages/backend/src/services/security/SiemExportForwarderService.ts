import dgram from "node:dgram";

import { createLogger } from "@shared/lib/logger";

import { getSiemRoutingConfig, type SiemRoutingConfig, type SiemSinkConfig } from "../../config/siem.js";

const logger = createLogger({ component: "SiemExportForwarderService" });

export type SiemSource = "audit_logs" | "security_audit_log";

export interface SiemExportEvent {
  id: string;
  source: SiemSource;
  tenantId?: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface SiemSinkAdapter {
  readonly name: string;
  send(event: SiemExportEvent): Promise<void>;
}

interface QueueEntry {
  sink: SiemSinkAdapter;
  event: SiemExportEvent;
  attempts: number;
}

interface DeadLetterEntry {
  sinkName: string;
  event: SiemExportEvent;
  attempts: number;
  error: string;
  failedAt: string;
}

export class WebhookSiemAdapter implements SiemSinkAdapter {
  public readonly name: string;

  constructor(private readonly config: SiemSinkConfig) {
    this.name = config.name;
  }

  async send(event: SiemExportEvent): Promise<void> {
     
    const response = await fetch(this.config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.token ? { Authorization: `Bearer ${this.config.token}` } : {}),
        ...(this.config.headers ?? {}),
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(`Webhook sink ${this.name} failed with status ${response.status}`);
    }
  }
}

export class HttpIngestionSiemAdapter implements SiemSinkAdapter {
  public readonly name: string;

  constructor(private readonly config: SiemSinkConfig) {
    this.name = config.name;
  }

  async send(event: SiemExportEvent): Promise<void> {
     
    const response = await fetch(this.config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.token ? { "X-API-Key": this.config.token } : {}),
        ...(this.config.headers ?? {}),
      },
      body: JSON.stringify({
        records: [event],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ingestion sink ${this.name} failed with status ${response.status}`);
    }
  }
}

export class SyslogSiemAdapter implements SiemSinkAdapter {
  public readonly name: string;

  constructor(private readonly config: SiemSinkConfig) {
    this.name = config.name;
  }

  async send(event: SiemExportEvent): Promise<void> {
    const endpoint = new URL(this.config.endpoint);
    const host = endpoint.hostname;
    const port = Number(endpoint.port || "514");
    const payload = Buffer.from(`<134>1 ${new Date().toISOString()} valueos SIEM - - - ${JSON.stringify(event)}`);

    await new Promise<void>((resolve, reject) => {
      const socket = dgram.createSocket("udp4");
      socket.send(payload, port, host, (error) => {
        socket.close();
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

export class SiemExportForwarderService {
  private readonly config: SiemRoutingConfig;
  private readonly adapters = new Map<string, SiemSinkAdapter>();
  private readonly deadLetterQueue: DeadLetterEntry[] = [];

  constructor(config: SiemRoutingConfig = getSiemRoutingConfig()) {
    this.config = config;
    this.initializeAdapters();
  }

  private initializeAdapters(): void {
    for (const sink of this.config.sinks) {
      if (sink.type === "webhook") {
        this.adapters.set(sink.name, new WebhookSiemAdapter(sink));
      } else if (sink.type === "http") {
        this.adapters.set(sink.name, new HttpIngestionSiemAdapter(sink));
      } else if (sink.type === "syslog") {
        this.adapters.set(sink.name, new SyslogSiemAdapter(sink));
      }
    }
  }

  async forward(event: SiemExportEvent): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const route = event.source === "audit_logs" ? this.config.routes.auditLogs : this.config.routes.securityAuditLog;
    const queueEntries: QueueEntry[] = route
      .map((sinkName) => this.adapters.get(sinkName))
      .filter((adapter): adapter is SiemSinkAdapter => Boolean(adapter))
      .map((sink) => ({ sink, event, attempts: 0 }));

    await Promise.all(queueEntries.map((entry) => this.deliverWithRetry(entry)));
  }

  private async deliverWithRetry(entry: QueueEntry): Promise<void> {
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt += 1) {
      try {
        await entry.sink.send(entry.event);
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (attempt === this.config.maxRetries) {
          this.handleDeadLetter(entry, attempt, errorMessage);
          return;
        }

        const sleepMs = Math.min(
          this.config.maxBackoffMs,
          this.config.baseBackoffMs * Math.pow(2, attempt - 1)
        );
        await new Promise((resolve) => setTimeout(resolve, sleepMs));
      }
    }
  }

  private handleDeadLetter(entry: QueueEntry, attempts: number, error: string): void {
    logger.error("SIEM forwarding moved event to dead-letter queue", undefined, {
      sink: entry.sink.name,
      source: entry.event.source,
      eventId: entry.event.id,
      attempts,
      error,
    });

    if (!this.config.deadLetterEnabled) {
      return;
    }

    this.deadLetterQueue.push({
      sinkName: entry.sink.name,
      event: entry.event,
      attempts,
      error,
      failedAt: new Date().toISOString(),
    });
  }

  getDeadLetterQueue(): DeadLetterEntry[] {
    return [...this.deadLetterQueue];
  }
}

export const siemExportForwarderService = new SiemExportForwarderService();

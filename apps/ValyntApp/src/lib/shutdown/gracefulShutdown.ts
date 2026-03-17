export type ShutdownHandler = (reason: string) => Promise<void> | void;

interface RegisteredHandler {
  name: string;
  handler: ShutdownHandler;
}

interface ShutdownRuntime {
  timeoutMs: number;
  exit: (code: number) => never | void;
  log: (level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) => void;
}

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 120_000;

const handlers: RegisteredHandler[] = [];
const wiredSignals = new Set<string>();

let shutdownInFlight: Promise<void> | null = null;
let shuttingDown = false;

const runtime: ShutdownRuntime = {
  timeoutMs: DEFAULT_SHUTDOWN_TIMEOUT_MS,
  exit: (code) => process.exit(code),
  log: (level, message, meta) => {
    const payload = meta ? ` ${JSON.stringify(meta)}` : "";
     
    console[level](`[shutdown] ${message}${payload}`);
  },
};

export function configureGracefulShutdown(config: Partial<ShutdownRuntime> & { timeoutMs?: number }): void {
  if (typeof config.timeoutMs === "number") {
    runtime.timeoutMs = config.timeoutMs;
  }
  if (config.exit) {
    runtime.exit = config.exit;
  }
  if (config.log) {
    runtime.log = config.log;
  }
}

export function registerShutdownHandler(name: string, handler: ShutdownHandler): void {
  handlers.push({ name, handler });
}

export function wireProcessShutdownSignals(signals: readonly NodeJS.Signals[] = ["SIGTERM", "SIGINT"]): void {
  for (const signal of signals) {
    if (wiredSignals.has(signal)) {
      continue;
    }

    process.on(signal, () => {
      void initiateGracefulShutdown(signal);
    });

    wiredSignals.add(signal);
  }
}

export async function initiateGracefulShutdown(reason: string): Promise<void> {
  if (shutdownInFlight) {
    runtime.log("warn", "Shutdown already in progress; reusing existing flow", { reason });
    return shutdownInFlight;
  }

  shuttingDown = true;
  runtime.log("info", "Starting graceful shutdown", { reason, handlerCount: handlers.length });

  shutdownInFlight = (async () => {
    const drain = (async () => {
      for (const { name, handler } of handlers) {
        runtime.log("info", "Running shutdown handler", { name, reason });
        await handler(reason);
      }
    })();

    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Graceful shutdown timed out after ${runtime.timeoutMs}ms`));
      }, runtime.timeoutMs);
    });

    try {
      await Promise.race([drain, timeout]);
      runtime.log("info", "Graceful shutdown completed", { reason });
      runtime.exit(0);
    } catch (error) {
      runtime.log("error", "Graceful shutdown failed or timed out", {
        reason,
        message: error instanceof Error ? error.message : String(error),
      });
      runtime.exit(1);
    }
  })();

  return shutdownInFlight;
}

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function __resetGracefulShutdownForTests(): void {
  handlers.splice(0, handlers.length);
  wiredSignals.clear();
  shutdownInFlight = null;
  shuttingDown = false;
  runtime.timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS;
  runtime.exit = (code) => process.exit(code);
  runtime.log = (level, message, meta) => {
    const payload = meta ? ` ${JSON.stringify(meta)}` : "";
     
    console[level](`[shutdown] ${message}${payload}`);
  };
}

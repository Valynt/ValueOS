export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
}

type LogLevel = "info" | "warn" | "error" | "debug";

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function resolveMinLevel(): LogLevel {
  const raw = (process.env["LOG_LEVEL"] ?? "info").toLowerCase();
  if (raw in LOG_LEVEL_RANK) return raw as LogLevel;
  return "info";
}

function emit(level: LogLevel, name: string, message: string, context?: LogContext): void {
  if (LOG_LEVEL_RANK[level] < LOG_LEVEL_RANK[resolveMinLevel()]) return;

  const entry = JSON.stringify({
    level,
    name,
    message,
    ...(context !== undefined && Object.keys(context).length > 0 ? { context } : {}),
    time: new Date().toISOString(),
  });

  // Route warn/error to stderr; info/debug to stdout.
  if (level === "error" || level === "warn") {
    process.stderr.write(entry + "\n");
  } else {
    process.stdout.write(entry + "\n");
  }
}

const createLogger = (name: string): Logger => ({
  info: (message, context) => emit("info", name, message, context),
  warn: (message, context) => emit("warn", name, message, context),
  error: (message, context) => emit("error", name, message, context),
  debug: (message, context) => emit("debug", name, message, context),
});

export const logger = createLogger("mcp");
export default logger;

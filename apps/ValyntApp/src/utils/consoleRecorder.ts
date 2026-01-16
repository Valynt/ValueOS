export type ConsoleLogEntry = {
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  data: unknown[];
  timestamp: number;
};

let capturedLogs: ConsoleLogEntry[] = [];
let isCapturing = false;

const MAX_LOGS = 500;

function serializeArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}

export function startConsoleCapture() {
  if (isCapturing || typeof console === 'undefined') return;

  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  (['log', 'info', 'warn', 'error'] as const).forEach((level) => {
    console[level] = (...args: unknown[]) => {
      const entry: ConsoleLogEntry = {
        level,
        message: serializeArgs(args),
        data: args,
        timestamp: Date.now(),
      };

      capturedLogs = [...capturedLogs.slice(-(MAX_LOGS - 1)), entry];
      originalConsole[level](...args);
    };
  });

  isCapturing = true;
}

export function getConsoleLogs(): ConsoleLogEntry[] {
  return [...capturedLogs];
}

export function clearConsoleLogs() {
  capturedLogs = [];
}

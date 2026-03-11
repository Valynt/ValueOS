/**
 * Worker-thread-based Code Sandbox
 *
 * Provides isolated code execution for agent-generated JavaScript
 * using Node.js worker_threads. Each execution runs in a separate
 * V8 isolate with:
 * - Timeout enforcement (kills worker on expiry)
 * - Memory limit via --max-old-space-size
 * - No access to parent process, filesystem, or network
 * - Restricted global scope (only Math, JSON, Date, etc.)
 *
 * Use this when E2B is unavailable or for lightweight JS calculations.
 * For Python/R, continue using SandboxedExecutor (E2B).
 */

import { Worker } from "node:worker_threads";

import { createLogger } from "@shared/lib/logger";

const logger = createLogger({ component: "WorkerSandbox" });

export interface WorkerSandboxConfig {
  /** Execution timeout in ms (default: 5000) */
  timeoutMs?: number;
  /** Max heap size in MB (default: 64) */
  maxHeapMB?: number;
  /** Context variables injected into the sandbox */
  context?: Record<string, unknown>;
}

export interface WorkerSandboxResult {
  success: boolean;
  result?: unknown;
  error?: string;
  executionTimeMs: number;
  consoleOutput: string[];
  timedOut: boolean;
}

// Patterns that must never appear in sandboxed code
const BLOCKED_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\brequire\s*\(/i, label: "require()" },
  { pattern: /\bimport\s+/i, label: "import statement" },
  { pattern: /\bimport\s*\(/i, label: "dynamic import()" },
  { pattern: /\bprocess\b/i, label: "process global" },
  { pattern: /\b__dirname\b/i, label: "__dirname" },
  { pattern: /\b__filename\b/i, label: "__filename" },
  { pattern: /\bglobalThis\b/i, label: "globalThis" },
  { pattern: /\bFunction\s*\(/i, label: "Function constructor" },
  { pattern: /\beval\s*\(/i, label: "eval()" },
  { pattern: /\bchild_process\b/i, label: "child_process" },
  { pattern: /\bfs\b\.\b/i, label: "fs module" },
  { pattern: /\bnet\b\.\b/i, label: "net module" },
  { pattern: /\bhttp\b\.\b/i, label: "http module" },
  { pattern: /\bhttps\b\.\b/i, label: "https module" },
  { pattern: /\bfetch\s*\(/i, label: "fetch()" },
  { pattern: /\bXMLHttpRequest\b/i, label: "XMLHttpRequest" },
  { pattern: /\bWebSocket\b/i, label: "WebSocket" },
];

const MAX_CODE_LENGTH = 50_000;

/**
 * Validate code before sending to worker.
 * Throws on dangerous patterns or excessive length.
 */
export function validateSandboxCode(
  code: string
): { safe: true } | { safe: false; reason: string } {
  if (code.length > MAX_CODE_LENGTH) {
    return { safe: false, reason: `Code exceeds max length (${MAX_CODE_LENGTH} chars)` };
  }

  for (const { pattern, label } of BLOCKED_PATTERNS) {
    if (pattern.test(code)) {
      return { safe: false, reason: `Blocked pattern: ${label}` };
    }
  }

  return { safe: true };
}

/**
 * The inline worker script. Runs in a separate V8 isolate.
 * Receives code + context via workerData, posts result back.
 *
 * The worker has no access to the parent's require/import because
 * we construct it from an inline string (no file path).
 */
function getWorkerScript(): string {
  return `
const { parentPort, workerData } = require("node:worker_threads");

// Strip dangerous globals
const _blocked = [
  "process", "require", "module", "exports", "__dirname", "__filename",
  "globalThis", "global", "fetch", "XMLHttpRequest", "WebSocket",
  "setTimeout", "setInterval", "setImmediate", "clearTimeout",
  "clearInterval", "clearImmediate", "queueMicrotask",
  "Buffer", "SharedArrayBuffer", "Atomics",
];

for (const name of _blocked) {
  try { Object.defineProperty(globalThis, name, { value: undefined, writable: false, configurable: false }); } catch {}
}

const _consoleOutput = [];
const _safeConsole = {
  log: (...args) => _consoleOutput.push(args.map(String).join(" ")),
  warn: (...args) => _consoleOutput.push("WARN: " + args.map(String).join(" ")),
  error: (...args) => _consoleOutput.push("ERROR: " + args.map(String).join(" ")),
  info: (...args) => _consoleOutput.push(args.map(String).join(" ")),
};

try {
  const _context = workerData.context || {};
  const _contextKeys = Object.keys(_context);
  const _contextValues = _contextKeys.map(k => _context[k]);

  // Build a function with context vars as parameters + safe globals
  const _fn = new Function(
    "console", "Math", "JSON", "Date", "Array", "Object", "String",
    "Number", "Boolean", "Map", "Set", "RegExp", "Error", "isNaN",
    "isFinite", "parseFloat", "parseInt", "NaN", "Infinity", "undefined",
    ..._contextKeys,
    workerData.code
  );

  const _result = _fn(
    _safeConsole, Math, JSON, Date, Array, Object, String,
    Number, Boolean, Map, Set, RegExp, Error, isNaN,
    isFinite, parseFloat, parseInt, NaN, Infinity, undefined,
    ..._contextValues
  );

  parentPort.postMessage({ success: true, result: _result, consoleOutput: _consoleOutput });
} catch (err) {
  parentPort.postMessage({ success: false, error: err.message || String(err), consoleOutput: _consoleOutput });
}
`;
}

/**
 * Execute JavaScript code in an isolated worker thread.
 */
export async function executeInWorkerSandbox(
  code: string,
  config: WorkerSandboxConfig = {}
): Promise<WorkerSandboxResult> {
  const timeoutMs = config.timeoutMs ?? 5000;
  const maxHeapMB = config.maxHeapMB ?? 64;
  const context = config.context ?? {};
  const startTime = Date.now();

  // Pre-validate
  const validation = validateSandboxCode(code);
  if (!validation.safe) {
    return {
      success: false,
      error: validation.reason,
      executionTimeMs: Date.now() - startTime,
      consoleOutput: [],
      timedOut: false,
    };
  }

  return new Promise<WorkerSandboxResult>((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;

    const worker = new Worker(getWorkerScript(), {
      eval: true,
      workerData: { code, context },
      resourceLimits: {
        maxOldGenerationSizeMb: maxHeapMB,
        maxYoungGenerationSizeMb: Math.max(8, Math.floor(maxHeapMB / 4)),
        codeRangeSizeMb: 16,
        stackSizeMb: 4,
      },
    });

    const finish = (result: WorkerSandboxResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    timer = setTimeout(() => {
      logger.warn("Worker sandbox timed out", { timeoutMs, codeLength: code.length });
      worker.terminate().catch(() => {});
      finish({
        success: false,
        error: `Execution timed out after ${timeoutMs}ms`,
        executionTimeMs: Date.now() - startTime,
        consoleOutput: [],
        timedOut: true,
      });
    }, timeoutMs);

    worker.on("message", (msg: { success: boolean; result?: unknown; error?: string; consoleOutput?: string[] }) => {
      finish({
        success: msg.success,
        result: msg.result,
        error: msg.error,
        executionTimeMs: Date.now() - startTime,
        consoleOutput: msg.consoleOutput ?? [],
        timedOut: false,
      });
      worker.terminate().catch(() => {});
    });

    worker.on("error", (err) => {
      logger.warn("Worker sandbox error", {
        error: err.message,
        codeLength: code.length,
      });
      finish({
        success: false,
        error: err.message,
        executionTimeMs: Date.now() - startTime,
        consoleOutput: [],
        timedOut: false,
      });
    });

    worker.on("exit", (exitCode) => {
      if (!settled) {
        finish({
          success: false,
          error: `Worker exited with code ${exitCode}`,
          executionTimeMs: Date.now() - startTime,
          consoleOutput: [],
          timedOut: false,
        });
      }
    });
  });
}

import { vi } from "vitest";

const DEFAULT_SPAN_STATUS_CODE = {
  OK: 0,
  ERROR: 2,
  UNSET: 1,
} as const;

type MockFn<TArgs extends unknown[] = unknown[], TReturn = unknown> = ReturnType<typeof vi.fn<TArgs, TReturn>>;

export interface MockSpan {
  setAttributes: MockFn<[Record<string, unknown>], void>;
  setAttribute: MockFn<[string, unknown], void>;
  setStatus: MockFn<[Record<string, unknown>], void>;
  recordException: MockFn<[unknown], void>;
  addEvent: MockFn<[string, Record<string, unknown>?], void>;
  end: MockFn<[], void>;
  spanContext: MockFn<[], { traceId: string; spanId: string; traceFlags: number }>;
}

export interface MockTracer {
  startSpan: MockFn<[string, Record<string, unknown>?], MockSpan>;
  startActiveSpan: MockFn<[string, ...unknown[]], unknown>;
}

export interface MockMeter {
  createCounter: MockFn<[string, Record<string, unknown>?], { add: MockFn<[number, Record<string, unknown>?], void> }>;
  createHistogram: MockFn<[string, Record<string, unknown>?], { record: MockFn<[number, Record<string, unknown>?], void> }>;
}

export interface CreateOpenTelemetryApiMockOptions {
  activeContext?: object;
  span?: Partial<MockSpan>;
  tracer?: Partial<MockTracer>;
  meter?: Partial<MockMeter>;
  trace?: Record<string, unknown>;
  context?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  propagation?: Record<string, unknown>;
  diag?: Record<string, unknown>;
  includeSpanStatusCode?: boolean;
  spanStatusCode?: Partial<typeof DEFAULT_SPAN_STATUS_CODE>;
}

export function createMockSpan(overrides: Partial<MockSpan> = {}): MockSpan {
  return {
    setAttributes: vi.fn(),
    setAttribute: vi.fn(),
    setStatus: vi.fn(),
    recordException: vi.fn(),
    addEvent: vi.fn(),
    end: vi.fn(),
    spanContext: vi.fn(() => ({
      traceId: "trace-id",
      spanId: "span-id",
      traceFlags: 1,
    })),
    ...overrides,
  };
}

export function createMockTracer(overrides: Partial<MockTracer> = {}): MockTracer {
  const fallbackSpan = createMockSpan();

  return {
    startSpan: vi.fn(() => fallbackSpan),
    startActiveSpan: vi.fn((_: string, ...args: unknown[]) => {
      const callback = [...args].reverse().find((value): value is (span: MockSpan) => unknown => typeof value === "function");
      return callback ? callback(fallbackSpan) : undefined;
    }),
    ...overrides,
  };
}

export function createMockMeter(overrides: Partial<MockMeter> = {}): MockMeter {
  return {
    createCounter: vi.fn(() => ({ add: vi.fn() })),
    createHistogram: vi.fn(() => ({ record: vi.fn() })),
    ...overrides,
  };
}

export function createOpenTelemetryApiMock(options: CreateOpenTelemetryApiMockOptions = {}) {
  const activeContext = options.activeContext ?? {};
  const tracer = createMockTracer(options.tracer);
  const meter = createMockMeter(options.meter);

  const mock = {
    trace: {
      getSpan: vi.fn(() => undefined),
      getTracer: vi.fn(() => tracer),
      setSpan: vi.fn((contextValue: object) => contextValue),
      ...options.trace,
    },
    context: {
      active: vi.fn(() => activeContext),
      with: vi.fn((_contextValue: object, fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args)),
      bind: vi.fn((_contextValue: object, target: unknown) => target),
      setValue: vi.fn((_key: unknown, _value: unknown, contextValue: object = activeContext) => contextValue),
      getValue: vi.fn(),
      ...options.context,
    },
    metrics: {
      getMeter: vi.fn(() => meter),
      ...options.metrics,
    },
    propagation: {
      inject: vi.fn(),
      extract: vi.fn((_contextValue: object) => activeContext),
      ...options.propagation,
    },
    diag: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      ...options.diag,
    },
  } as Record<string, unknown>;

  if (options.includeSpanStatusCode) {
    mock.SpanStatusCode = {
      ...DEFAULT_SPAN_STATUS_CODE,
      ...options.spanStatusCode,
    };
  }

  return mock;
}

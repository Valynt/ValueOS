/**
 * Security Test Fixtures
 *
 * Common security attack vectors for testing input validation.
 */

export const SQL_INJECTION_PAYLOADS = [
  "'; DROP TABLE users; --",
  "' OR '1'='1",
  "'; DELETE FROM benchmarks WHERE '1'='1'; --",
  "1; SELECT * FROM pg_catalog.pg_tables",
  "' UNION SELECT * FROM assumptions --",
];

export const XSS_PAYLOADS = [
  "<script>alert('xss')</script>",
  "<img src=x onerror=alert('xss')>",
  "javascript:alert('xss')",
  "<svg onload=alert('xss')>",
  "<iframe src=javascript:alert('xss')>",
];

export const REPLAY_ATTACK_VECTORS = [
  { timestamp: Date.now() - 86400000, nonce: "reused-nonce-123" },
  { timestamp: Date.now(), nonce: "reused-nonce-123" },
];

export const LARGE_PAYLOAD = "A".repeat(1000000);

export const NULL_BYTE_PAYLOAD = "test\x00 malicious";

export const PATH_TRAVERSAL_PAYLOADS = [
  "../../../etc/passwd",
  "..\\..\\..\\windows\\system32\\config\\sam",
  "....//....//etc/passwd",
];

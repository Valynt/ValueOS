/**
 * Security Metrics Sanitization Tests
 *
 * These tests verify that SecurityMetricsCollector properly sanitizes sensitive
 * data before storage to prevent secret leakage in memory, logs, and API responses.
 *
 * INVARIANT: No sensitive values (passwords, API keys, tokens, credentials) may
 * be stored in plaintext in security event metadata.
 *
 * Expected Behavior:
 * - All sensitive keys are redacted with "[REDACTED]"
 * - Nested objects are recursively sanitized
 * - Matching is case-insensitive
 * - Partial key matches trigger redaction (e.g., "apiKey" matches "key")
 */

import { beforeEach, describe, expect, it } from "vitest";

import { SecurityEvent, SecurityMetricsCollector } from "../security/enhancedSecurityLogger";

describe("SecurityMetricsCollector - Metadata Sanitization", () => {
  beforeEach(() => {
    SecurityMetricsCollector.getInstance().reset();
  });

  describe("sensitive key redaction", () => {
    it("must redact 'password' field and all variations at root level", () => {
      const event: SecurityEvent = {
        type: "AUTH_FAILURE",
        category: "authentication",
        severity: "medium",
        outcome: "blocked",
        metadata: {
          username: "admin",
          password: "SuperSecret123!",
          userPassword: "another_pass",
          oldPassword: "old_pass",
          newPassword: "new_pass",
          passwordHash: "5f4dcc3b5aa765d61d8327deb882cf99",
        },
      };

      SecurityMetricsCollector.getInstance().recordEvent(event);

      const storedEvent = SecurityMetricsCollector.getInstance().getRecentEvents()[0];
      // All password-related fields must be redacted
      expect(storedEvent.metadata?.password).toBe("[REDACTED]");
      expect(storedEvent.metadata?.userPassword).toBe("[REDACTED]");
      expect(storedEvent.metadata?.oldPassword).toBe("[REDACTED]");
      expect(storedEvent.metadata?.newPassword).toBe("[REDACTED]");
      expect(storedEvent.metadata?.passwordHash).toBe("[REDACTED]");
      // Safe fields must remain unchanged
      expect(storedEvent.metadata?.username).toBe("admin");
    });

    it("must redact 'apiKey' field and all case variations", () => {
      const event: SecurityEvent = {
        type: "API_CALL",
        category: "api_security",
        severity: "low",
        outcome: "allowed",
        metadata: {
          apiKey: "sk_live_12345abcdef",
          api_key: "another_key_here",
          APIKEY: "third_key_variant",
          myApiKeyField: "custom_api_key",
          x_apikey_header: "header_value",
        },
      };

      SecurityMetricsCollector.getInstance().recordEvent(event);

      const storedEvent = SecurityMetricsCollector.getInstance().getRecentEvents()[0];
      // All API key variations must be redacted
      expect(storedEvent.metadata?.apiKey).toBe("[REDACTED]");
      expect(storedEvent.metadata?.api_key).toBe("[REDACTED]");
      expect(storedEvent.metadata?.APIKEY).toBe("[REDACTED]");
      expect(storedEvent.metadata?.myApiKeyField).toBe("[REDACTED]");
      expect(storedEvent.metadata?.x_apikey_header).toBe("[REDACTED]");
    });

    it("must redact all token and authorization field variations", () => {
      const event: SecurityEvent = {
        type: "SESSION_REFRESH",
        category: "session_management",
        severity: "low",
        outcome: "allowed",
        metadata: {
          refreshToken: "eyJhbGciOiJIUzI1NiIs...",
          accessToken: "access_token_value",
          idToken: "id_token_value",
          auth: "Bearer xyz123",
          authorization: "Basic YWRtaW46cGFzcw==",
          bearer: "secret_token_value",
          x_auth_header: "auth_header_value",
        },
      };

      SecurityMetricsCollector.getInstance().recordEvent(event);

      const storedEvent = SecurityMetricsCollector.getInstance().getRecentEvents()[0];
      // All token/auth fields must be redacted
      expect(storedEvent.metadata?.refreshToken).toBe("[REDACTED]");
      expect(storedEvent.metadata?.accessToken).toBe("[REDACTED]");
      expect(storedEvent.metadata?.idToken).toBe("[REDACTED]");
      expect(storedEvent.metadata?.auth).toBe("[REDACTED]");
      expect(storedEvent.metadata?.authorization).toBe("[REDACTED]");
      expect(storedEvent.metadata?.bearer).toBe("[REDACTED]");
      expect(storedEvent.metadata?.x_auth_header).toBe("[REDACTED]");
    });

    it("must redact all secret and key field variations including private keys", () => {
      const event: SecurityEvent = {
        type: "CONFIG_ACCESS",
        category: "data_protection",
        severity: "high",
        outcome: "blocked",
        metadata: {
          secret: "top_secret_value",
          secretKey: "another_secret",
          private_key: "-----BEGIN RSA PRIVATE KEY-----",
          signingKey: "hmac_signing_key",
          encryptionKey: "encryption_key_value",
          mySecretField: "custom_secret",
          jwtSecret: "jwt_secret_value",
        },
      };

      SecurityMetricsCollector.getInstance().recordEvent(event);

      const storedEvent = SecurityMetricsCollector.getInstance().getRecentEvents()[0];
      // All secret/key fields must be redacted
      expect(storedEvent.metadata?.secret).toBe("[REDACTED]");
      expect(storedEvent.metadata?.secretKey).toBe("[REDACTED]");
      expect(storedEvent.metadata?.private_key).toBe("[REDACTED]");
      expect(storedEvent.metadata?.signingKey).toBe("[REDACTED]");
      expect(storedEvent.metadata?.encryptionKey).toBe("[REDACTED]");
      expect(storedEvent.metadata?.mySecretField).toBe("[REDACTED]");
      expect(storedEvent.metadata?.jwtSecret).toBe("[REDACTED]");
    });

    it("must redact session and cookie field variations", () => {
      const event: SecurityEvent = {
        type: "SESSION_HIJACK_ATTEMPT",
        category: "session_management",
        severity: "critical",
        outcome: "blocked",
        metadata: {
          sessionId: "sess_abc123",
          sessionToken: "session_token_value",
          sessionKey: "session_key_value",
          cookie: "session=xyz; path=/",
          cookieValue: "sensitive_cookie_data",
          setCookieHeader: "session=abc; HttpOnly",
        },
      };

      SecurityMetricsCollector.getInstance().recordEvent(event);

      const storedEvent = SecurityMetricsCollector.getInstance().getRecentEvents()[0];
      // All session/cookie fields must be redacted
      expect(storedEvent.metadata?.sessionId).toBe("[REDACTED]");
      expect(storedEvent.metadata?.sessionToken).toBe("[REDACTED]");
      expect(storedEvent.metadata?.sessionKey).toBe("[REDACTED]");
      expect(storedEvent.metadata?.cookie).toBe("[REDACTED]");
      expect(storedEvent.metadata?.cookieValue).toBe("[REDACTED]");
      expect(storedEvent.metadata?.setCookieHeader).toBe("[REDACTED]");
    });

    it("must redact credential field variations", () => {
      const event: SecurityEvent = {
        type: "CREDENTIAL_CHECK",
        category: "authentication",
        severity: "medium",
        outcome: "blocked",
        metadata: {
          credentials: "user:pass",
          credentialHash: "5f4dcc3b5aa765d61d8327deb882cf99",
          dbCredentials: "db_user:db_pass",
          serviceCredentials: "svc:creds",
        },
      };

      SecurityMetricsCollector.getInstance().recordEvent(event);

      const storedEvent = SecurityMetricsCollector.getInstance().getRecentEvents()[0];
      // All credential fields must be redacted
      expect(storedEvent.metadata?.credentials).toBe("[REDACTED]");
      expect(storedEvent.metadata?.credentialHash).toBe("[REDACTED]");
      expect(storedEvent.metadata?.dbCredentials).toBe("[REDACTED]");
      expect(storedEvent.metadata?.serviceCredentials).toBe("[REDACTED]");
    });
  });

  describe("nested object sanitization", () => {
    it("must recursively sanitize nested objects at all depths", () => {
      const event: SecurityEvent = {
        type: "AUTH_FAILURE",
        category: "authentication",
        severity: "medium",
        outcome: "blocked",
        reason: "Invalid credentials",
        metadata: {
          username: "admin",
          nested: {
            password: "nested_password_123",
            apiKey: "nested_sk_live_key",
            safeNestedField: "this_is_safe",
            deep: {
              secret: "deeply_nested_secret",
              token: "deeply_nested_token",
              deeper: {
                password: "very_deep_password",
                privateKey: "very_deep_key",
              },
            },
          },
          safeField: "this_is_safe",
        },
      };

      SecurityMetricsCollector.getInstance().recordEvent(event);

      const storedEvent = SecurityMetricsCollector.getInstance().getRecentEvents()[0];

      // Root level preserved
      expect(storedEvent.metadata?.username).toBe("admin");
      expect(storedEvent.metadata?.safeField).toBe("this_is_safe");

      // First level nested redacted
      expect(storedEvent.metadata?.nested).toBeDefined();
      const nested = storedEvent.metadata?.nested as Record<string, unknown>;
      expect(nested.password).toBe("[REDACTED]");
      expect(nested.apiKey).toBe("[REDACTED]");
      expect(nested.safeNestedField).toBe("this_is_safe");

      // Deep nesting redacted
      const deep = nested.deep as Record<string, unknown>;
      expect(deep.secret).toBe("[REDACTED]");
      expect(deep.token).toBe("[REDACTED]");

      // Deepest level redacted
      const deeper = deep.deeper as Record<string, unknown>;
      expect(deeper.password).toBe("[REDACTED]");
      expect(deeper.privateKey).toBe("[REDACTED]");
    });

    it("must sanitize arrays containing objects with sensitive data", () => {
      const event: SecurityEvent = {
        type: "BATCH_AUTH_CHECK",
        category: "authentication",
        severity: "medium",
        outcome: "blocked",
        metadata: {
          attempts: [
            { username: "user1", password: "pass1", safeField: "safe1" },
            { username: "user2", password: "pass2", apiKey: "key2" },
            { username: "user3", token: "token3", secret: "secret3" },
          ],
        },
      };

      SecurityMetricsCollector.getInstance().recordEvent(event);

      const storedEvent = SecurityMetricsCollector.getInstance().getRecentEvents()[0];
      const attempts = storedEvent.metadata?.attempts as Array<Record<string, unknown>>;

      // Array items preserved with sensitive fields redacted
      expect(attempts[0].username).toBe("user1");
      expect(attempts[0].password).toBe("[REDACTED]");
      expect(attempts[0].safeField).toBe("safe1");

      expect(attempts[1].username).toBe("user2");
      expect(attempts[1].password).toBe("[REDACTED]");
      expect(attempts[1].apiKey).toBe("[REDACTED]");

      expect(attempts[2].username).toBe("user3");
      expect(attempts[2].token).toBe("[REDACTED]");
      expect(attempts[2].secret).toBe("[REDACTED]");
    });

    it("must handle mixed arrays with primitives and objects", () => {
      const event: SecurityEvent = {
        type: "MIXED_DATA",
        category: "audit",
        severity: "low",
        outcome: "allowed",
        metadata: {
          items: [
            "safe_string",
            123,
            { password: "in_array_object", apiKey: "key_in_array" },
            ["nested", "array"],
          ],
        },
      };

      SecurityMetricsCollector.getInstance().recordEvent(event);

      const storedEvent = SecurityMetricsCollector.getInstance().getRecentEvents()[0];
      const items = storedEvent.metadata?.items as Array<unknown>;

      expect(items[0]).toBe("safe_string");
      expect(items[1]).toBe(123);
      const objItem = items[2] as Record<string, unknown>;
      expect(objItem.password).toBe("[REDACTED]");
      expect(objItem.apiKey).toBe("[REDACTED]");
      expect(items[3]).toEqual(["nested", "array"]);
    });
  });

  describe("edge cases and bypass attempts", () => {
    it("must handle case-insensitive key matching for all variations", () => {
      const event: SecurityEvent = {
        type: "AUTH_FAILURE",
        category: "authentication",
        severity: "medium",
        outcome: "blocked",
        metadata: {
          PASSWORD: "uppercase_password",
          Password: "mixed_case_password",
          PaSsWoRd: "mixed_case_password_2",
          APIKEY: "uppercase_apikey",
          ApiKey: "mixed_case_apikey",
          TOKEN: "uppercase_token",
          SECRET: "uppercase_secret",
        },
      };

      SecurityMetricsCollector.getInstance().recordEvent(event);

      const storedEvent = SecurityMetricsCollector.getInstance().getRecentEvents()[0];
      // All case variations must be redacted
      expect(storedEvent.metadata?.PASSWORD).toBe("[REDACTED]");
      expect(storedEvent.metadata?.Password).toBe("[REDACTED]");
      expect(storedEvent.metadata?.PaSsWoRd).toBe("[REDACTED]");
      expect(storedEvent.metadata?.APIKEY).toBe("[REDACTED]");
      expect(storedEvent.metadata?.ApiKey).toBe("[REDACTED]");
      expect(storedEvent.metadata?.TOKEN).toBe("[REDACTED]");
      expect(storedEvent.metadata?.SECRET).toBe("[REDACTED]");
    });

    it("must handle null and undefined metadata gracefully without throwing", () => {
      const nullEvent: SecurityEvent = {
        type: "TEST",
        category: "audit",
        severity: "low",
        outcome: "allowed",
        metadata: null as unknown as Record<string, unknown>,
      };

      const undefinedEvent: SecurityEvent = {
        type: "TEST",
        category: "audit",
        severity: "low",
        outcome: "allowed",
        metadata: undefined,
      };

      // Should not throw
      expect(() => SecurityMetricsCollector.getInstance().recordEvent(nullEvent)).not.toThrow();
      expect(() => SecurityMetricsCollector.getInstance().recordEvent(undefinedEvent)).not.toThrow();

      // Events should still be recorded
      const events = SecurityMetricsCollector.getInstance().getRecentEvents();
      expect(events).toHaveLength(2);
      expect(events[0].metadata).toBeNull();
      expect(events[1].metadata).toBeUndefined();
    });

    it("must handle empty metadata objects", () => {
      const event: SecurityEvent = {
        type: "TEST",
        category: "audit",
        severity: "low",
        outcome: "allowed",
        metadata: {},
      };

      SecurityMetricsCollector.getInstance().recordEvent(event);

      const storedEvent = SecurityMetricsCollector.getInstance().getRecentEvents()[0];
      expect(storedEvent.metadata).toEqual({});
    });

    it("must truncate long strings (>500 chars) after redaction check", () => {
      const longSafeValue = "a".repeat(1000);
      const longPasswordValue = "secret".repeat(100);

      const event: SecurityEvent = {
        type: "DATA_SUBMISSION",
        category: "input_validation",
        severity: "low",
        outcome: "allowed",
        metadata: {
          safeLongField: longSafeValue,
          password: longPasswordValue,
        },
      };

      SecurityMetricsCollector.getInstance().recordEvent(event);

      const storedEvent = SecurityMetricsCollector.getInstance().getRecentEvents()[0];
      // Password should be redacted, not truncated
      expect(storedEvent.metadata?.password).toBe("[REDACTED]");
      // Safe long field should be truncated (500 + suffix length)
      expect((storedEvent.metadata?.safeLongField as string).length).toBeLessThanOrEqual(515);
      expect(storedEvent.metadata?.safeLongField).toContain("...[TRUNCATED]");
    });

    it("must handle partial key matches for compound field names", () => {
      const event: SecurityEvent = {
        type: "CUSTOM_AUTH",
        category: "authentication",
        severity: "medium",
        outcome: "blocked",
        metadata: {
          userPassword: "user_pass",
          passwordHash: "hash_value",
          oldPassword: "old_pass",
          newPassword: "new_pass",
          myApiKeyField: "api_key_value",
          apiKeySecret: "api_key_secret",
          xCustomTokenHeader: "token_value",
          sessionIdWithSecret: "session_secret_value",
        },
      };

      SecurityMetricsCollector.getInstance().recordEvent(event);

      const storedEvent = SecurityMetricsCollector.getInstance().getRecentEvents()[0];
      // All partial matches must be redacted
      expect(storedEvent.metadata?.userPassword).toBe("[REDACTED]");
      expect(storedEvent.metadata?.passwordHash).toBe("[REDACTED]");
      expect(storedEvent.metadata?.oldPassword).toBe("[REDACTED]");
      expect(storedEvent.metadata?.newPassword).toBe("[REDACTED]");
      expect(storedEvent.metadata?.myApiKeyField).toBe("[REDACTED]");
      expect(storedEvent.metadata?.apiKeySecret).toBe("[REDACTED]");
      expect(storedEvent.metadata?.xCustomTokenHeader).toBe("[REDACTED]");
      expect(storedEvent.metadata?.sessionIdWithSecret).toBe("[REDACTED]");
    });

    it("must handle special characters and unicode in keys and values", () => {
      const event: SecurityEvent = {
        type: "UNICODE_TEST",
        category: "audit",
        severity: "low",
        outcome: "allowed",
        metadata: {
          "password\nwith\nnewlines": "secret_value",
          "api_key_with_underscores": "key_value",
          "token-with-dashes": "token_value",
          "secret.key.with.dots": "secret_value",
          "пароль": "russian_password",
          "密码": "chinese_password",
        },
      };

      SecurityMetricsCollector.getInstance().recordEvent(event);

      const storedEvent = SecurityMetricsCollector.getInstance().getRecentEvents()[0];
      // Keys containing sensitive substrings must be redacted
      expect(storedEvent.metadata?.["password\nwith\nnewlines"]).toBe("[REDACTED]");
      expect(storedEvent.metadata?.["api_key_with_underscores"]).toBe("[REDACTED]");
      expect(storedEvent.metadata?.["token-with-dashes"]).toBe("[REDACTED]");
      expect(storedEvent.metadata?.["secret.key.with.dots"]).toBe("[REDACTED]");
      expect(storedEvent.metadata?.["пароль"]).toBe("[REDACTED]");
      expect(storedEvent.metadata?.["密码"]).toBe("[REDACTED]");
    });
  });

  describe("event retrieval maintains sanitization", () => {
    it("must return sanitized events from getRecentEvents", () => {
      const event: SecurityEvent = {
        type: "AUTH_FAILURE",
        category: "authentication",
        severity: "medium",
        outcome: "blocked",
        metadata: {
          username: "admin",
          password: "secret123",
          apiKey: "sk_live_key",
        },
      };

      SecurityMetricsCollector.getInstance().recordEvent(event);
      const recent = SecurityMetricsCollector.getInstance().getRecentEvents(10);

      expect(recent[0].metadata?.username).toBe("admin");
      expect(recent[0].metadata?.password).toBe("[REDACTED]");
      expect(recent[0].metadata?.apiKey).toBe("[REDACTED]");
    });

    it("must return sanitized events from getEventsByCategory", () => {
      const event: SecurityEvent = {
        type: "AUTH_FAILURE",
        category: "authentication",
        severity: "medium",
        outcome: "blocked",
        metadata: {
          password: "secret123",
        },
      };

      SecurityMetricsCollector.getInstance().recordEvent(event);
      const authEvents = SecurityMetricsCollector.getInstance().getEventsByCategory("authentication");

      expect(authEvents[0].metadata?.password).toBe("[REDACTED]");
    });

    it("must return sanitized events from getEventsBySeverity", () => {
      const event: SecurityEvent = {
        type: "AUTH_FAILURE",
        category: "authentication",
        severity: "medium",
        outcome: "blocked",
        metadata: {
          apiKey: "sk_live_key",
          token: "bearer_token",
        },
      };

      SecurityMetricsCollector.getInstance().recordEvent(event);
      const mediumEvents = SecurityMetricsCollector.getInstance().getEventsBySeverity("medium");

      expect(mediumEvents[0].metadata?.apiKey).toBe("[REDACTED]");
      expect(mediumEvents[0].metadata?.token).toBe("[REDACTED]");
    });
  });

  describe("circular buffer behavior", () => {
    it("must maintain sanitization across circular buffer eviction", () => {
      // Fill buffer beyond max capacity (1000)
      for (let i = 0; i < 1005; i++) {
        SecurityMetricsCollector.getInstance().recordEvent({
          type: "TEST",
          category: "audit",
          severity: "low",
          outcome: "allowed",
          metadata: {
            index: i,
            password: `password_${i}`,
            apiKey: `key_${i}`,
          },
        });
      }

      const events = SecurityMetricsCollector.getInstance().getRecentEvents(100);

      // All stored events should have sanitized sensitive fields
      for (const event of events) {
        expect(event.metadata?.password).toBe("[REDACTED]");
        expect(event.metadata?.apiKey).toBe("[REDACTED]");
        expect(event.metadata?.password).not.toMatch(/^password_\d+$/);
        expect(event.metadata?.apiKey).not.toMatch(/^key_\d+$/);
        // Safe fields should be preserved
        expect(typeof event.metadata?.index).toBe("number");
      }
    });

    it("must maintain accurate metrics counts alongside sanitization", () => {
      // Record events with sensitive data
      for (let i = 0; i < 10; i++) {
        SecurityMetricsCollector.getInstance().recordEvent({
          type: "AUTH_ATTEMPT",
          category: "authentication",
          severity: "medium",
          outcome: i % 2 === 0 ? "blocked" : "allowed",
          metadata: {
            password: `secret_${i}`,
            username: `user_${i}`,
          },
        });
      }

      const metrics = SecurityMetricsCollector.getInstance().getMetrics();

      // Metrics should reflect actual counts, not be affected by sanitization
      expect(metrics["authentication_blocked"]).toBe(5);
      expect(metrics["authentication_allowed"]).toBe(5);

      // Events should be sanitized
      const events = SecurityMetricsCollector.getInstance().getRecentEvents(10);
      for (const event of events) {
        expect(event.metadata?.password).toBe("[REDACTED]");
        expect(event.metadata?.username).toBeDefined();
      }
    });
  });

  describe("singleton behavior", () => {
    it("must return same instance across multiple getInstance calls", () => {
      const instance1 = SecurityMetricsCollector.getInstance();
      const instance2 = SecurityMetricsCollector.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("must maintain state across instance references", () => {
      const event: SecurityEvent = {
        type: "TEST",
        category: "audit",
        severity: "low",
        outcome: "allowed",
        metadata: {
          password: "test_password",
          safeData: "safe_value",
        },
      };

      SecurityMetricsCollector.getInstance().recordEvent(event);

      // Get new instance reference and verify state maintained
      const newRef = SecurityMetricsCollector.getInstance();
      const events = newRef.getRecentEvents(1);

      expect(events[0].metadata?.password).toBe("[REDACTED]");
      expect(events[0].metadata?.safeData).toBe("safe_value");
    });

    it("must clear all data on reset", () => {
      // Add some data
      SecurityMetricsCollector.getInstance().recordEvent({
        type: "TEST",
        category: "audit",
        severity: "low",
        outcome: "allowed",
        metadata: { password: "secret" },
      });

      // Reset
      SecurityMetricsCollector.getInstance().reset();

      // Verify cleared
      expect(SecurityMetricsCollector.getInstance().getRecentEvents()).toHaveLength(0);
      expect(SecurityMetricsCollector.getInstance().getMetrics()).toEqual({});
    });
  });
});

## 2026-01-24 - Unconditional Dev Backdoor in Legacy Auth
**Vulnerability:** Hardcoded "backdoor" credentials (`dev@valynt.com` / `bypass`) were unconditionally enabled in `AuthProvider.tsx`.
**Learning:** Legacy or "dormant" code paths (like unused AuthProviders) can harbor critical vulnerabilities that might be reactivated or used in tests/development, exposing the system.
**Prevention:** Always wrap development-only logic in `import.meta.env.DEV` checks, and audit legacy code paths for security risks.

## 2026-01-25 - Unsafe Regex-based HTML Sanitization
**Vulnerability:** `InputSanitizer.ts` used a custom regex implementation to strip dangerous tags, which is easily bypassed and incomplete compared to standard libraries.
**Learning:** Home-rolled security functions often create a false sense of security while leaving gaps.
**Prevention:** Always use established, battle-tested libraries like `DOMPurify` (or `isomorphic-dompurify` for Node/Browser compatibility) for HTML sanitization instead of custom implementations.

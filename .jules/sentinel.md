## 2026-01-24 - Unconditional Dev Backdoor in Legacy Auth
**Vulnerability:** Hardcoded "backdoor" credentials (`dev@valynt.com` / `bypass`) were unconditionally enabled in `AuthProvider.tsx`.
**Learning:** Legacy or "dormant" code paths (like unused AuthProviders) can harbor critical vulnerabilities that might be reactivated or used in tests/development, exposing the system.
**Prevention:** Always wrap development-only logic in `import.meta.env.DEV` checks, and audit legacy code paths for security risks.

## 2025-02-18 - Missing Crypto Import in Middleware
**Vulnerability:** Runtime crash in production due to missing `import crypto` when using `crypto.randomBytes` for CSP nonces.
**Learning:** Node.js 20+ provides `globalThis.crypto` (Web Crypto API) but it does NOT include `randomBytes`. Accessing `crypto` without import might not fail immediately in some REPLs or if polyfilled, but fails in strict modules or when accessing Node-specific methods.
**Prevention:** Always explicitly import `crypto` from `node:crypto` when using Node-specific crypto functions. Use strict linting to catch undeclared globals.

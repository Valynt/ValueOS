# Sentinel Journal

## 2025-02-18 - [HIGH] Enable strict CSP by removing inline scripts
**Vulnerability:** Inline scripts in `index.html` and `health-dashboard.html` prevent enabling strict Content Security Policy (CSP), leaving the application vulnerable to XSS if `unsafe-inline` is allowed.
**Learning:** Even utility scripts like `window.onerror` or dashboard logic need to be externalized to support strict CSP.
**Prevention:** Always place JavaScript in external `.js` files and load them via `<script src="...">`. Avoid inline event handlers and `<script>...</script>` blocks.

## 2025-02-19 - [HIGH] Fail secure in shared utilities
**Vulnerability:** The `sanitizeHtml` utility in `apps/VOSAcademy` returned the original dirty input when `window` was undefined (e.g. server-side context), exposing the application to XSS if used in SSR or backend logic.
**Learning:** Shared utilities that rely on browser globals (like `DOMPurify` without JSDOM) must handle non-browser environments securely. Returning "dirty" input as a fallback is a dangerous default.
**Prevention:** In functions that sanitize or validate security inputs, the default fallback for missing dependencies or environments should be "deny all" (return empty/null/throw), not "allow all" (return original input).

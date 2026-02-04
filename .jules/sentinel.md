# Sentinel Journal

## 2025-02-18 - [HIGH] Enable strict CSP by removing inline scripts
**Vulnerability:** Inline scripts in `index.html` and `health-dashboard.html` prevent enabling strict Content Security Policy (CSP), leaving the application vulnerable to XSS if `unsafe-inline` is allowed.
**Learning:** Even utility scripts like `window.onerror` or dashboard logic need to be externalized to support strict CSP.
**Prevention:** Always place JavaScript in external `.js` files and load them via `<script src="...">`. Avoid inline event handlers and `<script>...</script>` blocks.

## 2025-02-19 - [MEDIUM] Disable Legacy X-XSS-Protection Header
**Vulnerability:** Setting `X-XSS-Protection: 1; mode=block` can introduce XS-Leak vulnerabilities (side-channel attacks) in older browsers and is deprecated in modern ones.
**Learning:** Modern security best practices favor a strong Content Security Policy (CSP) over the legacy XSS auditor.
**Prevention:** Explicitly set `X-XSS-Protection: 0` to disable the auditor and rely on CSP for XSS protection.

# Sentinel Journal

## 2025-02-18 - [HIGH] Enable strict CSP by removing inline scripts
**Vulnerability:** Inline scripts in `index.html` and `health-dashboard.html` prevent enabling strict Content Security Policy (CSP), leaving the application vulnerable to XSS if `unsafe-inline` is allowed.
**Learning:** Even utility scripts like `window.onerror` or dashboard logic need to be externalized to support strict CSP.
**Prevention:** Always place JavaScript in external `.js` files and load them via `<script src="...">`. Avoid inline event handlers and `<script>...</script>` blocks.

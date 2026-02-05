# Sentinel Journal

## 2025-02-18 - [HIGH] Enable strict CSP by removing inline scripts
**Vulnerability:** Inline scripts in `index.html` and `health-dashboard.html` prevent enabling strict Content Security Policy (CSP), leaving the application vulnerable to XSS if `unsafe-inline` is allowed.
**Learning:** Even utility scripts like `window.onerror` or dashboard logic need to be externalized to support strict CSP.
**Prevention:** Always place JavaScript in external `.js` files and load them via `<script src="...">`. Avoid inline event handlers and `<script>...</script>` blocks.

## 2025-02-19 - [HIGH] Sanitize sensitive data in security metrics collector
**Vulnerability:** The `SecurityMetricsCollector` stored raw security events in memory, including potentially sensitive metadata (like passwords in failed auth attempts).
**Learning:** In-memory stores used for monitoring or dashboards must apply the same sanitization rules as persistent logs, especially if exposed via APIs.
**Prevention:** Always sanitize inputs at the boundary of storage systems, even in-memory ones.

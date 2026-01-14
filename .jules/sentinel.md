## 2024-05-22 - Host Header Injection in Email Redirects
**Vulnerability:** Used `req.get('host')` to construct email verification redirect URLs.
**Learning:** `req.get('host')` is vulnerable to Host Header Injection unless `trust proxy` is strictly configured. Attackers can poison the link sent to the user.
**Prevention:** Always use `getConfig().app.url` (or a configured canonical URL) instead of request headers for constructing absolute URLs, especially for emails or redirects.

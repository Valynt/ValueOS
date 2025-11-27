# Content Security Policy Configuration

## Overview

ValueCanvas uses Content Security Policy (CSP) to prevent XSS attacks and other code injection vulnerabilities. The CSP configuration differs between development and production environments.

---

## Development CSP (Current)

**Location:** `index.html`

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; 
           img-src 'self' data: https:; 
           style-src 'self' 'unsafe-inline'; 
           script-src 'self' 'unsafe-inline' 'unsafe-eval'; 
           connect-src 'self' ws://localhost:* http://localhost:* https://*.supabase.co https://api.together.xyz; 
           font-src 'self' data:; 
           object-src 'none'; 
           base-uri 'self'; 
           form-action 'self';"
/>
```

### Why Relaxed for Development?

- **`'unsafe-inline'`** - Required for Vite Hot Module Replacement (HMR)
- **`'unsafe-eval'`** - Required for Vite development server
- **`ws://localhost:*`** - WebSocket for HMR
- **`http://localhost:*`** - Local API endpoints

⚠️ **Never use these relaxed settings in production!**

---

## Production CSP (Recommended)

For production deployment, use strict CSP via HTTP headers (not meta tags):

### Nginx Configuration

```nginx
add_header Content-Security-Policy "
  default-src 'self';
  img-src 'self' data: https:;
  style-src 'self' 'sha256-HASH_OF_INLINE_STYLES';
  script-src 'self' 'sha256-HASH_OF_INLINE_SCRIPTS';
  connect-src 'self' https://*.supabase.co https://api.together.xyz;
  font-src 'self' data:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
" always;

add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

### Apache Configuration

```apache
Header always set Content-Security-Policy "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'sha256-HASH'; script-src 'self' 'sha256-HASH'; connect-src 'self' https://*.supabase.co https://api.together.xyz; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"
Header always set X-Frame-Options "DENY"
Header always set X-Content-Type-Options "nosniff"
Header always set X-XSS-Protection "1; mode=block"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
```

### Cloudflare Workers

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const response = await fetch(request)
  const newHeaders = new Headers(response.headers)
  
  newHeaders.set('Content-Security-Policy', 
    "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'sha256-HASH'; script-src 'self' 'sha256-HASH'; connect-src 'self' https://*.supabase.co https://api.together.xyz; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"
  )
  newHeaders.set('X-Frame-Options', 'DENY')
  newHeaders.set('X-Content-Type-Options', 'nosniff')
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  })
}
```

---

## Generating CSP Hashes

To use strict CSP without `'unsafe-inline'`, generate hashes for inline scripts/styles:

```bash
# Generate SHA256 hash for inline script
echo -n "YOUR_INLINE_SCRIPT_CONTENT" | openssl dgst -sha256 -binary | openssl base64

# Example output: sha256-Z2/iFzh9VMlVkEOar1f/oSHWwQk3ve1qk/C2WdsC4Xk=
```

Then use in CSP:
```
script-src 'self' 'sha256-Z2/iFzh9VMlVkEOar1f/oSHWwQk3ve1qk/C2WdsC4Xk='
```

---

## CSP Directives Explained

| Directive | Purpose | Development | Production |
|-----------|---------|-------------|------------|
| `default-src` | Fallback for all resources | `'self'` | `'self'` |
| `script-src` | JavaScript sources | `'self' 'unsafe-inline' 'unsafe-eval'` | `'self' 'sha256-...'` |
| `style-src` | CSS sources | `'self' 'unsafe-inline'` | `'self' 'sha256-...'` |
| `img-src` | Image sources | `'self' data: https:` | `'self' data: https:` |
| `connect-src` | AJAX, WebSocket, EventSource | `'self' ws://localhost:* http://localhost:* https://*.supabase.co` | `'self' https://*.supabase.co https://api.together.xyz` |
| `font-src` | Font sources | `'self' data:` | `'self' data:` |
| `object-src` | `<object>`, `<embed>`, `<applet>` | `'none'` | `'none'` |
| `base-uri` | `<base>` tag | `'self'` | `'self'` |
| `form-action` | Form submission targets | `'self'` | `'self'` |
| `frame-ancestors` | Who can embed this page | N/A (meta) | `'none'` |
| `upgrade-insecure-requests` | Upgrade HTTP to HTTPS | N/A (dev) | ✅ |

---

## Common Issues

### Issue: Vite HMR Not Working

**Symptom:** Hot module replacement fails, page requires manual refresh

**Solution:** Ensure development CSP includes:
```
script-src 'self' 'unsafe-inline' 'unsafe-eval';
connect-src 'self' ws://localhost:*;
```

### Issue: External Resources Blocked

**Symptom:** Images, fonts, or API calls fail to load

**Solution:** Add domains to appropriate directives:
```
img-src 'self' data: https://cdn.example.com;
connect-src 'self' https://api.example.com;
```

### Issue: Inline Styles Blocked

**Symptom:** Styles don't apply, console shows CSP violation

**Solution (Dev):** Use `'unsafe-inline'` in `style-src`
**Solution (Prod):** Generate hashes or use external stylesheets

### Issue: Third-party Scripts Blocked

**Symptom:** Analytics, monitoring tools don't load

**Solution:** Add to `script-src`:
```
script-src 'self' https://cdn.jsdelivr.net https://www.googletagmanager.com;
```

---

## Testing CSP

### Browser DevTools

1. Open DevTools (F12)
2. Check Console for CSP violations
3. Look for messages like: "Refused to load..."

### CSP Evaluator

Use Google's CSP Evaluator: https://csp-evaluator.withgoogle.com/

### Report-Only Mode

Test CSP without blocking:
```html
<meta http-equiv="Content-Security-Policy-Report-Only" content="...">
```

---

## Production Deployment

### Option 1: Use Production HTML Template (Recommended)

Replace `index.html` with the production template:

```bash
cp index.production.html index.html
```

The production template has:
- ✅ Strict CSP without `'unsafe-inline'` or `'unsafe-eval'`
- ✅ No localhost WebSocket connections
- ✅ Production-ready security headers

### Option 2: Configure Web Server Headers

Set CSP via HTTP headers (preferred over meta tags). See examples above for Nginx, Apache, and Cloudflare.

## Migration Checklist

When moving from development to production:

- [ ] **Use `index.production.html`** or configure web server headers
- [ ] Remove `'unsafe-inline'` from `script-src`
- [ ] Remove `'unsafe-eval'` from `script-src`
- [ ] Generate hashes for inline scripts/styles (if any remain)
- [ ] Remove `ws://localhost:*` from `connect-src`
- [ ] Remove `http://localhost:*` from `connect-src`
- [ ] Add `frame-ancestors 'none'`
- [ ] Add `upgrade-insecure-requests`
- [ ] Move CSP from meta tag to HTTP headers (best practice)
- [ ] Test thoroughly in staging environment
- [ ] Monitor CSP reports in production
- [ ] Update `.env.production` with production URLs

---

## Monitoring CSP Violations

### Report URI

Add reporting to CSP:
```
Content-Security-Policy: ...; report-uri /csp-report;
```

### Report-To API

Modern alternative:
```
Content-Security-Policy: ...; report-to csp-endpoint;
Report-To: {"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"https://your-domain.com/csp-report"}]}
```

---

## Resources

- [MDN CSP Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [Report URI Service](https://report-uri.com/)

---

**Last Updated:** November 27, 2024  
**Status:** Development CSP Active, Production CSP Documented

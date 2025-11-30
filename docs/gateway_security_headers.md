# Gateway/LB Security Headers (Phase 1)

## Headers to enforce at the gateway/load balancer
- `Content-Security-Policy`: e.g. `default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://*.supabase.co; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`
- `Strict-Transport-Security`: `max-age=31536000; includeSubDomains; preload`
- `X-Frame-Options`: `DENY`
- `X-Content-Type-Options`: `nosniff`
- `Referrer-Policy`: `strict-origin-when-cross-origin`

## Validation
```bash
curl -I https://your-gateway.example.com/ | grep -Ei 'content-security-policy|strict-transport-security|x-frame-options|x-content-type-options|referrer-policy'
```

## Notes
- Configure these at the edge (Nginx/Envoy/Istio/Varnish/CDN) to cover every response, not just app-level middleware.
- Keep CSP aligned with the app’s allowed origins/endpoints (connect-src should include your APIs/WS endpoints as needed).

